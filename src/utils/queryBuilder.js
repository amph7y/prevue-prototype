// Builds the search query for each database from the concepts.
// The main query page and the Refine window both use this, so their queries always match.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

import { DB_CONFIG } from '../config/dbConfig.js';

const DEFAULT_SEARCH_FIELD = 4; // All fields
const SEMANTIC_SCHOLAR_MAX_PHRASES = 6;

const asList = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (typeof value === 'string' ? value : '');
const isOn = (concept) => Boolean(concept) && concept.active !== false;

// The database's code for a keyword's search field. A missing or unknown field uses All fields.
function fieldCode(config, searchField) {
    const fields = config.searchFields || {};
    return fields[searchField] ?? fields[DEFAULT_SEARCH_FIELD];
}

// A piece of the query: kind is 'concept' (one concept's terms), 'operator' (AND, NOT and
// spacing) or 'exclude' (the excluded terms). Joined together, the pieces are the query.
const piece = (text, kind, conceptId = null) => ({ text, kind, conceptId });

// Removes spaces at the very start and end of the query, piece by piece
function trimPieces(pieces) {
    const full = pieces.map((p) => p.text).join('');
    let fromStart = full.length - full.replace(/^\s+/, '').length;
    let fromEnd = full.length - full.replace(/\s+$/, '').length;
    const out = pieces.map((p) => ({ ...p }));
    for (const p of out) {
        if (fromStart <= 0) break;
        const cut = Math.min(fromStart, p.text.length);
        p.text = p.text.slice(cut);
        fromStart -= cut;
    }
    for (let i = out.length - 1; i >= 0 && fromEnd > 0; i -= 1) {
        const cut = Math.min(fromEnd, out[i].text.length);
        out[i].text = out[i].text.slice(0, out[i].text.length - cut);
        fromEnd -= cut;
    }
    return out.filter((p) => p.text !== '');
}

// One concept's terms joined with OR, or null if it has none switched on
function conceptGroup(dbKey, config, concept, enabledTypes) {
    const keywords = asList(concept.keywords);
    if (keywords.length === 0) return null;
    const { syntax } = config;

    const keywordTerms = keywords
        .filter((k) => k && k.active)
        .map((k) => syntax.phrase(k.term, fieldCode(config, k.searchField)));
    const vocabulary = asList(concept.controlled_vocabulary).filter((v) => v && v.active && typeof v.type === 'string');

    let terms;
    if (dbKey === 'pubmed') {
        // PubMed: controlled vocabulary first, and only the types switched on (Parallel MeSH Search)
        const vocabularyTerms = vocabulary
            .filter((v) => enabledTypes[v.type.toLowerCase()])
            .map((v) => {
                const write = syntax[v.type.toLowerCase()];
                return write ? write(v.term) : null;
            })
            .filter((term) => term !== null);
        terms = [...vocabularyTerms, ...keywordTerms];
    } else {
        // Other databases: keywords first, then the vocabulary types the database understands
        const defaultField = fieldCode(config, DEFAULT_SEARCH_FIELD);
        const vocabularyTerms = vocabulary
            .filter((v) => syntax[v.type.toLowerCase()])
            .map((v) => syntax[v.type.toLowerCase()](v.term, defaultField));
        terms = [...keywordTerms, ...vocabularyTerms];
    }
    return terms.length > 0 ? `(${terms.join(' OR ')})` : null;
}

// Semantic Scholar works best with a few short phrases: each concept's name and its first keyword
function semanticScholarPieces(concepts, negatives) {
    const phrases = [];
    concepts.forEach((concept) => {
        const name = asText(concept.name).trim();
        if (name) phrases.push({ text: `"${name}"`, conceptId: concept.id });
        if (phrases.length >= SEMANTIC_SCHOLAR_MAX_PHRASES) return;
        const first = asList(concept.keywords).find((k) => k && k.active && asText(k.term).trim());
        if (first) phrases.push({ text: `"${first.term.trim()}"`, conceptId: concept.id });
    });
    const seen = new Set();
    const unique = phrases
        .filter((p) => {
            if (seen.has(p.text)) return false;
            seen.add(p.text);
            return true;
        })
        .slice(0, SEMANTIC_SCHOLAR_MAX_PHRASES);

    const pieces = [];
    unique.forEach((p, i) => {
        if (i > 0) pieces.push(piece(' ', 'operator'));
        pieces.push(piece(p.text, 'concept', p.conceptId));
    });
    if (negatives.length > 0) {
        if (pieces.length > 0) pieces.push(piece(' ', 'operator'));
        pieces.push(piece(negatives.map((k) => `-"${k}"`).join(' '), 'exclude'));
    }
    return pieces;
}

// Builds the query for one database.
//   concepts: the project's concepts (turned-off concepts are left out)
//   enabledTypes: controlled vocabulary types switched on for PubMed, e.g. { mesh: true }
//   negativeKeywords: terms to exclude
// Returns { text, pieces }: the query, and the same query split into pieces for colored display.
export function buildQuery(dbKey, concepts, { enabledTypes = {}, negativeKeywords = [] } = {}) {
    const config = DB_CONFIG[dbKey];
    const usable = asList(concepts).filter(isOn);
    if (!config || usable.length === 0) return { text: '', pieces: [] };
    const negatives = asList(negativeKeywords).filter((k) => typeof k === 'string' && k.trim() !== '');
    const types = enabledTypes && typeof enabledTypes === 'object' ? enabledTypes : {};

    let pieces;
    if (dbKey === 'semanticScholar') {
        pieces = semanticScholarPieces(usable, negatives);
    } else {
        // Concepts are separated by AND, each on its own lines
        const joiner = `\n\n${config.syntax.separator}\n\n `;
        pieces = [];
        usable.forEach((concept) => {
            const group = conceptGroup(dbKey, config, concept, types);
            if (!group) return;
            if (pieces.length > 0) pieces.push(piece(joiner, 'operator'));
            pieces.push(piece(group, 'concept', concept.id));
        });
        if (negatives.length > 0 && pieces.length > 0) {
            if (config.syntax.not === '-') {
                // Databases without NOT (Google Scholar): a minus before each excluded term
                pieces.push(piece(' ', 'operator'));
                pieces.push(piece(negatives.map((k) => `-"${k}"`).join(' '), 'exclude'));
            } else {
                pieces.push(piece(` ${config.syntax.not} `, 'operator'));
                pieces.push(piece(`(${negatives.map((k) => `"${k}"`).join(' OR ')})`, 'exclude'));
            }
        }
    }
    pieces = trimPieces(pieces);
    return { text: pieces.map((p) => p.text).join(''), pieces };
}

// The concepts in a built query, in order (each once), and whether it excludes terms
export function queryLegend(pieces) {
    const conceptIds = [];
    let hasExcluded = false;
    for (const p of asList(pieces)) {
        if (p.kind === 'concept' && p.conceptId && !conceptIds.includes(p.conceptId)) conceptIds.push(p.conceptId);
        if (p.kind === 'exclude') hasExcluded = true;
    }
    return { conceptIds, hasExcluded };
}

// The Refine window keeps keywords as { [conceptId]: { label, keywords, controlled_vocabulary } }.
// This turns them back into concepts for buildQuery, in the given order when there is one.
export function conceptsFromKeywordGroups(groups, order) {
    if (!groups || typeof groups !== 'object') return [];
    const ids = Array.isArray(order) && order.length
        ? [...order.filter((id) => Object.prototype.hasOwnProperty.call(groups, id)),
            ...Object.keys(groups).filter((id) => !order.includes(id))]
        : Object.keys(groups);
    return ids
        .filter((id) => groups[id] && typeof groups[id] === 'object')
        .map((id) => ({
            id,
            name: asText(groups[id].label),
            active: true,
            colorIndex: groups[id].colorIndex,
            keywords: asList(groups[id].keywords),
            controlled_vocabulary: asList(groups[id].controlled_vocabulary),
        }));
}
