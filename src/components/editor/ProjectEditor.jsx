import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { runConceptTask } from '../../api/fanarApi.js';


// Config & Utils
import { db } from '../../config/firebase.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { useContextMenu } from '../../hooks/useContextMenu.jsx';
import { cn } from '../../utils/cn.js';
import { handleError } from '../../utils/utils.js';

// API Calls
import { callGeminiAPI } from '../../api/geminiApi.js';
import { getPubmedCount, searchPubmed } from '../../api/pubmedApi.js';
import { getElsevierCount, searchElsevier } from '../../api/elsevierApi.js';
import { getCoreCount, searchCore } from '../../api/coreApi.js';
import { getSemanticScholarCount, searchSemanticScholar } from '../../api/semanticScholarApi.js';

// Child Components & Modals
import QueryBuilder from './QueryBuilder.jsx';
import ResultsViewer from './ResultsViewer.jsx';
import ArticleDetailModal from '../common/ArticleDetailModal.jsx';
import ExportModal from '../common/ExportModal.jsx';

import ThesaurusModal from './ThesaurusModal.jsx';
import QueryRefinementModal from './QueryRefinementModal.jsx';
import { HomeIcon, CheckIcon, DownloadIcon } from '../common/Icons.jsx';
import Header from '../common/Header.jsx';
import DefineStep from './DefineStep.jsx';
import { retryAsync } from '../../utils/utils.js';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';
import { generateExportFile, downloadBlob, generateExportFilename } from '../../utils/exportUtils.js';
import logger from '../../utils/logger.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';
import {
    MAX_ANSWER_CHARS,
    MAX_CONCEPTS,
    MAX_QUESTION_CHARS,
    activeConcepts,
    addConcepts,
    appendExistingConcepts,
    applyKeywordResults,
    buildAiContext,
    buildKeywordRequest,
    countKeywords,
    emptyConceptAssist,
    makeConceptAssist,
    normalizeConceptAssist,
    normalizeLoadedConcepts,
} from '../../utils/concepts.js';

function ProjectEditor({ project, onBackToDashboard, onRequireLogin, onRequireSignup, onLogin, userId }) {
    const { userAccessLevel } = useAuth();
    const isGuestProject = project?.isGuest === true || !userId;
    const effectiveAccessLevel = isGuestProject ? 'guest' : userAccessLevel;
    const capabilities = getCapabilities(effectiveAccessLevel);
    // Global Download Context
    const { addDownload, setIsOpen: setDownloadCenterOpen } = useGlobalDownload();

    // Main State
    const [step, setStep] = useState(project.initialStep || 1);
    const [concepts, setConcepts] = useState([]);

    const [researchQuestion, setResearchQuestion] = useState('');
    const [negativeKeywords, setNegativeKeywords] = useState(['']);
    const [keywordStyle, setKeywordStyle] = useState('balanced');
    const [queries, setQueries] = useState({});
    const [searchCounts, setSearchCounts] = useState({});
    const [searchTotals, setSearchTotals] = useState({}); // Store totals from actual search results
    const [searchResults, setSearchResults] = useState(null);
    const [initialArticles, setInitialArticles] = useState([]);
    const [deduplicationResult, setDeduplicationResult] = useState(null);
    const [irrelevantArticles, setIrrelevantArticles] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Track generation state and counts for restrictions
    const [conceptsGenerated, setConceptsGenerated] = useState(false);
    const [keywordsGenerated, setKeywordsGenerated] = useState(false);
    const [conceptsGenerationCount, setConceptsGenerationCount] = useState(0);
    const [keywordsGenerationCount, setKeywordsGenerationCount] = useState(0);

    const [selectedDBs, setSelectedDBs] = useState(() => {
        // Implemented DBs
        const implemented = ['pubmed', 'scopus', 'core'];
        const initial = { pubmed: false, scopus: false, embase: false, core: false };
        if (capabilities.maxDatabases === Infinity) {
            // Premium: select all implemented by default
            implemented.forEach(k => { initial[k] = true; });
            return initial;
        }
        // Free: select first two implemented by default
        implemented.slice(0, Math.max(0, Math.min(2, capabilities.maxDatabases || 0))).forEach(k => { initial[k] = true; });
        return initial;
    });
    const [retmax, setRetmax] = useState(25);
    const [enabledControlledVocabTypes, setEnabledControlledVocabTypes] = useState({ mesh: true });

    // State for Modals
    // AI follow-up questions and suggested concepts for Step 1
    const [conceptAssist, setConceptAssist] = useState(emptyConceptAssist);
    const [answeringFollowUpId, setAnsweringFollowUpId] = useState(null);
    const [thesaurusData, setThesaurusData] = useState({ isOpen: false, word: '', synonyms: [], loading: false, context: null });
    const [refineModalData, setRefineModalData] = useState(null);

    const { showMenu, ContextMenuComponent } = useContextMenu();
    const debounceTimeout = useRef(null);

    const keywordGenerationStyles = {
        focused: { value: 'focused', label: 'Focused', description: 'Fewer, more specific terms', aiPrompt: 'For "keywords", provide a JSON array of 3-4 focused, specific synonym strings.' },
        balanced: { value: 'balanced', label: 'Balanced', description: 'Moderate number of terms', aiPrompt: 'For "keywords", provide a JSON array of 5-7 synonym strings.' },
        comprehensive: { value: 'comprehensive', label: 'Comprehensive', description: 'Many terms for broad coverage', aiPrompt: 'For "keywords", provide a JSON array of 8-12 comprehensive synonym strings for broad coverage.' },
    };

    useEffect(() => {
        if (isGuestProject) {
            try {
                const savedDraft = JSON.parse(localStorage.getItem('prevue_guest_project') || '{}');
                setResearchQuestion(savedDraft.researchQuestion || '');
                setConcepts(normalizeLoadedConcepts(savedDraft.concepts));
                setConceptAssist(normalizeConceptAssist(savedDraft.conceptAssist));
                setNegativeKeywords(savedDraft.negativeKeywords || ['']);
                setKeywordStyle(savedDraft.keywordStyle || 'balanced');
                setConceptsGenerated(savedDraft.conceptsGenerated || false);
                setKeywordsGenerated(savedDraft.keywordsGenerated || false);
                setConceptsGenerationCount(Number(savedDraft.conceptsGenerationCount || 0));
                setKeywordsGenerationCount(Number(savedDraft.keywordsGenerationCount || 0));
            } catch (error) {
                console.warn('Could not load guest draft:', error);
            }
            return;
        }

        if (!db || !userId || !project?.id) return;
        const docRef = doc(db, `users/${userId}/projects/${project.id}`);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setResearchQuestion(data.researchQuestion || '');

                setConcepts(normalizeLoadedConcepts(data.concepts));
                setConceptAssist(normalizeConceptAssist(data.conceptAssist));
                setNegativeKeywords(data.negativeKeywords || ['']);
                setKeywordStyle(data.keywordStyle || 'balanced');

                // Load generation state
                setConceptsGenerated(data.conceptsGenerated || false);
                setKeywordsGenerated(data.keywordsGenerated || false);
                setConceptsGenerationCount(Number(data.conceptsGenerationCount || (data.conceptsGenerated ? 1 : 0)));
                setKeywordsGenerationCount(Number(data.keywordsGenerationCount || (data.keywordsGenerated ? 1 : 0)));
            }
        });
    }, [project.id, userId, isGuestProject]);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            if (isGuestProject) {
                try {
                    localStorage.setItem('prevue_guest_project', JSON.stringify({
                        researchQuestion,
                        concepts,
                        negativeKeywords,
                        keywordStyle,
                        conceptsGenerated,
                        keywordsGenerated,
                        conceptsGenerationCount,
                        keywordsGenerationCount,
                        conceptAssist,
                        lastSaved: new Date().toISOString()
                    }));
                } catch (error) {
                    console.warn('Could not save guest draft:', error);
                }
                return;
            }

            if (!db || !userId || !project?.id) return;
            const docRef = doc(db, `users/${userId}/projects/${project.id}`);
            const dataToSave = {
                researchQuestion,
                concepts,
                negativeKeywords,
                keywordStyle,
                conceptsGenerated,
                keywordsGenerated,
                conceptsGenerationCount,
                keywordsGenerationCount,
                conceptAssist,
                lastSaved: serverTimestamp()
            };
            setDoc(docRef, dataToSave, { merge: true });
        }, 1000);
        return () => clearTimeout(debounceTimeout.current);
    }, [researchQuestion, concepts, conceptAssist, negativeKeywords, keywordStyle, conceptsGenerated, keywordsGenerated, conceptsGenerationCount, keywordsGenerationCount, project.id, userId, isGuestProject]);

    useEffect(() => {
        if (step === 2) {
            const keys = Object.keys(selectedDBs).filter(k => selectedDBs[k]);
            keys.forEach(dbKey => {
                const query = generateSingleQuery(dbKey, enabledControlledVocabTypes);
                setQueries(prev => ({ ...prev, [dbKey]: query }));

                if (query) {
                    fetchAndSetCount(dbKey);
                }
            });
        }
    }, [enabledControlledVocabTypes, step, selectedDBs]);

    const findSynonyms = async (word, context) => {
        if (!word) return toast.error("Please provide a word to search.");
        setThesaurusData({ isOpen: true, word, synonyms: [], loading: true, context });
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            if (!response.ok) throw new Error('No synonyms found.');
            const data = await response.json();
            const synonyms = data.flatMap(entry => entry.meanings.flatMap(meaning => meaning.synonyms || [])).filter((v, i, a) => a.indexOf(v) === i);
            setThesaurusData(prev => ({ ...prev, synonyms, loading: false }));
        } catch (error) {
            toast.error(error.message);
            setThesaurusData(prev => ({ ...prev, synonyms: [], loading: false }));
        }
    };

    const handleAddSynonym = (synonym) => {
        const { context } = thesaurusData;
        if (context) {
            handleAddKeyword(synonym, context.category, context.type, 'thesaurus');
        }
        setThesaurusData({ isOpen: false, word: '', synonyms: [], loading: false, context: null });
    };

    // Optional project details that help the AI understand the question
    const aiContext = () => buildAiContext(project, negativeKeywords);

    // The AI finds the concepts in the question, suggests related concepts and asks follow-up questions
    const handleAnalyzeQuestion = async () => {
        const question = researchQuestion.trim();
        if (!question) return toast.error('Please enter a research question first.');
        if (question.length > MAX_QUESTION_CHARS) {
            return toast.error(`Please shorten your question to ${MAX_QUESTION_CHARS} characters or fewer.`);
        }

        // Check if concepts generation exceeds limit for this project
        const maxConcepts = capabilities.maxConceptGenerationsPerProject;
        if (Number.isFinite(maxConcepts) && conceptsGenerationCount >= maxConcepts) {
            return toast.error(`Concepts can only be generated up to ${maxConcepts} times per project.`);
        }

        setIsLoading(true);
        try {
            const result = await runConceptTask('analyzeQuestion', { question, context: aiContext() });
            const found = (result.concepts || []).map((concept) => ({
                name: concept.name,
                questionText: concept.text,
                source: 'question',
            }));
            // Concepts come from the question; concepts the researcher typed in are kept
            const nextConcepts = appendExistingConcepts(
                addConcepts([], found).concepts,
                concepts.filter((concept) => concept.source === 'manual')
            );

            setConcepts(nextConcepts);
            setConceptAssist(makeConceptAssist(question, result, nextConcepts));
            setConceptsGenerated(true);
            setConceptsGenerationCount((prev) => prev + 1);

            if (found.length === 0) {
                toast("The AI couldn't find clear concepts. Add them yourself, or rephrase your question.");
            } else {
                toast.success('Concepts found in your question!');
            }
        } catch (err) {
            handleError(err, 'concept generation');
        } finally {
            setIsLoading(false);
        }
    };

    // The researcher answers an AI follow-up question; the answer becomes new concepts.
    // Returns true when the answer was used.
    const handleAnswerFollowUp = async (followUpId, answerText) => {
        const answer = (answerText || '').trim();
        const followUp = conceptAssist.followUps.find((f) => f.id === followUpId);
        if (!followUp || !answer) return false;
        if (answer.length > MAX_ANSWER_CHARS) {
            toast.error(`Please keep your answer to ${MAX_ANSWER_CHARS} characters or fewer.`);
            return false;
        }
        if (concepts.length >= MAX_CONCEPTS) {
            toast.error(`You can have up to ${MAX_CONCEPTS} concepts. Remove or join some to add more.`);
            return false;
        }

        setAnsweringFollowUpId(followUpId);
        try {
            const result = await runConceptTask('conceptsFromAnswer', {
                question: researchQuestion.trim(),
                followUp: followUp.question,
                answer,
                existingConcepts: concepts.map((c) => c.name),
                context: aiContext(),
            });
            const items = (result.concepts || []).map((name) => ({ name, source: 'answer' }));
            const preview = addConcepts(concepts, items);
            setConcepts((prev) => addConcepts(prev, items).concepts);
            setConceptAssist((prev) => ({
                ...prev,
                followUps: prev.followUps.map((f) => (f.id === followUpId ? { ...f, answer, status: 'answered' } : f)),
            }));

            const addedCount = preview.added + preview.reactivated;
            if (addedCount > 0) {
                toast.success(`Added ${addedCount} concept${addedCount === 1 ? '' : 's'} from your answer.`);
            } else if (preview.overLimit > 0) {
                toast.error(`You can have up to ${MAX_CONCEPTS} concepts. Remove or join some to add more.`);
            } else {
                toast('No new concepts were found in your answer.');
            }
            return true;
        } catch (err) {
            handleError(err, 'follow-up answer');
            return false;
        } finally {
            setAnsweringFollowUpId(null);
        }
    };

    const handleGenerateKeywords = async (conceptsData = concepts, keywordStyle = 'balanced') => {
        const allConcepts = Array.isArray(conceptsData) ? conceptsData : [];
        if (activeConcepts(allConcepts).length === 0) {
            return toast.error('No concepts are turned on. Add or turn on at least one concept first.');
        }

        // Check if keywords generation exceeds limit for this project
        const maxKeywords = capabilities.maxKeywordGenerationsPerProject;
        if (Number.isFinite(maxKeywords) && keywordsGenerationCount >= maxKeywords) {
            return toast.error(`Keywords can only be generated up to ${maxKeywords} times per project.`);
        }

        setIsLoading(true);
        try {
            // The server writes the AI instructions; concepts are matched back by id
            const { requestConcepts, idMap } = buildKeywordRequest(allConcepts);
            const result = await runConceptTask('generateKeywords', {
                question: researchQuestion.trim(),
                concepts: requestConcepts,
                style: keywordStyle,
                vocabulary: { mesh: Boolean(selectedDBs.pubmed), emtree: Boolean(selectedDBs.embase) },
                context: aiContext(),
            });

            const updatedConcepts = applyKeywordResults(allConcepts, result.concepts, idMap);
            const totalKeywords = countKeywords(updatedConcepts);
            if (totalKeywords === 0) {
                // Nothing usable came back, so this attempt doesn't count toward the limit
                return toast.error("The AI didn't return any keywords. Please try again.");
            }

            setConcepts(updatedConcepts);
            setKeywordsGenerated(true);
            setKeywordsGenerationCount(prev => prev + 1);

            // Log keyword generation
            await logger.logFeatureUsed(userId, 'keyword_generation', {
                projectId: project.id,
                projectName: project.name,
                keywordStyle,
                conceptsCount: requestConcepts.length,
                totalKeywords
            });

            toast.success(`Keywords generated with ${keywordStyle} style!`);
        } catch (err) {
            handleError(err, 'keyword generation');
        } finally {
            setIsLoading(false);
        }
    };

    const generateSingleQuery = (dbKey, enabledTypes = {}) => {
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
    };

    const fetchAndSetCount = async (dbKey) => {
        const query = generateSingleQuery(dbKey, enabledControlledVocabTypes);
        setQueries(prev => ({ ...prev, [dbKey]: query }));
        if (!capabilities.canSeeLiveCounts) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 'N/A', loading: false } }));
            return;
        }
        setSearchCounts(prev => ({ ...prev, [dbKey]: { ...prev[dbKey], loading: true } }));
        if (!query) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 0, loading: false } }));
            return;
        }
        try {
            const count = await retryAsync(async () => {
                if (dbKey === 'pubmed') return await getPubmedCount(query);
                if (dbKey === 'scopus' || dbKey === 'embase') return await getElsevierCount(dbKey, query);
                if (dbKey === 'core') return await getCoreCount(query);
                if (dbKey === 'semanticScholar') return await getSemanticScholarCount(query);
                return 'N/A';
            });
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: count, loading: false } }));
        } catch (err) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 'Error', loading: false } }));
            handleError(err, `count retrieval for ${dbKey}`);
        }
    };

    const handleDbSelectionChange = (dbKey, isChecked) => {
        setSelectedDBs(prev => ({ ...prev, [dbKey]: isChecked }));
        if (isChecked && step === 2) {
            fetchAndSetCount(dbKey);
        }
    };

    useEffect(() => {
        if (step === 2) {
            (async () => {
                const keys = Object.keys(selectedDBs).filter(k => selectedDBs[k]);
                await Promise.allSettled(keys.map(dbKey => fetchAndSetCount(dbKey)));
            })();
        }
    }, [step]);

    const handleRunSearch = async (isUpdate = false) => {
        if (capabilities.requiresLoginForSearch) {
            toast('Sign in to run your live search and save your project.');
            if (typeof onRequireLogin === 'function') {
                onRequireLogin();
            }
            return;
        }

        setIsSearching(true);
        if (!isUpdate) {
            setDeduplicationResult(null);
            setIrrelevantArticles(new Set());
        }

        const currentQueries = {};
        Object.keys(selectedDBs).forEach(dbKey => {
            if (selectedDBs[dbKey]) {
                currentQueries[dbKey] = generateSingleQuery(dbKey, enabledControlledVocabTypes);
            }
        });
        setQueries(currentQueries);
        setInitialArticles([]);
        setSearchResults(null);
        let results = {};
        let allFetchedArticles = [];

        const keys = Object.keys(currentQueries);
        const totals = {};
        const tasks = keys.map(dbKey => (async () => {
            const query = currentQueries[dbKey];
            try {
                const response = await retryAsync(async () => {
                    if (dbKey === 'pubmed') return await searchPubmed(query, retmax);
                    if (dbKey === 'scopus' || dbKey === 'embase') return await searchElsevier(dbKey, query, retmax);
                    if (dbKey === 'core') return await searchCore(query, retmax);
                    if (dbKey === 'semanticScholar') return await searchSemanticScholar(query, retmax);
                    return { total: 0, data: [] };
                });

                // Extract articles and total from response
                const articles = response.data || response; // Fallback for old format
                const total = response.total || 0;

                results[dbKey] = { status: 'success', data: articles };
                totals[dbKey] = total;
                allFetchedArticles.push(...articles);
            } catch (err) {
                console.error(`Error searching ${dbKey}:`, err);
                results[dbKey] = { status: 'error', message: err.message };
                totals[dbKey] = 0;
                handleError(err, `search for ${dbKey}`);
            }
        })());

        await Promise.all(tasks);

        setSearchResults(results);
        setInitialArticles(allFetchedArticles);
        setSearchTotals(totals); // Store the totals from search results
        setIsSearching(false);

        // Log search execution
        const successfulSearches = Object.values(results).filter(r => r.status === 'success').length;
        if (userId) {
            await logger.logSearchPerform(
                userId,
                currentQueries, // full queries by DB
                totals,         // per-DB counts
                keys.join(',')  // search type: comma-separated DBs
            );
        }

        if (!isUpdate) {
            const anyFailure = Object.values(results).some(r => r.status === 'error');
            if (anyFailure) return; // stay on Query step
            setStep(3);
        }
    };

    const handlePaginatedSearch = async (dbKey, page, pageSize = 25) => {
        const query = queries[dbKey];
        if (!query) return [];

        try {
            const offset = (page - 1) * pageSize;
            const response = await retryAsync(async () => {
                if (dbKey === 'pubmed') return await searchPubmed(query, pageSize, offset);
                if (dbKey === 'scopus' || dbKey === 'embase') return await searchElsevier(dbKey, query, pageSize, offset);
                if (dbKey === 'core') return await searchCore(query, pageSize, offset);
                if (dbKey === 'semanticScholar') return await searchSemanticScholar(query, pageSize, offset);
                return { total: 0, data: [] };
            }, { tries: 5, baseDelayMs: 1000, factor: 3 });

            // Extract articles from response (handle both old and new format)
            const articles = response.data || response;
            return articles;
        } catch (err) {
            console.error(`Error searching ${dbKey} page ${page}:`, err);
            handleError(err, `loading page ${page} for ${dbKey}`);
            return [];
        }
    };

    const handleDeduplicate = () => {
        if (initialArticles.length === 0) return toast.error("No articles to deduplicate.");
        const seen = new Set();
        let duplicateCount = 0;
        const updatedArticles = initialArticles.map(article => {
            const doi = article.doi || article.externalIds?.DOI;
            const title = (article.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            let isDuplicate = (doi && seen.has(doi)) || (title && seen.has(title));
            if (isDuplicate) {
                duplicateCount++;
                return { ...article, isDuplicate: true };
            } else {
                if (doi) seen.add(doi);
                if (title) seen.add(title);
                return { ...article, isDuplicate: false };
            }
        });
        setInitialArticles(updatedArticles);
        setDeduplicationResult({ count: duplicateCount });
        toast.success(`${duplicateCount} duplicates found.`);
    };

    const toggleIrrelevant = (articleId) => {
        const newSet = new Set(irrelevantArticles);
        if (newSet.has(articleId)) {
            newSet.delete(articleId);
        } else {
            newSet.add(articleId);
        }
        setIrrelevantArticles(newSet);
    };

    const exportHandler = async (format, options) => {
        if (!capabilities.canExport) {
            toast('Create a free account to export your results.');
            if (typeof onRequireSignup === 'function') onRequireSignup();
            return;
        }
        console.log('Export handler called with:', format, options);
        console.log('🔍 PROJECT EDITOR DEBUG:', {
            userAccessLevel,
            capabilities,
            exportQuotaPercent: options?.exportQuotaPercent,
            exportFullDataset: options?.exportFullDataset
        });

        // Always use background export (capped or full), so we can fetch beyond visible page
        console.log('Starting background export...');
        const downloadName = generateExportFilename(project.name, format);
        addDownload({
            name: downloadName,
            format,
            options,
            queries,
            searchTotals,
            progress: 0,
            totalRecords: 0,
            processedRecords: 0
        });
        setDownloadCenterOpen(true);
        toast.success('Export started! Check download center for progress.');
        return;
    };

    const renderStepIndicator = () => {
        const steps = [
            { number: 1, name: 'Define', label: 'Define Your Research Question', description: 'Set up your research concepts' },
            { number: 2, name: 'Query', label: 'Build & Run Your Search', description: 'Create and execute queries' },
            { number: 3, name: 'Results', label: 'Review & Export Results', description: 'Review and export findings' }
        ];

        // Determine if a step can be navigated to
        const canNavigateToStep = (stepNum) => {
            // Always allow backward navigation
            if (stepNum < step) return true;

            // Always can go to step 1
            if (stepNum === 1) return true;

            // Can go to step 2 if concepts exist with keywords (forward navigation)
            if (stepNum === 2) {
                return concepts && concepts.length > 0 && concepts.some(concept => concept.keywords && concept.keywords.length > 0);
            }

            // Can go to step 3 if we have search results (forward navigation)
            if (stepNum === 3) {
                return initialArticles && initialArticles.length > 0;
            }

            return false;
        };

        return (
            <nav aria-label="Progress" className="mb-8">
                <ol role="list" className="flex items-center justify-between">
                    {steps.map((stepInfo, index) => {
                        const s = stepInfo.number;
                        const isCompleted = step > s;
                        const isCurrent = step === s;
                        const isUpcoming = step < s;
                        const canNavigate = canNavigateToStep(s);

                        return (
                            <li
                                key={stepInfo.name}
                                className={cn(
                                    "relative flex-1",
                                    index !== steps.length - 1 ? "pr-4" : ""
                                )}
                            >
                                <div className="flex flex-col items-center">
                                    {/* Connector Line */}
                                    {index !== steps.length - 1 && (
                                        <div className="absolute top-5 left-[60%] right-0 h-0.5 z-0">
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-500",
                                                    isCompleted ? "bg-main" : "bg-gray-200"
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Step Circle */}
                                    <div className="relative z-10">
                                        {isCompleted ? (
                                            <button
                                                onClick={() => canNavigate && setStep(s)}
                                                disabled={!canNavigate}
                                                className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                                                    canNavigate
                                                        ? "bg-main border-main hover:bg-main-dark hover:scale-110 cursor-pointer shadow-md"
                                                        : "bg-gray-300 border-gray-300 cursor-not-allowed"
                                                )}
                                                title={`Go to ${stepInfo.label}`}
                                            >
                                                <CheckIcon className="h-6 w-6 text-white" />
                                            </button>
                                        ) : isCurrent ? (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-main bg-white shadow-lg ring-4 ring-main ring-opacity-20">
                                                <span className="h-3 w-3 rounded-full bg-main" />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => canNavigate && setStep(s)}
                                                disabled={!canNavigate}
                                                className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                                                    canNavigate
                                                        ? "border-gray-300 bg-white hover:border-main hover:bg-main hover:bg-opacity-10 hover:scale-110 cursor-pointer"
                                                        : "border-gray-200 bg-gray-50 cursor-not-allowed"
                                                )}
                                                title={canNavigate ? `Go to ${stepInfo.label}` : 'Complete previous steps first'}
                                            >
                                                <span className="h-3 w-3 rounded-full bg-transparent" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Step Label */}
                                    <div className="mt-3 text-center max-w-[140px]">
                                        <div
                                            className={cn(
                                                "text-xs font-semibold transition-colors duration-300",
                                                isCurrent ? "text-main" : isCompleted ? "text-gray-700" : "text-gray-400"
                                            )}
                                        >
                                            Step {s}
                                        </div>
                                        <div
                                            className={cn(
                                                "text-xs mt-1 transition-colors duration-300 leading-tight",
                                                isCurrent ? "text-gray-900 font-medium" : "text-gray-500"
                                            )}
                                        >
                                            {stepInfo.name}
                                        </div>
                                        {isCurrent && (
                                            <div className="text-[10px] mt-1 text-gray-500 leading-tight">
                                                {stepInfo.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </nav>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <ContextMenuComponent />
            <ThesaurusModal
                thesaurusState={thesaurusData}
                onClose={() => setThesaurusData({ isOpen: false, word: '', synonyms: [], loading: false, context: null })}
                onAddSynonym={handleAddSynonym}
            />
            <QueryRefinementModal
                modalData={refineModalData}
                onClose={() => setRefineModalData(null)}
                onApplyChanges={(updatedKeywords) => {
                    setRefineModalData(null);
                }}
            />
            {selectedArticle && <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
            {isExportModalOpen && <ExportModal onClose={() => setIsExportModalOpen(false)} allArticles={initialArticles} hasDeduplicated={!!deduplicationResult} onExport={exportHandler} />}


            <Header
                subtitle={project.name}
                onBackButtonClicked={onBackToDashboard}
                backButtonText={isGuestProject ? "Back to Dashboard" : "Dashboard"}
                showDownloadButton={true}
                onLogoClick={onBackToDashboard}
                onLogin={isGuestProject ? onLogin : null}
            />


            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="rounded-lg border bg-white p-6 md:p-10 shadow-lg">
                        <div className="mb-8">{renderStepIndicator()}</div>
                        <div className="relative min-h-[400px] overflow-hidden">
                            <div
                                key={step}
                                style={{
                                    animation: 'fadeInSlide 0.4s ease-in-out'
                                }}
                            >
                                {step === 1 && (
                                    <DefineStep
                                        state={{ researchQuestion, concepts, conceptAssist, answeringFollowUpId, isLoading, negativeKeywords, keywordGenerationStyles, keywordStyle, conceptsGenerated, keywordsGenerated, conceptsGenerationCount, keywordsGenerationCount, capabilities }}
                                        actions={{ setResearchQuestion, setConcepts, setConceptAssist, setNegativeKeywords, setKeywordStyle, handleGenerateKeywords, handleAnalyzeQuestion, handleAnswerFollowUp, setStep, showMenu, findSynonyms, onBackToDashboard }}
                                    />
                                )}
                                {step === 2 && (
                                    <QueryBuilder
                                        state={{ queries, searchCounts, isSearching, selectedDBs, concepts, enabledControlledVocabTypes, capabilities, isGuestProject }}
                                        actions={{ setStep, handleRunSearch, handleDbSelectionChange, setRefineModalData: (data) => setRefineModalData({ ...data, projectId: project.id }), setEnabledControlledVocabTypes, onRequireLogin, onRequireSignup }}                                    />
                                )}
                                {step === 3 && (
                                    <ResultsViewer
                                        state={{ searchResults, initialArticles, deduplicationResult, pageSize: retmax, isSearching, searchTotals, capabilities, isGuestProject }}
                                        actions={{ setStep, setSelectedArticle, setIsExportModalOpen, setAllArticles: setInitialArticles, setDeduplicationResult, setPageSize: setRetmax, handleRunSearch, handleDeduplicate, handlePaginatedSearch, onRequireSignup }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectEditor;
