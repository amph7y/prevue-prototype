// Tests for coloring edited searches: npm test
import assert from 'node:assert/strict';
import test from 'node:test';

import { highlightSearch } from './searchHighlight.js';
import { EXAMPLE_SEARCH, TRANSLATOR_DATABASES, translateSearch } from './searchTranslator.js';

const kinds = (text, key) => highlightSearch(text, key).filter((p) => p.kind !== 'term').map((p) => [p.text, p.kind]);

test('each database\'s operators, field codes and headings are colored', () => {
    assert.deepEqual(kinds('("Acne"[Mesh] OR acne[tiab]) AND light', 'pubmed'),
        [['(', 'paren'], ['[Mesh]', 'field'], ['OR', 'operator'], ['[tiab]', 'field'], [')', 'paren'], ['AND', 'operator']]);
    assert.deepEqual(kinds('exp Acne Vulgaris/ or (blue adj3 light).ti,ab.', 'ovidMedline'),
        [['exp', 'heading'], ['Acne Vulgaris/', 'heading'], ['or', 'operator'], ['(', 'paren'], ['adj3', 'operator'], [')', 'paren'], ['.ti,ab.', 'field']]);
    assert.deepEqual(kinds("'acne'/exp OR acne:ti,ab,kw", 'embase'), [["'acne'/exp", 'heading'], ['OR', 'operator'], [':ti,ab,kw', 'field']]);
    assert.deepEqual(kinds('[mh "Acne"] OR (a NEAR/3 b):ti', 'cochrane'),
        [['[mh "Acne"]', 'heading'], ['OR', 'operator'], ['(', 'paren'], ['NEAR/3', 'operator'], [')', 'paren'], [':ti', 'field']]);
    assert.deepEqual(kinds('(MH "Acne+") OR TI (a N3 b)', 'cinahl'),
        [['(MH "Acne+")', 'heading'], ['OR', 'operator'], ['TI', 'field'], ['(', 'paren'], ['N3', 'operator'], [')', 'paren']]);
    assert.deepEqual(kinds('TS=(a NEAR/2 b)', 'webOfScience'), [['TS=', 'field'], ['(', 'paren'], ['NEAR/2', 'operator'], [')', 'paren']]);
    assert.deepEqual(kinds('TITLE-ABS-KEY(a W/2 b) AND NOT INDEXTERMS("x")', 'scopus'),
        [['TITLE-ABS-KEY', 'field'], ['(', 'paren'], ['W/2', 'operator'], [')', 'paren'], ['AND NOT', 'operator'], ['INDEXTERMS', 'heading'], ['(', 'paren'], [')', 'paren']]);
    assert.deepEqual(kinds('intitle:acne -review', 'googleScholar'), [['intitle:', 'field'], ['-', 'operator']]);
});

test('words inside quotes and inside other words are not operators', () => {
    assert.deepEqual(kinds('"heart AND lung" OR Oregon', 'pubmed'), [['OR', 'operator']]);
    assert.deepEqual(kinds('ANDROGEN NOTCH', 'pubmed'), []);
});

test('the pieces always join back into the same text', () => {
    // Every translation of the example, and random text
    const { results } = translateSearch(EXAMPLE_SEARCH);
    for (const result of results) {
        assert.equal(highlightSearch(result.text, result.key).map((p) => p.text).join(''), result.text, result.key);
    }
    let seed = 42;
    const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const alphabet = ['a', 'b', ' ', '(', ')', '"', "'", '[', ']', ':', '.', ',', '/', '=', '-', '*', 'AND', 'OR', 'NOT', 'exp ', 'TI ',
        'NEAR/2', 'adj3', 'W/2', 'TS=', 'TITLE-ABS-KEY', '[mh ', 'MH "', 'intitle:', 'نوم', '\n', '\t', '$', '#', '?'];
    for (let i = 0; i < 3000; i += 1) {
        const text = Array.from({ length: Math.floor(random() * 25) }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
        for (const { key } of TRANSLATOR_DATABASES) {
            const pieces = highlightSearch(text, key);
            assert.equal(pieces.map((p) => p.text).join(''), text, `${key}: ${JSON.stringify(text)}`);
            assert.ok(pieces.every((p) => p.text.length > 0));
        }
    }
    assert.deepEqual(highlightSearch('', 'pubmed'), []);
    assert.deepEqual(highlightSearch(null, 'pubmed'), []);
});
