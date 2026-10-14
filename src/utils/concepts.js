// Concept helpers for Step 1: finding concepts in the question, joining and
// splitting words, colors, follow-up suggestions, and keyword requests.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

export const MAX_CONCEPTS = 25;
export const MAX_QUESTION_CHARS = 1000;
export const MAX_ANSWER_CHARS = 300;
export const MAX_CONCEPT_NAME_CHARS = 150;
export const MAX_ANSWER_SUGGESTIONS = 8;
const MAX_FOLLOW_UPS = 4;
const MAX_SUGGESTIONS = 4;
const MAX_PARTS = MAX_CONCEPTS; // pieces of one concept in the question (a cap for saved data)

export const conceptLimitMessage = () => `You can have up to ${MAX_CONCEPTS} concepts. Remove or join some to add more.`;

// Class names are written out in full so Tailwind includes them in the build.
// The first 10 colors keep their order, so saved projects keep their colors.
export const CONCEPT_PALETTE = [
    { chip: 'bg-green-100 text-green-900 border-green-300', dot: 'bg-green-500', ring: 'ring-green-500' },
    { chip: 'bg-orange-100 text-orange-900 border-orange-300', dot: 'bg-orange-500', ring: 'ring-orange-500' },
    { chip: 'bg-violet-100 text-violet-900 border-violet-300', dot: 'bg-violet-500', ring: 'ring-violet-500' },
    { chip: 'bg-yellow-100 text-yellow-900 border-yellow-300', dot: 'bg-yellow-500', ring: 'ring-yellow-500' },
    { chip: 'bg-sky-100 text-sky-900 border-sky-300', dot: 'bg-sky-500', ring: 'ring-sky-500' },
    { chip: 'bg-rose-100 text-rose-900 border-rose-300', dot: 'bg-rose-500', ring: 'ring-rose-500' },
    { chip: 'bg-teal-100 text-teal-900 border-teal-300', dot: 'bg-teal-500', ring: 'ring-teal-500' },
    { chip: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300', dot: 'bg-fuchsia-500', ring: 'ring-fuchsia-500' },
    { chip: 'bg-lime-100 text-lime-900 border-lime-300', dot: 'bg-lime-500', ring: 'ring-lime-500' },
    { chip: 'bg-indigo-100 text-indigo-900 border-indigo-300', dot: 'bg-indigo-500', ring: 'ring-indigo-500' },
    { chip: 'bg-blue-100 text-blue-900 border-blue-300', dot: 'bg-blue-500', ring: 'ring-blue-500' },
    { chip: 'bg-pink-100 text-pink-900 border-pink-300', dot: 'bg-pink-500', ring: 'ring-pink-500' },
    { chip: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { chip: 'bg-purple-100 text-purple-900 border-purple-300', dot: 'bg-purple-500', ring: 'ring-purple-500' },
    { chip: 'bg-cyan-100 text-cyan-900 border-cyan-300', dot: 'bg-cyan-500', ring: 'ring-cyan-500' },
    { chip: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-500', ring: 'ring-amber-500' },
    { chip: 'bg-red-100 text-red-900 border-red-300', dot: 'bg-red-500', ring: 'ring-red-500' },
];

export const INACTIVE_CHIP = 'bg-gray-100 text-gray-400 border-gray-200 line-through';

// Older projects used PICO roles; new concepts have no role label
const ROLE_LABELS = {
    population: 'Population',
    intervention: 'Intervention',
    comparison: 'Comparison',
    outcome: 'Outcome',
    custom: 'Custom Concept',
};
export const conceptRoleLabel = (type) => ROLE_LABELS[type] || '';

// ---------- Basics ----------

export const normalizeName = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
export const conceptKey = (value) => normalizeName(value).toLowerCase();
export const isActive = (concept) => Boolean(concept) && concept.active !== false;
export const activeConcepts = (concepts) => (Array.isArray(concepts) ? concepts.filter(isActive) : []);

let idCounter = 0;
export function createId(prefix = 'concept') {
    idCounter = (idCounter + 1) % 1000000;
    return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const colorOf = (concept, index) => (Number.isInteger(concept && concept.colorIndex) ? concept.colorIndex : index);

export function getConceptColor(concept, index = 0) {
    const size = CONCEPT_PALETTE.length;
    return CONCEPT_PALETTE[((colorOf(concept, index) % size) + size) % size];
}

function nextFreeColor(concepts) {
    const size = CONCEPT_PALETTE.length;
    const used = new Set(concepts.map((c, i) => ((colorOf(c, i) % size) + size) % size));
    for (let i = 0; i < size; i += 1) {
        if (!used.has(i)) return i;
    }
    return concepts.length % size;
}

// Small words that are not useful as concepts on their own (English and Arabic)
const LITTLE_WORDS = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'without', 'by', 'from', 'and', 'or', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had',
    'what', 'which', 'who', 'whom', 'whose', 'how', 'why', 'when', 'where',
    'among', 'between', 'versus', 'vs', 'into', 'onto', 'about', 'than', 'that', 'this', 'these', 'those',
    'it', 'its', 'their', 'there', 'within', 'per', 'via', 'upon',
    'في', 'من', 'على', 'عن', 'مع', 'إلى', 'الى', 'و', 'أو', 'او', 'ما', 'هل', 'هي', 'هو',
    'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'بين', 'لدى',
]);
export const isLittleWord = (word) => LITTLE_WORDS.has(normalizeName(word).toLowerCase());
const hasMeaningfulWord = (words) => words.some((word) => normalizeName(word) && !isLittleWord(word));

// The pieces of the question a concept covers. Saved data is cleaned first.
const cleanParts = (parts) => (Array.isArray(parts) ? parts : [])
    .map(normalizeName)
    .filter((part) => part && part.length <= MAX_CONCEPT_NAME_CHARS * 2)
    .slice(0, MAX_PARTS);

// Older saves have a single questionText; typed-in concepts have no pieces
export function conceptParts(concept) {
    if (!concept) return [];
    const parts = cleanParts(concept.questionParts);
    if (parts.length) return parts;
    const single = normalizeName(concept.questionText);
    return single ? [single] : [];
}

const withParts = (concept, parts) => ({ ...concept, questionParts: parts, questionText: parts.length === 1 ? parts[0] : '' });

export function makeConcept({ name, source = 'manual', questionParts, questionText = '', colorIndex = 0 }) {
    const parts = cleanParts(questionParts !== undefined ? questionParts : (questionText ? [questionText] : []));
    return withParts({
        id: createId(),
        name: normalizeName(name),
        type: 'concept',
        source,
        active: true,
        colorIndex,
        synonyms: [],
        keywords: [],
        controlled_vocabulary: [],
    }, parts);
}

// ---------- Adding, changing and removing ----------

// Adds new concepts from { name, source, questionParts | questionText } items.
// Duplicates are skipped (a turned-off duplicate is turned back on) and the list stops at MAX_CONCEPTS.
export function addConcepts(concepts, items) {
    const list = Array.isArray(concepts) ? [...concepts] : [];
    const summary = { added: 0, reactivated: 0, duplicates: 0, overLimit: 0 };
    for (const item of Array.isArray(items) ? items : []) {
        const name = normalizeName(item && item.name);
        if (!name || name.length > MAX_CONCEPT_NAME_CHARS) continue;
        const existingIndex = list.findIndex((c) => conceptKey(c.name) === conceptKey(name));
        if (existingIndex !== -1) {
            if (isActive(list[existingIndex])) {
                summary.duplicates += 1;
            } else {
                list[existingIndex] = { ...list[existingIndex], active: true };
                summary.reactivated += 1;
            }
            continue;
        }
        if (list.length >= MAX_CONCEPTS) {
            summary.overLimit += 1;
            continue;
        }
        list.push(makeConcept({
            name,
            source: item.source,
            questionParts: item.questionParts,
            questionText: item.questionText,
            colorIndex: nextFreeColor(list),
        }));
        summary.added += 1;
    }
    return { concepts: list, ...summary };
}

// Adds existing concept objects (keeping their ids), skipping duplicates and fixing color clashes
export function appendExistingConcepts(concepts, existing) {
    const size = CONCEPT_PALETTE.length;
    const list = [...concepts];
    for (const concept of Array.isArray(existing) ? existing : []) {
        if (list.length >= MAX_CONCEPTS) break;
        if (list.some((c) => conceptKey(c.name) === conceptKey(concept.name))) continue;
        const used = new Set(list.map((c, i) => ((colorOf(c, i) % size) + size) % size));
        const ownColor = Number.isInteger(concept.colorIndex) ? ((concept.colorIndex % size) + size) % size : null;
        list.push({ ...concept, colorIndex: ownColor !== null && !used.has(ownColor) ? ownColor : nextFreeColor(list) });
    }
    return list;
}

export const toggleConcept = (concepts, id) => concepts.map((c) => (c.id === id ? { ...c, active: !isActive(c) } : c));

export const removeConcept = (concepts, id) => concepts.filter((c) => c.id !== id);

export function renameConcept(concepts, id, newName) {
    const name = normalizeName(newName);
    if (!name) return { concepts, error: 'A concept name cannot be empty.' };
    if (name.length > MAX_CONCEPT_NAME_CHARS) {
        return { concepts, error: `Concept names can be up to ${MAX_CONCEPT_NAME_CHARS} characters.` };
    }
    if (concepts.some((c) => c.id !== id && conceptKey(c.name) === conceptKey(name))) {
        return { concepts, error: 'You already have a concept with this name.' };
    }
    return { concepts: concepts.map((c) => (c.id === id ? { ...c, name } : c)), error: null };
}

// ---------- The question: highlighting ----------

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_CHAR = /[\p{L}\p{N}]/u;
const isBoundary = (text, index) => index < 0 || index >= text.length || !WORD_CHAR.test(text[index]);
const wordPattern = () => /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;

// Only spaces, hyphens or slashes between two words: they can be joined
const JOINABLE_GAP = /^[\s\-\u2013\u2014/]*$/;
export const isJoinableGap = (text) => typeof text === 'string' && JOINABLE_GAP.test(text);

// Finds a phrase in the question, ignoring capital letters and spacing/hyphen differences.
// Only whole words match, and spans already taken are skipped. Returns { start, end } or null.
export function findPhrase(question, phrase, taken = []) {
    const text = normalizeName(phrase);
    if (typeof question !== 'string' || !question || !text) return null;
    const words = text.split(/[\s\-\u2013\u2014]+/).filter(Boolean).map(escapeRegExp);
    if (words.length === 0) return null;
    const pattern = new RegExp(words.join('[\\s\\-\\u2013\\u2014]+'), 'giu');
    let match = pattern.exec(question);
    while (match !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const overlaps = taken.some((span) => start < span.end && end > span.start);
        if (!overlaps && isBoundary(question, start - 1) && isBoundary(question, end)) {
            return { start, end };
        }
        pattern.lastIndex = start + 1;
        match = pattern.exec(question);
    }
    return null;
}

// The words between start and end: [{ text, start, end }]
function wordsIn(question, start, end) {
    const words = [];
    const part = question.slice(start, end);
    const pattern = wordPattern();
    let match = pattern.exec(part);
    while (match !== null) {
        words.push({ text: match[0], start: start + match.index, end: start + match.index + match[0].length });
        match = pattern.exec(part);
    }
    return words;
}

// Where each concept appears in the question: [{ conceptId, start, end }], sorted.
// A concept's saved pieces are looked up first; if none is found, its name is tried.
function locateConcepts(question, concepts) {
    const taken = [];
    for (const concept of concepts) {
        const found = [];
        for (const part of conceptParts(concept)) {
            const span = findPhrase(question, part, [...taken, ...found]);
            if (span) found.push(span);
        }
        if (found.length === 0) {
            const span = findPhrase(question, concept.name, taken);
            if (span) found.push(span);
        }
        found.forEach((span) => taken.push({ ...span, conceptId: concept.id }));
    }
    return taken.sort((a, b) => a.start - b.start);
}

// Splits the question into pieces for display:
//   { kind: 'concept', conceptId, text, start, end, words } - a piece of a concept (a bubble)
//   { kind: 'word', text, start, end }                      - any other word
//   { kind: 'gap', text, start, end }                       - spaces and punctuation
// A concept made of words from different places has one piece per place.
export function buildQuestionSegments(question, concepts) {
    const q = typeof question === 'string' ? question : '';
    if (!q) return [];
    const spans = locateConcepts(q, Array.isArray(concepts) ? concepts : []);

    const segments = [];
    const pushPlain = (from, to) => {
        let last = from;
        for (const word of wordsIn(q, from, to)) {
            if (word.start > last) segments.push({ kind: 'gap', text: q.slice(last, word.start), start: last, end: word.start });
            segments.push({ kind: 'word', text: word.text, start: word.start, end: word.end });
            last = word.end;
        }
        if (last < to) segments.push({ kind: 'gap', text: q.slice(last, to), start: last, end: to });
    };

    let cursor = 0;
    for (const span of spans) {
        if (span.start > cursor) pushPlain(cursor, span.start);
        segments.push({
            kind: 'concept',
            conceptId: span.conceptId,
            text: q.slice(span.start, span.end),
            start: span.start,
            end: span.end,
            words: wordsIn(q, span.start, span.end),
        });
        cursor = span.end;
    }
    if (cursor < q.length) pushPlain(cursor, q.length);
    return segments;
}

// The question as a row of chips, with what goes between them:
//   { type: 'chip', segment }           - a concept piece or a plain word
//   { type: 'join', left, right, text } - neighbors that can be joined (only spaces or hyphens between)
//   { type: 'gap', text }               - punctuation, shown as text
export function questionLayout(segments) {
    const list = Array.isArray(segments) ? segments : [];
    return list.map((segment, index) => {
        if (segment.kind !== 'gap') return { type: 'chip', segment };
        const left = list[index - 1];
        const right = list[index + 1];
        const joinable = left && right && left.kind !== 'gap' && right.kind !== 'gap' && isJoinableGap(segment.text);
        return joinable ? { type: 'join', left, right, text: segment.text } : { type: 'gap', text: segment.text };
    });
}

// ---------- Joining and splitting ----------

const uniqueByTerm = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item && item.type ? item.type : ''}:${conceptKey(item && item.term)}`;
        if (!item || !item.term || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

// Pieces with only spaces or hyphens between them become one piece
function mergePieces(question, spans) {
    const merged = [];
    for (const span of [...spans].sort((a, b) => a.start - b.start)) {
        const last = merged[merged.length - 1];
        if (last && (span.start < last.end || isJoinableGap(question.slice(last.end, span.start)))) {
            last.end = Math.max(last.end, span.end);
        } else {
            merged.push({ start: span.start, end: span.end });
        }
    }
    return merged;
}

const piecesToParts = (question, pieces) => pieces.map((p) => normalizeName(question.slice(p.start, p.end))).filter(Boolean);

// A concept's words, labelled for its name. When the name has as many words as the
// question text, the name's words are used, so spelling fixes are kept.
function labelledWords(question, concept, pieces) {
    const words = pieces.flatMap((piece) => wordsIn(question, piece.start, piece.end));
    const nameWords = normalizeName(concept.name).split(' ').filter(Boolean);
    const useName = nameWords.length === words.length;
    return words.map((word, i) => ({ ...word, label: useName ? nameWords[i] : word.text }));
}

// Parts of a new concept name, in question order. A concept whose name doesn't match
// its words word-for-word stays one unit; concepts not in the question go last.
function nameTokens(question, concept, pieces) {
    const words = labelledWords(question, concept, pieces);
    const nameWords = normalizeName(concept.name).split(' ').filter(Boolean);
    if (words.length && words.length === nameWords.length) return words.map((w) => ({ start: w.start, text: w.label }));
    if (words.length) return [{ start: words[0].start, text: normalizeName(concept.name) }];
    return [{ start: Number.POSITIVE_INFINITY, text: normalizeName(concept.name) }];
}

const nameIsTaken = (list, name, exceptIds) => list.some((c) => !exceptIds.includes(c.id) && conceptKey(c.name) === conceptKey(name));

// Joins any concepts and plain words of the question into one concept, applied straight away.
// Words that are apart stay separate pieces of the new concept (each one highlighted).
// Returns { concepts, joinedId, error }.
export function joinPicked(concepts, question, { conceptIds = [], wordStarts = [] } = {}) {
    const list = Array.isArray(concepts) ? concepts : [];
    const q = typeof question === 'string' ? question : '';
    const chosen = list.filter((c) => conceptIds.includes(c.id));
    const segments = buildQuestionSegments(q, list);
    const words = segments.filter((s) => s.kind === 'word' && wordStarts.includes(s.start));
    if (chosen.length + words.length < 2) {
        return { concepts: list, joinedId: null, error: 'Pick at least two concepts or words to join.' };
    }
    const piecesOf = (id) => segments.filter((s) => s.kind === 'concept' && s.conceptId === id);

    const tokens = [
        ...chosen.flatMap((c) => nameTokens(q, c, piecesOf(c.id))),
        ...words.map((w) => ({ start: w.start, text: w.text })),
    ].sort((a, b) => a.start - b.start);
    const name = normalizeName(tokens.map((t) => t.text).join(' ')).slice(0, MAX_CONCEPT_NAME_CHARS).trim();
    if (!name) return { concepts: list, joinedId: null, error: 'Pick at least two concepts or words to join.' };
    if (nameIsTaken(list, name, conceptIds)) {
        return { concepts: list, joinedId: null, error: `You already have a concept called "${name}".` };
    }
    if (list.length - chosen.length + 1 > MAX_CONCEPTS) {
        return { concepts: list, joinedId: null, error: conceptLimitMessage() };
    }

    const pieces = mergePieces(q, [...chosen.flatMap((c) => piecesOf(c.id)), ...words]);
    const first = chosen[0];
    const joined = {
        ...makeConcept({
            name,
            source: chosen.length ? 'joined' : 'words',
            questionParts: piecesToParts(q, pieces),
            colorIndex: first ? colorOf(first, list.indexOf(first)) : nextFreeColor(list),
        }),
        active: chosen.length === 0 || chosen.some(isActive),
        synonyms: [...new Set(chosen.flatMap((c) => (Array.isArray(c.synonyms) ? c.synonyms : [])))],
        keywords: uniqueByTerm(chosen.flatMap((c) => (Array.isArray(c.keywords) ? c.keywords : []))),
        controlled_vocabulary: uniqueByTerm(chosen.flatMap((c) => (Array.isArray(c.controlled_vocabulary) ? c.controlled_vocabulary : []))),
    };

    // The joined concept takes the place of the first chosen one (or goes at the end)
    const rest = list.filter((c) => !conceptIds.includes(c.id));
    rest.splice(first ? list.indexOf(first) : rest.length, 0, joined);
    return { concepts: rest, joinedId: joined.id, error: null };
}

// Joins two or more concepts from the list
export function joinConcepts(concepts, ids, question = '') {
    return joinPicked(concepts, question, { conceptIds: Array.isArray(ids) ? ids : [] });
}

// The join icon between two neighbors in the question (a word or a concept piece on each side)
export function joinNeighbors(concepts, question, leftStart, rightStart) {
    const list = Array.isArray(concepts) ? concepts : [];
    const q = typeof question === 'string' ? question : '';
    const segments = buildQuestionSegments(q, list);
    const left = segments.find((s) => s.kind !== 'gap' && s.start === leftStart);
    const right = segments.find((s) => s.kind !== 'gap' && s.start === rightStart);
    if (!left || !right || left.end > right.start || !isJoinableGap(q.slice(left.end, right.start))) {
        return { concepts: list, joinedId: null, error: 'Only words next to each other can be joined here. Use Join for words that are apart.' };
    }
    if (left.kind === 'concept' && right.kind === 'concept' && left.conceptId === right.conceptId) {
        // Two pieces of the same concept become one piece
        const pieces = mergePieces(q, segments.filter((s) => s.kind === 'concept' && s.conceptId === left.conceptId));
        const parts = piecesToParts(q, pieces);
        return { concepts: list.map((c) => (c.id === left.conceptId ? withParts(c, parts) : c)), joinedId: left.conceptId, error: null };
    }
    const pick = { conceptIds: [], wordStarts: [] };
    for (const side of [left, right]) {
        if (side.kind === 'concept') pick.conceptIds.push(side.conceptId);
        else pick.wordStarts.push(side.start);
    }
    return joinPicked(list, q, pick);
}

// Replaces one concept with the given pieces ({ name, parts }). The first piece keeps the
// concept's id, color and on/off state; the others get new colors. Pieces made only of
// small words, or that repeat a concept you already have, are left out.
function replaceWithPieces(list, index, pieces) {
    const concept = list[index];
    const seen = new Set();
    const keep = pieces.filter((piece) => {
        const key = conceptKey(piece.name);
        if (!key || seen.has(key) || nameIsTaken(list, piece.name, [concept.id])) return false;
        seen.add(key);
        return true;
    });
    if (list.length - 1 + keep.length > MAX_CONCEPTS) return { concepts: list, error: conceptLimitMessage() };

    const rest = list.filter((_, i) => i !== index);
    const made = keep.map((piece, i) => {
        const base = i === 0
            ? { ...concept, name: piece.name }
            : { ...makeConcept({ name: piece.name, source: 'split', colorIndex: 0 }), active: isActive(concept) };
        return withParts({ ...base, synonyms: [], keywords: [], controlled_vocabulary: [] }, piece.parts);
    });
    made.forEach((concept, i) => {
        if (i > 0) concept.colorIndex = nextFreeColor([...rest, ...made.slice(0, i)]);
    });
    rest.splice(index, 0, ...made);
    return { concepts: rest, error: null };
}

// Small words at the edges of a piece go back to plain text ("of health" -> "health")
const trimLittleWords = (words) => {
    let start = 0;
    let end = words.length;
    while (start < end && isLittleWord(words[start].text)) start += 1;
    while (end > start && isLittleWord(words[end - 1].text)) end -= 1;
    return words.slice(start, end);
};

// The split icon between two words of a concept in the question: the concept is cut there.
// cutStart is where the word after the cut begins.
export function splitConceptAt(concepts, question, conceptId, cutStart) {
    const list = Array.isArray(concepts) ? concepts : [];
    const q = typeof question === 'string' ? question : '';
    const index = list.findIndex((c) => c.id === conceptId);
    if (index === -1) return { concepts: list, error: 'This concept no longer exists.' };
    const pieces = buildQuestionSegments(q, list).filter((s) => s.kind === 'concept' && s.conceptId === conceptId);
    const words = labelledWords(q, list[index], pieces);
    const sides = [words.filter((w) => w.start < cutStart), words.filter((w) => w.start >= cutStart)];
    if (sides.some((side) => side.length === 0)) return { concepts: list, error: 'Pick a place between two words to split.' };

    const newPieces = sides
        .map(trimLittleWords)
        .filter((side) => side.length > 0)
        .map((side) => ({
            name: normalizeName(side.map((w) => w.label).join(' ')).slice(0, MAX_CONCEPT_NAME_CHARS).trim(),
            parts: piecesToParts(q, mergePieces(q, side)),
        }));
    return replaceWithPieces(list, index, newPieces);
}

// "Separate" for a concept joined from words in different places: each piece becomes its own concept
export function separateConcept(concepts, conceptId) {
    const list = Array.isArray(concepts) ? concepts : [];
    const index = list.findIndex((c) => c.id === conceptId);
    if (index === -1) return { concepts: list, error: 'This concept no longer exists.' };
    const concept = list[index];
    const parts = conceptParts(concept);
    if (parts.length < 2) return { concepts: list, error: 'This concept has only one part.' };

    // Use the name's words when they line up with the pieces (keeps spelling fixes)
    const nameWords = normalizeName(concept.name).split(' ');
    const counts = parts.map((part) => part.split(' ').length);
    const lineUp = counts.reduce((sum, n) => sum + n, 0) === nameWords.length;
    let offset = 0;
    const pieces = parts.map((part, i) => {
        const name = lineUp ? nameWords.slice(offset, offset + counts[i]).join(' ') : part;
        offset += counts[i];
        return { name: normalizeName(name), parts: [part], words: part.split(' ') };
    }).filter((piece) => hasMeaningfulWord(piece.words));
    return replaceWithPieces(list, index, pieces);
}

// ---------- AI follow-up questions and suggestions ----------

export const emptyConceptAssist = () => ({ analyzedQuestion: '', followUps: [], suggestions: [] });

const textList = (value, maxChars) => (Array.isArray(value) ? value : [])
    .map((item) => normalizeName(item))
    .filter((item) => item && item.length <= maxChars);

const pickStatus = (value, allowed) => (allowed.includes(value) ? value : allowed[0]);
const pickId = (value, prefix) => (typeof value === 'string' && value ? value : createId(prefix));

export function makeConceptAssist(question, result, concepts) {
    const existing = new Set((concepts || []).map((c) => conceptKey(c.name)));
    return {
        analyzedQuestion: normalizeName(question),
        followUps: textList(result && result.followUpQuestions, 300)
            .slice(0, MAX_FOLLOW_UPS)
            .map((text) => ({ id: createId('followup'), question: text, answer: '', status: 'open', suggestions: [] })),
        suggestions: textList(result && result.suggestedConcepts, MAX_CONCEPT_NAME_CHARS)
            .filter((name) => !existing.has(conceptKey(name)))
            .slice(0, MAX_SUGGESTIONS)
            .map((name) => ({ id: createId('suggestion'), name, status: 'open' })),
    };
}

const normalizeSuggestions = (value, limit) => (Array.isArray(value) ? value : [])
    .filter((s) => s && typeof s.name === 'string' && s.name.trim())
    .slice(0, limit)
    .map((s) => ({
        id: pickId(s.id, 'suggestion'),
        name: s.name.slice(0, MAX_CONCEPT_NAME_CHARS),
        status: pickStatus(s.status, ['open', 'added', 'dismissed']),
    }));

// Saved data is checked before use, so broken or old data can't break the screen
export function normalizeConceptAssist(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyConceptAssist();
    return {
        analyzedQuestion: typeof raw.analyzedQuestion === 'string' ? raw.analyzedQuestion.slice(0, MAX_QUESTION_CHARS) : '',
        followUps: (Array.isArray(raw.followUps) ? raw.followUps : [])
            .filter((f) => f && typeof f.question === 'string' && f.question.trim())
            .slice(0, MAX_FOLLOW_UPS)
            .map((f) => ({
                id: pickId(f.id, 'followup'),
                question: f.question.slice(0, 300),
                answer: typeof f.answer === 'string' ? f.answer.slice(0, MAX_ANSWER_CHARS) : '',
                status: pickStatus(f.status, ['open', 'answered', 'skipped']),
                suggestions: normalizeSuggestions(f.suggestions, MAX_ANSWER_SUGGESTIONS),
            })),
        suggestions: normalizeSuggestions(raw.suggestions, MAX_SUGGESTIONS),
    };
}

// The AI's concepts from an answer, minus ones the researcher already has
export function answerSuggestionNames(names, concepts) {
    const existing = new Set((Array.isArray(concepts) ? concepts : []).map((c) => conceptKey(c.name)));
    const seen = new Set();
    return textList(names, MAX_CONCEPT_NAME_CHARS)
        .filter((name) => {
            const key = conceptKey(name);
            if (existing.has(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, MAX_ANSWER_SUGGESTIONS);
}

// Saves an answer (new or edited). The AI's concepts wait under the question as suggestions;
// nothing joins the concept list until the researcher confirms. Concepts already added stay.
export function answerFollowUp(assist, followUpId, answer, names, concepts) {
    const base = assist && typeof assist === 'object' ? assist : emptyConceptAssist();
    const suggestions = answerSuggestionNames(names, concepts).map((name) => ({ id: createId('suggestion'), name, status: 'open' }));
    return {
        ...base,
        followUps: (base.followUps || []).map((f) => (f.id === followUpId
            ? { ...f, answer: normalizeName(answer).slice(0, MAX_ANSWER_CHARS), status: 'answered', suggestions }
            : f)),
    };
}

export function setAnswerSuggestionStatus(assist, followUpId, suggestionId, status) {
    return {
        ...assist,
        followUps: (assist.followUps || []).map((f) => (f.id === followUpId
            ? { ...f, suggestions: (f.suggestions || []).map((s) => (s.id === suggestionId ? { ...s, status } : s)) }
            : f)),
    };
}

// Adds the chosen suggestions under a follow-up question to the concept list.
// Returns { concepts, assist, added, overLimit }.
export function addAnswerSuggestions(concepts, assist, followUpId, suggestionIds) {
    const followUp = (assist && assist.followUps ? assist.followUps : []).find((f) => f.id === followUpId);
    if (!followUp) return { concepts, assist, added: 0, overLimit: 0 };
    let list = concepts;
    let added = 0;
    let overLimit = 0;
    const done = new Set();
    for (const suggestion of followUp.suggestions || []) {
        if (!suggestionIds.includes(suggestion.id) || suggestion.status !== 'open') continue;
        const result = addConcepts(list, [{ name: suggestion.name, source: 'answer' }]);
        list = result.concepts;
        if (result.overLimit > 0) {
            overLimit += 1;
            continue;
        }
        added += result.added + result.reactivated;
        done.add(suggestion.id);
    }
    const nextAssist = done.size === 0 ? assist : {
        ...assist,
        followUps: assist.followUps.map((f) => (f.id === followUpId
            ? { ...f, suggestions: f.suggestions.map((s) => (done.has(s.id) ? { ...s, status: 'added' } : s)) }
            : f)),
    };
    return { concepts: list, assist: nextAssist, added, overLimit };
}

// Concepts loaded from a saved project (including older PICO projects)
export function normalizeLoadedConcepts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((c) => c && typeof c === 'object' && typeof c.name === 'string')
        .map((c, index) => ({
            ...c,
            id: typeof c.id === 'string' && c.id ? c.id : createId(),
            questionParts: cleanParts(c.questionParts),
            synonyms: Array.isArray(c.synonyms) ? c.synonyms : [],
            keywords: Array.isArray(c.keywords) ? c.keywords : [],
            controlled_vocabulary: Array.isArray(c.controlled_vocabulary) ? c.controlled_vocabulary : [],
            colorIndex: Number.isInteger(c.colorIndex) ? c.colorIndex : index,
        }));
}

// ---------- Requests to the AI ----------

// Optional project details that help the AI (only text values are sent)
export function buildAiContext(project, negativeKeywords) {
    const text = (value) => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(', ');
        return '';
    };
    const negatives = (Array.isArray(negativeKeywords) ? negativeKeywords : [])
        .filter((k) => typeof k === 'string' && k.trim())
        .join(', ');
    return {
        projectType: text(project && project.projectType),
        discipline: text(project && project.discipline),
        desiredOutcomes: text(project && project.outcomesNeeded),
        undesiredOutcomes: text(project && project.outcomesNotNeeded) || negatives,
        questionTemplate: text(project && project.questionTemplate),
    };
}

// Active concepts get short temporary ids (c1, c2, ...) for the AI request
export function buildKeywordRequest(concepts) {
    const idMap = new Map();
    const requestConcepts = activeConcepts(concepts)
        .slice(0, MAX_CONCEPTS)
        .map((concept, index) => {
            const id = `c${index + 1}`;
            idMap.set(id, concept.id);
            return { id, name: normalizeName(concept.name).slice(0, MAX_CONCEPT_NAME_CHARS) };
        });
    return { requestConcepts, idMap };
}

// Puts the AI's keywords on the matching concepts. Turned-off concepts get no keywords.
export function applyKeywordResults(concepts, results, idMap) {
    const byConceptId = new Map();
    for (const item of Array.isArray(results) ? results : []) {
        const conceptId = item && typeof item.id === 'string' ? idMap.get(item.id) : undefined;
        if (conceptId) byConceptId.set(conceptId, item);
    }
    return concepts.map((concept) => {
        if (!isActive(concept)) return { ...concept, keywords: [], controlled_vocabulary: [] };
        const item = byConceptId.get(concept.id);
        const terms = Array.isArray(item && item.terms) ? item.terms.filter((t) => typeof t === 'string' && t.trim()) : [];
        const vocabulary = Array.isArray(item && item.controlledVocabulary)
            ? item.controlledVocabulary.filter((v) => v && typeof v.term === 'string' && typeof v.type === 'string')
            : [];
        return {
            ...concept,
            keywords: terms.map((term) => ({ term, active: true, source: 'ai', searchField: 4 })),
            controlled_vocabulary: vocabulary.map((v) => ({ term: v.term, type: v.type, active: true, source: 'ai' })),
        };
    });
}

export const countKeywords = (concepts) => (Array.isArray(concepts) ? concepts : [])
    .reduce((sum, c) => sum + (Array.isArray(c.keywords) ? c.keywords.length : 0), 0);
