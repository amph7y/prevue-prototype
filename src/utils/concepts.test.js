// Tests for the Step 1 concept helpers.
// Run from the project folder with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_CONCEPTS,
    MAX_ANSWER_SUGGESTIONS,
    CONCEPT_PALETTE,
    findPhrase,
    buildQuestionSegments,
    questionLayout,
    conceptParts,
    isLittleWord,
    addConcepts,
    appendExistingConcepts,
    joinConcepts,
    joinPicked,
    joinNeighbors,
    splitConceptAt,
    separateConcept,
    renameConcept,
    toggleConcept,
    activeConcepts,
    makeConceptAssist,
    normalizeConceptAssist,
    answerFollowUp,
    answerSuggestionNames,
    addAnswerSuggestions,
    setAnswerSuggestionStatus,
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

const wordStart = (segments, word) => segments.find((s) => s.kind === 'word' && s.text === word).start;
const pieceTexts = (question, concepts, id) => buildQuestionSegments(question, concepts)
    .filter((s) => s.kind === 'concept' && s.conceptId === id)
    .map((s) => s.text);

// ---------- Highlighting ----------

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
    assert.deepEqual(conceptSegments[0].words.map((w) => w.text), ['social', 'determinants', 'of', 'health']);
    assert.deepEqual(segments.filter((s) => s.kind === 'word').map((s) => s.text), ['What', 'are', 'the', 'impact', 'of', 'on']);
    assert.equal(segments.map((s) => s.text).join(''), QUESTION, 'segments must rebuild the exact question');
});

test('buildQuestionSegments: turned-off concepts stay highlighted; overlaps and old PICO names are handled', () => {
    const mockup = conceptsFromMockup();
    const concepts = toggleConcept(mockup, mockup[0].id);
    assert.equal(concepts[0].active, false);
    const list = addConcepts(concepts, [{ name: 'health', questionText: 'health' }]).concepts;
    const segments = buildQuestionSegments(QUESTION, list);
    assert.equal(segments.filter((s) => s.kind === 'concept').length, 2, 'overlapping "health" should not be highlighted twice');

    const oldProject = normalizeLoadedConcepts([{ id: 'p1', name: 'medication non-adherance', type: 'outcome' }]);
    const oldSegments = buildQuestionSegments(QUESTION, oldProject);
    assert.equal(oldSegments.find((s) => s.kind === 'concept').conceptId, 'p1', 'old concepts are found by name');
});

test('conceptParts: new pieces, older single questionText, or none for typed-in concepts', () => {
    assert.deepEqual(conceptParts({ name: 'x', questionParts: ['older', ' adults '] }), ['older', 'adults']);
    assert.deepEqual(conceptParts({ name: 'x', questionText: 'medication non-adherance' }), ['medication non-adherance']);
    assert.deepEqual(conceptParts({ name: 'x' }), []);
    assert.deepEqual(conceptParts({ name: 'x', questionParts: 'broken', questionText: 5 }), []);
});

test('questionLayout: join icons only between neighbors with spaces or hyphens; punctuation stays text', () => {
    const question = 'Adults, children and teens?';
    const layout = questionLayout(buildQuestionSegments(question, []));
    assert.deepEqual(layout.map((item) => (item.type === 'chip' ? item.segment.text : item.type === 'join' ? '+' : item.text)),
        ['Adults', ', ', 'children', '+', 'and', '+', 'teens', '?']);
    const withConcept = questionLayout(buildQuestionSegments(QUESTION, conceptsFromMockup()));
    const join = withConcept.find((item) => item.type === 'join' && item.right.kind === 'concept');
    assert.equal(join.left.text, 'of');
});

// ---------- Adding ----------

test('addConcepts: skips duplicates, turns duplicates back on, stops at 25', () => {
    let result = addConcepts([], [{ name: ' Adults ' }, { name: 'adults' }, { name: '' }, { name: 'x'.repeat(151) }]);
    assert.equal(result.added, 1);
    assert.equal(result.duplicates, 1);
    assert.equal(result.concepts[0].name, 'Adults');

    const turnedOff = toggleConcept(result.concepts, result.concepts[0].id);
    result = addConcepts(turnedOff, [{ name: 'ADULTS' }]);
    assert.equal(result.reactivated, 1);
    assert.equal(activeConcepts(result.concepts).length, 1);

    assert.equal(MAX_CONCEPTS, 25);
    const many = Array.from({ length: MAX_CONCEPTS + 2 }, (_, i) => ({ name: `concept ${i}` }));
    result = addConcepts([], many);
    assert.equal(result.concepts.length, MAX_CONCEPTS);
    assert.equal(result.overLimit, 2);
});

test('colors: 17 clearly different colors, the first 10 unchanged for saved projects', () => {
    assert.equal(CONCEPT_PALETTE.length, 17);
    assert.equal(new Set(CONCEPT_PALETTE.map((c) => c.chip)).size, 17);
    assert.match(CONCEPT_PALETTE[0].chip, /green/);
    assert.match(CONCEPT_PALETTE[9].chip, /indigo/);
    const concepts = addConcepts([], Array.from({ length: 20 }, (_, i) => ({ name: `c${i}` }))).concepts;
    assert.equal(new Set(concepts.slice(0, 17).map((c) => c.colorIndex)).size, 17, 'the first 17 concepts get different colors');
    assert.ok(getConceptColor(concepts[19], 19).chip, 'later concepts reuse a color');
});

test('appendExistingConcepts: keeps ids and fixes color clashes', () => {
    const base = addConcepts([], [{ name: 'a' }, { name: 'b' }]).concepts;
    const kept = [{ id: 'manual-1', name: 'c', colorIndex: 0, keywords: [] }, { id: 'manual-2', name: 'A', colorIndex: 5 }];
    const list = appendExistingConcepts(base, kept);
    assert.deepEqual(list.map((c) => c.id).slice(2), ['manual-1']);
    assert.equal(list[2].colorIndex, 2, 'color 0 was taken, so the next free color is used');
});

test('renameConcept: rejects empty, too long and duplicate names', () => {
    const concepts = addConcepts([], [{ name: 'a' }, { name: 'b' }]).concepts;
    assert.match(renameConcept(concepts, concepts[0].id, '   ').error, /cannot be empty/);
    assert.match(renameConcept(concepts, concepts[0].id, 'x'.repeat(151)).error, /up to 150/);
    assert.match(renameConcept(concepts, concepts[0].id, 'B').error, /already have/);
    assert.equal(renameConcept(concepts, concepts[0].id, ' new  name ').concepts[0].name, 'new name');
});

// ---------- Joining ----------

test('joinConcepts: neighbors become one bubble, keywords are combined, applied straight away', () => {
    let concepts = addConcepts([], [
        { name: 'medication', questionText: 'medication' },
        { name: 'non-adherence', questionText: 'non-adherance' },
        { name: 'Adults' },
    ]).concepts;
    concepts = concepts.map((c, i) => ({ ...c, keywords: [{ term: `t${i}`, active: true }, { term: 'shared', active: true }] }));
    const result = joinConcepts(concepts, [concepts[1].id, concepts[0].id], QUESTION);
    assert.equal(result.error, null);
    assert.equal(result.concepts.length, 2);
    const joined = result.concepts[0];
    assert.equal(joined.id, result.joinedId);
    assert.equal(joined.name, 'medication non-adherence', 'names are ordered as in the question');
    assert.deepEqual(joined.questionParts, ['medication non-adherance'], 'neighbors become one piece');
    assert.equal(joined.colorIndex, concepts[0].colorIndex);
    assert.deepEqual(joined.keywords.map((k) => k.term), ['t0', 'shared', 't1']);
    assert.deepEqual(pieceTexts(QUESTION, result.concepts, joined.id), ['medication non-adherance']);

    const withTyped = joinConcepts(result.concepts, result.concepts.map((c) => c.id), QUESTION);
    assert.equal(withTyped.concepts[0].name, 'medication non-adherence Adults', 'concepts not in the question go last');
    assert.match(joinConcepts(concepts, [concepts[0].id], QUESTION).error, /at least two/);
});

test('joinPicked: words that are apart become one concept with a highlighted piece for each', () => {
    const question = 'Exercise in older and younger adults with type 2 diabetes';
    const segments = buildQuestionSegments(question, []);
    const result = joinPicked([], question, { wordStarts: [wordStart(segments, 'older'), wordStart(segments, 'adults')] });
    assert.equal(result.error, null);
    const [concept] = result.concepts;
    assert.equal(concept.name, 'older adults');
    assert.deepEqual(concept.questionParts, ['older', 'adults']);
    assert.equal(concept.source, 'words');
    assert.deepEqual(pieceTexts(question, result.concepts, concept.id), ['older', 'adults']);
    const plain = buildQuestionSegments(question, result.concepts).filter((s) => s.kind === 'word').map((s) => s.text);
    assert.ok(plain.includes('and') && plain.includes('younger'), 'the words in between stay plain');

    // Mixing a concept and words: "type 2" + "diabetes"
    const typeTwo = joinPicked(result.concepts, question, { wordStarts: [wordStart(segments, 'type'), wordStart(segments, '2')] });
    assert.equal(typeTwo.concepts[1].name, 'type 2');
    const segments2 = buildQuestionSegments(question, typeTwo.concepts);
    const full = joinPicked(typeTwo.concepts, question, { conceptIds: [typeTwo.concepts[1].id], wordStarts: [wordStart(segments2, 'diabetes')] });
    assert.equal(full.concepts[1].name, 'type 2 diabetes');
    assert.deepEqual(full.concepts[1].questionParts, ['type 2 diabetes'], 'neighbors merge into one piece');
    assert.equal(full.concepts.length, 2);
});

test('joinPicked: refuses duplicates, single picks and going over 25', () => {
    const question = 'older adults and older people';
    const segments = buildQuestionSegments(question, []);
    const first = joinPicked([], question, { wordStarts: [segments[0].start, wordStart(segments, 'adults')] });
    assert.equal(first.concepts[0].name, 'older adults');
    const segments2 = buildQuestionSegments(question, first.concepts);
    const olderAgain = segments2.filter((s) => s.kind === 'word' && s.text === 'older')[0].start;
    assert.match(joinPicked(first.concepts, question, { wordStarts: [olderAgain] }).error, /at least two/);

    const full = addConcepts([], Array.from({ length: MAX_CONCEPTS }, (_, i) => ({ name: `c${i}` }))).concepts;
    const two = buildQuestionSegments('alpha beta', full);
    assert.match(joinPicked(full, 'alpha beta', { wordStarts: two.filter((s) => s.kind === 'word').map((s) => s.start) }).error, /up to 25/);

    const named = addConcepts([], [{ name: 'alpha beta' }]).concepts;
    const words = buildQuestionSegments('alpha gamma beta', named).filter((s) => s.kind === 'word');
    assert.match(joinPicked(named, 'alpha gamma beta', { wordStarts: [words[0].start, words[2].start] }).error, /already have a concept called "alpha beta"/);
});

test('joinNeighbors: word + word, word + concept (keeps spelling fixes), concept + concept', () => {
    const question = 'Impact of daily social media use on sleep';
    let concepts = addConcepts([], [{ name: 'social media', questionText: 'social media', source: 'question' }]).concepts;
    let segments = buildQuestionSegments(question, concepts);
    const media = segments.find((s) => s.kind === 'concept');

    let result = joinNeighbors(concepts, question, media.start, wordStart(segments, 'use'));
    assert.equal(result.error, null);
    assert.equal(result.concepts[0].name, 'social media use');
    concepts = result.concepts;
    segments = buildQuestionSegments(question, concepts);
    result = joinNeighbors(concepts, question, wordStart(segments, 'daily'), segments.find((s) => s.kind === 'concept').start);
    assert.equal(result.concepts[0].name, 'daily social media use');
    assert.deepEqual(result.concepts[0].questionParts, ['daily social media use']);
    assert.equal(result.concepts[0].colorIndex, concepts[0].colorIndex, 'the concept keeps its color');

    segments = buildQuestionSegments(question, []);
    result = joinNeighbors([], question, wordStart(segments, 'on'), wordStart(segments, 'sleep'));
    assert.equal(result.concepts[0].name, 'on sleep');

    // Spelling fixes from the AI are kept: "non-adherance" in the question, "non-adherence" in the name
    const mockup = conceptsFromMockup();
    const mockSegments = buildQuestionSegments(QUESTION, mockup);
    const fixed = joinNeighbors(mockup, QUESTION, wordStart(mockSegments, 'on'), mockSegments.filter((s) => s.kind === 'concept')[1].start);
    assert.equal(fixed.concepts[1].name, 'on medication non-adherence');

    // Two concepts next to each other
    const pair = addConcepts([], [{ name: 'medication', questionText: 'medication' }, { name: 'non-adherence', questionText: 'non-adherance' }]).concepts;
    const pairSegments = buildQuestionSegments(QUESTION, pair).filter((s) => s.kind === 'concept');
    const joinedPair = joinNeighbors(pair, QUESTION, pairSegments[0].start, pairSegments[1].start);
    assert.equal(joinedPair.concepts.length, 1);
    assert.equal(joinedPair.concepts[0].name, 'medication non-adherence');
});

test('joinNeighbors: words with punctuation between them, or far apart, are not joined here', () => {
    const question = 'Adults, children and teens';
    const segments = buildQuestionSegments(question, []);
    assert.match(joinNeighbors([], question, wordStart(segments, 'Adults'), wordStart(segments, 'children')).error, /next to each other/);
    assert.match(joinNeighbors([], question, wordStart(segments, 'children'), wordStart(segments, 'teens')).error, /next to each other/);
});

// ---------- Splitting and separating ----------

test('splitConceptAt: cuts between two words; small words at the edges go back to plain text', () => {
    const concepts = conceptsFromMockup();
    const original = concepts[0];
    const segments = buildQuestionSegments(QUESTION, concepts);
    const piece = segments.find((s) => s.kind === 'concept' && s.conceptId === original.id);
    const ofWord = piece.words.find((w) => w.text === 'of');

    const result = splitConceptAt(concepts, QUESTION, original.id, ofWord.start);
    assert.equal(result.error, null);
    assert.deepEqual(result.concepts.map((c) => c.name), ['social determinants', 'health', 'medication non-adherence']);
    assert.equal(result.concepts[0].id, original.id, 'the first part keeps the id');
    assert.equal(result.concepts[0].colorIndex, original.colorIndex, 'and the color');
    assert.notEqual(result.concepts[1].colorIndex, original.colorIndex);
    const plain = buildQuestionSegments(QUESTION, result.concepts).filter((s) => s.kind === 'word').map((s) => s.text);
    assert.deepEqual(plain, ['What', 'are', 'the', 'impact', 'of', 'of', 'on'], '"of" is plain text again');

    // Splitting keeps the AI's spelling fix
    const med = buildQuestionSegments(QUESTION, concepts).find((s) => s.kind === 'concept' && s.conceptId === concepts[1].id);
    const medSplit = splitConceptAt(concepts, QUESTION, concepts[1].id, med.words[1].start);
    assert.deepEqual(medSplit.concepts.slice(1).map((c) => c.name), ['medication', 'non-adherence']);
});

test('splitConceptAt: a turned-off concept stays off; a cut must be inside; the 25 limit applies', () => {
    const mockup = conceptsFromMockup();
    const concepts = toggleConcept(mockup, mockup[1].id);
    const med = buildQuestionSegments(QUESTION, concepts).find((s) => s.kind === 'concept' && s.conceptId === concepts[1].id);
    const result = splitConceptAt(concepts, QUESTION, concepts[1].id, med.words[1].start);
    assert.deepEqual(result.concepts.slice(1).map((c) => c.active), [false, false]);
    assert.match(splitConceptAt(concepts, QUESTION, concepts[1].id, med.words[0].start).error, /between two words/);

    const filler = Array.from({ length: MAX_CONCEPTS - 2 }, (_, i) => ({ name: `filler ${i}` }));
    const full = addConcepts(conceptsFromMockup(), filler).concepts;
    const fullMed = buildQuestionSegments(QUESTION, full).find((s) => s.kind === 'concept' && s.conceptId === full[1].id);
    assert.match(splitConceptAt(full, QUESTION, full[1].id, fullMed.words[1].start).error, /up to 25/);
});

test('splitConceptAt: a concept from words that are apart is cut in word order', () => {
    const question = 'Exercise for type 2 adults with diabetes';
    const segments = buildQuestionSegments(question, []);
    const picked = joinPicked([], question, {
        wordStarts: ['type', '2', 'diabetes'].map((w) => wordStart(segments, w)),
    }).concepts;
    assert.equal(picked[0].name, 'type 2 diabetes');
    assert.deepEqual(picked[0].questionParts, ['type 2', 'diabetes']);
    const piece = buildQuestionSegments(question, picked).find((s) => s.kind === 'concept' && s.text === 'type 2');
    const result = splitConceptAt(picked, question, picked[0].id, piece.words[1].start);
    assert.deepEqual(result.concepts.map((c) => c.name), ['type', '2 diabetes']);
    assert.deepEqual(result.concepts[1].questionParts, ['2', 'diabetes']);
});

test('separateConcept: a concept joined from separate places goes back to its pieces', () => {
    const question = 'Exercise in older and younger adults';
    const segments = buildQuestionSegments(question, []);
    const joined = joinPicked([], question, { wordStarts: [wordStart(segments, 'older'), wordStart(segments, 'adults')] }).concepts;
    const result = separateConcept(joined, joined[0].id);
    assert.equal(result.error, null);
    assert.deepEqual(result.concepts.map((c) => c.name), ['older', 'adults']);
    assert.equal(result.concepts[0].id, joined[0].id);
    assert.deepEqual(result.concepts.map((c) => c.questionParts), [['older'], ['adults']]);
    assert.match(separateConcept(result.concepts, result.concepts[0].id).error, /only one part/);
    assert.ok(isLittleWord('Of') && isLittleWord('في') && !isLittleWord('adults'));
});

// ---------- Follow-up questions ----------

test('makeConceptAssist and normalizeConceptAssist: limits, no repeats, safe with bad saved data', () => {
    const concepts = conceptsFromMockup();
    const assist = makeConceptAssist(QUESTION, {
        followUpQuestions: ['Who?', 'Where?', 'When?', 'Which design?', 'Extra?'],
        suggestedConcepts: ['health literacy', 'Social determinants of health', 7],
    }, concepts);
    assert.equal(assist.followUps.length, 4);
    assert.deepEqual(assist.followUps[0].suggestions, []);
    assert.deepEqual(assist.suggestions.map((s) => s.name), ['health literacy']);

    assert.deepEqual(normalizeConceptAssist(null), { analyzedQuestion: '', followUps: [], suggestions: [] });
    assert.deepEqual(normalizeConceptAssist('broken'), { analyzedQuestion: '', followUps: [], suggestions: [] });
    const restored = normalizeConceptAssist({
        followUps: [
            {
                id: 'f1', question: 'Who?', answer: 'x'.repeat(400), status: 'hacked',
                suggestions: [...Array.from({ length: 10 }, (_, i) => ({ name: `s${i}`, status: 'weird' })), { name: 3 }],
            },
            { question: '' },
            { id: 'f2', question: 'Old answered question', answer: 'Adults', status: 'answered' },
        ],
        suggestions: [{ name: 'a', status: 'added' }, { name: 5 }],
    });
    assert.equal(restored.followUps.length, 2);
    assert.equal(restored.followUps[0].status, 'open');
    assert.equal(restored.followUps[0].answer.length, 300);
    assert.equal(restored.followUps[0].suggestions.length, MAX_ANSWER_SUGGESTIONS);
    assert.equal(restored.followUps[0].suggestions[0].status, 'open');
    assert.deepEqual(restored.followUps[1].suggestions, [], 'answers saved by the previous version still load');
    assert.equal(restored.suggestions[0].status, 'added');
    assert.ok(restored.suggestions[0].id);
});

test('answerFollowUp: suggestions wait under the question; editing replaces them', () => {
    const concepts = addConcepts([], [{ name: 'Adults' }]).concepts;
    let assist = makeConceptAssist(QUESTION, { followUpQuestions: ['Which age groups?'] }, concepts);
    const id = assist.followUps[0].id;

    assert.deepEqual(answerSuggestionNames(['Adults', 'Children', 'children', '', 'Older adults'], concepts), ['Children', 'Older adults']);
    assist = answerFollowUp(assist, id, ' all ', ['Infants', 'Children', 'Adolescents', 'Adults', 'Older adults'], concepts);
    const followUp = assist.followUps[0];
    assert.equal(followUp.status, 'answered');
    assert.equal(followUp.answer, 'all');
    assert.deepEqual(followUp.suggestions.map((s) => s.name), ['Infants', 'Children', 'Adolescents', 'Older adults']);
    assert.ok(followUp.suggestions.every((s) => s.status === 'open'));

    // Confirm two, dismiss one
    const [infants, children, adolescents] = followUp.suggestions;
    const added = addAnswerSuggestions(concepts, assist, id, [infants.id, children.id]);
    assert.equal(added.added, 2);
    assert.deepEqual(added.concepts.map((c) => c.name), ['Adults', 'Infants', 'Children']);
    assert.ok(added.concepts.slice(1).every((c) => c.source === 'answer'));
    assist = setAnswerSuggestionStatus(added.assist, id, adolescents.id, 'dismissed');
    assert.deepEqual(assist.followUps[0].suggestions.map((s) => s.status), ['added', 'added', 'dismissed', 'open']);

    // Editing the answer replaces the suggestions; concepts already added stay
    assist = answerFollowUp(assist, id, 'children only', ['Children', 'School-age children'], added.concepts);
    assert.equal(assist.followUps[0].answer, 'children only');
    assert.deepEqual(assist.followUps[0].suggestions.map((s) => s.name), ['School-age children']);
    assert.equal(added.concepts.length, 3);

    // Up to 8 suggestions per answer
    const many = Array.from({ length: 12 }, (_, i) => `group ${i}`);
    assert.equal(answerFollowUp(assist, id, 'all', many, []).followUps[0].suggestions.length, MAX_ANSWER_SUGGESTIONS);
});

test('addAnswerSuggestions: stops at 25 and leaves the rest waiting', () => {
    const full = addConcepts([], Array.from({ length: MAX_CONCEPTS - 1 }, (_, i) => ({ name: `c${i}` }))).concepts;
    let assist = makeConceptAssist(QUESTION, { followUpQuestions: ['Where?'] }, full);
    const id = assist.followUps[0].id;
    assist = answerFollowUp(assist, id, 'GCC', ['Qatar', 'Kuwait'], full);
    const ids = assist.followUps[0].suggestions.map((s) => s.id);
    const result = addAnswerSuggestions(full, assist, id, ids);
    assert.equal(result.added, 1);
    assert.equal(result.overLimit, 1);
    assert.equal(result.concepts.length, MAX_CONCEPTS);
    assert.deepEqual(result.assist.followUps[0].suggestions.map((s) => s.status), ['added', 'open']);
});

// ---------- Saved projects and AI requests ----------

test('normalizeLoadedConcepts: old PICO concepts keep their data and get a color', () => {
    const loaded = normalizeLoadedConcepts([
        { id: 'p1', name: 'adults', type: 'population', keywords: [{ term: 'adult', active: true }] },
        { name: 'no id', keywords: 'broken', questionParts: ['ok', 7, ''] },
        null,
        { id: 'x' },
    ]);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].type, 'population');
    assert.equal(loaded[0].keywords.length, 1);
    assert.equal(loaded[0].colorIndex, 0);
    assert.deepEqual(loaded[0].questionParts, []);
    assert.ok(loaded[1].id);
    assert.deepEqual(loaded[1].keywords, []);
    assert.deepEqual(loaded[1].questionParts, ['ok']);
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

test('keyword request and results: temporary ids, up to 25 concepts, turned-off concepts get no keywords', () => {
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

    const many = addConcepts([], Array.from({ length: MAX_CONCEPTS }, (_, i) => ({ name: `concept ${i}` }))).concepts;
    assert.equal(buildKeywordRequest(many).requestConcepts.length, 25);
});
