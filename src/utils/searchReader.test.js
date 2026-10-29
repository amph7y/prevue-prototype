// Tests for reading searches written for any database: npm test
import assert from 'node:assert/strict';
import test from 'node:test';

import { SYNTAXES, SearchSyntaxError, detectSyntax, looksLikeQuestion, readSearch } from './searchReader.js';
import { CHECK, formatTree, translateSearch } from './searchTranslator.js';

const byKey = (text, syntax) => Object.fromEntries(translateSearch(text, { syntax }).results.map((r) => [r.key, r]));
const pubmedOf = (text, syntax) => byKey(text, syntax).pubmed.oneLine;
const checksOf = (result) => result.checks.map((c) => c.message);

// ---------- Guessing the syntax ----------

test('the syntax is guessed from the search itself', () => {
    const cases = [
        ['acne[tiab] AND "blue light"[tiab]', 'pubmed'],
        ['acne AND (blue light OR phototherapy)', 'pubmed'],
        ['exp Acne Vulgaris/ or acne.ti,ab.', 'ovidMedline'],
        ['(light adj3 therap*).ti,ab.', 'ovidMedline'],
        ["'acne vulgaris'/exp OR acne:ti,ab,kw", 'embase'],
        ['[mh "Acne Vulgaris"] OR acne:ti,ab,kw', 'cochrane'],
        ['acne:ti,ab,kw OR pimple*:ti,ab,kw', 'cochrane'],
        ['(MH "Acne Vulgaris+") OR TI acne', 'cinahl'],
        ['TS=(acne AND light)', 'webOfScience'],
        ['TITLE-ABS-KEY(acne) AND PUBYEAR > 2015', 'scopus'],
        ['intitle:acne "blue light"', 'googleScholar'],
        ['Database: Embase <1974 to 2026>\n1 exp acne/\n2 acne.ti,ab.\n3 1 or 2', 'embaseOvid'],
        ['Database: APA PsycInfo <1806 to 2026>\n1 exp Depression/\n2 depress*.ti,ab.\n3 1 or 2', 'psycinfo'],
        ['1 acne.ti,ab.\n2 pimple*.ti,ab.\n3 1 or 2', 'ovidMedline'],
    ];
    for (const [text, expected] of cases) {
        assert.equal(detectSyntax(text), expected, text);
        assert.equal(translateSearch(text).syntax.key, expected, text);
        assert.equal(translateSearch(text).syntax.detected, true, text);
    }
    // Choosing the syntax overrides the guess
    const chosen = translateSearch('acne AND light', { syntax: 'scopus' }).syntax;
    assert.deepEqual(chosen, { key: 'scopus', name: 'Scopus', detected: false });
});

test('research questions are told apart from searches', () => {
    const questions = [
        'Does telemedicine improve blood pressure control in older adults?',
        'effect of blue light therapy on acne in teenagers and young adults',
        'In adults with type 2 diabetes, does metformin reduce mortality compared with sulfonylureas',
        'What is the prevalence of burnout among nurses?',
    ];
    const searches = [
        'acne', 'acne blue light', 'acne AND blue light', '(acne OR pimples) AND light', 'acne[tiab]', 'exp Acne/',
        'acne or pimples or spots and blue light or red light', 'TS=(acne)', '1 exp Acne/\n2 acne.ti,ab.', '"blue light" acne',
        '', '   ',
    ];
    for (const text of questions) assert.equal(looksLikeQuestion(text), true, text);
    for (const text of searches) assert.equal(looksLikeQuestion(text), false, text);
});

// ---------- Each database's syntax ----------

test('Ovid: headings, field codes, truncation, ADJ and limits', () => {
    const headings = byKey('exp Acne Vulgaris/ OR *Acne/ OR Acne Vulgaris/dt,th', 'ovidMedline');
    assert.equal(headings.pubmed.oneLine, '"Acne Vulgaris"[Mesh] OR "Acne"[Majr:NoExp] OR "Acne Vulgaris"[Mesh:NoExp]');
    assert.equal(headings.ovidMedline.oneLine, 'exp Acne Vulgaris/ OR *Acne/ OR Acne Vulgaris/dt,th', 'Ovid subheadings stay in Ovid');
    assert.deepEqual(headings.pubmed.checks, [{ message: CHECK.subheading, items: ['Acne Vulgaris/dt,th'] }]);
    assert.deepEqual(checksOf(headings.embase), [CHECK.emtree, CHECK.subheading]);

    const fields = byKey('a.ti. OR b.ab. OR c.tw. OR d.mp. OR e.ti,ab,kf. OR f.ab,ti.', 'ovidMedline');
    assert.equal(fields.pubmed.oneLine, 'a[ti] OR b[ab] OR c[tw] OR d[all] OR e[tiab] OR f[tiab]');

    const truncation = translateSearch('therap$.ti,ab. OR child$2.ti,ab. OR wom#n.ti,ab.', { syntax: 'ovidMedline' });
    const tByKey = Object.fromEntries(truncation.results.map((r) => [r.key, r]));
    assert.equal(tByKey.pubmed.oneLine, 'therap*[tiab] OR child*[tiab] OR wom#n[tiab]');
    assert.ok(truncation.notes.some((n) => n.startsWith('Limited truncation')));
    assert.deepEqual(tByKey.pubmed.checks, [{ message: CHECK.wildcards, items: ['wom#n'] }]);

    assert.equal(pubmedOf('(blue adj3 light).ti,ab.', 'ovidMedline'), '"blue light"[tiab:~2]');
    assert.equal(pubmedOf('(blue adj light).ti,ab.', 'ovidMedline'), '"blue light"[tiab]', 'ADJ alone: next to each other, in order');
    assert.equal(pubmedOf('((blue or red) adj2 light).ti,ab.', 'ovidMedline'), '"blue light"[tiab:~1] OR "red light"[tiab:~1]');

    const limits = byKey('acne.ti,ab. AND english.lg.', 'ovidMedline');
    assert.equal(limits.ovidMedline.oneLine, 'acne.ti,ab. AND english.lg.', 'kept for Ovid');
    assert.equal(limits.embaseOvid.oneLine, 'acne.ti,ab,kw. AND english.lg.');
    assert.equal(limits.pubmed.oneLine, 'acne[tiab]');
    assert.match(checksOf(limits.pubmed)[0], /^Not translated: english\.lg\. Use the limits in PubMed instead/);
    assert.equal(pubmedOf('HIV/AIDS.ti,ab. OR and/or', 'ovidMedline'), 'HIV/AIDS[tiab] OR and/or', 'slashes inside words are not headings');
});

test('Ovid databases: Emtree and APA headings are checked against MeSH', () => {
    const embase = byKey('exp acne/', 'embaseOvid');
    assert.equal(embase.embaseOvid.checks.length, 0, 'Emtree is Embase\'s own thesaurus');
    assert.deepEqual(checksOf(embase.pubmed), ['Emtree term: this database uses MeSH. Check the matching MeSH heading.']);
    const apa = byKey('exp Depression/', 'psycinfo');
    assert.equal(apa.psycinfo.checks.length, 0);
    assert.deepEqual(checksOf(apa.embase), ['APA Thesaurus term: Embase uses Emtree. Check the matching Emtree term; it is often the same or similar.']);
});

test('Embase.com: headings, fields, NEAR/NEXT, quotes and limits', () => {
    const out = byKey("('acne vulgaris'/exp OR 'acne'/de OR 'acne'/mj OR 'acne'/exp/mj) AND (blue NEAR/3 light):ti,ab AND (light NEXT/2 therapy):ti AND [english]/lim", 'embase');
    assert.equal(out.pubmed.oneLine,
        '("acne vulgaris"[Mesh] OR "acne"[Mesh:NoExp] OR "acne"[Majr:NoExp] OR "acne"[Majr]) AND "blue light"[tiab:~2] AND "light therapy"[ti:~1]');
    assert.equal(out.embase.oneLine,
        "('acne vulgaris'/exp OR 'acne'/de OR 'acne'/mj OR 'acne'/exp/mj) AND (blue NEAR/3 light):ti,ab,kw AND (light NEXT/2 therapy):ti AND [english]/lim",
        'Embase keeps its own word order (NEXT) and limits');
    assert.equal(out.embase.checks.length, 0);
    assert.ok(checksOf(out.pubmed).includes(CHECK.order));
    assert.ok(checksOf(out.pubmed).includes('Emtree term: this database uses MeSH. Check the matching MeSH heading.'));
    assert.equal(pubmedOf("\"crohn's disease\":ti,ab OR 'heart attack':ti", 'embase'), '"crohn\'s disease"[tiab] OR "heart attack"[ti]');
    assert.equal(pubmedOf('asthma/exp OR asthma:ti:ab', 'embase'), '"asthma"[Mesh] OR asthma[tiab]');
    const assumed = translateSearch('(blue NEAR light):ti,ab', { syntax: 'embase' });
    assert.ok(assumed.notes.some((n) => n.startsWith('NEAR without a number was read as NEAR/5')));
});

test('Cochrane Library: [mh], qualifiers, NEAR, NEXT and search history', () => {
    const out = byKey('[mh "Acne Vulgaris"] OR [mh ^Acne] OR [mh Acne[mj]] OR [mh "Acne Vulgaris"/DT,TH] OR [mh /DT] OR (cancer NEAR lung):ti,ab OR (hearing NEXT aid*):ti,ab', 'cochrane');
    assert.equal(out.pubmed.oneLine,
        '"Acne Vulgaris"[Mesh] OR "Acne"[Mesh:NoExp] OR "Acne"[Majr] OR "Acne Vulgaris"[Mesh] OR "cancer lung"[tiab:~5] OR "hearing aid*"[tiab]');
    assert.equal(out.cochrane.oneLine,
        '[mh "Acne Vulgaris"] OR [mh ^Acne] OR [mh Acne[mj]] OR [mh "Acne Vulgaris"/DT,TH] OR [mh /DT] OR (cancer NEAR/6 lung):ti,ab,kw OR (hearing NEXT aid*):ti,ab,kw',
        'qualifiers and floating subheadings stay in Cochrane');
    assert.match(checksOf(out.pubmed).join(' '), /Not translated: \[mh \/DT\]/);

    const history = byKey('#1\tMeSH descriptor: [Acne Vulgaris] explode all trees\t1234\n#2\tMeSH descriptor: [Acne] this term only\t20\n#3\tacne:ti,ab,kw\t5678\n#4\t{OR #1-#3}\t6000\n#5\t("blue light" OR phototherap*):ti,ab,kw\t300\n#6\t#4 AND #5\t120', 'cochrane');
    assert.equal(history.pubmed.oneLine, '("Acne Vulgaris"[Mesh] OR "Acne"[Mesh:NoExp] OR acne[tiab]) AND ("blue light"[tiab] OR phototherap*[tiab])');
});

test('CINAHL: MH and MM headings, TI and AB, N and W proximity, S lines', () => {
    const out = byKey('((MH "Acne Vulgaris+") OR (MM "Acne") OR TI acne OR AB acne) AND (TI (blue N3 light) OR AB (blue N3 light)) AND TI (light W2 therapy) AND TX phototherap*', 'cinahl');
    assert.equal(out.pubmed.oneLine,
        '("Acne Vulgaris"[Mesh] OR "Acne"[Majr:NoExp] OR acne[tiab]) AND "blue light"[tiab:~3] AND "light therapy"[ti:~2] AND phototherap*[all]');
    assert.equal(out.cinahl.oneLine,
        '((MH "Acne Vulgaris+") OR (MM "Acne") OR (TI acne OR AB acne)) AND (TI (blue N3 light) OR AB (blue N3 light)) AND TI (light W2 therapy) AND TX phototherap*');
    assert.equal(out.cinahl.checks.length, 0, 'CINAHL Headings are CINAHL\'s own');
    assert.deepEqual(out.pubmed.checks.find((c) => c.message.startsWith('CINAHL heading')).items, ['Acne Vulgaris', 'Acne']);

    const lines = byKey('S1 (MH "Acne+")\nS2 TI acne OR AB acne\nS3 S1 OR S2\nS4 TI "blue light"\nS5 S3 AND S4', 'cinahl');
    assert.equal(lines.pubmed.oneLine, '("Acne"[Mesh] OR acne[tiab]) AND "blue light"[ti]');
});

test('Web of Science: field tags, NEAR/n, implicit AND and its order of operators', () => {
    const out = byKey('TS=(acne AND ("blue light" OR phototherap*)) AND TI=(blue NEAR/3 light) AND AB=therapy AND PY=(2015-2026)', 'webOfScience');
    assert.equal(out.pubmed.oneLine, 'acne[tiab] AND ("blue light"[tiab] OR phototherap*[tiab]) AND "blue light"[ti:~3] AND therapy[ab]');
    assert.equal(out.webOfScience.oneLine, 'TS=(acne) AND TS=("blue light" OR phototherap*) AND TI=(blue NEAR/3 light) AND AB=(therapy) AND PY=(2015-2026)');
    assert.equal(pubmedOf('TS=(blue light therapy)', 'webOfScience'), 'blue[tiab] AND light[tiab] AND therapy[tiab]', 'words without an operator are joined with AND');

    const order = translateSearch('TS=(acne OR pimple AND light)', { syntax: 'webOfScience' });
    assert.equal(order.results[0].oneLine, 'acne[tiab] OR (pimple[tiab] AND light[tiab])', 'AND before OR, as Web of Science does');
    assert.ok(order.notes.some((n) => /NOT first, then AND, then OR/.test(n)));
    const near = translateSearch('TS=(blue NEAR light)', { syntax: 'webOfScience' });
    assert.ok(near.notes.some((n) => n.startsWith('NEAR without a number was read as NEAR/15')));
});

test('Scopus: field functions, W/n and PRE/n, exact phrases, AND NOT and limits', () => {
    const out = byKey('TITLE-ABS-KEY(acne AND {blue light}) AND TITLE(light PRE/2 therapy) AND NOT ABS(review) AND INDEXTERMS("Acne") AND PUBYEAR > 2015 AND LIMIT-TO(DOCTYPE, "ar")', 'scopus');
    // Since 2026 Scopus does AND NOT before AND: a AND b AND NOT c AND d is a AND (b AND NOT c) AND d
    assert.equal(out.scopus.oneLine,
        'TITLE-ABS-KEY(acne) AND TITLE-ABS-KEY({blue light}) AND (TITLE(light PRE/2 therapy) AND NOT ABS(review)) AND INDEXTERMS("Acne") AND PUBYEAR > 2015 AND LIMIT-TO(DOCTYPE, "ar")');
    assert.equal(out.scopus.checks.length, 0);
    assert.ok(checksOf(out.pubmed).includes(CHECK.order));
    assert.ok(translateSearch('TITLE-ABS-KEY(acne) AND NOT ABS(review) AND TITLE(light)', { syntax: 'scopus' }).notes.some((n) => /2026 update/.test(n)),
        'searches that read differently under the old Scopus order get a note');
    assert.ok(!translateSearch('TITLE-ABS-KEY(acne) AND TITLE(light) AND NOT ABS(review)', { syntax: 'scopus' }).notes.some((n) => /2026 update/.test(n)));
    const order = translateSearch('TITLE-ABS-KEY(acne OR pimple AND light)', { syntax: 'scopus' });
    assert.equal(order.results[0].oneLine, 'acne[tiab] OR (pimple[tiab] AND light[tiab])');
    assert.ok(order.notes.some((n) => /AND NOT first, then AND, then OR/.test(n)));
    assert.equal(pubmedOf('TITLE-ABS-KEY(COVID (vaccine OR vaccination))', 'scopus'), 'COVID[tiab] AND (vaccine[tiab] OR vaccination[tiab])', 'COVID( is not a limit');
});

test('Google Scholar: intitle:, minus and implicit AND', () => {
    assert.equal(pubmedOf('intitle:acne "blue light" -review', 'googleScholar'), '(acne[ti] AND "blue light") NOT review');
    assert.equal(byKey('intitle:acne "blue light" -review', 'googleScholar').googleScholar.oneLine, 'intitle:acne "blue light" -review');
});

test('numbered searches: the last line is written out in full', () => {
    const ovid = 'Database: Ovid MEDLINE(R) ALL <1946 to October 15, 2026>\nSearch Strategy:\n--------------------\n'
        + '1     exp Acne Vulgaris/ (12345)\n2     acne.ti,ab. (23456)\n3     1 or 2 (25000)\n4     (blue light or phototherap*).ti,ab. (5000)\n'
        + '5     pimple*.ti,ab. (10)\n6     3 and 4 (300)\n7     limit 6 to english language (250)\n***************************';
    const read = translateSearch(ovid);
    assert.equal(read.syntax.key, 'ovidMedline');
    const out = Object.fromEntries(read.results.map((r) => [r.key, r]));
    assert.equal(out.pubmed.oneLine, '("Acne Vulgaris"[Mesh] OR acne[tiab]) AND ("blue light"[tiab] OR phototherap*[tiab])');
    assert.equal(out.ovidMedline.oneLine, '(exp Acne Vulgaris/ OR acne.ti,ab.) AND ("blue light" OR phototherap*).ti,ab.', 'an Ovid limit line can\'t be written inside one search');
    assert.match(checksOf(out.ovidMedline)[0], /^Not translated: limit to english language/);
    assert.match(read.notes[0], /numbered search with 7 lines/);
    assert.match(read.notes[0], /Line 5 isn't used by the last line/);

    assert.equal(pubmedOf('1 acne.ti,ab.\n2 light.ti,ab.\n3 or/1-2\n4 and/1,2', 'ovidMedline'), 'acne[tiab] AND light[tiab]');
    assert.equal(pubmedOf('#1 acne[tiab]\n#2 light[tiab]\n#3 #1 AND #2', 'pubmed'), 'acne[tiab] AND light[tiab]');
    assert.throws(() => translateSearch('#1 acne[tiab]\n#2 #1 AND #3', { syntax: 'pubmed' }), /Line 2 uses line 3, which isn't in this search/);
    assert.throws(() => translateSearch('#1 #2 OR acne[tiab]\n#2 light[tiab]', { syntax: 'pubmed' }), /Line 1 uses line 2, which comes after it/);
    assert.throws(() => translateSearch('acne.ti,ab. or/1-2', { syntax: 'ovidMedline' }), /only work in a numbered search/);
});

test('mistakes in other syntaxes get a clear message and where they are', () => {
    const cases = [
        ['ovidMedline', '(acne or pimple', 0, /"\(" is not closed/],
        ['embase', "'acne", 0, /quotation mark \(.\) is not closed/],
        ['scopus', 'TITLE-ABS-KEY(acne', 13, /"\(" is not closed/],
        ['webOfScience', 'TS=', 0, /needs a search term after it/],
        ['cinahl', 'blue N3', 5, /"N3" needs a search term after it/],
        ['embase', 'acne NEAR/3 (light AND therapy)', 5, /can only join words/],
        ['cochrane', '[mh Acne', 0, /not closed with "\]"/],
        ['cochrane', '{AND acne}', 0, /\{OR #1-#4\}/],
        ['scopus', 'acne}', 4, /"\}" has no matching "\{"/],
        ['googleScholar', '-review', 0, /minus sign/],
        ['webOfScience', 'TS=(acne) NOT', 10, /"NOT" needs a search term after it/],
        ['ovidMedline', 'acne adj3', 5, /needs a search term after it/],
    ];
    for (const [syntax, search, position, message] of cases) {
        assert.throws(() => translateSearch(search, { syntax }), (error) => {
            assert.ok(error instanceof SearchSyntaxError, `${search}: ${error && error.name}`);
            assert.match(error.message, message, search);
            assert.equal(error.position, position, `${syntax}: ${search}`);
            return true;
        });
    }
});

// ---------- Random searches, written for each database and read back ----------

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
    if (roll < 0.2) return { type: 'unsupported', text: pick(['english', 'review']), quoted: false, tag: pick(['la', 'pt']) };
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

// How each database writes PreVue's fields, as they come back when read
const FIELDS_BACK = {
    ovidMedline: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'tw', all: 'all', none: null },
    embase: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'tiab', all: null, none: null },
    cochrane: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'tiab', all: null, none: null },
    cinahl: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'all', all: 'all', none: null },
    webOfScience: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'tiab', all: 'all', none: 'tiab' },
    scopus: { tiab: 'tiab', ti: 'ti', ab: 'ab', tw: 'tiab', all: 'all', none: 'tiab' },
};

// The meaning of a tree after one database's round trip: limits PubMed wrote are left out,
// headings lose what that database can't write, and the order inside AND and OR doesn't matter
function expectedBack(node, key) {
    if (!node) return null;
    if (node.type === 'unsupported') return null;
    if (node.type === 'not') {
        const left = expectedBack(node.left, key);
        const right = expectedBack(node.right, key);
        if (!left) return null;
        return right ? { type: 'not', left, right } : left;
    }
    if (node.type === 'and' || node.type === 'or') {
        const items = [];
        node.items.forEach((item) => {
            const child = expectedBack(item, key);
            if (!child) return;
            if (child.type === node.type) items.push(...child.items);
            else items.push(child);
        });
        if (items.length === 0) return null;
        return items.length === 1 ? items[0] : { type: node.type, items };
    }
    if (node.type === 'heading') {
        if (key === 'webOfScience') return { type: 'term', text: node.text, field: 'tiab' };
        if (key === 'scopus') return { type: 'heading', text: node.text, explode: false, major: false };
        return { type: 'heading', text: node.text, explode: node.explode, major: node.major };
    }
    const term = { type: 'term', text: node.text, field: FIELDS_BACK[key][node.field || 'none'] };
    if (node.distance !== undefined) {
        term.distance = node.distance;
        term.words = node.words;
    }
    return term;
}

// The same comparison form for a tree that was read
function canonical(node) {
    if (!node) return null;
    if (node.type === 'not') return { type: 'not', left: canonical(node.left), right: canonical(node.right) };
    if (node.type === 'and' || node.type === 'or') {
        let items = node.items.map(canonical);
        if (node.type === 'or') items = mergeTitleAbstract(items);
        const flat = [];
        items.forEach((item) => (item.type === node.type ? flat.push(...item.items) : flat.push(item)));
        const sorted = flat.map((item) => JSON.stringify(item)).sort().map((item) => JSON.parse(item));
        return sorted.length === 1 ? sorted[0] : { type: node.type, items: sorted };
    }
    if (node.type === 'heading') return { type: 'heading', text: node.text, explode: node.explode, major: node.major };
    const term = { type: 'term', text: node.text, field: node.field };
    if (node.distance !== undefined) {
        term.distance = node.distance;
        term.words = node.words;
    }
    return term;
}

// (x in titles OR x in abstracts) is x in titles or abstracts, as the reader treats it
function mergeTitleAbstract(items) {
    const out = [];
    const used = new Set();
    items.forEach((item, index) => {
        if (used.has(index)) return;
        used.add(index);
        if (item.type === 'term' && (item.field === 'ti' || item.field === 'ab')) {
            const other = item.field === 'ti' ? 'ab' : 'ti';
            const match = items.findIndex((c, k) => !used.has(k) && c.type === 'term' && c.field === other
                && c.text.toLowerCase() === item.text.toLowerCase() && (c.distance ?? null) === (item.distance ?? null));
            if (match !== -1) {
                used.add(match);
                out.push({ ...item, field: 'tiab' });
                return;
            }
        }
        out.push(item);
    });
    return out;
}

for (const key of Object.keys(FIELDS_BACK)) {
    test(`300 random searches written for ${key} and read back mean the same`, () => {
        const random = seededRandom(key.length * 7919 + 20261018);
        for (let i = 0; i < 300; i += 1) {
            const tree = randomTree(random);
            const text = formatTree(tree, key);
            const expected = canonical(expectedBack(tree, key));
            let back;
            try {
                back = readSearch(text, key).tree;
            } catch (error) {
                assert.fail(`${key} could not read its own search: ${error.message} @${error.position}\n${text}`);
            }
            assert.deepEqual(canonical(back), expected, `${key}:\n${text}`);
        }
    });
}

// ---------- Random text ----------

test('random text in every syntax is translated or gets a clear message', () => {
    const random = seededRandom(7);
    const pieces = ['acne', 'light', 'blue light', 'AND', 'OR', 'NOT', 'and', 'or', '(', ')', '"', "'", '[', ']', '{', '}',
        ':ti,ab,kw', '.ti,ab.', '/exp', 'exp', '*', '$', '#', '?', 'adj3', 'NEAR/2', 'NEAR', 'NEXT', 'W/2', 'PRE/1', 'N3', 'W2',
        'TS=', 'TI', 'AB', 'MH', '"Acne+"', 'TITLE-ABS-KEY(', 'PUBYEAR >', '2015', 'intitle:', '-', '[mh', '[mj]', '^', '/DT',
        'MeSH descriptor: [Acne] explode all trees', 'or/1-2', '#1', 'S1', '1', '2', '\n', '\n1 ', '\n2 ', '\t', '(12)', 'limit 1 to english',
        '[tiab]', '[mh]', '[tiab:~2]', 'LIMIT-TO(', 'café', 'نوم', ',', '=', '+', '/'];
    const syntaxes = ['auto', ...SYNTAXES.map((s) => s.key)];
    for (let i = 0; i < 4000; i += 1) {
        const length = 1 + Math.floor(random() * 14);
        const text = Array.from({ length }, () => pieces[Math.floor(random() * pieces.length)]).join(random() < 0.5 ? ' ' : '');
        const syntax = syntaxes[i % syntaxes.length];
        try {
            const result = translateSearch(text, { syntax });
            assert.ok(result.empty || result.results.length === 12);
        } catch (error) {
            assert.ok(error instanceof SearchSyntaxError, `${syntax} ${JSON.stringify(text)}: ${error && error.stack}`);
            assert.ok(Number.isInteger(error.position) && error.position >= 0 && error.position <= text.length + 1, `${syntax} ${JSON.stringify(text)} @${error.position}`);
        }
    }
});

test('hostile input stays fast and never crashes the page', () => {
    const N = 19990;
    const inputs = [
        'TI '.repeat(N / 3),
        `1 a\n2 b${' '.repeat(N - 20)}x`,
        `1 1 or 2${' '.repeat(N - 20)}x`,
        `${'\n'.repeat(N)}x`,
        `a${':ab'.repeat(N / 3 - 1)}:x1`,
        "'a ".repeat(N / 3),
        'exp a b c d e f g h '.repeat(N / 20),
        `MeSH descriptor: [x]${' '.repeat(N - 30)}y`,
    ];
    for (const text of inputs) {
        for (const syntax of ['auto', ...SYNTAXES.map((s) => s.key)]) {
            const started = Date.now();
            try {
                translateSearch(text, { syntax });
            } catch (error) {
                assert.ok(error instanceof SearchSyntaxError, `${syntax}: ${error.message}`);
            }
            assert.ok(Date.now() - started < 2000, `${syntax} took ${Date.now() - started} ms`);
        }
    }
    assert.throws(() => translateSearch('TI TI acne', { syntax: 'cinahl' }), /Two field codes are in a row/);
    assert.equal(pubmedOf('1 acne.ti,ab.  (1,234)\n2 light.ti,ab.\t99\n3 1 and 2   12', 'ovidMedline'), 'acne[tiab] AND light[tiab]', 'hit counts are ignored');
});
