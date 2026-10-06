// Tests for the Step 1 concept helpers.
// Run from the project folder with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_CONCEPTS,
    CONCEPT_PALETTE,
    findPhrase,
    buildQuestionSegments,
    phrasesFromSelection,
    addConcepts,
    appendExistingConcepts,
    joinConcepts,
    renameConcept,
    toggleConcept,
    activeConcepts,
    makeConceptAssist,
    normalizeConceptAssist,
    normalizeLoadedConcepts,
    buildAiContext,
    buildKeywordRequest,
    applyKeywordResults,
    countKeywords,
    getConceptColor,
} from './concepts.js';

const QUESTION = 'What are the impact of social determinants of health on medication non-adherance?';

const conceptsFromMockup = () => addConcepts([], [
    { name: 'social determinants of health', questionText: 'social determinants of health', source: 'question' },
    { name: 'medication non-adherence', questionText: 'medication non-adherance', source: 'question' },
]).concepts;

test('findPhrase: ignores capital letters and spacing, matches whole words, skips taken spans', () => {
    const at = (phrase) => ({ start: QUESTION.indexOf(phrase), end: QUESTION.indexOf(phrase) + phrase.length });
    assert.deepEqual(findPhrase(QUESTION, 'Social Determinants  of Health'), at('social determinants of health'));
    assert.deepEqual(findPhrase(QUESTION, 'medication non adherance'), at('medication non-adherance'));
    assert.equal(findPhrase(QUESTION, 'medication non-adherence'), null, 'different spelling should not match');
    assert.equal(findPhrase('Adulthood studies', 'adult'), null, 'should not match part of a word');
    assert.equal(findPhrase(QUESTION, 'health', [at('social determinants of health')]), null, 'taken span should be skipped');
    assert.equal(findPhrase(QUESTION, 'a.b*c(d)'), null, 'special characters are treated as text');
    assert.equal(findPhrase('', 'x'), null);
});

test('buildQuestionSegments: highlights concepts and splits the rest into words and gaps', () => {
    const concepts = conceptsFromMockup();
    const segments = buildQuestionSegments(QUESTION, concepts);
    const conceptSegments = segments.filter((s) => s.kind === 'concept');
    assert.deepEqual(conceptSegments.map((s) => s.text), ['social determinants of health', 'medication non-adherance']);
    assert.deepEqual(segments.filter((s) => s.kind === 'word').map((s) => s.text), ['What', 'are', 'the', 'impact', 'of', 'on']);
    assert.equal(segments.map((s) => s.text).join(''), QUESTION, 'segments must rebuild the exact question');
});

test('buildQuestionSegments: turned-off concepts stay highlighted; overlaps and old PICO names are handled', () => {
    const concepts = toggleConcept(conceptsFromMockup(), conceptsFromMockup()[0].id);
    const list = addConcepts(concepts, [{ name: 'health', questionText: 'health' }]).concepts;
    const segments = buildQuestionSegments(QUESTION, list);
    assert.equal(segments.filter((s) => s.kind === 'concept').length, 2, 'overlapping "health" should not be highlighted twice');

    const oldProject = normalizeLoadedConcepts([{ id: 'p1', name: 'medication non-adherance', type: 'outcome' }]);
    const oldSegments = buildQuestionSegments(QUESTION, oldProject);
    assert.equal(oldSegments.find((s) => s.kind === 'concept').conceptId, 'p1', 'old concepts are found by name');
});

test('phrasesFromSelection: neighbouring words join; punctuation and concepts break phrases', () => {
    const segments = buildQuestionSegments(QUESTION, conceptsFromMockup());
    const startOf = (word) => segments.find((s) => s.kind === 'word' && s.text === word).start;
    assert.deepEqual(phrasesFromSelection(QUESTION, segments, [startOf('the'), startOf('impact')]).map((p) => p.text), ['the impact']);
    assert.deepEqual(phrasesFromSelection(QUESTION, segments, [startOf('What'), startOf('impact')]).map((p) => p.text), ['What', 'impact']);
    assert.deepEqual(phrasesFromSelection(QUESTION, segments, [startOf('of'), startOf('on')]).map((p) => p.text), ['of', 'on'], 'a concept between words splits them');

    const commaQuestion = 'adults, children and teens';
    const commaSegments = buildQuestionSegments(commaQuestion, []);
    const all = commaSegments.filter((s) => s.kind === 'word').map((s) => s.start);
    assert.deepEqual(phrasesFromSelection(commaQuestion, commaSegments, all).map((p) => p.text), ['adults', 'children and teens']);
});

test('addConcepts: skips duplicates, turns duplicates back on, stops at the limit, unique colors', () => {
    let result = addConcepts([], [{ name: ' Adults ' }, { name: 'adults' }, { name: '' }, { name: 'x'.repeat(151) }]);
    assert.equal(result.added, 1);
    assert.equal(result.duplicates, 1);
    assert.equal(result.concepts[0].name, 'Adults');

    const turnedOff = toggleConcept(result.concepts, result.concepts[0].id);
    result = addConcepts(turnedOff, [{ name: 'ADULTS' }]);
    assert.equal(result.reactivated, 1);
    assert.equal(activeConcepts(result.concepts).length, 1);

    const many = Array.from({ length: 12 }, (_, i) => ({ name: `concept ${i}` }));
    result = addConcepts([], many);
    assert.equal(result.concepts.length, MAX_CONCEPTS);
    assert.equal(result.overLimit, 2);
    assert.equal(new Set(result.concepts.map((c) => c.colorIndex)).size, MAX_CONCEPTS, 'each concept gets its own color');
    assert.ok(MAX_CONCEPTS <= CONCEPT_PALETTE.length);
});

test('appendExistingConcepts: keeps ids and fixes color clashes', () => {
    const base = addConcepts([], [{ name: 'a' }, { name: 'b' }]).concepts;
    const kept = [{ id: 'manual-1', name: 'c', colorIndex: 0, keywords: [] }, { id: 'manual-2', name: 'A', colorIndex: 5 }];
    const list = appendExistingConcepts(base, kept);
    assert.deepEqual(list.map((c) => c.id).slice(2), ['manual-1']);
    assert.equal(list[2].colorIndex, 2, 'color 0 was taken, so the next free color is used');
});

test('joinConcepts: words in the question become one bubble; keywords are combined', () => {
    let concepts = addConcepts([], [
        { name: 'medication', questionText: 'medication' },
        { name: 'non-adherence', questionText: 'non-adherance' },
        { name: 'Adults' },
    ]).concepts;
    concepts = concepts.map((c, i) => ({ ...c, keywords: [{ term: `t${i}`, active: true }, { term: 'shared', active: true }] }));
    const ids = [concepts[1].id, concepts[0].id];
    const result = joinConcepts(concepts, ids, QUESTION);
    assert.equal(result.error, null);
    assert.equal(result.concepts.length, 2);
    const joined = result.concepts[0];
    assert.equal(joined.id, result.joinedId);
    assert.equal(joined.name, 'medication non-adherence', 'names are ordered as in the question');
    assert.equal(joined.questionText, 'medication non-adherance');
    assert.deepEqual(joined.keywords.map((k) => k.term), ['t0', 'shared', 't1']);
    assert.equal(result.concepts[1].name, 'Adults');

    const segments = buildQuestionSegments(QUESTION, result.concepts);
    assert.ok(segments.some((s) => s.kind === 'concept' && s.text === 'medication non-adherance'));

    const notInQuestion = joinConcepts(result.concepts, result.concepts.map((c) => c.id), QUESTION);
    assert.equal(notInQuestion.concepts[0].name, 'medication non-adherence Adults');
    assert.equal(notInQuestion.concepts[0].questionText, '');

    assert.match(joinConcepts(concepts, [concepts[0].id], QUESTION).error, /at least two/);
});

test('renameConcept: rejects empty, too long and duplicate names', () => {
    const concepts = addConcepts([], [{ name: 'a' }, { name: 'b' }]).concepts;
    assert.match(renameConcept(concepts, concepts[0].id, '   ').error, /cannot be empty/);
    assert.match(renameConcept(concepts, concepts[0].id, 'x'.repeat(151)).error, /up to 150/);
    assert.match(renameConcept(concepts, concepts[0].id, 'B').error, /already have/);
    assert.equal(renameConcept(concepts, concepts[0].id, ' new  name ').concepts[0].name, 'new name');
});

test('makeConceptAssist and normalizeConceptAssist: limits, no repeats, safe with bad saved data', () => {
    const concepts = conceptsFromMockup();
    const assist = makeConceptAssist(QUESTION, {
        followUpQuestions: ['Who?', 'Where?', 'When?', 'Which design?', 'Extra?'],
        suggestedConcepts: ['health literacy', 'Social determinants of health', 7],
    }, concepts);
    assert.equal(assist.followUps.length, 4);
    assert.deepEqual(assist.suggestions.map((s) => s.name), ['health literacy']);

    assert.deepEqual(normalizeConceptAssist(null), { analyzedQuestion: '', followUps: [], suggestions: [] });
    assert.deepEqual(normalizeConceptAssist('broken'), { analyzedQuestion: '', followUps: [], suggestions: [] });
    const restored = normalizeConceptAssist({
        followUps: [{ id: 'f1', question: 'Who?', answer: 'x'.repeat(400), status: 'hacked' }, { question: '' }],
        suggestions: [{ name: 'a', status: 'added' }, { name: 5 }],
    });
    assert.equal(restored.followUps.length, 1);
    assert.equal(restored.followUps[0].status, 'open');
    assert.equal(restored.followUps[0].answer.length, 300);
    assert.equal(restored.suggestions[0].status, 'added');
    assert.ok(restored.suggestions[0].id);
});

test('normalizeLoadedConcepts: old PICO concepts keep their data and get a color', () => {
    const loaded = normalizeLoadedConcepts([
        { id: 'p1', name: 'adults', type: 'population', keywords: [{ term: 'adult', active: true }] },
        { name: 'no id', keywords: 'broken' },
        null,
        { id: 'x' },
    ]);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].type, 'population');
    assert.equal(loaded[0].keywords.length, 1);
    assert.equal(loaded[0].colorIndex, 0);
    assert.ok(loaded[1].id);
    assert.deepEqual(loaded[1].keywords, []);
    assert.ok(getConceptColor(loaded[1], 1).chip);
});

test('buildAiContext: sends text only, and uses negative keywords when no undesired outcomes are set', () => {
    assert.deepEqual(buildAiContext({ discipline: 'Pharmacy', outcomesNeeded: ['a', 1, 'b'], questionTemplate: 'PICO' }, ['children', '', 3]), {
        projectType: '',
        discipline: 'Pharmacy',
        desiredOutcomes: 'a, b',
        undesiredOutcomes: 'children',
        questionTemplate: 'PICO',
    });
});

test('keyword request and results: temporary ids, turned-off concepts get no keywords', () => {
    let concepts = addConcepts([], [{ name: 'Adults' }, { name: 'Arab Countries' }, { name: 'Off' }]).concepts;
    concepts = toggleConcept(concepts, concepts[2].id);
    concepts[2] = { ...concepts[2], keywords: [{ term: 'old', active: true }] };

    const { requestConcepts, idMap } = buildKeywordRequest(concepts);
    assert.deepEqual(requestConcepts, [{ id: 'c1', name: 'Adults' }, { id: 'c2', name: 'Arab Countries' }]);

    const updated = applyKeywordResults(concepts, [
        { id: 'c2', terms: ['Middle East', ''], controlledVocabulary: [{ term: 'Arabs', type: 'MeSH' }, { term: 5 }] },
        { id: 'c1', terms: ['adult'] },
        { id: '__proto__', terms: ['ignored'] },
        { id: 'c9', terms: ['ignored'] },
    ], idMap);
    assert.deepEqual(updated[0].keywords, [{ term: 'adult', active: true, source: 'ai', searchField: 4 }]);
    assert.deepEqual(updated[1].keywords.map((k) => k.term), ['Middle East']);
    assert.deepEqual(updated[1].controlled_vocabulary, [{ term: 'Arabs', type: 'MeSH', active: true, source: 'ai' }]);
    assert.deepEqual(updated[2].keywords, []);
    assert.equal(countKeywords(updated), 2);
});
