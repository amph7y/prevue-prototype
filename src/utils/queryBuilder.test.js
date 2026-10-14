// Tests for the shared query builder.
// Run from the project folder with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_CONFIG } from '../config/dbConfig.js';
import { activeConcepts } from './concepts.js';
import { buildQuery, queryLegend, conceptsFromKeywordGroups } from './queryBuilder.js';

// ---------- The query code from before this change, copied unchanged ----------
// Used to prove that the main query page produces exactly the same queries as before.
// eslint-disable-next-line
function legacyGenerateSingleQuery(dbKey, enabledTypes, concepts, negativeKeywords) {
        // Concepts the researcher turned off are left out of the search
        const usableConcepts = activeConcepts(concepts);
        if (usableConcepts.length === 0) return '';
        const { syntax } = DB_CONFIG[dbKey];

        // Special handling for Semantic Scholar: keep it short and natural-language-like
        if (dbKey === 'semanticScholar') {
            // Prefer concept names; fallback to first active keyword per concept
            const phrases = [];
            usableConcepts.forEach(concept => {
                const name = (concept.name || '').trim();
                if (name) phrases.push(`"${name}"`);
                if (phrases.length >= 6) return; // cap early if enough terms collected
                const firstKeyword = (concept.keywords || []).find(k => k && k.active && (k.term || '').trim());
                if (firstKeyword) phrases.push(`"${firstKeyword.term.trim()}"`);
            });
            // De-duplicate and cap to a safe number of phrases
            const deduped = Array.from(new Set(phrases)).slice(0, 6);
            let finalQuery = deduped.join(' ');

            // Add negative terms using minus style
            const activeNegative = negativeKeywords.filter(k => k.trim() !== '');
            if (activeNegative.length > 0) {
                const ssNegatives = activeNegative.map(k => `-"${k}"`).join(' ');
                finalQuery = `${finalQuery}${finalQuery ? ' ' : ''}${ssNegatives}`.trim();
            }
            return finalQuery;
        }

        const parts = [];

        usableConcepts.forEach(concept => {
            if (!concept.keywords || concept.keywords.length === 0) return;

            let activeTerms = [];

            // OPTIMIZED LOGIC FOR PUBMED: Combine controlled vocabulary and Keywords with OR
            if (dbKey === 'pubmed') {
                // Include controlled vocabulary terms based on enabled types
                const controlledVocabTerms = concept.controlled_vocabulary
                    .filter(v => v.active && enabledTypes[v.type.toLowerCase()])
                    .map(v => syntax[v.type.toLowerCase()] ? syntax[v.type.toLowerCase()](v.term) : null)
                    .filter(term => term !== null);

                const keywordTerms = concept.keywords
                    .filter(k => k.active)
                    .map(k => {
                        const searchField = k.searchField;

                        const dbField = DB_CONFIG[dbKey].searchFields[searchField];
                        return syntax.phrase(k.term, dbField);
                    });

                activeTerms = [...controlledVocabTerms, ...keywordTerms];

            } else {
                // ADVANCED LOGIC FOR ALL OTHER DATABASES
                activeTerms = [
                    ...concept.keywords.filter(k => k.active).map(k => {
                        const searchField = k.searchField;
                        const dbField = DB_CONFIG[dbKey].searchFields[searchField];

                        return syntax.phrase(k.term, dbField);
                    }),
                    ...concept.controlled_vocabulary.filter(v => v.active && syntax[v.type.toLowerCase()]).map(v => syntax[v.type.toLowerCase()](v.term))
                ];
            }

            if (activeTerms.length > 0) {
                parts.push(`(${activeTerms.join(' OR ')})`);
            }
        });

        let finalQuery = parts.join(`\n\n${syntax.separator}\n\n `);

        const activeNegative = negativeKeywords.filter(k => k.trim() !== '');
        if (activeNegative.length > 0) {
            if (dbKey === 'semanticScholar') {
                // Semantic Scholar supports minus for exclusion
                const ssNegatives = activeNegative.map(k => `-"${k}"`).join(' ');
                finalQuery = `${finalQuery}${finalQuery ? ' ' : ''}${ssNegatives}`.trim();
            } else {
                const negativePart = activeNegative.map(k => `"${k}"`).join(' OR ');
                if (finalQuery) {
                    finalQuery += ` ${syntax.not} (${negativePart})`;
                }
            }
        }
        return finalQuery.trim();
    }

// ---------- Random projects for comparison (same seed every run) ----------
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
const WORDS = ['adults', 'older adults', 'telemedicine', 'blood pressure', 'non-adherence', 'social determinants of health',
    'Qatar', 'mHealth', 'type 2 diabetes', 'COVID-19', 'self care', 'Arab countries', 'children', 'quality of life'];
const NEGATIVES = ['', ' ', 'children', ' adolescents ', 'animal studies', 'rats'];

function randomProject(random) {
    const pick = (list) => list[Math.floor(random() * list.length)];
    const count = (max) => Math.floor(random() * (max + 1));
    const concepts = Array.from({ length: 1 + count(5) }, (_, i) => ({
        id: `concept_${i}`,
        name: random() < 0.1 ? '' : pick(WORDS),
        active: random() < 0.85 ? (random() < 0.5 ? true : undefined) : false,
        keywords: Array.from({ length: count(5) }, () => ({
            term: pick(WORDS),
            active: random() < 0.8,
            searchField: pick([1, 2, 3, 4, '4', '1']),
        })),
        controlled_vocabulary: Array.from({ length: count(3) }, () => ({
            term: pick(WORDS),
            type: pick(['MeSH', 'Emtree', 'mesh', 'EMTREE']),
            active: random() < 0.8,
        })),
    }));
    return {
        concepts,
        enabledTypes: { mesh: random() < 0.7, emtree: random() < 0.3 },
        negativeKeywords: Array.from({ length: count(3) }, () => pick(NEGATIVES)),
    };
}

const LIVE_DATABASES = ['pubmed', 'scopus', 'core', 'semanticScholar'];

test('the main query is exactly the same as before, for 2,000 random projects and every live database', () => {
    const random = seededRandom(20261014);
    let compared = 0;
    for (let i = 0; i < 2000; i += 1) {
        const { concepts, enabledTypes, negativeKeywords } = randomProject(random);
        for (const db of LIVE_DATABASES) {
            const before = legacyGenerateSingleQuery(db, enabledTypes, concepts, negativeKeywords);
            const now = buildQuery(db, concepts, { enabledTypes, negativeKeywords }).text;
            assert.equal(now, before, `different query for ${db} in project ${i}`);
            compared += 1;
        }
    }
    assert.equal(compared, 8000);
});

test('the pieces always join back into exactly the query, for every database', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 500; i += 1) {
        const { concepts, enabledTypes, negativeKeywords } = randomProject(random);
        for (const db of Object.keys(DB_CONFIG)) {
            const { text, pieces } = buildQuery(db, concepts, { enabledTypes, negativeKeywords });
            assert.equal(pieces.map((p) => p.text).join(''), text);
            assert.ok(pieces.every((p) => p.text !== ''));
            assert.ok(!text.includes('undefined'), `"undefined" in the ${db} query`);
            pieces.filter((p) => p.kind === 'concept').forEach((p) => {
                const concept = concepts.find((c) => c.id === p.conceptId);
                assert.ok(concept && concept.active !== false, 'a concept piece belongs to a concept that is on');
            });
        }
    }
});

// ---------- A worked example ----------

const EXAMPLE = [
    {
        id: 'a', name: 'older adults', colorIndex: 0,
        keywords: [
            { term: 'older adults', active: true, searchField: 4 },
            { term: 'elderly', active: true, searchField: 1 },
            { term: 'aged', active: false, searchField: 4 },
        ],
        controlled_vocabulary: [{ term: 'Aged', type: 'MeSH', active: true }],
    },
    { id: 'off', name: 'turned off', active: false, keywords: [{ term: 'ignored', active: true, searchField: 4 }], controlled_vocabulary: [] },
    {
        id: 'b', name: 'telemedicine', colorIndex: 3,
        keywords: [{ term: 'telehealth', active: true, searchField: 4 }],
        controlled_vocabulary: [{ term: 'Telemedicine', type: 'Emtree', active: true }],
    },
];

test('PubMed example: one block per concept, separated by AND lines, MeSH first, NOT at the end', () => {
    const { text, pieces } = buildQuery('pubmed', EXAMPLE, { enabledTypes: { mesh: true }, negativeKeywords: ['children', ''] });
    assert.equal(text,
        '("Aged"[MeSH Terms] OR "older adults"[all] OR "elderly"[tiab])\n\n AND \n\n ("telehealth"[all]) NOT ("children")');
    assert.deepEqual(pieces.map((p) => p.kind), ['concept', 'operator', 'concept', 'operator', 'exclude']);
    assert.deepEqual(queryLegend(pieces), { conceptIds: ['a', 'b'], hasExcluded: true });

    const meshOff = buildQuery('pubmed', EXAMPLE, { enabledTypes: { mesh: false } }).text;
    assert.ok(!meshOff.includes('[MeSH Terms]'), 'the Parallel MeSH Search switch is respected');
});

test('Scopus example: field codes and Emtree index terms', () => {
    assert.equal(buildQuery('scopus', EXAMPLE).text,
        '(ALL("older adults") OR TITLE-ABS-KEY("elderly"))\n\n AND \n\n (ALL("telehealth") OR INDEXTERMS("Telemedicine"))');
});

test('a keyword without a search field searches all fields (it used to print [undefined])', () => {
    const concepts = [{ id: 'x', keywords: [{ term: 'mHealth', active: true }], controlled_vocabulary: [] }];
    assert.equal(buildQuery('pubmed', concepts).text, '("mHealth"[all])');
    assert.ok(legacyGenerateSingleQuery('pubmed', {}, concepts, []).includes('[undefined]'), 'the old code had this bug');
});

test('Embase (manual count only): valid Embase.com field codes, Emtree as /exp, NOT for exclusions', () => {
    const { text } = buildQuery('embase', EXAMPLE, { negativeKeywords: ['rats'] });
    assert.equal(text,
        "('older adults':ti,ab,kw OR 'elderly':ti,ab,kw OR 'Aged':ti,ab,kw)\n\n AND \n\n ('telehealth':ti,ab,kw OR 'Telemedicine'/exp) NOT (\"rats\")");
});

test('Google Scholar (manual count only): title field and minus signs for exclusions', () => {
    const concepts = [{ id: 'x', keywords: [{ term: 'telehealth', active: true, searchField: 2 }, { term: 'mHealth', active: true, searchField: 4 }], controlled_vocabulary: [] }];
    const { text, pieces } = buildQuery('googleScholar', concepts, { negativeKeywords: ['rats', 'mice'] });
    assert.equal(text, '(intitle:"telehealth" OR "mHealth") -"rats" -"mice"');
    assert.equal(pieces[pieces.length - 1].kind, 'exclude');
});

test('Semantic Scholar keeps its short form: concept names and first keywords', () => {
    const { text, pieces } = buildQuery('semanticScholar', EXAMPLE, { negativeKeywords: ['children'] });
    assert.equal(text, '"older adults" "telemedicine" "telehealth" -"children"');
    assert.deepEqual(queryLegend(pieces).conceptIds, ['a', 'b']);
});

test('empty cases: no concepts, all turned off, unknown database', () => {
    assert.deepEqual(buildQuery('pubmed', []), { text: '', pieces: [] });
    assert.deepEqual(buildQuery('pubmed', [{ ...EXAMPLE[0], active: false }]), { text: '', pieces: [] });
    assert.deepEqual(buildQuery('nope', EXAMPLE), { text: '', pieces: [] });
    assert.equal(buildQuery('pubmed', [{ id: 'x', keywords: [{ term: 'a', active: false }] }], { negativeKeywords: ['b'] }).text, '',
        'excluded terms alone do not make a query');
});

// ---------- The Refine window ----------

test('Refine builds exactly the same query as the main page from the same keywords', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 500; i += 1) {
        const { concepts, enabledTypes, negativeKeywords } = randomProject(random);
        // The groups the query page hands to the Refine window: every concept that is on
        const groups = {};
        const order = [];
        activeConcepts(concepts).forEach((c) => {
            groups[c.id] = { label: c.name, keywords: c.keywords, controlled_vocabulary: c.controlled_vocabulary };
            order.push(c.id);
        });
        for (const db of Object.keys(DB_CONFIG)) {
            const main = buildQuery(db, concepts, { enabledTypes, negativeKeywords }).text;
            const refine = buildQuery(db, conceptsFromKeywordGroups(groups, order), { enabledTypes, negativeKeywords }).text;
            assert.equal(refine, main, `Refine differs for ${db} in project ${i}`);
        }
    }
});

test('conceptsFromKeywordGroups: keeps the given order and skips broken groups', () => {
    const groups = { '2': { label: 'two', keywords: [] }, b: { label: 'bee', keywords: 'broken' }, bad: null, '1': { label: 'one' } };
    const list = conceptsFromKeywordGroups(groups, ['b', '2', '1']);
    assert.deepEqual(list.map((c) => c.id), ['b', '2', '1']);
    assert.deepEqual(list[0].keywords, []);
    assert.deepEqual(conceptsFromKeywordGroups(null), []);
});
