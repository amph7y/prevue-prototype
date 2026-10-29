// Search Translator: colors for a search the researcher has edited (operators, field codes,
// subject headings). For display only. The pieces always join back into exactly the same text.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

// Rules for each database: [sticky pattern, kind]. They are tried in order at each position.
const OVID = [
    [/\.[a-z]{2,3}(?:,[a-z]{2,3}){0,10}\.(?=[\s)]|$)/iy, 'field'],
    [/exp(?=\s)/iy, 'heading'],
    [/\*?[^\s()"/.]{1,60}(?: [^\s()"/.]{1,60}){0,6}\/(?:[a-z]{2}(?:,[a-z]{2}){0,10})?(?=[\s)]|$)/iy, 'heading'],
    [/adj\d{0,2}(?![\w/])/iy, 'operator'],
];
const AFTER_TERM = [[/:[a-z]{2,3}(?:[,:][a-z]{2,3}){0,10}/iy, 'field']];
const RULES = Object.freeze({
    pubmed: [[/\[[^\]\n]{0,80}\]/y, 'field']],
    ovidMedline: OVID,
    embaseOvid: OVID,
    psycinfo: OVID,
    embase: [
        [/'[^'\n]{1,200}'\/(?:exp|de|mj)(?:\/(?:exp|de|mj))*/iy, 'heading'],
        [/\[[^\]\n]{0,40}\]\/[a-z_]{2,12}/iy, 'field'],
        ...AFTER_TERM,
        [/(?:NEAR|NEXT)\/\d{1,2}(?![\w/])/iy, 'operator'],
    ],
    cochrane: [
        [/\[mh\b[^\]\n]{0,200}(?:\[mj\])?\]/iy, 'heading'],
        ...AFTER_TERM,
        [/(?:NEAR(?:\/\d{1,2})?|NEXT)(?![\w/])/iy, 'operator'],
    ],
    cinahl: [
        [/\((?:MH|MM) "[^"\n]{1,200}"\)/y, 'heading'],
        [/(?:TI|AB|TX|SU|KW)(?= )/y, 'field'],
        [/[NW]\d{1,2}(?![\w/])/y, 'operator'],
    ],
    webOfScience: [
        [/[A-Z]{2,4}=/y, 'field'],
        [/NEAR(?:\/\d{1,2})?(?![\w/])/iy, 'operator'],
    ],
    scopus: [
        [/INDEXTERMS(?=\s*\()/iy, 'heading'],
        [/(?:TITLE-ABS-KEY|TITLE-ABS|TITLE|ABS|KEY|AUTHKEY|ALL|PUBYEAR|LIMIT-TO|EXCLUDE|DOCTYPE|LANGUAGE|SRCTITLE|AUTH|AFFIL|SUBJAREA)(?=\s*[(<>=])/iy, 'field'],
        [/(?:W|PRE)\/\d{1,2}(?![\w/])/iy, 'operator'],
    ],
    core: [[/(?:title|abstract):/y, 'field']],
    googleScholar: [[/(?:allintitle|intitle):/iy, 'field']],
    semanticScholar: [],
});
const OPERATOR = /(?:AND NOT|AND|OR|NOT)(?![\w/-])/y;
const OPERATOR_ANY_CASE = /(?:and not|and|or|not)(?![\w/-])/iy;

const isWordChar = (ch) => /[\p{L}\p{N}_*?#$-]/u.test(ch || '');

export function highlightSearch(text, databaseKey) {
    const source = String(text ?? '');
    const rules = RULES[databaseKey] || [];
    const operator = databaseKey === 'ovidMedline' || databaseKey === 'embaseOvid' || databaseKey === 'psycinfo' ? OPERATOR_ANY_CASE : OPERATOR;
    const pieces = [];
    const push = (pieceText, kind) => {
        if (!pieceText) return;
        const last = pieces[pieces.length - 1];
        if (last && last.kind === kind) last.text += pieceText;
        else pieces.push({ text: pieceText, kind, flag: null });
    };
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const atWordStart = !isWordChar(source[i - 1]);
        let matched = false;
        if (atWordStart || ch === '.' || ch === ':' || ch === '[' || ch === '(' || ch === "'") {
            for (const [pattern, kind] of rules) {
                pattern.lastIndex = i;
                const m = pattern.exec(source);
                if (m && m[0]) {
                    push(m[0], kind);
                    i += m[0].length;
                    matched = true;
                    break;
                }
            }
        }
        if (matched) continue;
        if (atWordStart) {
            operator.lastIndex = i;
            const m = operator.exec(source);
            if (m) {
                push(m[0], 'operator');
                i += m[0].length;
                continue;
            }
        }
        if (ch === '(' || ch === ')') {
            push(ch, 'paren');
            i += 1;
            continue;
        }
        if (ch === '-' && databaseKey === 'googleScholar' && (i === 0 || /\s/.test(source[i - 1]))) {
            push(ch, 'operator');
            i += 1;
            continue;
        }
        if (ch === '"') {
            // A quoted phrase is one term: operator words inside it are not operators
            const close = source.indexOf('"', i + 1);
            const end = close === -1 ? source.length : close + 1;
            push(source.slice(i, end), 'term');
            i = end;
            continue;
        }
        push(ch, 'term');
        i += 1;
    }
    return pieces;
}
