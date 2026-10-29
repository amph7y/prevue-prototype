// Tests for hand-entered search counts and the links to each database.
// Run from the project folder with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_MANUAL_COUNT,
    isManualOnly,
    parseCountInput,
    queryFingerprint,
    normalizeManualCounts,
    serializeManualCounts,
    setManualCount,
    countIsOutdated,
    combinedTotal,
    selectDatabasesWithCounts,
} from './manualCounts.js';
import { databaseLink, GOOGLE_SCHOLAR_MAX_CHARS } from './databaseLinks.js';

// ---------- Typing a count ----------

test('parseCountInput: whole numbers, with or without thousands separators', () => {
    assert.deepEqual(parseCountInput('1234'), { value: 1234, error: null });
    assert.deepEqual(parseCountInput(' 1,234 '), { value: 1234, error: null });
    assert.deepEqual(parseCountInput('1 234 567'), { value: 1234567, error: null });
    assert.deepEqual(parseCountInput('0'), { value: 0, error: null });
    assert.deepEqual(parseCountInput('١٢٣٤'), { value: 1234, error: null }, 'Arabic-Indic digits');
    assert.deepEqual(parseCountInput('۱٬۲۳۴'), { value: 1234, error: null }, 'Persian digits with an Arabic separator');
    assert.deepEqual(parseCountInput(''), { value: null, error: null }, 'empty means no count');
    assert.deepEqual(parseCountInput('   '), { value: null, error: null });
    assert.deepEqual(parseCountInput(undefined), { value: null, error: null });
});

test('parseCountInput: rejects anything that is not a whole number in range', () => {
    for (const bad of ['-5', '1.5', '12a', 'abc', '1e6', '0x10', '+3', '1.234.567', '<script>']) {
        const result = parseCountInput(bad);
        assert.equal(result.value, null, bad);
        assert.match(result.error, /whole number/, bad);
    }
    assert.match(parseCountInput(String(MAX_MANUAL_COUNT + 1)).error, /up to 1,000,000,000/);
    assert.equal(parseCountInput(String(MAX_MANUAL_COUNT)).value, MAX_MANUAL_COUNT);
    assert.match(parseCountInput('99999999999999999999').error, /up to/);
});

// ---------- Saving and loading ----------

test('queryFingerprint: ignores spacing, changes when the query changes', () => {
    const a = queryFingerprint('("a"[all])\n\n AND \n\n ("b"[all])');
    assert.match(a, /^[0-9a-f]{8}$/);
    assert.equal(a, queryFingerprint('("a"[all]) AND ("b"[all])'));
    assert.notEqual(a, queryFingerprint('("a"[all]) AND ("c"[all])'));
    assert.equal(queryFingerprint(null), queryFingerprint(''));
});

test('setManualCount and serializeManualCounts: save, replace and remove', () => {
    const when = new Date('2026-10-14T08:00:00Z');
    let counts = setManualCount({}, 'scopus', 420, 'query A', when);
    counts = setManualCount(counts, 'pubmed', 1234, 'query B', when);
    assert.deepEqual(serializeManualCounts(counts), [
        { db: 'pubmed', count: 1234, enteredAt: '2026-10-14T08:00:00.000Z', queryKey: queryFingerprint('query B') },
        { db: 'scopus', count: 420, enteredAt: '2026-10-14T08:00:00.000Z', queryKey: queryFingerprint('query A') },
    ], 'saved in database order');
    counts = setManualCount(counts, 'scopus', null, '');
    assert.deepEqual(Object.keys(counts), ['pubmed'], 'null removes the count');
    assert.deepEqual(setManualCount(counts, 'notADatabase', 5, 'q'), counts);
    assert.deepEqual(setManualCount(counts, 'core', -1, 'q'), counts, 'bad counts are ignored');
    assert.deepEqual(serializeManualCounts(null), []);
});

test('normalizeManualCounts: only known databases and valid numbers; broken data is skipped', () => {
    const loaded = normalizeManualCounts([
        { db: 'pubmed', count: 12, enteredAt: '2026-10-14T08:00:00.000Z', queryKey: 'abcdef01' },
        { db: 'pubmed', count: 99 },
        { db: 'scopus', count: 5, enteredAt: 'not a date', queryKey: 'NOT-HEX!' },
        { db: '__proto__', count: 1 },
        { db: 'webOfScience', count: 1 },
        { db: 'core', count: 1.5 },
        { db: 'semanticScholar', count: '7' },
        { db: 'embase', count: MAX_MANUAL_COUNT + 1 },
        null,
        'text',
    ]);
    assert.deepEqual(Object.keys(loaded), ['pubmed', 'scopus']);
    assert.equal(loaded.pubmed.count, 12, 'the first entry for a database wins');
    assert.deepEqual(loaded.scopus, { count: 5, enteredAt: null, queryKey: null });
    assert.equal(Object.getPrototypeOf(loaded), Object.prototype);
    assert.deepEqual(normalizeManualCounts({ pubmed: { count: 3 } }), {}, 'only the saved list form is read');
    assert.deepEqual(normalizeManualCounts(Array.from({ length: 80 }, () => ({ db: 'pubmed', count: 1 }))), { pubmed: { count: 1, enteredAt: null, queryKey: null } });
});

test('countIsOutdated: flags counts entered for a different query', () => {
    const entry = setManualCount({}, 'pubmed', 10, 'query A').pubmed;
    assert.equal(countIsOutdated(entry, 'query A'), false);
    assert.equal(countIsOutdated(entry, '  query   A '), false, 'spacing does not matter');
    assert.equal(countIsOutdated(entry, 'query B'), true);
    assert.equal(countIsOutdated({ count: 10, queryKey: null }, 'anything'), false, 'unknown query: no warning');
    assert.equal(countIsOutdated(undefined, 'x'), false);
});

// ---------- Totals and selection ----------

test('combinedTotal: your count wins over the live count; unusable live counts are skipped', () => {
    const liveCounts = { pubmed: { count: '1000' }, scopus: { count: 500 }, core: { count: 'Error' }, embase: { count: 'N/A' } };
    const manualCounts = { scopus: { count: 450 }, embase: { count: 30 } };
    assert.deepEqual(combinedTotal(['pubmed', 'scopus', 'core', 'embase'], { liveCounts, manualCounts }), { total: 1480, manual: 2, live: 1 });
    assert.deepEqual(combinedTotal(['pubmed', 'scopus'], { liveCounts, manualCounts, includeLive: false }), { total: 450, manual: 1, live: 0 },
        'plans without live counts add up your counts only');
    assert.deepEqual(combinedTotal([], {}), { total: 0, manual: 0, live: 0 });
});

test('selectDatabasesWithCounts: reopens databases that have a count, within the plan limit', () => {
    const counts = { embase: { count: 1 }, googleScholar: { count: 2 } };
    assert.deepEqual(selectDatabasesWithCounts({ pubmed: true, scopus: true }, counts),
        { pubmed: true, scopus: true, embase: true, googleScholar: true });
    assert.deepEqual(selectDatabasesWithCounts({ pubmed: true }, counts, { maxDatabases: 2 }),
        { pubmed: true, embase: true }, 'free plan: up to 2 databases');
    assert.deepEqual(selectDatabasesWithCounts({ pubmed: true }, { scopus: { count: 1 } }, { isGuest: true }),
        { pubmed: true }, 'guests stay on PubMed');
    assert.ok(isManualOnly('embase') && isManualOnly('googleScholar') && !isManualOnly('pubmed'));
});

// ---------- Links ----------

test('databaseLink: PubMed opens with the query filled in, safely encoded', () => {
    const link = databaseLink('pubmed', '("older adults"[all] OR "aged"[MeSH Terms])\n\n AND \n\n ("tele&health"[all])');
    assert.equal(link.prefilled, true);
    assert.equal(link.href,
        'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent('("older adults"[all] OR "aged"[MeSH Terms]) AND ("tele&health"[all])'));
    assert.ok(!link.href.includes('&health'), 'the query cannot add its own link parameters');
});

test('databaseLink: other databases open their home page for pasting; long queries too', () => {
    for (const db of ['scopus', 'embase', 'core', 'semanticScholar']) {
        const link = databaseLink(db, 'q');
        assert.equal(link.prefilled, false, db);
        assert.match(link.href, /^https:\/\/[a-z.]+\/$/, db);
    }
    assert.equal(databaseLink('pubmed', 'x'.repeat(7000)).href, 'https://pubmed.ncbi.nlm.nih.gov/', 'very long links fall back');
    assert.equal(databaseLink('pubmed', '').href, 'https://pubmed.ncbi.nlm.nih.gov/');
});

test('databaseLink: Google Scholar only takes short searches', () => {
    const short = databaseLink('googleScholar', '"telehealth" "older adults"');
    assert.equal(short.prefilled, true);
    assert.ok(short.href.startsWith('https://scholar.google.com/scholar?q='));
    const long = databaseLink('googleScholar', 'x'.repeat(GOOGLE_SCHOLAR_MAX_CHARS + 1));
    assert.deepEqual(long, { href: 'https://scholar.google.com/', prefilled: false, tooLong: true });
});

test('databaseLink: unknown databases get no link', () => {
    for (const db of ['notADatabase', '__proto__', 'constructor', 'hasOwnProperty', '', null, undefined]) {
        assert.equal(databaseLink(db, 'q'), null, String(db));
    }
});
