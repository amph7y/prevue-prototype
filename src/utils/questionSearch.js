// Search Translator: turns a research question into a PubMed search with the same two AI steps
// Step 1 uses (find the concepts in the question, then keywords and MeSH headings for them).
// The search is then translated for every database like any other search.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

import {
    MAX_QUESTION_CHARS,
    addConcepts,
    applyKeywordResults,
    buildKeywordRequest,
    countKeywords,
} from './concepts.js';
import { buildQuery } from './queryBuilder.js';

// Each question uses this many AI requests
export const QUESTION_AI_REQUESTS = 2;
const TITLE_ABSTRACT_FIELD = 1; // keywords search titles and abstracts

export class QuestionSearchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QuestionSearchError';
    }
}

// runTask(task, payload) calls the AI (runConceptTask in the app; a stand-in in the tests).
// Returns { search, concepts: [names] }.
export async function searchFromQuestion(question, runTask) {
    const text = String(question ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new QuestionSearchError('Write your research question first.');
    if (text.length > MAX_QUESTION_CHARS) {
        throw new QuestionSearchError(`Please shorten your question to ${MAX_QUESTION_CHARS.toLocaleString('en-US')} characters or fewer.`);
    }

    const analysis = await runTask('analyzeQuestion', { question: text, context: {} });
    const found = (analysis && Array.isArray(analysis.concepts) ? analysis.concepts : [])
        .filter((concept) => concept && typeof concept.name === 'string')
        .map((concept) => ({ name: concept.name, questionText: typeof concept.text === 'string' ? concept.text : '', source: 'question' }));
    const concepts = addConcepts([], found).concepts;
    if (concepts.length === 0) {
        throw new QuestionSearchError("The AI couldn't find clear concepts in this question. Try rephrasing it, or paste a search instead.");
    }

    const { requestConcepts, idMap } = buildKeywordRequest(concepts);
    const keywords = await runTask('generateKeywords', {
        question: text,
        concepts: requestConcepts,
        style: 'balanced',
        vocabulary: { mesh: true, emtree: false },
        context: {},
    });
    const withKeywords = applyKeywordResults(concepts, keywords && keywords.concepts, idMap)
        .map((concept) => ({
            ...concept,
            keywords: concept.keywords.map((keyword) => ({ ...keyword, searchField: TITLE_ABSTRACT_FIELD })),
        }));
    if (countKeywords(withKeywords) === 0) {
        throw new QuestionSearchError("The AI didn't return any keywords. Please try again.");
    }

    const search = buildQuery('pubmed', withKeywords, { enabledTypes: { mesh: true }, negativeKeywords: [] }).text.trim();
    if (!search) throw new QuestionSearchError("The AI didn't return any keywords. Please try again.");
    return { search, concepts: withKeywords.map((concept) => concept.name) };
}
