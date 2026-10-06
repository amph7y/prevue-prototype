// Concept helpers for Step 1: finding concepts in the question, picking words,
// joining, colors, and preparing keyword requests.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

export const MAX_CONCEPTS = 10;
export const MAX_QUESTION_CHARS = 1000;
export const MAX_ANSWER_CHARS = 300;
export const MAX_CONCEPT_NAME_CHARS = 150;
const MAX_FOLLOW_UPS = 4;
const MAX_SUGGESTIONS = 4;

// Class names are written out in full so Tailwind includes them in the build
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

export function makeConcept({ name, source = 'manual', questionText = '', colorIndex = 0 }) {
    return {
        id: createId(),
        name: normalizeName(name),
        type: 'concept',
        source,
        active: true,
        colorIndex,
        questionText: normalizeName(questionText),
        synonyms: [],
        keywords: [],
        controlled_vocabulary: [],
    };
}

// ---------- Adding, changing and removing ----------

// Adds new concepts from { name, source, questionText } items.
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
        list.push(makeConcept({ name, source: item.source, questionText: item.questionText, colorIndex: nextFreeColor(list) }));
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

// ---------- The question: highlighting and picking words ----------

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_CHAR = /[\p{L}\p{N}]/u;
const isBoundary = (text, index) => index < 0 || index >= text.length || !WORD_CHAR.test(text[index]);

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

// Splits the question into pieces for display:
//   { kind: 'concept', conceptId, text, start, end } - a concept (shown as a bubble)
//   { kind: 'word', text, start, end }               - any other word (can be selected)
//   { kind: 'gap', text, start, end }                - spaces and punctuation
export function buildQuestionSegments(question, concepts) {
    const q = typeof question === 'string' ? question : '';
    if (!q) return [];

    const taken = [];
    for (const concept of Array.isArray(concepts) ? concepts : []) {
        const span = findPhrase(q, concept.questionText, taken) || findPhrase(q, concept.name, taken);
        if (span) taken.push({ ...span, conceptId: concept.id });
    }
    taken.sort((a, b) => a.start - b.start);

    const segments = [];
    const pushPlain = (from, to) => {
        const part = q.slice(from, to);
        const wordPattern = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;
        let last = 0;
        let match = wordPattern.exec(part);
        while (match !== null) {
            if (match.index > last) {
                segments.push({ kind: 'gap', text: part.slice(last, match.index), start: from + last, end: from + match.index });
            }
            segments.push({ kind: 'word', text: match[0], start: from + match.index, end: from + match.index + match[0].length });
            last = match.index + match[0].length;
            match = wordPattern.exec(part);
        }
        if (last < part.length) segments.push({ kind: 'gap', text: part.slice(last), start: from + last, end: to });
    };

    let cursor = 0;
    for (const span of taken) {
        if (span.start > cursor) pushPlain(cursor, span.start);
        segments.push({ kind: 'concept', conceptId: span.conceptId, text: q.slice(span.start, span.end), start: span.start, end: span.end });
        cursor = span.end;
    }
    if (cursor < q.length) pushPlain(cursor, q.length);
    return segments;
}

// Selected words that sit next to each other (with only spaces, hyphens or slashes
// between them) become one phrase. Returns [{ text, start, end }].
export function phrasesFromSelection(question, segments, selectedStarts) {
    const selected = new Set(selectedStarts);
    const phrases = [];
    let current = null;
    const close = () => {
        if (current) {
            const text = normalizeName(question.slice(current.start, current.end));
            if (text) phrases.push({ text, start: current.start, end: current.end });
        }
        current = null;
    };
    for (const segment of segments) {
        if (segment.kind === 'word' && selected.has(segment.start)) {
            if (current) current.end = segment.end;
            else current = { start: segment.start, end: segment.end };
        } else if (segment.kind === 'gap' && /^[\s\-\u2013\u2014/]*$/.test(segment.text)) {
            // a space between words keeps the phrase going
        } else {
            close();
        }
    }
    close();
    return phrases;
}

const uniqueByTerm = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item && item.type ? item.type : ''}:${conceptKey(item && item.term)}`;
        if (!item || !item.term || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

// Joins two or more concepts into one, placed where the first of them was.
// If they all appear in the question, the bubble covers the question text from the first to the last.
export function joinConcepts(concepts, ids, question = '') {
    const chosen = concepts.filter((c) => ids.includes(c.id));
    if (chosen.length < 2) return { concepts, joinedId: null, error: 'Select at least two concepts to join.' };

    const spanById = new Map(
        buildQuestionSegments(question, concepts)
            .filter((s) => s.kind === 'concept')
            .map((s) => [s.conceptId, s])
    );
    const spans = chosen.map((c) => spanById.get(c.id));
    const allInQuestion = spans.every(Boolean);
    const ordered = allInQuestion
        ? [...chosen].sort((a, b) => spanById.get(a.id).start - spanById.get(b.id).start)
        : chosen;

    let questionText = '';
    if (allInQuestion) {
        const start = Math.min(...spans.map((s) => s.start));
        const end = Math.max(...spans.map((s) => s.end));
        const slice = normalizeName(question.slice(start, end));
        if (slice.length <= MAX_CONCEPT_NAME_CHARS * 2) questionText = slice;
    }
    const name = normalizeName(ordered.map((c) => c.name).join(' ')).slice(0, MAX_CONCEPT_NAME_CHARS).trim();

    const first = concepts.find((c) => ids.includes(c.id));
    const joined = {
        ...makeConcept({ name, source: 'joined', questionText, colorIndex: colorOf(first, concepts.indexOf(first)) }),
        synonyms: [...new Set(chosen.flatMap((c) => (Array.isArray(c.synonyms) ? c.synonyms : [])))],
        keywords: uniqueByTerm(chosen.flatMap((c) => (Array.isArray(c.keywords) ? c.keywords : []))),
        controlled_vocabulary: uniqueByTerm(chosen.flatMap((c) => (Array.isArray(c.controlled_vocabulary) ? c.controlled_vocabulary : []))),
    };

    const firstIndex = concepts.indexOf(first);
    const rest = concepts.filter((c) => !ids.includes(c.id));
    rest.splice(firstIndex, 0, joined);
    return { concepts: rest, joinedId: joined.id, error: null };
}

// ---------- AI follow-up questions and suggestions ----------

export const emptyConceptAssist = () => ({ analyzedQuestion: '', followUps: [], suggestions: [] });

const textList = (value, maxChars) => (Array.isArray(value) ? value : [])
    .map((item) => normalizeName(item))
    .filter((item) => item && item.length <= maxChars);

export function makeConceptAssist(question, result, concepts) {
    const existing = new Set((concepts || []).map((c) => conceptKey(c.name)));
    return {
        analyzedQuestion: normalizeName(question),
        followUps: textList(result && result.followUpQuestions, 300)
            .slice(0, MAX_FOLLOW_UPS)
            .map((text) => ({ id: createId('followup'), question: text, answer: '', status: 'open' })),
        suggestions: textList(result && result.suggestedConcepts, MAX_CONCEPT_NAME_CHARS)
            .filter((name) => !existing.has(conceptKey(name)))
            .slice(0, MAX_SUGGESTIONS)
            .map((name) => ({ id: createId('suggestion'), name, status: 'open' })),
    };
}

// Saved data is checked before use, so broken or old data can't break the screen
export function normalizeConceptAssist(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyConceptAssist();
    const pickStatus = (value, allowed) => (allowed.includes(value) ? value : 'open');
    const pickId = (value, prefix) => (typeof value === 'string' && value ? value : createId(prefix));
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
            })),
        suggestions: (Array.isArray(raw.suggestions) ? raw.suggestions : [])
            .filter((s) => s && typeof s.name === 'string' && s.name.trim())
            .slice(0, MAX_SUGGESTIONS)
            .map((s) => ({
                id: pickId(s.id, 'suggestion'),
                name: s.name.slice(0, MAX_CONCEPT_NAME_CHARS),
                status: pickStatus(s.status, ['open', 'added', 'dismissed']),
            })),
    };
}

// Concepts loaded from a saved project (including older PICO projects)
export function normalizeLoadedConcepts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((c) => c && typeof c === 'object' && typeof c.name === 'string')
        .map((c, index) => ({
            ...c,
            id: typeof c.id === 'string' && c.id ? c.id : createId(),
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
