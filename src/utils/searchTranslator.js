// Search Translator, part 2: writes a search for each database, like the Polyglot Search
// Translator. searchReader.js first reads the search (PubMed, Ovid, Embase, Cochrane, CINAHL,
// Web of Science, Scopus, Google Scholar or plain keywords) into one tree.
// Only the syntax changes. Subject headings are not mapped between thesauri (MeSH, Emtree,
// CINAHL Headings, APA Thesaurus); they are flagged for the researcher to check.
//
// It runs entirely in the browser: the search is never sent anywhere.
// Plain JavaScript (no React), so it can be tested with Node:  npm test
//
// Syntax sources: each database's own search help (PubMed, Ovid, Embase, Cochrane Library,
// EBSCO, Web of Science, Scopus) and KU Leuven Libraries' cross-database syntax table (2026).

import { databaseLink, GOOGLE_SCHOLAR_MAX_CHARS } from './databaseLinks.js';
import {
    MAX_SEARCH_CHARS,
    SYNTAXES,
    SearchSyntaxError,
    collectLeaves,
    detectSyntax,
    looksLikeQuestion,
    normalizeSearchText,
    parseSearch,
    readSearch,
} from './searchReader.js';

export {
    MAX_SEARCH_CHARS,
    SYNTAXES,
    SearchSyntaxError,
    collectLeaves,
    detectSyntax,
    looksLikeQuestion,
    normalizeSearchText,
    parseSearch,
    readSearch,
};

const SEMANTIC_SCHOLAR_MAX_PHRASES = 6;
const MAX_LABEL_CHARS = 40;

export const TRANSLATOR_DATABASES = Object.freeze([
    { key: 'pubmed', name: 'PubMed', where: 'Paste into the PubMed search box.' },
    { key: 'ovidMedline', name: 'Ovid MEDLINE', where: 'Paste into Ovid Advanced Search.' },
    { key: 'embase', name: 'Embase (Embase.com)', where: 'Paste into the Embase search box.' },
    { key: 'embaseOvid', name: 'Embase (Ovid)', where: 'Paste into Ovid Advanced Search with Embase selected.' },
    { key: 'cochrane', name: 'Cochrane Library', where: 'Paste into the Search Manager, on the Advanced search page.' },
    { key: 'cinahl', name: 'CINAHL (EBSCO)', where: 'Paste into the EBSCOhost Advanced Search box.' },
    { key: 'psycinfo', name: 'APA PsycInfo (Ovid)', where: 'Paste into Ovid Advanced Search with APA PsycInfo selected.' },
    { key: 'webOfScience', name: 'Web of Science', where: 'Paste into Advanced Search (the query builder).' },
    { key: 'scopus', name: 'Scopus', where: 'Paste into Advanced document search.' },
    { key: 'core', name: 'CORE', where: 'Paste into the CORE search box.' },
    { key: 'semanticScholar', name: 'Semantic Scholar', where: 'Paste into the Semantic Scholar search box.' },
    { key: 'googleScholar', name: 'Google Scholar', where: 'Paste into the Google Scholar search box.' },
]);

// Things the researcher should check. The same text appears as a tooltip on the highlighted
// part of the query and in the list under it.
export const CHECK = Object.freeze({
    emtree: 'MeSH heading: Embase uses Emtree. Check the matching Emtree term; it is often the same or similar.',
    cinahl: 'MeSH heading: CINAHL uses CINAHL Headings. Check the matching heading.',
    apa: 'MeSH heading: APA PsycInfo uses the APA Thesaurus. Check the matching index term.',
    wosHeading: 'Web of Science has no subject headings, so these are searched as topic words.',
    scopusHeading: "Scopus can't explode subject headings. INDEXTERMS finds records indexed with this exact term only.",
    noHeadings: 'This database has no subject headings, so these are searched as phrases.',
    subheading: "MeSH subheading not translated: add it with the database's own qualifier codes if you need it.",
    multiProximity: 'Proximity with more than two words: check that each pair of words is within the distance you want.',
    noProximity: 'This database has no proximity search, so these words are searched separately.',
    noTruncation: 'Google Scholar has no truncation (*), so the * was removed. Add the word endings you need.',
    noAbstract: "Google Scholar can't limit a search to abstracts, so these words search the whole record.",
    googleSyntax: 'Google Scholar ignores some search syntax, sometimes including brackets. Check the results.',
    googleExclude: "This exclusion (NOT) can't be written for Google Scholar, so it was left out.",
    googleLength: `Google Scholar reads only the first ${GOOGLE_SCHOLAR_MAX_CHARS} characters of a search. Shorten this search there.`,
    coreTiab: "CORE has no title-and-abstract field, so [tiab] terms search all fields, as in PreVue's live CORE search.",
    semanticScholar: "Semantic Scholar's search box doesn't support AND, OR, NOT or brackets. This is a short keyword version with one phrase from each part of your search.",
    pubmedProximityField: 'PubMed can only search for words near each other in titles or titles and abstracts, so this uses [tiab].',
    pubmedProximityWildcard: 'PubMed ignores proximity (~) when a word has a wildcard (*). Remove the * or check the results.',
    order: 'The original search needed these words in this order. Here they can be in any order.',
    wildcards: 'Wildcards other than * (such as ?, # or $) work differently in each database. Check this term.',
});

// Subject headings from one thesaurus, checked in a database that uses another
const VOCABULARY_SOURCE = Object.freeze({
    mesh: 'MeSH heading', emtree: 'Emtree term', cinahl: 'CINAHL heading', apa: 'APA Thesaurus term', index: 'Scopus index term',
});
const VOCABULARY_TARGET = Object.freeze({
    mesh: 'this database uses MeSH. Check the matching MeSH heading.',
    emtree: 'Embase uses Emtree. Check the matching Emtree term; it is often the same or similar.',
    cinahl: 'CINAHL uses CINAHL Headings. Check the matching heading.',
    apa: 'APA PsycInfo uses the APA Thesaurus. Check the matching index term.',
});
const vocabularyOf = (node) => node.vocabulary || 'mesh';
function mappingCheck(node, target) {
    const source = vocabularyOf(node);
    if (!target || source === target || !VOCABULARY_SOURCE[source]) return null;
    return `${VOCABULARY_SOURCE[source]}: ${VOCABULARY_TARGET[target]}`;
}

// Which reader family each database's own syntax belongs to (limits are kept within a family)
const WRITER_FAMILY = Object.freeze({
    pubmed: 'pubmed', ovidMedline: 'ovid', embaseOvid: 'ovid', psycinfo: 'ovid', embase: 'embase', cochrane: 'cochrane',
    cinahl: 'cinahl', webOfScience: 'wos', scopus: 'scopus', core: 'core', semanticScholar: 'semanticScholar', googleScholar: 'google',
});

// Limits such as [dp] or english.lg. can't be translated: they stay in the database they were
// written for and are left out of the others
const keepsLimit = (node, family) => (node.source || 'pubmed') === family && node.passthrough !== false;
function removeUnsupported(node, removed, family) {
    if (!node) return null;
    if (node.type === 'unsupported') {
        if (keepsLimit(node, family)) return node;
        removed.push(node);
        return null;
    }
    if (node.type === 'and' || node.type === 'or') return { type: node.type, items: node.items.map((n) => removeUnsupported(n, removed, family)) };
    if (node.type === 'not') return { type: 'not', left: removeUnsupported(node.left, removed, family), right: removeUnsupported(node.right, removed, family) };
    return node;
}
const shortLabel = (text) => (text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS)}...` : text);
const unsupportedLabel = (node) => (node.source ? shortLabel(node.raw || node.text) : `[${node.tag}]`);

// Proximity that needed a word order, and wildcards that differ between databases
function proximityChecks(ctx, node) {
    if (node.ordered) ctx.flag(CHECK.order, node.text);
}
const hasOtherWildcards = (text) => /[?#$]/.test(text);
function wildcardCheck(ctx, node) {
    if (hasOtherWildcards(node.text)) ctx.flag(CHECK.wildcards, node.text);
}

function tidy(node) {
    if (!node) return null;
    if (node.type === 'and' || node.type === 'or') {
        const items = [];
        node.items.forEach((item) => {
            const child = tidy(item);
            if (!child) return;
            if (child.type === node.type) items.push(...child.items);
            else items.push(child);
        });
        if (items.length === 0) return null;
        return items.length === 1 ? items[0] : { type: node.type, items };
    }
    if (node.type === 'not') {
        const left = tidy(node.left);
        const right = tidy(node.right);
        if (!left) return null;
        return right ? { type: 'not', left, right } : left;
    }
    return node;
}

// ---------- Writing for each database ----------

const piece = (text, kind, flag = null) => ({ text, kind, flag });
const paren = (text) => piece(text, 'paren');
// safe: can sit next to any operator without brackets. op: its own operator, when it has one.
const leaf = (pieces, safe = true, op = null) => ({ pieces, safe, op });
const block = (pieces, safe = true, op = null) => ({ pieces, safe, op, block: true });

const OPS = Object.freeze({ AND: 'AND', OR: 'OR', NOT: 'NOT' });
const RESERVED_WORD = /^(and|or|not|adj\d*|near(\/\d+)?|next(\/\d+)?|with|same|w\/\d+|pre\/\d+|n\d+|w\d+)$/i;
const isPhrase = (text) => /\s/.test(text);
// Double quotes around phrases, and around single words that would be read as an operator
const dq = (text) => (isPhrase(text) || RESERVED_WORD.test(text) ? `"${text}"` : text);

function joinPieces(parts, opText) {
    const out = [];
    parts.forEach((part, i) => {
        if (i > 0) out.push(piece(opText, 'operator'));
        out.push(...part);
    });
    return out;
}

const proximityPieces = (words, opText) => joinPieces(words.map((word) => [piece(word, 'term')]), ` ${opText} `);

function wrapIfNeeded(compiled, parentType) {
    if (compiled.safe || (compiled.op === parentType && parentType !== 'not')) return compiled.pieces;
    return [paren('('), ...compiled.pieces, paren(')')];
}

function compile(node, dialect, ctx, isTop = false) {
    if (node.type === 'term') return dialect.term(node, ctx);
    if (node.type === 'heading') return leaf(dialect.heading(node, ctx));
    if (node.type === 'unsupported') return leaf(dialect.unsupported ? dialect.unsupported(node, ctx) : [piece(node.raw || node.text, 'field')]);
    if (node.type === 'not') {
        if (dialect.not) return dialect.not(node, ctx, (child) => compile(child, dialect, ctx));
        // In "(concepts) NOT (exclusions)" the concept blocks still get their own lines
        const left = compile(node.left, dialect, ctx, isTop);
        const right = compile(node.right, dialect, ctx);
        return leaf([...wrapIfNeeded(left, 'not'), piece(` ${dialect.ops.NOT} `, 'operator'), ...wrapIfNeeded(right, 'not')], false, 'not');
    }
    return compileList(node, dialect, ctx, isTop);
}

function compileList(node, dialect, ctx, isTop) {
    const entries = [];
    if (node.type === 'or' && dialect.groupKey) {
        // Terms in the same field share one field code, e.g. (a OR b).ti,ab. instead of a.ti,ab. OR b.ti,ab.
        const order = [];
        const groups = new Map();
        node.items.forEach((item) => {
            const key = dialect.groupKey(item);
            if (key === null || key === undefined) {
                order.push({ item });
                return;
            }
            if (!groups.has(key)) {
                groups.set(key, []);
                order.push({ key });
            }
            groups.get(key).push(item);
        });
        order.forEach((entry) => {
            if (entry.item) {
                entries.push(compile(entry.item, dialect, ctx));
                return;
            }
            const terms = groups.get(entry.key);
            entries.push(terms.length === 1 ? compile(terms[0], dialect, ctx) : dialect.fieldGroup(entry.key, terms, ctx));
        });
    } else {
        node.items.forEach((item) => entries.push(compile(item, dialect, ctx)));
    }
    if (entries.length === 1) return entries[0];

    const opText = node.type === 'or' ? dialect.ops.OR : dialect.ops.AND;
    // Concept blocks go on their own lines, like PreVue's own queries
    const lineBreaks = isTop && node.type === 'and' && dialect.multiLine && entries.some((e) => !e.safe || e.block);
    let joiner = opText ? ` ${opText} ` : ' ';
    if (lineBreaks) joiner = `\n\n${opText}\n\n`;
    const pieces = [];
    entries.forEach((entry, i) => {
        if (i > 0) pieces.push(piece(joiner, 'operator'));
        pieces.push(...wrapIfNeeded(entry, node.type));
    });
    return leaf(pieces, false, node.type);
}

// PubMed itself: a cleaned-up copy of the search, with brackets that make the order explicit
const pubmedText = (node) => (node.quoted || isPhrase(node.text) ? `"${node.text}"` : node.text);
const PUBMED = {
    ops: OPS,
    multiLine: true,
    term(node, ctx) {
        if (node.distance !== undefined) {
            let field = node.field;
            if (field !== 'tiab' && field !== 'ti') {
                field = 'tiab';
                ctx.flag(CHECK.pubmedProximityField, node.text);
            }
            if (node.words.some((word) => /[*?#$]/.test(word))) ctx.flag(CHECK.pubmedProximityWildcard, node.text);
            proximityChecks(ctx, node);
            return leaf([piece(`"${node.words.join(' ')}"`, 'term'), piece(`[${field}:~${node.distance}]`, 'field')]);
        }
        wildcardCheck(ctx, node);
        const out = [piece(pubmedText(node), 'term')];
        if (node.field) out.push(piece(`[${node.field}]`, 'field'));
        return leaf(out);
    },
    heading(node, ctx) {
        let tag = node.explode ? 'Mesh' : 'Mesh:NoExp';
        if (node.major) tag = node.explode ? 'Majr' : 'Majr:NoExp';
        // Subheadings are kept when they were written for PubMed
        const keepSubheading = node.subheading && !node.source;
        const name = keepSubheading ? `${node.text}/${node.subheading}` : node.text;
        const flag = headingFlags(ctx, node, 'mesh', null, keepSubheading);
        return [piece(`"${name}"`, 'heading', flag), piece(`[${tag}]`, 'field')];
    },
    unsupported(node) {
        return [piece(pubmedText(node), 'term'), piece(`[${node.tag}]`, 'field')];
    },
};

// target: the thesaurus the database uses (or null); fixedCheck: a message for databases with
// no subject headings; keptSubheading: the subheading was written, so it needs no check
function headingFlags(ctx, node, target, fixedCheck = null, keptSubheading = false) {
    const flags = [];
    const check = fixedCheck || mappingCheck(node, target);
    if (check) flags.push(ctx.flag(check, node.text));
    if (node.subheading && !keptSubheading) flags.push(ctx.flag(CHECK.subheading, `${node.text}/${node.subheading}`));
    return flags.length ? flags.join(' ') : null;
}

function multiWordCheck(ctx, node) {
    if (node.words.length > 2) ctx.flag(CHECK.multiProximity, node.text);
}

// Ovid MEDLINE, Embase on Ovid and APA PsycInfo on Ovid
function ovidDialect({ fields, vocabulary }) {
    const suffix = (field) => (field && fields[field] ? `.${fields[field]}.` : '');
    return {
        ops: OPS,
        multiLine: true,
        term(node, ctx) {
            if (node.distance !== undefined) {
                multiWordCheck(ctx, node);
                proximityChecks(ctx, node);
                // Ovid counts one higher: ADJ3 allows up to 2 words in between, like PubMed's ~2
                return leaf([paren('('), ...proximityPieces(node.words, `ADJ${node.distance + 1}`), paren(')'), piece(suffix(node.field), 'field')]);
            }
            wildcardCheck(ctx, node);
            const out = [piece(dq(node.text), 'term')];
            if (suffix(node.field)) out.push(piece(suffix(node.field), 'field'));
            return leaf(out);
        },
        groupKey: (item) => (item.type === 'term' && item.distance === undefined && suffix(item.field) ? item.field : null),
        fieldGroup(field, terms, ctx) {
            terms.forEach((t) => wildcardCheck(ctx, t));
            return block([paren('('), ...joinPieces(terms.map((t) => [piece(dq(t.text), 'term')]), ' OR '), paren(')'), piece(suffix(field), 'field')]);
        },
        heading(node, ctx) {
            // Ovid subheading codes (such as /dt) are kept when the search was written for Ovid
            const keepSubheading = Boolean(node.subheading) && node.source === 'ovid';
            const text = `${node.explode ? 'exp ' : ''}${node.major ? '*' : ''}${node.text}/${keepSubheading ? node.subheading : ''}`;
            return [piece(text, 'heading', headingFlags(ctx, node, vocabulary, null, keepSubheading))];
        },
    };
}

// Embase.com and the Cochrane Library write field codes after the term, e.g. 'asthma':ti,ab,kw
const AFTER_TERM_FIELDS = Object.freeze({ tiab: 'ti,ab,kw', ti: 'ti', ab: 'ab', tw: 'ti,ab,kw', all: null });
const afterTermField = (field) => (field && AFTER_TERM_FIELDS[field] ? `:${AFTER_TERM_FIELDS[field]}` : '');
const embaseQuote = (text) => (text.includes("'") ? `"${text}"` : `'${text}'`);

const EMBASE = {
    ops: OPS,
    multiLine: true,
    term(node, ctx) {
        const field = afterTermField(node.field);
        if (node.distance !== undefined) {
            multiWordCheck(ctx, node);
            // NEXT/n keeps the word order, NEAR/n doesn't
            const op = node.ordered ? `NEXT/${node.distance + 1}` : `NEAR/${node.distance + 1}`;
            return leaf([paren('('), ...proximityPieces(node.words, op), paren(')'), ...(field ? [piece(field, 'field')] : [])]);
        }
        wildcardCheck(ctx, node);
        return leaf([piece(embaseQuote(node.text), 'term'), ...(field ? [piece(field, 'field')] : [])]);
    },
    groupKey: (item) => (item.type === 'term' && item.distance === undefined && afterTermField(item.field) ? item.field : null),
    fieldGroup(field, terms, ctx) {
        terms.forEach((t) => wildcardCheck(ctx, t));
        return block([paren('('), ...joinPieces(terms.map((t) => [piece(embaseQuote(t.text), 'term')]), ' OR '), paren(')'), piece(afterTermField(field), 'field')]);
    },
    heading(node, ctx) {
        let suffix = node.explode ? '/exp' : '/de';
        if (node.major) suffix = node.explode ? '/exp/mj' : '/mj';
        const flag = headingFlags(ctx, node, 'emtree');
        return [piece(embaseQuote(node.text), 'heading', flag), piece(suffix, 'field')];
    },
};

// The Cochrane Library can't truncate inside quotes, so "breast feed*" becomes (breast NEXT feed*)
function cochraneTerm(text) {
    if (isPhrase(text) && text.includes('*')) return [paren('('), ...proximityPieces(text.split(' '), 'NEXT'), paren(')')];
    return [piece(dq(text), 'term')];
}

const COCHRANE = {
    ops: OPS,
    multiLine: true,
    term(node, ctx) {
        const field = afterTermField(node.field);
        if (node.distance !== undefined) {
            multiWordCheck(ctx, node);
            proximityChecks(ctx, node);
            return leaf([paren('('), ...proximityPieces(node.words, `NEAR/${node.distance + 1}`), paren(')'), ...(field ? [piece(field, 'field')] : [])]);
        }
        wildcardCheck(ctx, node);
        return leaf([...cochraneTerm(node.text), ...(field ? [piece(field, 'field')] : [])]);
    },
    groupKey: (item) => (item.type === 'term' && item.distance === undefined && afterTermField(item.field) ? item.field : null),
    fieldGroup(field, terms, ctx) {
        terms.forEach((t) => wildcardCheck(ctx, t));
        return block([paren('('), ...joinPieces(terms.map((t) => cochraneTerm(t.text)), ' OR '), paren(')'), piece(afterTermField(field), 'field')]);
    },
    heading(node, ctx) {
        const name = isPhrase(node.text) || node.subheading ? `"${node.text}"` : node.text;
        // Cochrane qualifiers (such as /DT) are kept when the search was written for the Cochrane Library
        const keepSubheading = Boolean(node.subheading) && node.source === 'cochrane' && !node.major;
        const text = `[mh ${node.explode ? '' : '^'}${name}${keepSubheading ? `/${node.subheading}` : ''}${node.major ? '[mj]' : ''}]`;
        return [piece(text, 'heading', headingFlags(ctx, node, 'mesh', null, keepSubheading))];
    },
};

// CINAHL (EBSCO): field codes go before the term; title or abstract is TI (...) OR AB (...)
const CINAHL_FIELDS = Object.freeze({ tiab: ['TI', 'AB'], ti: ['TI'], ab: ['AB'], tw: ['TX'], all: ['TX'] });
const cinahlCodes = (field) => (field && CINAHL_FIELDS[field] ? CINAHL_FIELDS[field] : []);

const CINAHL = {
    ops: OPS,
    multiLine: true,
    term(node, ctx) {
        const codes = cinahlCodes(node.field);
        let inner = [piece(dq(node.text), 'term')];
        if (node.distance !== undefined) {
            multiWordCheck(ctx, node);
            // Wn keeps the word order, Nn doesn't
            inner = [paren('('), ...proximityPieces(node.words, `${node.ordered ? 'W' : 'N'}${node.distance}`), paren(')')];
        } else {
            wildcardCheck(ctx, node);
        }
        if (codes.length === 0) return leaf(inner);
        if (codes.length === 1) return leaf([piece(`${codes[0]} `, 'field'), ...inner]);
        return leaf([paren('('), piece('TI ', 'field'), ...inner, piece(' OR ', 'operator'), piece('AB ', 'field'), ...inner, paren(')')]);
    },
    groupKey: (item) => (item.type === 'term' && item.distance === undefined && cinahlCodes(item.field).length ? item.field : null),
    fieldGroup(field, terms, ctx) {
        terms.forEach((t) => wildcardCheck(ctx, t));
        const inner = [paren('('), ...joinPieces(terms.map((t) => [piece(dq(t.text), 'term')]), ' OR '), paren(')')];
        const codes = cinahlCodes(field);
        if (codes.length === 1) return block([piece(`${codes[0]} `, 'field'), ...inner]);
        return block([piece('TI ', 'field'), ...inner, piece(' OR ', 'operator'), piece('AB ', 'field'), ...inner], false, 'or');
    },
    heading(node, ctx) {
        const text = `(${node.major ? 'MM' : 'MH'} "${node.text}${node.explode ? '+' : ''}")`;
        return [piece(text, 'heading', headingFlags(ctx, node, 'cinahl'))];
    },
};

// Web of Science and Scopus write the field around the terms, e.g. TS=(a OR b), TITLE-ABS-KEY(a OR b).
// Terms without a field use topic / title-abstract-keywords, because their advanced search needs a field.
function aroundTermDialect({ codes, defaultCode, separator, near, ordered, not, headingCode, headingCheck, exactPhrase, ownVocabulary }) {
    const termText = (node) => (exactPhrase && node.exact ? `{${node.text}}` : dq(node.text));
    const codeFor = (field) => (field && codes[field]) || defaultCode;
    return {
        ops: { AND: 'AND', OR: 'OR', NOT: not },
        multiLine: true,
        term(node, ctx) {
            let inner = [piece(termText(node), 'term')];
            if (node.distance !== undefined) {
                multiWordCheck(ctx, node);
                // Scopus PRE/n keeps the word order; Web of Science has no ordered proximity
                if (node.ordered && !ordered) proximityChecks(ctx, node);
                inner = proximityPieces(node.words, `${node.ordered && ordered ? ordered : near}${node.distance}`);
            } else {
                wildcardCheck(ctx, node);
            }
            return leaf([piece(`${codeFor(node.field)}${separator}`, 'field'), paren('('), ...inner, paren(')')]);
        },
        groupKey: (item) => (item.type === 'term' && item.distance === undefined ? codeFor(item.field) : null),
        fieldGroup(code, terms, ctx) {
            terms.forEach((t) => wildcardCheck(ctx, t));
            return block([piece(`${code}${separator}`, 'field'), paren('('), ...joinPieces(terms.map((t) => [piece(termText(t), 'term')]), ' OR '), paren(')')]);
        },
        heading(node, ctx) {
            // Scopus index terms written for Scopus need no check
            const own = ownVocabulary && node.vocabulary === ownVocabulary && !node.explode;
            const flag = headingFlags(ctx, node, null, own ? null : headingCheck);
            return [piece(`${headingCode}${separator}`, 'field'), paren('('), piece(`"${node.text}"`, 'heading', flag), paren(')')];
        },
    };
}

const WEB_OF_SCIENCE = aroundTermDialect({
    codes: { tiab: 'TS', ti: 'TI', ab: 'AB', tw: 'TS', all: 'ALL' },
    defaultCode: 'TS',
    separator: '=',
    near: 'NEAR/',
    ordered: null,
    not: 'NOT',
    headingCode: 'TS',
    headingCheck: CHECK.wosHeading,
});

const SCOPUS = aroundTermDialect({
    codes: { tiab: 'TITLE-ABS-KEY', ti: 'TITLE', ab: 'ABS', tw: 'TITLE-ABS-KEY', all: 'ALL' },
    defaultCode: 'TITLE-ABS-KEY',
    separator: '',
    near: 'W/',
    ordered: 'PRE/',
    not: 'AND NOT',
    headingCode: 'INDEXTERMS',
    headingCheck: CHECK.scopusHeading,
    exactPhrase: true,
    ownVocabulary: 'index',
});

// CORE: the same field codes PreVue uses for its live CORE search
const CORE_PREFIX = Object.freeze({ ti: 'title:', ab: 'abstract:' });
const CORE = {
    ops: OPS,
    multiLine: true,
    term(node, ctx) {
        if (node.distance !== undefined) {
            ctx.flag(CHECK.noProximity, node.text);
            return leaf([paren('('), ...joinPieces(node.words.map((w) => [piece(w, 'term')]), ' AND '), paren(')')]);
        }
        if (node.field === 'tiab') ctx.flag(CHECK.coreTiab, null);
        wildcardCheck(ctx, node);
        const prefix = node.field && CORE_PREFIX[node.field] ? CORE_PREFIX[node.field] : '';
        const text = prefix ? `"${node.text}"` : dq(node.text);
        return leaf([...(prefix ? [piece(prefix, 'field')] : []), piece(text, 'term')]);
    },
    heading(node, ctx) {
        return [piece(dq(node.text), 'heading', headingFlags(ctx, node, null, CHECK.noHeadings))];
    },
};

// Google Scholar: quotes, OR, a minus sign to exclude, and intitle: for titles
function googleTerm(node, ctx) {
    let text = node.text;
    if (text.includes('*')) {
        ctx.flag(CHECK.noTruncation, node.text);
        text = text.replace(/\*/g, '').replace(/\s+/g, ' ').trim() || node.text.replace(/\*/g, '');
    }
    if (node.distance !== undefined) {
        ctx.flag(CHECK.noProximity, node.text);
        return leaf(joinPieces(text.split(' ').map((w) => [piece(w, 'term')]), ' '), false, 'and');
    }
    wildcardCheck(ctx, node);
    if (node.field === 'ti') return leaf([piece('intitle:', 'field'), piece(dq(text), 'term')]);
    const flag = node.field === 'ab' ? ctx.flag(CHECK.noAbstract, node.text) : null;
    return leaf([piece(dq(text), 'term', flag)]);
}

const GOOGLE_SCHOLAR = {
    ops: { AND: '', OR: 'OR', NOT: '-' },
    multiLine: false,
    term: googleTerm,
    heading(node, ctx) {
        return [piece(dq(node.text), 'heading', headingFlags(ctx, node, null, CHECK.noHeadings))];
    },
    not(node, ctx, compileChild) {
        const left = compileChild(node.left);
        const right = node.right;
        let excluded = null;
        if (right.type === 'term' || right.type === 'heading') excluded = [right];
        else if (right.type === 'or' && right.items.every((item) => item.type === 'term' || item.type === 'heading')) excluded = right.items;
        if (!excluded) {
            ctx.flag(CHECK.googleExclude, null);
            return left;
        }
        const pieces = [...wrapIfNeeded(left, 'and')];
        excluded.forEach((item) => {
            pieces.push(piece(' -', 'operator'), ...compileChild(item).pieces);
        });
        return leaf(pieces, false, 'and');
    },
};

// Semantic Scholar: a short keyword version, one phrase from each part of the search
function firstLeaf(node) {
    if (node.type === 'term' || node.type === 'heading') return node;
    if (node.type === 'not') return firstLeaf(node.left);
    for (const item of node.items || []) {
        const found = firstLeaf(item);
        if (found) return found;
    }
    return null;
}

function semanticScholarCompile(tree, ctx) {
    let main = tree;
    while (main.type === 'not') main = main.left;
    const parts = main.type === 'and' ? main.items : [main];
    const phrases = [];
    for (const part of parts) {
        const found = firstLeaf(part);
        const text = found ? found.text.replace(/\*/g, '').replace(/\s+/g, ' ').trim() : '';
        if (text && !phrases.includes(text)) phrases.push(text);
        if (phrases.length >= SEMANTIC_SCHOLAR_MAX_PHRASES) break;
    }
    ctx.flag(CHECK.semanticScholar, null);
    return leaf(joinPieces(phrases.map((p) => [piece(`"${p}"`, 'term')]), ' '));
}

const DIALECTS = Object.freeze({
    pubmed: PUBMED,
    ovidMedline: ovidDialect({ fields: { tiab: 'ti,ab', ti: 'ti', ab: 'ab', tw: 'tw', all: 'mp' }, vocabulary: 'mesh' }),
    embase: EMBASE,
    embaseOvid: ovidDialect({ fields: { tiab: 'ti,ab,kw', ti: 'ti', ab: 'ab', tw: 'tw', all: 'mp' }, vocabulary: 'emtree' }),
    cochrane: COCHRANE,
    cinahl: CINAHL,
    psycinfo: ovidDialect({ fields: { tiab: 'ti,ab,id', ti: 'ti', ab: 'ab', tw: 'tw', all: 'mp' }, vocabulary: 'apa' }),
    webOfScience: WEB_OF_SCIENCE,
    scopus: SCOPUS,
    core: CORE,
    googleScholar: GOOGLE_SCHOLAR,
});

// Collects what to check, with the terms each check applies to
function makeContext() {
    const checks = new Map();
    return {
        flag(message, item) {
            if (!checks.has(message)) checks.set(message, []);
            const items = checks.get(message);
            if (item && !items.includes(item)) items.push(item);
            return message;
        },
        list: () => [...checks.entries()].map(([message, items]) => ({ message, items })),
    };
}

function translateFor(database, tree) {
    const ctx = makeContext();
    const removed = [];
    const source = tidy(removeUnsupported(tree, removed, WRITER_FAMILY[database.key]));
    if (removed.length) {
        const labels = [...new Set(removed.map(unsupportedLabel))].join(', ');
        ctx.flag(`Not translated: ${labels}${labels.endsWith('.') ? '' : '.'} Use the limits in ${database.name} instead (for example dates, languages or publication types).`, null);
    }
    let compiled = leaf([]);
    if (source) {
        compiled = database.key === 'semanticScholar'
            ? semanticScholarCompile(source, ctx)
            : compile(source, DIALECTS[database.key], ctx, true);
    }
    const pieces = compiled.pieces.filter((p) => p.text !== '');
    const text = pieces.map((p) => p.text).join('');
    // Many search boxes take one line, so copying uses this version
    const oneLine = text.replace(/\s*\n\s*/g, ' ').trim();
    if (database.key === 'googleScholar') {
        ctx.flag(CHECK.googleSyntax, null);
        if (oneLine.length > GOOGLE_SCHOLAR_MAX_CHARS) ctx.flag(CHECK.googleLength, null);
    }
    return {
        key: database.key,
        name: database.name,
        where: database.where,
        text,
        oneLine,
        pieces,
        checks: ctx.list(),
        link: databaseLink(database.key, oneLine),
    };
}

// Writes a parsed search for one database (used by the tests to check reading and writing match)
export function formatTree(tree, databaseKey) {
    const database = TRANSLATOR_DATABASES.find((d) => d.key === databaseKey);
    return database && tree ? translateFor(database, tree).text : '';
}

// Translates a search for every database. options.syntax: 'auto' (guess) or one of SYNTAXES.
// Returns { empty, notes, results, syntax }; throws SearchSyntaxError if the search can't be read.
export function translateSearch(rawText, options = {}) {
    const { tree, notes, syntax } = readSearch(rawText, options.syntax || 'auto');
    if (!tree) return { empty: true, notes: [], results: [] };
    return { empty: false, notes, syntax, results: TRANSLATOR_DATABASES.map((database) => translateFor(database, tree)) };
}

export const EXAMPLE_SEARCH = '("Acne Vulgaris"[Mesh] OR acne[tiab])\nAND\n("blue light"[tiab] OR phototherap*[tiab] OR "photodynamic therapy"[tiab] OR "light therap*"[tiab])';
