// Search Translator, part 1: reads a search written for any supported database (or plain
// keywords) into one tree. searchTranslator.js then writes that tree for each database.
// It runs entirely in the browser: the search is never sent anywhere.
// Plain JavaScript (no React), so it can be tested with Node:  npm test
//
// Syntax sources: each database's own search help (PubMed, Ovid, Embase, Cochrane Library,
// EBSCO, Web of Science, Scopus), the Cochrane Library's guide to converting searches,
// and KU Leuven Libraries' cross-database syntax table (2026).
//
// The tree:
//   { type: 'and' | 'or', items: [...] }, { type: 'not', left, right }
//   { type: 'term', text, quoted, field, distance?, words?, ordered?, exact? }
//       field: null (no field), 'tiab', 'ti', 'ab', 'tw' (text words) or 'all'
//   { type: 'heading', text, subheading, explode, major, vocabulary? }
//       vocabulary: 'mesh' (when missing), 'emtree', 'cinahl', 'apa' or 'index'
//   { type: 'unsupported', text, quoted, tag, source?, raw?, passthrough? }
//       limits PreVue can't translate (dates, languages...). source is missing for PubMed.

export const MAX_SEARCH_CHARS = 20000;
const MAX_DEPTH = 40; // brackets inside brackets
const MAX_TERMS = 2000;
const MAX_TAG_CHARS = 60;
const MAX_LINES = 500;
const MAX_TREE_DEPTH = 300;
const MAX_PROXIMITY_COMBINATIONS = 50;
const MAX_LABEL_CHARS = 40;

export class SearchSyntaxError extends Error {
    constructor(message, position = null) {
        super(message);
        this.name = 'SearchSyntaxError';
        this.position = position;
    }
}

// Curly quotes (common when a search is copied from Word) become straight quotes.
// Each character is replaced by one character, so error positions stay correct.
const CURLY_DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;
const CURLY_SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032]/g;
export const normalizeSearchText = (text) => String(text ?? '')
    .replace(CURLY_DOUBLE_QUOTES, '"')
    .replace(CURLY_SINGLE_QUOTES, "'");

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isSpace = (ch) => /\s/.test(ch);
const shorten = (text) => (text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS)}...` : text);

// ---------- The syntaxes PreVue can read ----------

// family: how the text is read. vocabulary: the thesaurus its subject headings come from.
export const SYNTAXES = Object.freeze([
    { key: 'pubmed', name: 'PubMed or plain keywords', family: 'pubmed', vocabulary: 'mesh' },
    { key: 'ovidMedline', name: 'Ovid MEDLINE', family: 'ovid', vocabulary: 'mesh' },
    { key: 'embaseOvid', name: 'Embase (Ovid)', family: 'ovid', vocabulary: 'emtree' },
    { key: 'psycinfo', name: 'APA PsycInfo (Ovid)', family: 'ovid', vocabulary: 'apa' },
    { key: 'embase', name: 'Embase (Embase.com)', family: 'embase', vocabulary: 'emtree' },
    { key: 'cochrane', name: 'Cochrane Library', family: 'cochrane', vocabulary: 'mesh' },
    { key: 'cinahl', name: 'CINAHL (EBSCO)', family: 'cinahl', vocabulary: 'cinahl' },
    { key: 'webOfScience', name: 'Web of Science', family: 'wos', vocabulary: null },
    { key: 'scopus', name: 'Scopus', family: 'scopus', vocabulary: 'index' },
    { key: 'googleScholar', name: 'Google Scholar', family: 'google', vocabulary: null },
]);
export const findSyntax = (key) => SYNTAXES.find((syntax) => syntax.key === key) || null;

// What field codes search, in PreVue's terms: ti, ab, tw (text words), all, kw (keywords,
// read as the closest field), heading (a subject heading) or limit (not translated).
const codeTable = (entries) => new Map(Object.entries(entries));
const OVID_CODES = codeTable({ ti: 'ti', ab: 'ab', ot: 'ti', tw: 'tw', mp: 'all', af: 'all', kw: 'kw', kf: 'kw', id: 'kw', sh: 'heading' });
const AFTER_TERM_CODES = codeTable({ ti: 'ti', ab: 'ab', tt: 'ti', kw: 'kw', de: 'heading' }); // Embase and Cochrane
const CINAHL_CODES = codeTable({
    TI: 'ti', AB: 'ab', TX: 'all', KW: 'kw', SU: 'kw', MH: 'heading', MM: 'major',
    AU: 'limit', SO: 'limit', PT: 'limit', LA: 'limit', DT: 'limit', PY: 'limit', JN: 'limit', IS: 'limit',
    IB: 'limit', AN: 'limit', AF: 'limit', ZT: 'limit', ZY: 'limit', PZ: 'limit', AD: 'limit', JT: 'limit',
});
const WOS_CODES = codeTable({
    TS: 'tiab', TI: 'ti', AB: 'ab', ALL: 'all', AK: 'kw', KP: 'kw',
    AU: 'limit', AI: 'limit', AD: 'limit', AF: 'limit', DO: 'limit', DT: 'limit', ED: 'limit', FG: 'limit',
    FO: 'limit', FT: 'limit', FD: 'limit', GP: 'limit', LA: 'limit', OG: 'limit', OO: 'limit', PMID: 'limit',
    PY: 'limit', SA: 'limit', SG: 'limit', SO: 'limit', SU: 'limit', UT: 'limit', WC: 'limit', ZP: 'limit',
    PS: 'limit', CI: 'limit', CU: 'limit', CF: 'limit', IS: 'limit', DOP: 'limit', PUBL: 'limit',
});
const SCOPUS_FIELDS = codeTable({
    'TITLE-ABS-KEY': 'tiab', 'TITLE-ABS': 'tiab', TITLE: 'ti', ABS: 'ab', KEY: 'kw', AUTHKEY: 'kw',
    INDEXTERMS: 'heading', ALL: 'all',
});
const SCOPUS_LIMITS = new Set(['SRCTITLE', 'EXACTSRCTITLE', 'SRCTYPE', 'SRCID', 'AUTH', 'AUTHOR-NAME', 'AUTHLASTNAME',
    'AUTHFIRST', 'AU-ID', 'AF-ID', 'ORCID', 'AFFIL', 'AFFILORG', 'AFFILCITY', 'AFFILCOUNTRY', 'DOCTYPE', 'LANGUAGE',
    'SUBJAREA', 'LIMIT-TO', 'EXCLUDE', 'ISSN', 'EISSN', 'ISBN', 'DOI', 'PMID', 'EXACTKEYWORD', 'PUBSTAGE', 'OPENACCESS',
    'FUND-SPONSOR', 'FUND-ACR', 'FUND-NO', 'REF', 'REFTITLE', 'REFAUTH', 'REFSRCTITLE', 'REFPUBYEAR', 'CHEM',
    'CASREGNUMBER', 'CHEMNAME', 'CODEN', 'CONF', 'CONFNAME', 'EDITOR', 'PUBLISHER', 'SEQBANK', 'SEQNUMBER', 'TRADENAME',
    'MANUFACTURER', 'ARTNUM', 'VOLUME', 'ISSUE', 'PAGES', 'PAGEFIRST', 'PAGELAST', 'PUBYEAR', 'PUBDATETXT']);
const GOOGLE_PREFIXES = codeTable({ intitle: 'ti', allintitle: 'ti', intext: 'all', allintext: 'all', author: 'limit', source: 'limit', site: 'limit' });

// One or more field codes together (for example ti,ab,kw) as one PreVue field
function resolveCodes(codes, table) {
    const kinds = codes.map((code) => (table.has(code) ? table.get(code) : 'limit'));
    if (kinds.length === 0 || kinds.includes('limit')) return { kind: 'limit' };
    if (kinds.includes('heading') || kinds.includes('major')) {
        if (kinds.length > 1) return { kind: 'limit' };
        return { kind: 'heading', major: kinds[0] === 'major' };
    }
    if (kinds.includes('all')) return { kind: 'field', field: 'all' };
    if (kinds.includes('tw')) return { kind: 'field', field: 'tw' };
    const keywords = kinds.includes('kw');
    const title = kinds.includes('ti') || kinds.includes('tiab');
    const abstract = kinds.includes('ab') || kinds.includes('tiab');
    let field = 'tiab';
    if (title && !abstract) field = 'ti';
    if (abstract && !title) field = 'ab';
    return { kind: 'field', field, keywords };
}

// The way each family reads text.
//   adjacency: words with no operator between them are one 'phrase', or joined with 'and'
//   precedence: null (left to right) or the order of operators (higher first)
const FAMILIES = Object.freeze({
    pubmed: { adjacency: 'phrase', precedence: null, order: 'from left to right, as PubMed does' },
    ovid: { adjacency: 'phrase', precedence: null, order: 'from left to right' },
    embase: { adjacency: 'phrase', precedence: null, order: 'from left to right, as Embase does' },
    cochrane: { adjacency: 'phrase', precedence: null, order: 'from left to right' },
    cinahl: { adjacency: 'phrase', precedence: null, order: 'from left to right' },
    wos: { adjacency: 'and', precedence: { NOT: 3, AND: 2, OR: 1 }, order: 'as Web of Science does: NOT first, then AND, then OR' },
    scopus: { adjacency: 'and', precedence: { ANDNOT: 3, AND: 2, OR: 1 }, order: 'as Scopus does since its 2026 update: AND NOT first, then AND, then OR' },
    google: { adjacency: 'and', precedence: null, order: 'from left to right' },
});

// Proximity operators: { distance (words allowed in between, like PubMed's ~N), ordered, assumed }
// Ovid ADJn, Embase NEAR/n and Cochrane NEAR/n count one higher than PubMed's ~N.
function readNear(word, family) {
    let m;
    if (family === 'ovid') {
        if ((m = word.match(/^adj(\d{0,2})$/i))) {
            return m[1] === '' ? { distance: 0, ordered: true } : { distance: Math.max(0, Number(m[1]) - 1), ordered: false };
        }
    } else if (family === 'embase' || family === 'cochrane') {
        if ((m = word.match(/^near\/(\d{1,2})$/i))) return { distance: Math.max(0, Number(m[1]) - 1), ordered: false };
        if ((m = word.match(/^next\/(\d{1,2})$/i))) return { distance: Math.max(0, Number(m[1]) - 1), ordered: true };
        // The Cochrane Library's guide: NEAR on its own is NEAR/6, and NEXT means next to each other
        if (/^near$/i.test(word)) return family === 'cochrane' ? { distance: 5, ordered: false } : { distance: 4, ordered: false, assumed: 'NEAR/5' };
        if (/^next$/i.test(word)) return { distance: 0, ordered: true };
    } else if (family === 'cinahl') {
        if ((m = word.match(/^N(\d{1,2})$/))) return { distance: Number(m[1]), ordered: false };
        if ((m = word.match(/^W(\d{1,2})$/))) return { distance: Number(m[1]), ordered: true };
    } else if (family === 'wos') {
        if ((m = word.match(/^near\/(\d{1,2})$/i))) return { distance: Number(m[1]), ordered: false };
        if (/^near$/i.test(word)) return { distance: 15, ordered: false, assumed: 'NEAR/15' };
    } else if (family === 'scopus') {
        if ((m = word.match(/^w\/(\d{1,2})$/i))) return { distance: Number(m[1]), ordered: false };
        if ((m = word.match(/^pre\/(\d{1,2})$/i))) return { distance: Number(m[1]), ordered: true };
    }
    return null;
}

// ---------- PubMed field tags ----------

const FIELD_TAGS = Object.freeze({
    tiab: 'tiab', 'title/abstract': 'tiab',
    ti: 'ti', title: 'ti',
    ab: 'ab', abstract: 'ab',
    tw: 'tw', 'text word': 'tw', textword: 'tw',
    all: 'all', 'all fields': 'all', 'all field': 'all',
});
const MESH = { explode: true, major: false };
const MESH_NO_EXPLODE = { explode: false, major: false };
const MAJOR = { explode: true, major: true };
const MAJOR_NO_EXPLODE = { explode: false, major: true };
const HEADING_TAGS = Object.freeze({
    mh: MESH, mesh: MESH, 'mesh terms': MESH, 'mesh term': MESH,
    'mh:noexp': MESH_NO_EXPLODE, 'mesh:noexp': MESH_NO_EXPLODE, 'mesh terms:noexp': MESH_NO_EXPLODE,
    majr: MAJOR, 'mesh major topic': MAJOR,
    'majr:noexp': MAJOR_NO_EXPLODE, 'mesh major topic:noexp': MAJOR_NO_EXPLODE,
});

function readTag(token) {
    const raw = token.value.trim();
    if (raw.length > MAX_TAG_CHARS) return { kind: 'unsupported', raw: `${raw.slice(0, MAX_TAG_CHARS)}...` };
    const key = raw.toLowerCase().replace(/\s+/g, ' ');
    if (has(FIELD_TAGS, key)) return { kind: 'field', field: FIELD_TAGS[key] };
    if (has(HEADING_TAGS, key)) return { kind: 'heading', ...HEADING_TAGS[key] };
    // Proximity, for example "hip fracture"[tiab:~2]
    const proximity = key.match(/^(tiab|title\/abstract|ti|title):~(\d{1,2})$/);
    if (proximity) return { kind: 'field', field: FIELD_TAGS[proximity[1]], distance: Number(proximity[2]) };
    return { kind: 'unsupported', raw };
}

// ---------- Reading the text into tokens ----------

const BASIC_ENDS = new Set(['(', ')', '"', '[', ']']);

// Where a word ends
function chunkEnd(text, i, end, family) {
    let j = i;
    while (j < end) {
        const ch = text[j];
        if (isSpace(ch) || BASIC_ENDS.has(ch)) break;
        if ((ch === '{' || ch === '}') && (family === 'scopus' || family === 'cochrane')) break;
        j += 1;
    }
    return j;
}

const isOperatorWord = (word, family) => {
    if (family === 'google') return word === 'OR' || word === 'AND';
    const upper = word.toUpperCase();
    return upper === 'AND' || upper === 'OR' || upper === 'NOT';
};

// Ovid subject headings end with a slash: exp Acne Vulgaris/, *Acne/, Acne Vulgaris/dt,th
const OVID_HEADING_END = /^(.*)\/([a-z]{2}(?:,[a-z]{2})*)?(,)?$/i;

function readOvidHeading(text, start, end, vocabulary) {
    const chunks = [];
    let k = start;
    while (k < end && chunks.length < 40) {
        let s = k;
        while (s < end && isSpace(text[s])) s += 1;
        if (s >= end || BASIC_ENDS.has(text[s])) break;
        const e = chunkEnd(text, s, end, 'ovid');
        const chunk = text.slice(s, e);
        if (isOperatorWord(chunk, 'ovid') || readNear(chunk, 'ovid')) break;
        chunks.push({ text: chunk, end: e });
        k = e;
        if (chunk.includes('/')) break;
    }
    const last = chunks[chunks.length - 1];
    if (!last || !last.text.includes('/')) return null;
    const m = last.text.match(OVID_HEADING_END);
    if (!m) return null;
    let names = chunks.slice(0, -1).map((c) => c.text);
    let explode = false;
    if (names.length && names[0].toLowerCase() === 'exp') {
        explode = true;
        names = names.slice(1);
    } else if (names.length === 0 && m[1].toLowerCase() === 'exp') {
        return null;
    }
    if (names.some((name) => name.toLowerCase() === 'exp')) return null;
    if (!explode && names.length === 0 && /^(and|or|not)$/i.test(m[1])) return null;
    names.push(m[1]);
    let major = false;
    if (names[0].startsWith('*')) {
        major = true;
        names[0] = names[0].slice(1);
    }
    const name = names.join(' ').replace(/\s+/g, ' ').trim();
    if (!name || name.includes('/')) return null;
    let headingEnd = last.end;
    const subheadings = m[2] ? m[2].split(',') : [];
    // "Acne Vulgaris/dt, th": more subheadings after a comma and a space
    if (m[3]) {
        let s = headingEnd;
        for (;;) {
            let t = s;
            while (t < end && text[t] === ' ') t += 1;
            const e = chunkEnd(text, t, end, 'ovid');
            const more = text.slice(t, e).match(/^([a-z]{2})(,?)$/i);
            if (!more) break;
            subheadings.push(more[1]);
            headingEnd = e;
            s = e;
            if (!more[2]) break;
        }
    }
    return {
        node: { type: 'heading', text: name, subheading: subheadings.length ? subheadings.join(',') : null, explode, major, vocabulary, source: 'ovid' },
        end: headingEnd,
    };
}

// Cochrane: [mh "Acne Vulgaris"], [mh ^Acne], [mh "Acne Vulgaris"[mj]], [mh "Acne"/DT,TH], [mh /DT]
function readCochraneMh(text, i, end) {
    let depth = 0;
    let j = i;
    for (; j < end; j += 1) {
        if (text[j] === '[') depth += 1;
        else if (text[j] === ']') {
            depth -= 1;
            if (depth === 0) break;
        }
    }
    if (j >= end) throw new SearchSyntaxError('A "[mh" heading is not closed with "]".', i);
    const raw = text.slice(i, j + 1);
    let inner = text.slice(i + 3, j).trim();
    let major = false;
    if (/\[mj\]\s*$/i.test(inner)) {
        major = true;
        inner = inner.replace(/\[mj\]\s*$/i, '').trim();
    }
    let explode = true;
    if (inner.startsWith('^')) {
        explode = false;
        inner = inner.slice(1).trim();
    }
    let name = inner;
    let subheading = null;
    const quoted = inner.match(/^"([^"]*)"\s*(?:\/(.*))?$/);
    if (quoted) {
        name = quoted[1];
        subheading = quoted[2] ? quoted[2].trim() : null;
    } else if (inner.includes('/')) {
        name = inner.slice(0, inner.indexOf('/'));
        subheading = inner.slice(inner.indexOf('/') + 1).trim() || null;
    }
    name = name.replace(/\s+/g, ' ').trim();
    if (!name) {
        // A subheading on its own ("floating"), for example [mh /DT]
        return { kind: 'unsupported', raw, end: j + 1 };
    }
    return { kind: 'heading', node: { type: 'heading', text: name, subheading, explode, major, vocabulary: 'mesh', source: 'cochrane' }, end: j + 1 };
}

// Cochrane search history: MeSH descriptor: [Acne Vulgaris] explode all trees
const MESH_DESCRIPTOR = /MeSH[ \t]{1,5}descriptor[ \t]{0,5}:[ \t]{0,5}\[([^\]\n]{1,200})\][ \t]{0,10}(explode all trees|this term only)?(?:[ \t]{1,10}and[ \t]{1,5}with[ \t]{1,5}qualifiers?[ \t]{0,5}\(s\)[ \t]{0,5}:[ \t]{0,5}\[([^\]\n]{0,300})\])?/iy;

const LIMIT_SUFFIX = /\/[a-z_]{2,12}/iy;
const PUBYEAR_COMPARE = /[ \t]{0,5}(>|<|=|AFT|BEF|IS)[ \t]{0,5}(\d{4})/iy;

function makeLexer(text, start, end, syntax, env) {
    const family = syntax.family;
    const tokens = [];
    let i = start;
    const startsToken = (at) => at === start || isSpace(text[at - 1]) || text[at - 1] === '(';
    const nextNonSpace = (at) => {
        let k = at;
        while (k < end && isSpace(text[k])) k += 1;
        return k;
    };
    const refToken = (label, pos, tokenEnd) => {
        if (!env.refs) {
            throw new SearchSyntaxError(`Search history numbers like ${text.slice(pos, tokenEnd)} can't be translated. Paste the full search instead.`, pos);
        }
        return { type: 'ref', label, pos, end: tokenEnd };
    };
    // A word, split into a field code and a term where the syntax writes them together
    const pushWord = (word, pos) => {
        const wordEnd = pos + word.length;
        tokens.push({ type: 'word', value: word, pos, end: wordEnd });
    };

    while (i < end) {
        const ch = text[i];
        if (isSpace(ch)) {
            i += 1;
            continue;
        }
        if (ch === '(' || ch === ')') {
            tokens.push({ type: ch === '(' ? 'open' : 'close', pos: i });
            i += 1;
            continue;
        }
        if (ch === '"') {
            const close = text.indexOf('"', i + 1);
            if (close === -1 || close >= end) throw new SearchSyntaxError('A quotation mark (") is not closed.', i);
            tokens.push({ type: 'phrase', value: text.slice(i + 1, close), pos: i, end: close + 1 });
            i = close + 1;
            continue;
        }
        if (ch === "'" && family === 'embase' && startsToken(i)) {
            // Embase phrases use single quotes; an apostrophe inside a word doesn't close them
            let close = -1;
            let from = i + 1;
            while (from < end) {
                const at = text.indexOf("'", from);
                if (at === -1 || at >= end) break;
                if (at + 1 >= end || !/[\p{L}\p{N}]/u.test(text[at + 1])) {
                    close = at;
                    break;
                }
                from = at + 1;
            }
            if (close === -1) throw new SearchSyntaxError("A quotation mark (') is not closed.", i);
            tokens.push({ type: 'phrase', value: text.slice(i + 1, close), pos: i, end: close + 1 });
            i = close + 1;
            continue;
        }
        if (ch === '{' && family === 'scopus') {
            const close = text.indexOf('}', i + 1);
            if (close === -1 || close >= end) throw new SearchSyntaxError('A "{" is not closed with "}".', i);
            tokens.push({ type: 'phrase', value: text.slice(i + 1, close), pos: i, end: close + 1, exact: true });
            i = close + 1;
            continue;
        }
        if (ch === '{' && family === 'cochrane') {
            // {OR #1-#4} combines several lines
            const close = text.indexOf('}', i + 1);
            const inside = close === -1 || close >= end ? '' : text.slice(i + 1, close);
            const m = inside.match(/^\s*(OR|AND)\s+(#\d{1,4}(?:\s*-\s*#\d{1,4})?(?:\s*,?\s*#\d{1,4}(?:\s*-\s*#\d{1,4})?)*)\s*$/i);
            if (!m) throw new SearchSyntaxError('PreVue can only read { } in the form {OR #1-#4}.', i);
            if (!env.refs) throw new SearchSyntaxError(`Search history numbers like {${inside.trim()}} can't be translated. Paste the full search instead.`, i);
            tokens.push({ type: 'refset', op: m[1].toUpperCase(), labels: expandRanges(m[2].replace(/#/g, ''), i), pos: i, end: close + 1 });
            i = close + 1;
            continue;
        }
        if (ch === '}' && (family === 'scopus' || family === 'cochrane')) {
            throw new SearchSyntaxError('A "}" has no matching "{".', i);
        }
        if (ch === '[') {
            if (family === 'pubmed') {
                const close = text.indexOf(']', i + 1);
                if (close === -1 || close >= end) throw new SearchSyntaxError('A field tag that starts with "[" is not closed with "]".', i);
                tokens.push({ type: 'tag', value: text.slice(i + 1, close), pos: i });
                i = close + 1;
                continue;
            }
            if (family === 'cochrane' && /^\[mh\b/i.test(text.slice(i, i + 4))) {
                const mh = readCochraneMh(text, i, end);
                if (mh.kind === 'heading') tokens.push({ type: 'heading', node: { ...mh.node, pos: i }, pos: i, end: mh.end });
                else tokens.push({ type: 'unsupportedLeaf', raw: mh.raw, tag: 'mh', pos: i, end: mh.end });
                i = mh.end;
                continue;
            }
            const close = text.indexOf(']', i + 1);
            if (close === -1 || close >= end) throw new SearchSyntaxError('A "[" is not closed with "]".', i);
            if (family === 'ovid') {
                // Ovid search history adds notes in brackets, for example [mp=title, abstract, ...]
                i = close + 1;
                continue;
            }
            if (family === 'embase') {
                // Limits such as [english]/lim or [2015-2026]/py
                let limitEnd = close + 1;
                LIMIT_SUFFIX.lastIndex = limitEnd;
                const suffix = LIMIT_SUFFIX.exec(text);
                if (suffix && limitEnd + suffix[0].length <= end) limitEnd += suffix[0].length;
                tokens.push({ type: 'unsupportedLeaf', raw: text.slice(i, limitEnd), tag: 'lim', pos: i, end: limitEnd });
                i = limitEnd;
                continue;
            }
            throw new SearchSyntaxError(`"[" isn't part of ${syntax.name} search syntax.`, i);
        }
        if (ch === ']') throw new SearchSyntaxError('A "]" has no matching "[".', i);
        if (ch === '-' && family === 'google' && startsToken(i) && i + 1 < end && !isSpace(text[i + 1])) {
            tokens.push({ type: 'minus', pos: i });
            i += 1;
            continue;
        }

        // Cochrane search history: MeSH descriptor: [Acne Vulgaris] explode all trees
        if (family === 'cochrane' && /^MeSH\s+descriptor/i.test(text.slice(i, i + 20))) {
            MESH_DESCRIPTOR.lastIndex = i;
            const found = MESH_DESCRIPTOR.exec(text);
            const m = found && i + found[0].length <= end ? found : null;
            if (!m) throw new SearchSyntaxError('PreVue can only read "MeSH descriptor: [name] explode all trees" or "this term only".', i);
            const subheading = m[3] ? m[3].trim() || null : null;
            const node = {
                type: 'heading', text: m[1].replace(/\s+/g, ' ').trim(), subheading, explode: /explode/i.test(m[2] || ''), major: false, vocabulary: 'mesh', source: 'cochrane', pos: i,
            };
            tokens.push({ type: 'heading', node, pos: i, end: i + m[0].length });
            i += m[0].length;
            continue;
        }

        // Ovid subject headings: exp Acne Vulgaris/
        if (family === 'ovid') {
            const heading = readOvidHeading(text, i, end, syntax.vocabulary);
            if (heading) {
                tokens.push({ type: 'heading', node: { ...heading.node, pos: i }, pos: i, end: heading.end });
                i = heading.end;
                continue;
            }
        }

        const j = chunkEnd(text, i, end, family);
        const word = text.slice(i, j);
        const upper = word.toUpperCase();

        if (isOperatorWord(word, family)) {
            const last = tokens[tokens.length - 1];
            if (upper === 'NOT' && last && last.type === 'operator' && last.value === 'AND' && family !== 'pubmed') {
                // AND NOT: Scopus has it as its own operator; elsewhere it means NOT
                last.value = family === 'scopus' ? 'ANDNOT' : 'NOT';
                last.text = 'AND NOT';
            } else {
                tokens.push({ type: 'operator', value: upper, text: word, pos: i });
            }
            i = j;
            continue;
        }
        const near = readNear(word, family);
        if (near) {
            tokens.push({ type: 'near', ...near, text: word, pos: i });
            i = j;
            continue;
        }
        let m;
        if (/^#\d+$/.test(word) && family !== 'google') {
            tokens.push(refToken(Number(word.slice(1)), i, j));
            i = j;
            continue;
        }
        if (family === 'cinahl' && env.refs && (m = word.match(/^S(\d{1,4})$/))) {
            tokens.push(refToken(Number(m[1]), i, j));
            i = j;
            continue;
        }
        if (family === 'ovid' && (m = word.match(/^(or|and)\/(\d{1,4}(?:-\d{1,4})?(?:,\d{1,4}(?:-\d{1,4})?)*)$/i))) {
            if (!env.refs) throw new SearchSyntaxError(`Line numbers like ${word} only work in a numbered search. Paste the full search instead.`, i);
            tokens.push({ type: 'refset', op: m[1].toUpperCase(), labels: expandRanges(m[2], i), pos: i, end: j });
            i = j;
            continue;
        }

        // Field codes written before the term: CINAHL TI, Web of Science TS=, Scopus TITLE-ABS-KEY(,
        // Google Scholar intitle:
        if (family === 'cinahl' && CINAHL_CODES.has(word) && j < end && isSpace(text[j])) {
            const k = nextNonSpace(j);
            if (k < end && !isOperatorWord(text.slice(k, chunkEnd(text, k, end, family)), family) && text[k] !== ')') {
                tokens.push({ type: 'prefix', code: word, resolved: resolveCodes([word], CINAHL_CODES), raw: word, pos: i, end: j });
                i = j;
                continue;
            }
        }
        if (family === 'wos') {
            const eq = word.match(/^([A-Za-z]{2,5})=(.*)$/);
            const code = eq ? eq[1].toUpperCase() : upper;
            const afterCode = eq ? i + eq[1].length + 1 : nextNonSpace(j);
            if (WOS_CODES.has(code) && (eq || (afterCode < end && text[afterCode] === '='))) {
                const valueStart = eq ? afterCode : afterCode + 1;
                tokens.push({ type: 'prefix', code, resolved: resolveCodes([code], WOS_CODES), raw: `${code}=`, pos: i, end: valueStart });
                i = valueStart;
                continue;
            }
        }
        if (family === 'scopus' && /^[A-Za-z][A-Za-z-]{1,24}$/.test(word)) {
            const k = nextNonSpace(j);
            if (k < end && text[k] === '(') {
                if (SCOPUS_FIELDS.has(upper)) {
                    const resolved = resolveCodes([upper], SCOPUS_FIELDS);
                    tokens.push({ type: 'prefix', code: upper, resolved, raw: upper, pos: i, end: j });
                    i = j;
                    continue;
                }
                if (SCOPUS_LIMITS.has(upper)) {
                    // Limits such as LIMIT-TO(DOCTYPE, "ar") or DOCTYPE(ar): kept for Scopus only
                    const close = matchingParen(text, k, end);
                    tokens.push({ type: 'unsupportedLeaf', raw: text.slice(i, close + 1), tag: upper, pos: i, end: close + 1 });
                    i = close + 1;
                    continue;
                }
            }
            if (upper === 'PUBYEAR') {
                PUBYEAR_COMPARE.lastIndex = j;
                const found = PUBYEAR_COMPARE.exec(text);
                const cmp = found && j + found[0].length <= end ? found : null;
                if (cmp) {
                    const limitEnd = j + cmp[0].length;
                    tokens.push({ type: 'unsupportedLeaf', raw: text.slice(i, limitEnd), tag: 'PUBYEAR', pos: i, end: limitEnd });
                    i = limitEnd;
                    continue;
                }
            }
        }
        if (family === 'google' && (m = word.match(/^([a-z]+):(.*)$/i)) && GOOGLE_PREFIXES.has(m[1].toLowerCase())) {
            const code = m[1].toLowerCase();
            const valueStart = i + m[1].length + 1;
            tokens.push({ type: 'prefix', code, resolved: resolveCodes([code], GOOGLE_PREFIXES), raw: `${m[1]}:`, pos: i, end: valueStart });
            i = valueStart;
            continue;
        }

        // Field codes written after the term: Ovid .ti,ab., Embase and Cochrane :ti,ab,kw, Embase /exp
        if (family === 'ovid') {
            const suffix = word.length <= 200 ? word.match(/^(.*?)\.([a-z]{2,3}(?:,[a-z]{2,3}){0,10})\.$/i) : null;
            if (suffix) {
                if (suffix[1]) pushWord(normalizeOvidWord(suffix[1], env), i);
                const codes = suffix[2].toLowerCase().split(',');
                tokens.push({ type: 'suffix', resolved: resolveCodes(codes, OVID_CODES), raw: `.${suffix[2]}.`, pos: i + suffix[1].length, end: j });
                i = j;
                continue;
            }
            pushWord(normalizeOvidWord(word, env), i);
            i = j;
            continue;
        }
        if (family === 'embase' || family === 'cochrane') {
            const colon = word.length <= 200 ? word.match(/^(.*?)(:[a-z]{2,3}(?:[,:][a-z]{2,3}){0,10})$/i) : null;
            if (colon && (colon[1] || tokens.length)) {
                if (colon[1]) {
                    const slashInWord = family === 'embase' ? colon[1].match(/^(.*?)(\/(?:exp|de|mj)(?:\/(?:exp|de|mj))*)$/i) : null;
                    if (slashInWord) {
                        pushWord(slashInWord[1], i);
                        tokens.push({ type: 'suffix', resolved: embaseSlash(slashInWord[2]), raw: slashInWord[2], pos: i + slashInWord[1].length, end: i + colon[1].length });
                    } else {
                        pushWord(colon[1], i);
                    }
                }
                const codes = colon[2].slice(1).toLowerCase().split(/[,:]/);
                tokens.push({ type: 'suffix', resolved: resolveCodes(codes, AFTER_TERM_CODES), raw: colon[2], pos: i + colon[1].length, end: j });
                i = j;
                continue;
            }
            if (family === 'embase') {
                const slash = word.match(/^(.*?)(\/(?:exp|de|mj)(?:\/(?:exp|de|mj))*)$/i);
                if (slash && (slash[1] || tokens.length)) {
                    if (slash[1]) pushWord(slash[1], i);
                    tokens.push({ type: 'suffix', resolved: embaseSlash(slash[2]), raw: slash[2], pos: i + slash[1].length, end: j });
                    i = j;
                    continue;
                }
            }
        }
        pushWord(word, i);
        i = j;
    }
    return tokens;
}

// Embase /exp, /de, /mj and /exp/mj after a term make it an Emtree heading
function embaseSlash(raw) {
    const parts = raw.toLowerCase().split('/').filter(Boolean);
    return { kind: 'heading', explode: parts.includes('exp'), major: parts.includes('mj') };
}

// Ovid truncation: $ is the same as *, and limited truncation (*2, $2) becomes plain *
function normalizeOvidWord(word, env) {
    if (!/[$]|\*\d/.test(word)) return word;
    if (/[*$]\d/.test(word)) env.note('limitedTruncation', 'Limited truncation (such as *2 or $2) was changed to *, which has no limit.');
    return word.replace(/[*$]\d{0,2}/g, '*');
}

function matchingParen(text, open, end) {
    let depth = 0;
    let inQuotes = false;
    for (let k = open; k < end; k += 1) {
        const ch = text[k];
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch === '(') depth += 1;
        else if (!inQuotes && ch === ')') {
            depth -= 1;
            if (depth === 0) return k;
        }
    }
    throw new SearchSyntaxError('A "(" is not closed with ")".', open);
}

// "1-3,5" -> [1, 2, 3, 5]
function expandRanges(list, pos) {
    const labels = [];
    for (const part of list.split(',')) {
        const range = part.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/);
        if (!range) continue;
        const from = Number(range[1]);
        const to = range[2] ? Number(range[2]) : from;
        if (to < from || to - from > MAX_LINES) throw new SearchSyntaxError(`The line range ${part.trim()} isn't valid.`, pos);
        for (let n = from; n <= to; n += 1) labels.push(n);
    }
    return labels;
}

// ---------- Reading the tokens into a tree ----------

const UNTAGGED_HINT = Object.freeze({
    pubmed: 'Add [tiab] to search titles and abstracts everywhere.',
    ovid: 'Add .ti,ab. to search titles and abstracts everywhere.',
    embase: 'Add :ti,ab to search titles and abstracts everywhere.',
    cochrane: 'Add :ti,ab to search titles and abstracts everywhere.',
    cinahl: 'Put TI or AB before them to search titles and abstracts.',
    wos: 'Use TS= to search topics (titles, abstracts and keywords).',
    scopus: 'Use TITLE-ABS-KEY( ) to search titles, abstracts and keywords.',
    google: 'Google Scholar searches the whole record by default.',
});

function parseTokens(tokens, text, syntax, env) {
    const family = syntax.family;
    const rules = FAMILIES[family];
    let pos = 0;
    let firstImplicit = null;
    const groupTags = [];
    const peek = () => tokens[pos];
    const precedence = (op) => (rules.precedence ? rules.precedence[op] || 1 : 1);
    const codeName = (token) => (token.type === 'tag' ? `[${token.value}]` : token.raw);
    const opLabel = (token) => (token.value === 'ANDNOT' ? 'AND NOT' : token.value);
    // Operators used at each bracket level, to spot AND and OR mixed without brackets
    const groupOps = [];
    let groupCount = 0;

    function makeTerm(value, quoted, at, extra = {}) {
        const leafText = value.replace(/\s+/g, ' ').trim();
        if (!leafText) throw new SearchSyntaxError('These quotation marks are empty: "".', at);
        env.countTerm(at);
        return { type: 'term', text: leafText, quoted, field: null, pos: at, ...extra };
    }

    // A PubMed tag right after a term or phrase
    function leafWithTag(value, quoted, at) {
        let tag = null;
        if (family === 'pubmed' && peek() && peek().type === 'tag') {
            tag = readTag(peek());
            pos += 1;
        }
        if (!tag) return makeTerm(value, quoted, at);
        const leafText = value.replace(/\s+/g, ' ').trim();
        if (tag.kind === 'heading') {
            if (!leafText) throw new SearchSyntaxError('These quotation marks are empty: "".', at);
            env.countTerm(at);
            const slash = leafText.indexOf('/');
            return {
                type: 'heading',
                text: slash > 0 ? leafText.slice(0, slash).trim() : leafText,
                subheading: slash > 0 ? (leafText.slice(slash + 1).trim() || null) : null,
                explode: tag.explode,
                major: tag.major,
                pos: at,
            };
        }
        if (tag.kind === 'field') {
            const node = makeTerm(value, quoted, at);
            node.field = tag.field;
            const words = node.text.split(' ');
            if (tag.distance !== undefined && words.length >= 2) {
                node.distance = tag.distance;
                node.words = words;
            }
            return node;
        }
        if (!leafText) throw new SearchSyntaxError('These quotation marks are empty: "".', at);
        env.countTerm(at);
        return { type: 'unsupported', text: leafText, quoted, tag: tag.raw, pos: at };
    }

    function parseGroup(depth) {
        const token = peek();
        if (depth >= MAX_DEPTH) throw new SearchSyntaxError('The search has too many brackets inside brackets.', token.pos);
        pos += 1;
        if (peek() && peek().type === 'close') throw new SearchSyntaxError('These brackets are empty: "()".', token.pos);
        groupCount += 1;
        const inner = parseExpression(depth + 1, 0, groupCount);
        if (!peek() || peek().type !== 'close') throw new SearchSyntaxError('A "(" is not closed with ")".', token.pos);
        const closeToken = peek();
        pos += 1;
        inner.rawStart = token.pos;
        inner.rawEnd = closeToken.pos + 1;
        // PubMed doesn't allow a tag after brackets; like Polyglot, apply it to each term inside
        if (family === 'pubmed' && peek() && peek().type === 'tag') {
            const tagToken = peek();
            const tag = readTag(tagToken);
            if (tag.kind !== 'field' || tag.distance !== undefined) {
                throw new SearchSyntaxError(`The tag [${tagToken.value}] can't follow brackets. Put it after each term instead.`, tagToken.pos);
            }
            pos += 1;
            applyField(inner, tag.field);
            groupTags.push(tagToken.value.trim());
        }
        return inner;
    }

    function parsePrimary(depth) {
        const token = peek();
        if (!token) throw new SearchSyntaxError('A search term is missing at the end.', text.length);
        if (token.type === 'operator') throw new SearchSyntaxError(`"${opLabel(token)}" needs a search term before it.`, token.pos);
        if (token.type === 'near') throw new SearchSyntaxError(`"${token.text}" needs a search term before it.`, token.pos);
        if (token.type === 'minus') throw new SearchSyntaxError('A minus sign (-) needs a search term before it.', token.pos);
        if (token.type === 'close') throw new SearchSyntaxError('A ")" has no matching "(".', token.pos);
        if (token.type === 'tag') throw new SearchSyntaxError(`The field tag [${token.value}] has no search term before it.`, token.pos);
        if (token.type === 'suffix') throw new SearchSyntaxError(`The field code ${token.raw} has no search term before it.`, token.pos);
        if (token.type === 'open') return parseGroup(depth);
        if (token.type === 'prefix') {
            pos += 1;
            const next = peek();
            if (!next || next.type === 'close' || next.type === 'operator') {
                throw new SearchSyntaxError(`The field code ${token.raw} needs a search term after it.`, token.pos);
            }
            if (next.type === 'prefix') {
                throw new SearchSyntaxError(`Two field codes are in a row: ${token.raw} ${next.raw}. Use one field code for each term or bracket.`, next.pos);
            }
            const operand = parsePrimary(depth);
            const end = next.type === 'open' ? operand.rawEnd : (tokens[pos - 1] && (tokens[pos - 1].end || tokens[pos - 1].pos + 1));
            return applyCode(operand, token.resolved, { raw: text.slice(token.pos, end || token.end), code: token.code, pos: token.pos });
        }
        if (token.type === 'heading') {
            pos += 1;
            env.countTerm(token.pos);
            return { ...token.node };
        }
        if (token.type === 'unsupportedLeaf') {
            pos += 1;
            env.countTerm(token.pos);
            return { type: 'unsupported', text: token.raw, quoted: false, tag: token.tag, source: family, raw: token.raw, pos: token.pos };
        }
        if (token.type === 'ref') {
            pos += 1;
            return env.useRef(token.label, token.pos);
        }
        if (token.type === 'refset') {
            pos += 1;
            const parts = token.labels.map((label) => env.useRef(label, token.pos));
            if (parts.length === 1) return parts[0];
            return parts.slice(1).reduce((left, right) => ({ type: 'bool', op: token.op, left, right }), parts[0]);
        }
        if (token.type === 'phrase') {
            pos += 1;
            if (family === 'pubmed') return leafWithTag(token.value, true, token.pos);
            const node = makeTerm(token.value, true, token.pos, token.exact ? { exact: true } : {});
            node.rawStart = token.pos;
            node.rawEnd = token.end;
            return node;
        }
        // Words
        if (rules.adjacency === 'and' && family !== 'pubmed') {
            pos += 1;
            const node = makeTerm(token.value, false, token.pos);
            node.rawStart = token.pos;
            node.rawEnd = token.end;
            return node;
        }
        // Words with no operator between them are one phrase, as in Polyglot
        const words = [];
        let wordEnd = token.end;
        while (peek() && peek().type === 'word') {
            words.push(peek().value);
            wordEnd = peek().end;
            pos += 1;
        }
        // Ovid combines numbered lines with plain numbers, for example 1 or 2
        if (family === 'ovid' && env.refs && words.length === 1 && /^\d{1,4}$/.test(words[0]) && !(peek() && peek().type === 'suffix')) {
            return env.useRef(Number(words[0]), token.pos);
        }
        if (words.length > 1 && (family === 'embase' || family === 'cochrane')) {
            env.note('phrase', `Words with no operator between them were read as one phrase (for example "${shorten(words.join(' '))}"). Add quotation marks or AND to make it clear.`);
        }
        if (family === 'pubmed') return leafWithTag(words.join(' '), false, token.pos);
        const node = makeTerm(words.join(' '), false, token.pos);
        node.rawStart = token.pos;
        node.rawEnd = wordEnd;
        return node;
    }

    // A term or group with the field code written after it
    function parseOperand(depth) {
        let operand = parsePrimary(depth);
        const token = peek();
        if (token && token.type === 'suffix') {
            pos += 1;
            const start = operand.rawStart !== undefined ? operand.rawStart : operand.pos;
            operand = applyCode(operand, token.resolved, { raw: text.slice(start ?? token.pos, token.end), code: token.raw, pos: token.pos });
        }
        return operand;
    }

    // Proximity binds tightest: a NEAR/3 b
    function parseNear(depth) {
        const first = parseOperand(depth);
        if (!peek() || peek().type !== 'near') return first;
        const items = [first];
        const ops = [];
        while (peek() && peek().type === 'near') {
            const nearToken = peek();
            pos += 1;
            const next = peek();
            if (!next || next.type === 'close' || next.type === 'operator' || next.type === 'near') {
                throw new SearchSyntaxError(`"${nearToken.text}" needs a search term after it.`, nearToken.pos);
            }
            ops.push(nearToken);
            items.push(parseOperand(depth));
        }
        const node = { type: 'near', items, ops, field: null, pos: first.pos ?? ops[0].pos };
        node.rawStart = first.rawStart;
        node.rawEnd = items[items.length - 1].rawEnd;
        return node;
    }

    function parseExpression(depth, minPrecedence, group) {
        let left = parseNear(depth);
        if (!groupOps[group]) groupOps[group] = new Set();
        const levelOps = groupOps[group];
        while (peek() && peek().type !== 'close') {
            const token = peek();
            let op = 'AND';
            let explicit = false;
            if (token.type === 'operator') {
                op = token.value;
                explicit = true;
            } else if (token.type === 'minus') {
                op = 'NOT';
                explicit = true;
            } else if (token.type === 'tag') {
                throw new SearchSyntaxError(`The field tag [${token.value}] is in an unexpected place.`, token.pos);
            } else if (token.type === 'suffix') {
                throw new SearchSyntaxError(`The field code ${codeName(token)} is in an unexpected place.`, token.pos);
            } else if (token.type === 'near') {
                throw new SearchSyntaxError(`"${token.text}" is in an unexpected place.`, token.pos);
            }
            const opPrecedence = precedence(op);
            if (opPrecedence < minPrecedence) break;
            if (explicit) {
                pos += 1;
                if (token.type === 'operator') {
                    const next = peek();
                    if (!next || next.type === 'close') throw new SearchSyntaxError(`"${opLabel(token)}" needs a search term after it.`, token.pos);
                    if (next.type === 'operator') throw new SearchSyntaxError(`"${opLabel(token)} ${opLabel(next)}" has two operators in a row.`, next.pos);
                } else if (!peek() || peek().type === 'close' || peek().type === 'operator') {
                    throw new SearchSyntaxError('A minus sign (-) needs a search term after it.', token.pos);
                }
            } else if (firstImplicit === null) {
                firstImplicit = token.pos;
            }
            // Scopus changed its order in 2026: "a AND NOT b AND c" now means (a AND NOT b) AND c
            if (op === 'AND' && levelOps.has('ANDNOT')) env.mixed = true;
            levelOps.add(op);
            const right = parseExpression(depth, rules.precedence ? opPrecedence + 1 : Infinity, group);
            left = { type: 'bool', op, left, right, implicit: !explicit };
        }
        if (levelOps.has('OR') && (levelOps.has('AND') || levelOps.has('NOT') || levelOps.has('ANDNOT'))) env.mixed = true;
        return left;
    }

    // Precedence climbing: with no precedence (left to right) every operator has the same level
    const parseTop = () => {
        const tree = parseExpression(0, 0, 0);
        if (pos < tokens.length) {
            const token = tokens[pos];
            throw new SearchSyntaxError('A ")" has no matching "(".', token.pos);
        }
        return tree;
    };
    if (tokens.length === 0) return { tree: null, firstImplicit, groupTags };
    return { tree: parseTop(), firstImplicit, groupTags };

    // A field code from the syntax: a field, a subject heading, or a limit that can't be translated
    function applyCode(operand, resolved, info) {
        if (resolved.kind === 'field') {
            if (resolved.keywords) env.note('keywords', 'Searches in keyword fields (such as kw, TS= or TITLE-ABS-KEY) were read as title and abstract searches. Each database\'s version uses its own closest fields.');
            applyField(operand, resolved.field);
            return operand;
        }
        if (resolved.kind === 'heading') {
            const vocabulary = info.code === 'INDEXTERMS' ? 'index' : syntax.vocabulary;
            return toHeadings(operand, { explode: Boolean(resolved.explode), major: Boolean(resolved.major), vocabulary }, info);
        }
        const raw = (info.raw || '').trim();
        return {
            type: 'unsupported', text: raw, quoted: false, tag: info.code, source: family, raw, pos: info.pos,
        };
    }

    // CINAHL MH "Acne+", Embase 'acne'/exp, Ovid acne.sh.: the terms become subject headings
    function toHeadings(node, { explode, major, vocabulary }, info) {
        if (node.type === 'term' && node.distance === undefined) {
            let name = node.text;
            let exploded = explode;
            // CINAHL marks exploded headings with a plus: MH "Acne Vulgaris+"
            if (family === 'cinahl' && name.endsWith('+')) {
                exploded = true;
                name = name.slice(0, -1).trim();
            }
            return { type: 'heading', text: name, subheading: null, explode: exploded, major, vocabulary, source: family, pos: node.pos };
        }
        if ((node.type === 'bool' && node.op === 'OR')) {
            return { ...node, left: toHeadings(node.left, { explode, major, vocabulary }, info), right: toHeadings(node.right, { explode, major, vocabulary }, info) };
        }
        throw new SearchSyntaxError(`${info.code} can only be used with terms, not with ${node.type === 'heading' ? 'headings' : 'combined searches'}.`, info.pos);
    }
}

// The field applies to every term inside that has no field yet
function applyField(node, field) {
    if (!node) return;
    if (node.type === 'bool') {
        applyField(node.left, field);
        applyField(node.right, field);
    } else if (node.type === 'near') {
        if (node.field === null) node.field = field;
        node.items.forEach((item) => applyField(item, field));
    } else if (node.type === 'term' && node.field === null) {
        node.field = field;
    }
}

// ---------- Tidying the tree ----------

// Proximity (a NEAR/3 b) becomes PreVue's proximity term: "a b" within 2 words.
// (a OR b) NEAR/3 c becomes "a c" OR "b c".
function lowerNear(node, env) {
    if (!node) return node;
    if (node.type === 'bool') return { ...node, left: lowerNear(node.left, env), right: lowerNear(node.right, env) };
    if (node.type !== 'near') return node;
    const choices = node.items.map((item) => termChoices(lowerNear(item, env)));
    if (choices.some((choice) => choice === null)) {
        throw new SearchSyntaxError(`${node.ops[0].text} can only join words, phrases, or words joined with OR.`, node.ops[0].pos);
    }
    let combinations = [[]];
    for (const choice of choices) {
        const next = [];
        for (const combination of combinations) {
            for (const term of choice) next.push([...combination, term]);
        }
        combinations = next;
        if (combinations.length > MAX_PROXIMITY_COMBINATIONS) {
            throw new SearchSyntaxError(`This proximity search makes more than ${MAX_PROXIMITY_COMBINATIONS} combinations. Split it into smaller parts.`, node.ops[0].pos);
        }
    }
    const distances = [...new Set(node.ops.map((op) => op.distance))];
    const distance = Math.max(...distances);
    if (distances.length > 1) env.note('nearDistances', 'One proximity search used different distances, so PreVue used the largest one.');
    node.ops.filter((op) => op.assumed).forEach((op) => {
        env.note(`assumed-${op.assumed}`, `${op.text} without a number was read as ${op.assumed}. Add the number you want.`);
    });
    const ordered = node.ops.some((op) => op.ordered);
    const fields = [...new Set(node.items.flatMap((item) => fieldsOf(item)).filter(Boolean))];
    const field = node.field || fields[0] || null;
    if (fields.length > 1) env.note('nearFields', 'Words in one proximity search had different fields, so PreVue used one field for all of them.');
    const terms = combinations.map((combination) => {
        const words = combination.flatMap((term) => term.text.split(' '));
        const text = words.join(' ');
        if (distance === 0 && ordered) {
            // Next to each other, in this order: a phrase
            return { type: 'term', text, quoted: true, field, pos: node.pos };
        }
        const term = { type: 'term', text, quoted: true, field, pos: node.pos, distance, words };
        if (ordered) term.ordered = true;
        return term;
    });
    if (terms.length === 1) return terms[0];
    return terms.slice(1).reduce((left, right) => ({ type: 'bool', op: 'OR', left, right }), terms[0]);
}

function termChoices(node) {
    if (node.type === 'term' && node.distance === undefined) return [node];
    if (node.type === 'bool' && node.op === 'OR') {
        const left = termChoices(node.left);
        const right = termChoices(node.right);
        return left && right ? [...left, ...right] : null;
    }
    return null;
}

function fieldsOf(node) {
    if (node.type === 'term') return [node.field];
    if (node.type === 'bool') return [...fieldsOf(node.left), ...fieldsOf(node.right)];
    if (node.type === 'near') return [node.field, ...node.items.flatMap(fieldsOf)];
    return [];
}

// AND and OR chains become lists; NOT stays a pair (it isn't interchangeable)
export function toNary(node) {
    if (node.type !== 'bool') {
        const { rawStart, rawEnd, ...rest } = node;
        return rest;
    }
    if (node.op === 'NOT' || node.op === 'ANDNOT') return { type: 'not', left: toNary(node.left), right: toNary(node.right) };
    const type = node.op === 'AND' ? 'and' : 'or';
    const items = [];
    for (const child of [toNary(node.left), toNary(node.right)]) {
        if (child.type === type) items.push(...child.items);
        else items.push(child);
    }
    return { type, items };
}

export function collectLeaves(node, out = []) {
    if (!node) return out;
    if (node.type === 'and' || node.type === 'or') node.items.forEach((item) => collectLeaves(item, out));
    else if (node.type === 'not') {
        collectLeaves(node.left, out);
        collectLeaves(node.right, out);
    } else out.push(node);
    return out;
}

// (TI x OR AB x), as CINAHL writes it, is x in titles or abstracts
function mergeTitleAbstract(node) {
    if (node.type === 'not') return { type: 'not', left: mergeTitleAbstract(node.left), right: mergeTitleAbstract(node.right) };
    if (node.type !== 'and' && node.type !== 'or') return node;
    const items = node.items.map(mergeTitleAbstract);
    if (node.type === 'and') return { type: 'and', items };
    const sameTerm = (a, b) => a.text.toLowerCase() === b.text.toLowerCase()
        && (a.distance ?? null) === (b.distance ?? null) && Boolean(a.ordered) === Boolean(b.ordered);
    const merged = [];
    const used = new Set();
    items.forEach((item, index) => {
        if (used.has(index)) return;
        used.add(index);
        if (item.type === 'term' && (item.field === 'ti' || item.field === 'ab')) {
            const other = item.field === 'ti' ? 'ab' : 'ti';
            const match = items.findIndex((candidate, k) => !used.has(k) && candidate.type === 'term' && candidate.field === other && sameTerm(candidate, item));
            if (match !== -1) {
                used.add(match);
                merged.push({ ...item, field: 'tiab' });
                return;
            }
        }
        merged.push(item);
    });
    return merged.length === 1 ? merged[0] : { type: 'or', items: merged };
}

const treeDepth = (node) => {
    if (!node) return 0;
    if (node.type === 'and' || node.type === 'or') return 1 + Math.max(...node.items.map(treeDepth));
    if (node.type === 'not') return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
    return 1;
};

const copyTree = (node) => JSON.parse(JSON.stringify(node));

// ---------- Numbered searches (search history) ----------

// "1 exp Acne/", "#2 acne:ti,ab,kw", "S3 S1 OR S2". Hit counts at the end of a line are ignored.
const LINE_LABEL = /^[ \t]*(?:#[ \t]?(\d{1,4})|S(\d{1,4})|(\d{1,4}))[.:)]?(?:[ \t]+)(\S.*)?$/;

function splitNumberedLines(text) {
    const lines = [];
    let offset = 0;
    for (const line of text.split('\n')) {
        lines.push({ text: line, start: offset });
        offset += line.length + 1;
    }
    const found = lines.map((line) => {
        const m = line.text.match(LINE_LABEL);
        if (!m || m[4] === undefined) return null;
        return {
            number: Number(m[1] || m[2] || m[3]),
            start: line.start + line.text.length - m[4].length,
            end: line.start + line.text.length,
        };
    });
    const labeledAt = found.map((line, index) => (line ? index : -1)).filter((index) => index !== -1);
    if (labeledAt.length < 2) return null;
    // Text before the first numbered line (such as "Database: Ovid MEDLINE") and after the last
    // (such as "****") is not part of the search. A line without a number in between continues
    // the line before it, unless it is only decoration such as "-----".
    const header = lines.slice(0, labeledAt[0]).map((line) => line.text).join('\n');
    const labeled = [];
    for (let index = labeledAt[0]; index <= labeledAt[labeledAt.length - 1]; index += 1) {
        const line = lines[index];
        if (found[index]) labeled.push(found[index]);
        else if (line.text.trim() && !/^[\s*\-=_~#.]+$/.test(line.text)) labeled[labeled.length - 1].end = line.start + line.text.length;
    }
    for (let k = 1; k < labeled.length; k += 1) {
        if (labeled[k].number <= labeled[k - 1].number) return null;
    }
    if (labeled.length > MAX_LINES) throw new SearchSyntaxError(`The search has more than ${MAX_LINES} lines.`, labeled[MAX_LINES].start);
    return { lines: labeled, header };
}

// How many characters at the end of a line are a hit count: " (12,345)" or "   12345".
// Read from the end in one pass, so very long lines stay fast.
function trailingCountLength(content) {
    let k = content.length;
    while (k > 0 && isSpace(content[k - 1])) k -= 1;
    const isDigit = (ch) => ch >= '0' && ch <= '9';
    if (content[k - 1] === ')') {
        let d = k - 1;
        while (d > 0 && (isDigit(content[d - 1]) || content[d - 1] === ',')) d -= 1;
        if (d < k - 1 && content[d - 1] === '(' && isDigit(content[d])) {
            let s = d - 1;
            while (s > 0 && isSpace(content[s - 1])) s -= 1;
            return content.length - s;
        }
        return 0;
    }
    let d = k;
    while (d > 0 && (isDigit(content[d - 1]) || content[d - 1] === ',')) d -= 1;
    if (d === k || !isDigit(content[d])) return 0;
    let s = d;
    while (s > 0 && isSpace(content[s - 1])) s -= 1;
    return d - s >= 2 && s > 0 ? content.length - s : 0;
}

// The search part of a line, without hit counts or other columns
function lineContent(text, line) {
    let start = line.start;
    let end = line.end;
    let content = text.slice(start, end);
    if (content.includes('\t')) {
        // Copied from a table: the search is the first column
        const firstTab = content.indexOf('\t');
        end = start + firstTab;
        content = text.slice(start, end);
    }
    end = start + content.length - trailingCountLength(content);
    while (start < end && isSpace(text[start])) start += 1;
    while (end > start && isSpace(text[end - 1])) end -= 1;
    return { start, end };
}

// ---------- Guessing the syntax ----------

const SIGNS = Object.freeze({
    pubmed: [
        [/\[(?:tiab|ti|ab|tw|mh|mesh|majr|all|pt|la|dp|sb|au|ta|mesh terms|mesh:noexp|majr:noexp|mh:noexp|title\/abstract|title|abstract|all fields|text word|mesh major topic|sh|ot|nm)(?::~\d{1,2})?\]/gi, 3],
    ],
    ovidMedline: [
        [/\.(?:ti|ab|tw|mp|kw|kf|sh|af|id|ot|pt|lg|yr|fs|hw)(?:,(?:ti|ab|tw|kw|kf|sh|id|ot))*\.(?=\s|\)|$)/gi, 3],
        [/\bexp[ \t]{1,5}\*?[^\n/()"]{1,120}\//gi, 3],
        [/\badj\d{0,2}\b/gi, 2],
        [/\b(?:or|and)\/\d{1,4}(?:-\d{1,4})?/gi, 3],
        [/\blimit\s+\d{1,4}\s+to\b/gi, 3],
        [/^[ \t]{0,10}\d{1,4}\.?[ \t]{1,10}\d{1,4}(?:[ \t]{1,10}(?:or|and|not)[ \t]{1,10}\d{1,4}){1,50}(?=[ \t]{0,10}(?:\(\d|$))/gim, 3],
    ],
    embase: [
        [/'[^'\n]{1,150}'\s*\/\s*(?:exp|de|mj)\b/gi, 4],
        [/\bNEXT\/\d{1,2}\b/gi, 2],
        [/'[^'\n]{1,150}'\s*:[a-z]{2}/gi, 3],
        [/\[[a-z0-9 -]{2,30}\]\/(?:lim|py|it)\b/gi, 3],
    ],
    cochrane: [
        [/\[mh\s/gi, 4],
        [/MeSH descriptor\s*:/gi, 4],
        [/\bNEXT\b(?!\/)/g, 2],
        [/\{\s*(?:OR|AND)\s+#\d/gi, 3],
    ],
    afterTerm: [[/[\w*)"']:(?:ti|ab|kw)(?:[,:](?:ti|ab|kw))*\b/gi, 2]],
    cinahl: [
        [/\b(?:MH|MM)\s+"[^"\n]{1,150}"/g, 4],
        [/(?:^|[\s(])(?:TI|AB|TX|SU|KW)\s+(?=[("\p{L}\p{N}])/gu, 2],
        [/\b[NW]\d{1,2}\b/g, 1],
        [/^[ \t]{0,10}S\d{1,4}[ \t]/gm, 2],
    ],
    webOfScience: [[/\b(?:TS|TI|AB|ALL|AK|KP|PY|AU|SO|DT|LA)\s*=/g, 3]],
    scopus: [
        [/\b(?:TITLE-ABS-KEY|TITLE-ABS|TITLE|ABS|KEY|AUTHKEY|INDEXTERMS|ALL|SRCTITLE|AUTH|AFFIL|DOCTYPE|LANGUAGE|PUBYEAR|LIMIT-TO|EXCLUDE)\s*\(/gi, 3],
        [/\b(?:W|PRE)\/\d{1,2}\b/gi, 2],
        [/\{[^}\n]{1,150}\}/g, 1],
    ],
    googleScholar: [
        [/\b(?:intitle|allintitle|allintext|intext|author|source):/gi, 3],
        [/(?:^|\s)-(?=["\p{L}])/gu, 1],
    ],
});

const countMatches = (text, re) => (text.match(re) || []).length;

// Guesses which database a search was written for. Plain keywords read as PubMed.
export function detectSyntax(rawText) {
    const text = normalizeSearchText(rawText).slice(0, MAX_SEARCH_CHARS);
    const score = (key) => (SIGNS[key] || []).reduce((sum, [re, weight]) => sum + countMatches(text, re) * weight, 0);
    const scores = {
        pubmed: score('pubmed'),
        ovidMedline: score('ovidMedline'),
        embase: score('embase'),
        cochrane: score('cochrane'),
        cinahl: score('cinahl'),
        webOfScience: score('webOfScience'),
        scopus: score('scopus'),
        googleScholar: score('googleScholar'),
    };
    // Field codes such as :ti,ab,kw are shared by Embase and the Cochrane Library
    const afterTerm = score('afterTerm');
    if (afterTerm) {
        if (scores.embase >= scores.cochrane && /'[^'\n]+'/.test(text)) scores.embase += afterTerm;
        else scores.cochrane += afterTerm;
    }
    // Ovid's own search history names the database
    const ovidHeader = text.match(/Database:\s*(?:Ovid\s+)?([^\n<]*)/i);
    let best = 'pubmed';
    let bestScore = 0;
    for (const [key, value] of Object.entries(scores)) {
        if (value > bestScore) {
            best = key;
            bestScore = value;
        }
    }
    if (ovidHeader && (best === 'ovidMedline' || bestScore === 0)) {
        if (/embase/i.test(ovidHeader[1])) return 'embaseOvid';
        if (/psyc/i.test(ovidHeader[1])) return 'psycinfo';
        return 'ovidMedline';
    }
    return best;
}

// A research question rather than a search: words, no search syntax
const QUESTION_START = /^(what|which|how|does|do|did|is|are|was|were|can|could|should|would|will|why|when|whether|among|in|for|to what extent|compared)\b/i;
export function looksLikeQuestion(rawText) {
    const text = normalizeSearchText(rawText).trim();
    if (!text || text.length > 1000) return false;
    // Search syntax: brackets, quotes, field tags, operators in capitals, line numbers
    if (/[()[\]{}"=*]|\.(?:ti|ab|tw|mp)\.|:(?:ti|ab|kw)\b|\/(?:exp|de|mj)\b|\b(?:AND|OR|NOT)\b|^[ \t]*(?:#?\d{1,3}|S\d{1,3})[ \t]/m.test(text)) return false;
    const words = text.split(/\s+/);
    if ((text.match(/\s(?:or)\s/gi) || []).length >= 2) return false;
    if (text.endsWith('?')) return words.length >= 3;
    if (QUESTION_START.test(text)) return words.length >= 5;
    return words.length >= 8;
}

// ---------- Reading a whole search ----------

function makeEnv(refs) {
    const notes = new Map();
    let terms = 0;
    const env = {
        refs,
        mixed: false,
        note(key, message) {
            if (!notes.has(key)) notes.set(key, message);
        },
        countTerm(at) {
            terms += 1;
            if (terms > MAX_TERMS) {
                throw new SearchSyntaxError(`The search has more than ${MAX_TERMS.toLocaleString('en-US')} terms. Split it into smaller searches.`, at);
            }
        },
        noteList: () => [...notes.values()],
        used: new Set(),
        useRef: null,
    };
    return env;
}

function readRange(text, start, end, syntax, env) {
    const tokens = makeLexer(text, start, end, syntax, env);
    const { tree, firstImplicit, groupTags } = parseTokens(tokens, text, syntax, env);
    return { tree: tree ? lowerNear(tree, env) : null, firstImplicit, groupTags };
}

// Reads a search into a tree. syntaxKey: 'auto' (guess) or one of SYNTAXES.
// Returns { tree, notes, syntax: { key, name, detected }, lines? }; throws SearchSyntaxError.
export function readSearch(rawText, syntaxKey = 'auto') {
    const text = normalizeSearchText(rawText);
    if (text.length > MAX_SEARCH_CHARS) {
        throw new SearchSyntaxError(`The search is too long. Keep it under ${MAX_SEARCH_CHARS.toLocaleString('en-US')} characters.`, MAX_SEARCH_CHARS);
    }
    const detected = syntaxKey === 'auto' || !findSyntax(syntaxKey);
    const syntax = findSyntax(detected ? detectSyntax(text) : syntaxKey);
    const syntaxInfo = { key: syntax.key, name: syntax.name, detected };
    if (!text.trim()) return { tree: null, notes: [], syntax: syntaxInfo };

    const numbered = splitNumberedLines(text);
    let bool;
    let firstImplicit = null;
    let groupTags = [];
    const env = makeEnv(numbered ? new Map() : null);
    let lineNote = null;

    if (numbered) {
        const parsedLines = new Map();
        const lineRefs = new Map();
        let current = null;
        env.useRef = (label, at) => {
            if (!parsedLines.has(label)) {
                const known = numbered.lines.some((line) => line.number === label);
                throw new SearchSyntaxError(known
                    ? `Line ${current} uses line ${label}, which comes after it.`
                    : `Line ${current} uses line ${label}, which isn't in this search.`, at);
            }
            lineRefs.get(current).add(label);
            return copyTree(parsedLines.get(label));
        };
        for (const line of numbered.lines) {
            current = line.number;
            lineRefs.set(current, new Set());
            const { start, end } = lineContent(text, line);
            if (start >= end) throw new SearchSyntaxError(`Line ${line.number} has no search.`, line.start);
            const content = text.slice(start, end);
            let tree;
            const limit = syntax.family === 'ovid' && content.match(/^limit\s+(\d{1,4})\s+to\s+(.+)$/i);
            const dedupe = syntax.family === 'ovid' && content.match(/^remove duplicates from\s+(\d{1,4})$/i);
            if (limit) {
                const base = env.useRef(Number(limit[1]), start);
                const raw = `limit to ${limit[2].trim()}`;
                tree = { type: 'bool', op: 'AND', left: base, right: { type: 'unsupported', text: raw, quoted: false, tag: 'limit', source: 'ovid', raw, passthrough: false, pos: start } };
            } else if (dedupe) {
                tree = env.useRef(Number(dedupe[1]), start);
            } else {
                const read = readRange(text, start, end, syntax, env);
                tree = read.tree;
                if (read.firstImplicit !== null && firstImplicit === null) firstImplicit = read.firstImplicit;
                groupTags = groupTags.concat(read.groupTags);
            }
            if (!tree) throw new SearchSyntaxError(`Line ${line.number} has no search.`, line.start);
            parsedLines.set(line.number, tree);
        }
        const last = numbered.lines[numbered.lines.length - 1];
        bool = parsedLines.get(last.number);
        // Which lines the last line uses, directly or through other lines
        const used = new Set([last.number]);
        const queue = [last.number];
        while (queue.length) {
            const label = queue.shift();
            for (const ref of lineRefs.get(label) || []) {
                if (!used.has(ref)) {
                    used.add(ref);
                    queue.push(ref);
                }
            }
        }
        const unused = numbered.lines.map((line) => line.number).filter((n) => !used.has(n));
        lineNote = `This is a numbered search with ${numbered.lines.length} lines. PreVue translated the last line (${last.number}) and wrote out the lines it uses in full.`;
        if (unused.length) {
            lineNote += ` Line${unused.length === 1 ? '' : 's'} ${unused.join(', ')} ${unused.length === 1 ? "isn't" : "aren't"} used by the last line, so ${unused.length === 1 ? "it isn't" : "they aren't"} included.`;
        }
    } else {
        const read = readRange(text, 0, text.length, syntax, env);
        bool = read.tree;
        firstImplicit = read.firstImplicit;
        groupTags = read.groupTags;
        if (!bool) return { tree: null, notes: [], syntax: syntaxInfo };
    }

    const tree = syntax.family === 'pubmed' ? toNary(bool) : mergeTitleAbstract(toNary(bool));
    const leaves = collectLeaves(tree);
    if (leaves.length > MAX_TERMS) {
        throw new SearchSyntaxError(`The search has more than ${MAX_TERMS.toLocaleString('en-US')} terms when its lines are written out. Split it into smaller searches.`, 0);
    }
    if (treeDepth(tree) > MAX_TREE_DEPTH) {
        throw new SearchSyntaxError('The search has too many levels when its lines are written out. Split it into smaller searches.', 0);
    }

    const notes = [];
    if (lineNote) notes.push(lineNote);
    if (firstImplicit !== null && syntax.family === 'pubmed') {
        notes.push('Some terms have no operator between them. PreVue joined them with AND, as PubMed does.');
    } else if (firstImplicit !== null && FAMILIES[syntax.family].adjacency === 'phrase') {
        notes.push('Some parts of the search have no operator between them. PreVue joined them with AND.');
    }
    if (groupTags.length) {
        notes.push(`PubMed's help says to tag each term separately, so [${groupTags[0]}] after brackets was applied to each untagged term inside them.`);
    }
    const untagged = leaves.filter((leaf) => leaf.type === 'term' && leaf.field === null).map((leaf) => leaf.text);
    if (untagged.length) {
        notes.push(`${untagged.length} term${untagged.length === 1 ? ' has' : 's have'} no field tag (for example "${shorten(untagged[0])}"). `
            + `Each database searches its own default fields for these. ${UNTAGGED_HINT[syntax.family]}`);
    }
    notes.push(...env.noteList());
    if (env.mixed) {
        notes.push(`AND, OR and NOT are mixed without brackets in places, so PreVue read them ${FAMILIES[syntax.family].order}. The translations add brackets: check that they mean what you intended.`);
    }
    return { tree, notes, syntax: syntaxInfo };
}

// Reads a PubMed search (or plain keywords). Kept for the tests and older callers.
export function parseSearch(rawText) {
    const { tree, notes } = readSearch(rawText, 'pubmed');
    return { tree, notes };
}
