// Tests for the Search Translator.
// Run from the project folder with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CHECK,
    EXAMPLE_SEARCH,
    MAX_SEARCH_CHARS,
    SearchSyntaxError,
    TRANSLATOR_DATABASES,
    collectLeaves,
    formatTree,
    parseSearch,
    translateSearch,
} from './searchTranslator.js';
import { buildQuery } from './queryBuilder.js';

const byKey = (search) => Object.fromEntries(translateSearch(search).results.map((r) => [r.key, r]));
const checkMessages = (result) => result.checks.map((c) => c.message);

// ---------- Reference translations ----------
// Checked against each database's search help and KU Leuven Libraries' syntax table.

test('the example search, written for all 12 databases', () => {
    const out = byKey(EXAMPLE_SEARCH);
    assert.deepEqual(Object.keys(out), TRANSLATOR_DATABASES.map((d) => d.key));
    const expected = {
        pubmed: '("Acne Vulgaris"[Mesh] OR acne[tiab]) AND ("blue light"[tiab] OR phototherap*[tiab] OR "photodynamic therapy"[tiab] OR "light therap*"[tiab])',
        ovidMedline: '(exp Acne Vulgaris/ OR acne.ti,ab.) AND ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*").ti,ab.',
        embase: "('Acne Vulgaris'/exp OR 'acne':ti,ab,kw) AND ('blue light' OR 'phototherap*' OR 'photodynamic therapy' OR 'light therap*'):ti,ab,kw",
        embaseOvid: '(exp Acne Vulgaris/ OR acne.ti,ab,kw.) AND ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*").ti,ab,kw.',
        cochrane: '([mh "Acne Vulgaris"] OR acne:ti,ab,kw) AND ("blue light" OR phototherap* OR "photodynamic therapy" OR (light NEXT therap*)):ti,ab,kw',
        cinahl: '((MH "Acne Vulgaris+") OR (TI acne OR AB acne)) AND (TI ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*") OR AB ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*"))',
        psycinfo: '(exp Acne Vulgaris/ OR acne.ti,ab,id.) AND ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*").ti,ab,id.',
        webOfScience: '(TS=("Acne Vulgaris") OR TS=(acne)) AND TS=("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*")',
        scopus: '(INDEXTERMS("Acne Vulgaris") OR TITLE-ABS-KEY(acne)) AND TITLE-ABS-KEY("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*")',
        core: '("Acne Vulgaris" OR acne) AND ("blue light" OR phototherap* OR "photodynamic therapy" OR "light therap*")',
        semanticScholar: '"Acne Vulgaris" "blue light"',
        googleScholar: '("Acne Vulgaris" OR acne) ("blue light" OR phototherap OR "photodynamic therapy" OR "light therap")',
    };
    for (const [key, oneLine] of Object.entries(expected)) assert.equal(out[key].oneLine, oneLine, key);
    // Concept blocks are on their own lines in the display
    assert.ok(out.ovidMedline.text.includes('\n\nAND\n\n'));
    assert.ok(!out.googleScholar.text.includes('\n'));
});

test('subject headings are flagged where the database uses a different thesaurus', () => {
    const out = byKey(EXAMPLE_SEARCH);
    assert.deepEqual(out.embase.checks, [{ message: CHECK.emtree, items: ['Acne Vulgaris'] }]);
    assert.deepEqual(checkMessages(out.embaseOvid), [CHECK.emtree]);
    assert.deepEqual(checkMessages(out.cinahl), [CHECK.cinahl]);
    assert.deepEqual(checkMessages(out.psycinfo), [CHECK.apa]);
    assert.deepEqual(checkMessages(out.webOfScience), [CHECK.wosHeading]);
    assert.deepEqual(checkMessages(out.scopus), [CHECK.scopusHeading]);
    // Ovid MEDLINE and Cochrane use MeSH itself: nothing to check
    assert.deepEqual(out.ovidMedline.checks, []);
    assert.deepEqual(out.cochrane.checks, []);
    // The heading itself is highlighted with the same message
    const flagged = out.embase.pieces.find((p) => p.flag);
    assert.equal(flagged.text, "'Acne Vulgaris'");
    assert.equal(flagged.flag, CHECK.emtree);
});

test('MeSH variants: exploded, not exploded, major topic', () => {
    const search = 'a[Mesh] AND b[Mesh:NoExp] AND c[Majr] AND "d e"[Majr:NoExp]';
    const out = byKey(search);
    assert.equal(out.pubmed.oneLine, '"a"[Mesh] AND "b"[Mesh:NoExp] AND "c"[Majr] AND "d e"[Majr:NoExp]');
    assert.equal(out.ovidMedline.oneLine, 'exp a/ AND b/ AND exp *c/ AND *d e/');
    assert.equal(out.embase.oneLine, "'a'/exp AND 'b'/de AND 'c'/exp/mj AND 'd e'/mj");
    assert.equal(out.cochrane.oneLine, '[mh a] AND [mh ^b] AND [mh c[mj]] AND [mh ^"d e"[mj]]');
    assert.equal(out.cinahl.oneLine, '(MH "a+") AND (MH "b") AND (MM "c+") AND (MM "d e")');
    // Other spellings of the same tags
    assert.equal(byKey('x[mh] OR y[MeSH Terms] OR z[mesh terms:noexp]').ovidMedline.oneLine, 'exp x/ OR exp y/ OR z/');
});

test('MeSH subheadings are kept in PubMed and flagged elsewhere', () => {
    const out = byKey('"Diabetes Mellitus/therapy"[Mesh]');
    assert.equal(out.pubmed.oneLine, '"Diabetes Mellitus/therapy"[Mesh]');
    assert.equal(out.ovidMedline.oneLine, 'exp Diabetes Mellitus/');
    assert.deepEqual(out.ovidMedline.checks, [{ message: CHECK.subheading, items: ['Diabetes Mellitus/therapy'] }]);
});

test('proximity: PubMed ~N becomes each database\'s own operator (Ovid, Embase and Cochrane count one higher)', () => {
    const out = byKey('"hip fracture"[tiab:~2] AND "pain relief"[ti:~0]');
    assert.equal(out.pubmed.oneLine, '"hip fracture"[tiab:~2] AND "pain relief"[ti:~0]');
    assert.equal(out.ovidMedline.oneLine, '(hip ADJ3 fracture).ti,ab. AND (pain ADJ1 relief).ti.');
    assert.equal(out.embase.oneLine, '(hip NEAR/3 fracture):ti,ab,kw AND (pain NEAR/1 relief):ti');
    assert.equal(out.cochrane.oneLine, '(hip NEAR/3 fracture):ti,ab,kw AND (pain NEAR/1 relief):ti');
    assert.equal(out.cinahl.oneLine, '(TI (hip N2 fracture) OR AB (hip N2 fracture)) AND TI (pain N0 relief)');
    assert.equal(out.webOfScience.oneLine, 'TS=(hip NEAR/2 fracture) AND TI=(pain NEAR/0 relief)');
    assert.equal(out.scopus.oneLine, 'TITLE-ABS-KEY(hip W/2 fracture) AND TITLE(pain W/0 relief)');
    assert.deepEqual(out.core.checks.map((c) => c.message), [CHECK.noProximity]);
    // More than two words: each pair, flagged
    const three = byKey('"long term care"[tiab:~1]');
    assert.equal(three.ovidMedline.oneLine, '(long ADJ2 term ADJ2 care).ti,ab.');
    assert.deepEqual(checkMessages(three.ovidMedline), [CHECK.multiProximity]);
});

test('field tags: title, abstract, text word, all fields and no tag', () => {
    const out = byKey('a[ti] AND b[ab] AND c[tw] AND d[all] AND e');
    assert.equal(out.ovidMedline.oneLine, 'a.ti. AND b.ab. AND c.tw. AND d.mp. AND e');
    assert.equal(out.embase.oneLine, "'a':ti AND 'b':ab AND 'c':ti,ab,kw AND 'd' AND 'e'");
    assert.equal(out.cochrane.oneLine, 'a:ti AND b:ab AND c:ti,ab,kw AND d AND e');
    assert.equal(out.cinahl.oneLine, 'TI a AND AB b AND TX c AND TX d AND e');
    assert.equal(out.webOfScience.oneLine, 'TI=(a) AND AB=(b) AND TS=(c) AND ALL=(d) AND TS=(e)');
    assert.equal(out.scopus.oneLine, 'TITLE(a) AND ABS(b) AND TITLE-ABS-KEY(c) AND ALL(d) AND TITLE-ABS-KEY(e)');
    assert.equal(out.googleScholar.oneLine, 'intitle:a b c d e');
    assert.deepEqual(out.googleScholar.checks.find((c) => c.message === CHECK.noAbstract).items, ['b']);
    // Long tag names work too
    assert.equal(byKey('a[Title/Abstract] OR b[Text Word] OR c[All Fields]').ovidMedline.oneLine, 'a.ti,ab. OR b.tw. OR c.mp.');
});

test('PubMed reads left to right; every translation keeps that meaning with brackets', () => {
    const out = byKey('a[tiab] OR b[tiab] AND c[tiab] NOT d[tiab]');
    assert.equal(out.pubmed.oneLine, '((a[tiab] OR b[tiab]) AND c[tiab]) NOT d[tiab]');
    assert.equal(out.ovidMedline.oneLine, '((a OR b).ti,ab. AND c.ti,ab.) NOT d.ti,ab.');
    // Scopus runs OR before AND and AND NOT last; the brackets make the order explicit
    assert.equal(out.scopus.oneLine, '(TITLE-ABS-KEY(a OR b) AND TITLE-ABS-KEY(c)) AND NOT TITLE-ABS-KEY(d)');
    assert.equal(out.webOfScience.oneLine, '(TS=(a OR b) AND TS=(c)) NOT TS=(d)');
});

test('quoting: Cochrane NEXT for truncated phrases, Embase double quotes for apostrophes, operator words quoted', () => {
    assert.equal(byKey('"breast feed*"[tiab]').cochrane.oneLine, '(breast NEXT feed*):ti,ab,kw');
    assert.equal(byKey('"breast feed*"').cochrane.oneLine, '(breast NEXT feed*)');
    assert.equal(byKey('"Crohn\'s disease"[tiab]').embase.oneLine, '"Crohn\'s disease":ti,ab,kw');
    const reserved = byKey('"or"[tiab] AND "near"[ti]');
    assert.equal(reserved.ovidMedline.oneLine, '"or".ti,ab. AND "near".ti.');
    assert.equal(reserved.webOfScience.oneLine, 'TS=("or") AND TI=("near")');
    assert.equal(reserved.pubmed.oneLine, '"or"[tiab] AND "near"[ti]');
});

test('limits such as [dp] and [la] stay in PubMed and are left out elsewhere, with a check', () => {
    const out = byKey('asthma[tiab] AND english[la] AND 2018:2026[dp]');
    assert.equal(out.pubmed.oneLine, 'asthma[tiab] AND english[la] AND 2018:2026[dp]');
    assert.equal(out.ovidMedline.oneLine, 'asthma.ti,ab.');
    assert.match(out.ovidMedline.checks[0].message, /^Not translated: \[la\], \[dp\]\. Use the limits in Ovid MEDLINE instead/);
    const onlyLimits = byKey('english[la]');
    assert.equal(onlyLimits.scopus.text, '');
    assert.equal(onlyLimits.scopus.checks.length, 1);
    // A NOT whose left side was a limit is dropped with it
    assert.equal(byKey('english[la] NOT rats[tiab]').ovidMedline.text, '');
    assert.equal(byKey('asthma[tiab] NOT english[la]').ovidMedline.oneLine, 'asthma.ti,ab.');
});

test('Google Scholar: minus signs, intitle:, truncation removed, and its 256-character limit', () => {
    const out = byKey('telehealth[ti] NOT (rats[tiab] OR "lab mice"[tiab])');
    assert.equal(out.googleScholar.oneLine, 'intitle:telehealth -rats -"lab mice"');
    const complex = byKey('telehealth[tiab] NOT (rats[tiab] AND mice[tiab])');
    assert.equal(complex.googleScholar.oneLine, 'telehealth');
    assert.ok(checkMessages(complex.googleScholar).includes(CHECK.googleExclude));
    const long = byKey(Array.from({ length: 30 }, (_, i) => `"term number ${i}"[tiab]`).join(' OR '));
    assert.ok(checkMessages(long.googleScholar).includes(CHECK.googleLength));
    assert.equal(long.googleScholar.link.href, 'https://scholar.google.com/', 'too long to open with the search filled in');
    const short = byKey('asthma[tiab]');
    assert.equal(short.googleScholar.link.href, 'https://scholar.google.com/scholar?q=asthma');
});

test('Semantic Scholar: one phrase from each part, up to six, without exclusions', () => {
    const search = Array.from({ length: 8 }, (_, i) => `("topic ${i}"[tiab] OR other${i}[tiab])`).join(' AND ') + ' NOT rats[tiab]';
    assert.equal(byKey(search).semanticScholar.oneLine, '"topic 0" "topic 1" "topic 2" "topic 3" "topic 4" "topic 5"');
});

test('notes about the search itself: missing operators, tags after brackets, terms without a tag', () => {
    const { notes } = translateSearch('(heart attack OR stroke)[tiab] "aspirin" outcome');
    assert.equal(notes.length, 3);
    assert.match(notes[0], /PreVue joined them with AND/);
    assert.match(notes[1], /\[tiab\] after brackets was applied to each untagged term inside them/);
    assert.match(notes[2], /^2 terms have no field tag \(for example "aspirin"\)/);
    const out = byKey('(heart attack OR stroke)[tiab] "aspirin"');
    assert.equal(out.pubmed.oneLine, '("heart attack"[tiab] OR stroke[tiab]) AND "aspirin"');
});

test('curly quotes copied from Word are read as straight quotes', () => {
    assert.equal(byKey('\u201Cblue light\u201D[tiab] AND \u2018acne\u2019').pubmed.oneLine, '"blue light"[tiab] AND \'acne\'');
});

test('PubMed links open with the search filled in; others open the database', () => {
    const out = byKey('asthma[tiab] AND child*[tiab]');
    assert.equal(out.pubmed.link.href, `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(out.pubmed.oneLine)}`);
    assert.equal(out.ovidMedline.link.href, 'https://ovidsp.ovid.com/');
    assert.equal(out.cochrane.link.href, 'https://www.cochranelibrary.com/');
    assert.equal(out.cinahl.link.href, 'https://search.ebscohost.com/');
    assert.equal(out.webOfScience.link.href, 'https://www.webofscience.com/');
    assert.equal(out.scopus.link.href, 'https://www.scopus.com/');
    for (const result of Object.values(out)) assert.match(result.link.href, /^https:\/\//);
});

// ---------- Mistakes in the search ----------

test('mistakes get a clear message and where they are', () => {
    const cases = [
        ['(asthma OR wheeze', 0, /"\(" is not closed/],
        ['asthma OR', 7, /"OR" needs a search term after it/],
        ['OR asthma', 0, /"OR" needs a search term before it/],
        ['asthma AND OR wheeze', 11, /two operators in a row/],
        ['"asthma', 0, /quotation mark .* is not closed/],
        ['asthma[tiab', 6, /not closed with "\]"/],
        ['asthma]', 6, /"\]" has no matching "\["/],
        ['()', 0, /brackets are empty/],
        ['a)', 1, /"\)" has no matching "\("/],
        ['#1 AND #2', 0, /history numbers/],
        ['[tiab]', 0, /no search term before it/],
        ['asthma [tiab] [ti]', 14, /unexpected place/],
        ['(a OR b)[mh]', 8, /can't follow brackets/],
        ['""', 0, /quotation marks are empty/],
    ];
    for (const [search, position, message] of cases) {
        assert.throws(() => translateSearch(search), (error) => {
            assert.ok(error instanceof SearchSyntaxError, `${search}: ${error && error.name}`);
            assert.match(error.message, message, search);
            assert.equal(error.position, position, search);
            return true;
        });
    }
});

test('limits protect the page: length, nesting and number of terms', () => {
    assert.throws(() => translateSearch('a'.repeat(MAX_SEARCH_CHARS + 1)), /too long/);
    assert.throws(() => translateSearch(`${'('.repeat(41)}a${')'.repeat(41)}`), /too many brackets/);
    assert.doesNotThrow(() => translateSearch(`${'('.repeat(40)}a${')'.repeat(40)}`));
    assert.throws(() => translateSearch(Array.from({ length: 2001 }, (_, i) => `t${i}`).join(' OR ')), /more than 2,000 terms/);
    // Unusual tag names can't reach the code's own properties
    for (const tag of ['__proto__', 'constructor', 'toString']) {
        assert.equal(byKey(`asthma[${tag}]`).ovidMedline.text, '', tag);
    }
    assert.deepEqual(translateSearch('   \n  '), { empty: true, notes: [], results: [] });
});

// ---------- Random searches ----------

function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const WORDS = ['asthma', 'wheez*', 'child*', 'blood pressure', 'older adults', 'self-care', 'Crohn\'s disease',
    'quality of life', 'COVID-19', 'tele-health', 'type 2 diabetes', 'non-adherence', 'e-health', 'café', 'نوم'];
const HEADINGS = ['Asthma', 'Child', 'Hypertension', 'Heart Failure, Diastolic', 'Quality of Life'];
const FIELDS = [null, 'tiab', 'ti', 'ab', 'tw', 'all'];

function randomLeaf(random) {
    const pick = (list) => list[Math.floor(random() * list.length)];
    const roll = random();
    if (roll < 0.15) {
        return { type: 'heading', text: pick(HEADINGS), subheading: random() < 0.2 ? 'therapy' : null, explode: random() < 0.7, major: random() < 0.2 };
    }
    if (roll < 0.2) return { type: 'unsupported', text: pick(['english', '2018:2026', 'review']), quoted: false, tag: pick(['la', 'dp', 'pt']) };
    const text = pick(WORDS);
    const field = pick(FIELDS);
    const leaf = { type: 'term', text, quoted: random() < 0.3, field };
    if (/\s/.test(text) && !text.includes('*') && (field === 'tiab' || field === 'ti') && random() < 0.3) {
        leaf.distance = Math.floor(random() * 6);
        leaf.words = text.split(' ');
    }
    return leaf;
}

function randomTree(random, depth = 0, parentType = null) {
    if (depth > 3 || random() < 0.35) return randomLeaf(random);
    const types = ['and', 'or', 'not'].filter((t) => t !== parentType || t === 'not');
    const type = types[Math.floor(random() * types.length)];
    if (type === 'not') return { type, left: randomTree(random, depth + 1, 'not'), right: randomTree(random, depth + 1, 'not') };
    const count = 2 + Math.floor(random() * 3);
    return { type, items: Array.from({ length: count }, () => randomTree(random, depth + 1, type)) };
}

// The meaning of a tree, without positions or how it was quoted
function meaning(node) {
    if (!node) return null;
    if (node.type === 'and' || node.type === 'or') return { type: node.type, items: node.items.map(meaning) };
    if (node.type === 'not') return { type: 'not', left: meaning(node.left), right: meaning(node.right) };
    const { pos, quoted, ...rest } = node;
    return rest;
}

const balanced = (text) => {
    let depth = 0;
    let inQuotes = false;
    for (const ch of text) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch === '(') depth += 1;
        else if (!inQuotes && ch === ')') {
            depth -= 1;
            if (depth < 0) return false;
        }
    }
    return depth === 0 && !inQuotes;
};

test('1,000 random searches: writing for PubMed and reading back gives the same search', () => {
    const random = seededRandom(20261018);
    for (let i = 0; i < 1000; i += 1) {
        const tree = randomTree(random);
        const text = formatTree(tree, 'pubmed');
        const { tree: back } = parseSearch(text);
        assert.deepEqual(meaning(back), meaning(tree), `search ${i}: ${text}`);
    }
});

test('1,000 random searches: every translation is well formed', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 1000; i += 1) {
        const text = formatTree(randomTree(random), 'pubmed');
        const { results } = translateSearch(text);
        for (const result of results) {
            const where = `${result.key}, search ${i}: ${result.text}`;
            assert.equal(result.pieces.map((p) => p.text).join(''), result.text, where);
            assert.ok(balanced(result.text), `brackets or quotes don't match: ${where}`);
            assert.ok(!/undefined|null|\[object/.test(result.text), where);
            assert.ok(!result.oneLine.includes('\n'), where);
            assert.match(result.link.href, /^https:\/\//, where);
        }
    }
});

test('random text never crashes: it is translated or gets a clear message', () => {
    const random = seededRandom(5);
    const parts = ['asthma', ' ', 'AND', 'OR', 'NOT', '(', ')', '"', '[', ']', 'tiab', 'mh', ':~', '3', '*', '#', '1', '/', "'"];
    for (let i = 0; i < 3000; i += 1) {
        const text = Array.from({ length: 1 + Math.floor(random() * 15) }, () => parts[Math.floor(random() * parts.length)]).join('');
        try {
            translateSearch(text);
        } catch (error) {
            assert.ok(error instanceof SearchSyntaxError, `unexpected ${error && error.name} for ${JSON.stringify(text)}`);
            assert.ok(Number.isInteger(error.position), JSON.stringify(text));
        }
    }
});

test('PreVue\'s own PubMed queries (Step 2) always translate, keeping every term', () => {
    const random = seededRandom(31);
    const pick = (list) => list[Math.floor(random() * list.length)];
    for (let i = 0; i < 300; i += 1) {
        const concepts = Array.from({ length: 1 + Math.floor(random() * 5) }, (_, c) => ({
            id: `c${c}`,
            name: pick(WORDS),
            active: random() < 0.9,
            keywords: Array.from({ length: 1 + Math.floor(random() * 4) }, () => ({ term: pick(WORDS), active: random() < 0.85, searchField: pick([1, 2, 3, 4]) })),
            controlled_vocabulary: Array.from({ length: Math.floor(random() * 3) }, () => ({ term: pick(HEADINGS), type: pick(['MeSH', 'Emtree']), active: true })),
        }));
        const query = buildQuery('pubmed', concepts, { enabledTypes: { mesh: random() < 0.7 }, negativeKeywords: random() < 0.3 ? ['rats'] : [] }).text;
        if (!query) continue;
        const { results } = translateSearch(query);
        const leaves = collectLeaves(parseSearch(query).tree);
        const ovid = results.find((r) => r.key === 'ovidMedline').text;
        for (const leafNode of leaves) assert.ok(ovid.includes(leafNode.type === 'heading' ? `${leafNode.text}/` : (leafNode.words ? leafNode.words[0] : leafNode.text)), `${leafNode.text} missing from ${ovid}`);
    }
});
