import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

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
import PicoBuilder from './PicoBuilder.jsx';
import QueryBuilder from './QueryBuilder.jsx';
import ResultsViewer from './ResultsViewer.jsx';
import ArticleDetailModal from '../common/ArticleDetailModal.jsx';
import ExportModal from '../common/ExportModal.jsx';

import PicoSuggestionsModal from './PicoSuggestionsModal.jsx';
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

function ProjectEditor({ project, onBackToDashboard, userId }) {
    const { userAccessLevel } = useAuth();
    const capabilities = getCapabilities(userAccessLevel);
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
    
    // Track generation state for restrictions
    const [conceptsGenerated, setConceptsGenerated] = useState(false);
    const [keywordsGenerated, setKeywordsGenerated] = useState(false);

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
    const [picoSuggestions, setPicoSuggestions] = useState({ isOpen: false, category: null, suggestions: [], loading: false });
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
        const docRef = doc(db, `users/${userId}/projects/${project.id}`);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setResearchQuestion(data.researchQuestion || '');

                let loadedConcepts = data.concepts || [];
                setConcepts(loadedConcepts);
                setNegativeKeywords(data.negativeKeywords || ['']);
                setKeywordStyle(data.keywordStyle || 'balanced');
                
                // Load generation state
                setConceptsGenerated(data.conceptsGenerated || false);
                setKeywordsGenerated(data.keywordsGenerated || false);
            }
        });
    }, [project.id, userId]);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            const docRef = doc(db, `users/${userId}/projects/${project.id}`);
            const dataToSave = { 
                researchQuestion, 
                concepts, 
                negativeKeywords, 
                keywordStyle, 
                conceptsGenerated,
                keywordsGenerated,
                lastSaved: serverTimestamp() 
            };
            setDoc(docRef, dataToSave, { merge: true });
        }, 1000);
        return () => clearTimeout(debounceTimeout.current);
    }, [researchQuestion, concepts, negativeKeywords, keywordStyle, conceptsGenerated, keywordsGenerated, project.id, userId]);

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

    const handleGeneratePicoFromQuestion = async () => {
        if (!researchQuestion.trim()) return toast.error('Please enter a research question first.');
        
        // Check if concepts have already been generated for this project
        if (conceptsGenerated && capabilities.canGenerateConceptsOncePerProject) {
            return toast.error('Concepts can only be generated once per project. Please edit existing concepts or create a new project.');
        }
        
        setIsLoading(true);
        
        const prompt = `
        You are an expert in information retrieval and research database searching.
        
        Analyze the following research question and break it into its core search concepts 
        (for example: Population, Intervention, Comparison, Outcome, or other relevant concepts).

        For each concept, provide up to 3 relevant search terms. Make sure the terms are different enough to provide wider search value.

        Example:

        Research Question: "What is the effectiveness of mindfulness on anxiety in healthcare professionals?"

        Concepts:
        - Population: "healthcare professionals"
        - Intervention: "mindfulness"
        - Outcome: "anxiety"
        - Comparison: "usual care"
                
        Return ONLY valid JSON in the following format:
        {
          "concepts": [
            { "name": "Concept Name", "terms": ["term1", "term2", "term3"] },
            ...
          ]
        }
        
        Research Question: "${researchQuestion}"
        `;
                
        try {
            const result = await callGeminiAPI(prompt);
            console.log(result);
            const generatedConcepts = [];
            
            if (result.concepts && Array.isArray(result.concepts)) {
                result.concepts.forEach((concept, index) => {
                    if (concept.name && concept.terms && Array.isArray(concept.terms)) {
                        // Determine concept type based on name or create custom type
                        let conceptType = 'custom';
                        const nameLower = concept.name.toLowerCase();
                        
                        if (nameLower.includes('population')) {
                            conceptType = 'population';
                        } else if (nameLower.includes('intervention')) {
                            conceptType = 'intervention';
                        } else if (nameLower.includes('comparison')) {
                            conceptType = 'comparison';
                        } else if (nameLower.includes('outcome')) {
                            conceptType = 'outcome';
                        }
                        
                        // Create concept with initial synonyms from the terms
                        const [mainTerm, ...synonymTerms] = concept.terms;
                        
                        generatedConcepts.push({
                            id: `concept_${Date.now()}_${index}`,
                            name: mainTerm || concept.name,
                            type: conceptType,
                            synonyms: synonymTerms.filter(term => term.trim() !== ''),
                            keywords: [],
                            controlled_vocabulary: []
                        });
                    }
                });
            }
                        
            setConcepts(generatedConcepts);
            setConceptsGenerated(true);
            
            // Log concept generation
            await logger.logFeatureUsed(userId, 'concept_generation', {
                projectId: project.id,
                projectName: project.name,
                conceptsCount: generatedConcepts.length,
                researchQuestion: researchQuestion.substring(0, 100)
            });
                        
            toast.success("Concepts generated from your research question!");
        } catch (err) {
            handleError(err, 'concept generation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestPicoTerms = async (category) => {
        const picoLabels = { p: 'Population', i: 'Intervention', c: 'Comparison', o: 'Outcome' };
        const contextPico = { ...pico };
        delete contextPico[category];
        const contextText = Object.entries(contextPico).map(([key, value]) => Array.isArray(value) && value.join(' ').trim() ? `${picoLabels[key]}: ${value.join('; ')}` : null).filter(Boolean).join('\n');
        if (contextText.trim() === '') return toast.error('Please fill in at least one other PICO field for context.');
        
        setPicoSuggestions({ isOpen: true, category, suggestions: [], loading: true });
        const prompt = `Given the PICO context for a systematic review:\n${contextText}\n\nSuggest 5-7 specific terms or short phrases for the "${picoLabels[category]}" component. Return ONLY a raw JSON array of strings.`;
        try {
            const suggestions = await callGeminiAPI(prompt);
            setPicoSuggestions(prev => ({ ...prev, suggestions: Array.isArray(suggestions) ? suggestions : [], loading: false }));
        } catch (err) {
            handleError(err, 'PICO suggestions');
            setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false });
        }
    };

    const handleAddSuggestionToPico = (suggestion, category) => {
        setPico(prev => {
            const newCategoryValues = [...prev[category]];
            const lastIndex = newCategoryValues.length - 1;
            if (lastIndex >= 0 && newCategoryValues[lastIndex].trim() === '') {
                newCategoryValues[lastIndex] = suggestion;
            } else {
                newCategoryValues.push(suggestion);
            }
            return { ...prev, [category]: newCategoryValues };
        });
        setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false });
    };

    const handleGenerateKeywords = async (conceptsData = concepts, keywordStyle = 'balanced') => {
        if (!conceptsData || !Array.isArray(conceptsData) || conceptsData.length === 0) {
            return toast.error('No concepts defined. Please generate PICO concepts first.');
        }
        
        // Check if keywords have already been generated for this project
        if (keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject) {
            return toast.error('Keywords can only be generated once per project. Please edit existing keywords or create a new project.');
        }
        
        setIsLoading(true);
        try {
            
            const conceptDescriptions = conceptsData.map(concept => {
                const synonyms = concept.synonyms.filter(syn => syn.trim() !== '').join('; ');
                const synonymText = synonyms ? ` (Synonyms: ${synonyms})` : '';
                return `${concept.name}${synonymText}`;
            });
            
            if (conceptDescriptions.length === 0) {
                return toast.error('No valid concepts found. Please add some concepts first.');
            }
            
            let vocabInstructions = 'For the "controlled_vocabulary" array: ';
            if (selectedDBs.pubmed) {
                vocabInstructions += 'Generate 2-3 relevant MeSH terms, where each is an object like {"term": "Term Name", "type": "MeSH"}. ';
            }
            if (selectedDBs.embase) {
                vocabInstructions += 'Generate 2-3 relevant Emtree terms, where each is an object like {"term": "Term Name", "type": "Emtree"}. ';
            }
            if (!selectedDBs.pubmed && !selectedDBs.embase) {
                vocabInstructions = 'The "controlled_vocabulary" array must be empty.';
            }
            
            const prompt = `For each concept provided: ${conceptDescriptions.join('; ')}, generate search terms based on the concept name and its synonyms. ${keywordGenerationStyles[keywordStyle].aiPrompt || keywordGenerationStyles.balanced.aiPrompt} ${vocabInstructions} 

IMPORTANT: Return ONLY a single, valid JSON object where each key is the EXACT concept name as provided. For example, if you have a concept called "Healthcare Professionals", the key should be "Healthcare Professionals", not "healthcare_professionals" or "healthcareprofessionals".

Each concept should have this structure:
{
  "keywords": ["term1", "term2", "term3"],
  "controlled_vocabulary": [{"term": "Term Name", "type": "MeSH"}]
}

Return ONLY the JSON object with no additional text.`;
            
            const result = await callGeminiAPI(prompt);
            
            const updatedConcepts = conceptsData.map(concept => {
                let conceptData = result[concept.name];
                let keywords = [];
                let controlled_vocabulary = [];
                
                if (Array.isArray(conceptData)) {
                    keywords = conceptData;
                } else if (conceptData && typeof conceptData === 'object') {
                    keywords = Array.isArray(conceptData.keywords) ? conceptData.keywords : [];
                    controlled_vocabulary = Array.isArray(conceptData.controlled_vocabulary) ? conceptData.controlled_vocabulary : [];
                }
                
                const updatedConcept = {
                    ...concept,
                    keywords: keywords.map(term => ({
                        term,
                        active: true,
                        source: 'ai',
                        searchField: 4
                    })),
                    controlled_vocabulary: controlled_vocabulary.map(item => ({
                        ...item,
                        active: true,
                        source: 'ai'
                    }))
                };
                
                return updatedConcept;
            });
            
            setConcepts(updatedConcepts);
            setKeywordsGenerated(true);
            
            // Log keyword generation
            await logger.logFeatureUsed(userId, 'keyword_generation', {
                projectId: project.id,
                projectName: project.name,
                keywordStyle,
                conceptsCount: conceptsData.length,
                totalKeywords: updatedConcepts.reduce((sum, concept) => sum + concept.keywords.length, 0)
            });
                        
            toast.success(`Keywords generated with ${keywordStyle} style!`);
            
        } catch (err) {
            handleError(err, 'keyword generation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestParameters = () => {
        const testConcepts = [
            {
                id: "pico_p_test",
                name: "adults with hypertension",
                type: "population",
                synonyms: ["adults", "hypertension"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_i_test",
                name: "telemedicine",
                type: "intervention",
                synonyms: ["telemedicine"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_c_test",
                name: "usual care",
                type: "comparison",
                synonyms: ["usual care"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_o_test",
                name: "blood pressure control",
                type: "outcome",
                synonyms: ["blood pressure control"],
                keywords: [],
                controlled_vocabulary: []
            }
        ];
        const testRQ = "In adults with hypertension, is telemedicine effective compared to usual care for blood pressure control?";
        setConcepts(testConcepts);
        setResearchQuestion(testRQ);
        toast("Test parameters loaded!");
    };
    
    const generateSingleQuery = (dbKey, enabledTypes = {}) => {
        if (!concepts || concepts.length === 0) return '';
        const { syntax } = DB_CONFIG[dbKey];
    
        // Special handling for Semantic Scholar: keep it short and natural-language-like
        if (dbKey === 'semanticScholar') {
            // Prefer concept names; fallback to first active keyword per concept
            const phrases = [];
            concepts.forEach(concept => {
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
        
        concepts.forEach(concept => {
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
                    ...concept.controlled_vocabulary.filter(v => v.active && syntax[v.type.toLowerCase()]).map(v => syntax[v.type.toLowerCase()](v.term) )
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
        await logger.logSearchPerform(
            userId,
            currentQueries, // full queries by DB
            totals,         // per-DB counts
            keys.join(',')  // search type: comma-separated DBs
        );
    
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

    const renderStepIndicator = () => (
        <nav aria-label="Progress"><ol role="list" className="flex items-center">
            {['Define', 'Query', 'Results'].map((name, index) => {
                const s = index + 1;
                const canNavigate = concepts && concepts.length > 0 && concepts.some(concept => concept.keywords && concept.keywords.length > 0);
                return (<li key={name} className={cn("relative", index !== 2 ? "pr-8 sm:pr-20" : "")}> 
                    {step > s ? (<><div className="absolute inset-0 flex items-center"><div className="h-0.5 w-full bg-main" /></div><button disabled={!canNavigate} onClick={() => setStep(s)} className="relative flex h-8 w-8 items-center justify-center rounded-full bg-main hover:bg-main-dark disabled:bg-gray-400"><CheckIcon className="h-5 w-5 text-white" /></button></>) 
                    : step === s ? (<><div className="absolute inset-0 flex items-center"><div className="h-0.5 w-full bg-gray-200" /></div><span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-main bg-white"><span className="h-2.5 w-2.5 rounded-full bg-main" /></span></>) 
                    : (<><div className="absolute inset-0 flex items-center"><div className="h-0.5 w-full bg-gray-200" /></div><span className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white"><span className="h-2.5 w-2.5 rounded-full bg-transparent" /></span></>)}
                </li>);
            })}
        </ol></nav>
    );

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <ContextMenuComponent />
            <ThesaurusModal 
                thesaurusState={thesaurusData}
                onClose={() => setThesaurusData({ isOpen: false, word: '', synonyms: [], loading: false, context: null })}
                onAddSynonym={handleAddSynonym}
            />
            <PicoSuggestionsModal 
                suggestionsState={picoSuggestions}
                onClose={() => setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false })}
                onAddSuggestion={handleAddSuggestionToPico}
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
                backButtonText="Dashboard"
                showDownloadButton={true}
                onLogoClick={onBackToDashboard}
            />
            

            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="rounded-lg border bg-white p-6 md:p-10 shadow-lg">
                        <div className="mb-8">{renderStepIndicator()}</div>
                        {step === 1 && (
                            <DefineStep
                                state={{ researchQuestion, concepts, isLoading, negativeKeywords, keywordGenerationStyles, keywordStyle, conceptsGenerated, keywordsGenerated, capabilities }}
                                actions={{ setResearchQuestion, setConcepts, setNegativeKeywords, setKeywordStyle, handleGenerateKeywords, handleGeneratePicoFromQuestion, setStep, showMenu, findSynonyms, onBackToDashboard }}
                            />
                        )}
                        {step === 2 && (
                            <QueryBuilder
                                state={{ queries, searchCounts, isSearching, selectedDBs, concepts, enabledControlledVocabTypes }}
                                actions={{ setStep, handleRunSearch, handleDbSelectionChange, setRefineModalData, setEnabledControlledVocabTypes }}
                            />
                        )}
                        {step === 3 && (
                            <ResultsViewer
                                state={{ searchResults, initialArticles, deduplicationResult, pageSize: retmax, isSearching, searchTotals }}
                                actions={{ setStep, setSelectedArticle, setIsExportModalOpen, setAllArticles: setInitialArticles, setDeduplicationResult, setPageSize: setRetmax, handleRunSearch, handleDeduplicate, handlePaginatedSearch }}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectEditor;