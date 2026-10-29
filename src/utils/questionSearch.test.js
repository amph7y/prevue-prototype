// Tests for turning a research question into a search: npm test
import assert from 'node:assert/strict';
import test from 'node:test';

import { QUESTION_AI_REQUESTS, QuestionSearchError, searchFromQuestion } from './questionSearch.js';
import { translateSearch } from './searchTranslator.js';

const QUESTION = 'Does telemedicine improve blood pressure control in older adults?';

// A stand-in for the AI that answers like the server does
function fakeAi({ concepts, keywords }) {
    const calls = [];
    const runTask = async (task, payload) => {
        calls.push({ task, payload: JSON.parse(JSON.stringify(payload)) });
        if (task === 'analyzeQuestion') return { concepts };
        if (task === 'generateKeywords') return { concepts: keywords(payload.concepts) };
        throw new Error(`unexpected task ${task}`);
    };
    return { runTask, calls };
}

const GOOD = {
    concepts: [
        { name: 'telemedicine', text: 'telemedicine' },
        { name: 'blood pressure control', text: 'blood pressure control' },
        { name: 'older adults', text: 'older adults' },
    ],
    keywords: (requested) => requested.map((concept) => ({
        id: concept.id,
        terms: concept.name === 'telemedicine' ? ['telemedicine', 'telehealth'] : [concept.name],
        controlledVocabulary: concept.name === 'telemedicine' ? [{ term: 'Telemedicine', type: 'MeSH' }] : [],
    })),
};

test('a question becomes a PubMed search with two AI requests, then translates for every database', async () => {
    const { runTask, calls } = fakeAi(GOOD);
    const { search, concepts } = await searchFromQuestion(`  ${QUESTION}\n`, runTask);
    assert.equal(calls.length, QUESTION_AI_REQUESTS);
    assert.deepEqual(calls.map((c) => c.task), ['analyzeQuestion', 'generateKeywords']);
    assert.deepEqual(calls[0].payload, { question: QUESTION, context: {} });
    assert.deepEqual(calls[1].payload.vocabulary, { mesh: true, emtree: false });
    assert.deepEqual(calls[1].payload.concepts.map((c) => c.name), ['telemedicine', 'blood pressure control', 'older adults']);
    assert.deepEqual(concepts, ['telemedicine', 'blood pressure control', 'older adults']);
    // Keywords search titles and abstracts; MeSH headings are included
    assert.match(search, /"Telemedicine"\[MeSH Terms\]/);
    assert.match(search, /"telehealth"\[tiab\]/);
    assert.ok(!search.includes('[all]'));
    const translated = translateSearch(search);
    assert.equal(translated.syntax.key, 'pubmed');
    const ovid = translated.results.find((r) => r.key === 'ovidMedline').oneLine;
    assert.match(ovid, /exp Telemedicine\//);
    assert.match(ovid, /\.ti,ab\./);
});

test('no concepts, no keywords, an empty or long question: clear messages, and no wasted AI requests', async () => {
    const none = fakeAi({ concepts: [], keywords: () => [] });
    await assert.rejects(searchFromQuestion(QUESTION, none.runTask), (e) => e instanceof QuestionSearchError && /couldn't find clear concepts/.test(e.message));
    assert.equal(none.calls.length, 1, 'keywords are not requested when there are no concepts');

    const empty = fakeAi({ concepts: GOOD.concepts, keywords: (requested) => requested.map((c) => ({ id: c.id, terms: [], controlledVocabulary: [] })) });
    await assert.rejects(searchFromQuestion(QUESTION, empty.runTask), /didn't return any keywords/);

    const unused = fakeAi(GOOD);
    await assert.rejects(searchFromQuestion('   ', unused.runTask), /Write your research question first/);
    await assert.rejects(searchFromQuestion('a'.repeat(1001), unused.runTask), /shorten your question to 1,000 characters/);
    assert.equal(unused.calls.length, 0);
});

test('odd AI replies are ignored safely', async () => {
    const odd = fakeAi({
        concepts: [null, { name: 42 }, { name: 'telemedicine', text: 5 }, 'x', { name: '' }],
        keywords: (requested) => [{ id: 'nope', terms: ['ignored'] }, { id: requested[0].id, terms: ['telehealth', 7, null], controlledVocabulary: [{ term: 3 }] }],
    });
    const { search, concepts } = await searchFromQuestion(QUESTION, odd.runTask);
    assert.deepEqual(concepts, ['telemedicine']);
    assert.equal(search, '("telehealth"[tiab])');
});

test('AI errors reach the caller unchanged', async () => {
    const failing = async () => { throw new Error('Too many requests. Please wait a minute.'); };
    await assert.rejects(searchFromQuestion(QUESTION, failing), /Too many requests/);
});
