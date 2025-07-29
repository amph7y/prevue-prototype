import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Config & Utils
import { db } from '../../config/firebase.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { useContextMenu } from '../../hooks/useContextMenu.jsx';
import { cn } from '../../utils/cn.js';

// API Calls
import { callGeminiAPI } from '../../api/geminiApi.js';
import { getPubmedCount, searchPubmed } from '../../api/pubmedApi.js';
import { getElsevierCount, searchElsevier } from '../../api/elsevierApi.js';

// Child Components & Modals
import PicoBuilder from './PicoBuilder.jsx';
import KeywordViewer from './KeywordViewer.jsx';
import QueryBuilder from './QueryBuilder.jsx';
import ResultsViewer from './ResultsViewer.jsx';
import ArticleDetailModal from '../common/ArticleDetailModal.jsx';
import ExportModal from '../common/ExportModal.jsx';
import PicoSuggestionsModal from './PicoSuggestionsModal.jsx';
import ThesaurusModal from './ThesaurusModal.jsx';
import QueryRefinementModal from './QueryRefinementModal.jsx';
import { HomeIcon, CheckIcon } from '../common/Icons.jsx';

function ProjectEditor({ project, onBackToDashboard, userId }) {
    // Main State
    const [step, setStep] = useState(project.initialStep || 1);
    const [pico, setPico] = useState({ p: [''], i: [''], c: [''], o: [''] });
    const [researchQuestion, setResearchQuestion] = useState('');
    const [keywords, setKeywords] = useState(null);
    const [negativeKeywords, setNegativeKeywords] = useState(['']);
    const [queries, setQueries] = useState({});
    const [searchCounts, setSearchCounts] = useState({});
    const [searchResults, setSearchResults] = useState(null);
    const [allArticles, setAllArticles] = useState([]);
    const [deduplicationResult, setDeduplicationResult] = useState(null);
    const [irrelevantArticles, setIrrelevantArticles] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedDBs, setSelectedDBs] = useState({ pubmed: true, scopus: true, embase: false });
    const [searchFieldOptions, setSearchFieldOptions] = useState(Object.keys(DB_CONFIG).reduce((acc, key) => ({ ...acc, [key]: Object.keys(DB_CONFIG[key].searchFields)[0] }), {}));
    const [retmax, setRetmax] = useState(25);
    
    // State for Modals
    const [picoSuggestions, setPicoSuggestions] = useState({ isOpen: false, category: null, suggestions: [], loading: false });
    const [thesaurusData, setThesaurusData] = useState({ isOpen: false, word: '', synonyms: [], loading: false, context: null });
    const [refineModalData, setRefineModalData] = useState(null);

    const { showMenu, ContextMenuComponent } = useContextMenu();
    const debounceTimeout = useRef(null);

    useEffect(() => {
        const docRef = doc(db, `users/${userId}/projects/${project.id}`);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setResearchQuestion(data.researchQuestion || '');
                const loadedPico = data.pico || {};
                const safePico = {
                    p: Array.isArray(loadedPico.p) && loadedPico.p.length > 0 ? loadedPico.p.map(String) : [''],
                    i: Array.isArray(loadedPico.i) && loadedPico.i.length > 0 ? loadedPico.i.map(String) : [''],
                    c: Array.isArray(loadedPico.c) && loadedPico.c.length > 0 ? loadedPico.c.map(String) : [''],
                    o: Array.isArray(loadedPico.o) && loadedPico.o.length > 0 ? loadedPico.o.map(String) : [''],
                };
                setPico(safePico);
                setKeywords(data.keywords || null);
                setNegativeKeywords(data.negativeKeywords || ['']);
            }
        });
    }, [project.id, userId]);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            const docRef = doc(db, `users/${userId}/projects/${project.id}`);
            setDoc(docRef, { researchQuestion, pico, keywords, negativeKeywords, lastSaved: serverTimestamp() }, { merge: true });
        }, 2000);
        return () => clearTimeout(debounceTimeout.current);
    }, [researchQuestion, pico, keywords, negativeKeywords, project.id, userId]);

    const handleAddKeyword = (newTerm, category, type, source) => {
        if (!newTerm || !keywords || !category || !type) return;
        setKeywords(prev => {
            const updatedKeywords = JSON.parse(JSON.stringify(prev));
            const targetArray = updatedKeywords[category][type];
            if (targetArray.some(item => item.term.toLowerCase() === newTerm.toLowerCase())) {
                toast.error(`'${newTerm}' already exists.`);
                return prev;
            }
            targetArray.push({ term: newTerm, active: true, source });
            toast.success(`Added '${newTerm}'`);
            return updatedKeywords;
        });
    };

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
        setIsLoading(true);
        const prompt = `Analyze this research question: "${researchQuestion}". Extract the PICO components (Population, Intervention, Comparison, Outcome). For each component, provide a single, concise phrase. Return ONLY a JSON object with keys "p", "i", "c", "o", where each value is an array with one string. If a component is missing, return an empty array.`;
        try {
            const result = await callGeminiAPI(prompt);
            setPico({
                p: result.p && result.p.length > 0 ? result.p : [''],
                i: result.i && result.i.length > 0 ? result.i : [''],
                c: result.c && result.c.length > 0 ? result.c : [''],
                o: result.o && result.o.length > 0 ? result.o : [''],
            });
            toast.success("PICO generated from your question!");
        } catch (err) {
            toast.error(`Failed to generate PICO: ${err.message}`);
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
            toast.error(`Failed to get suggestions: ${err.message}`);
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

    const handleGenerateKeywords = async (picoData = pico) => {
        setIsLoading(true);
        const hasInput = Object.values(picoData).some(arr => arr.some(item => item.trim() !== ''));
        if (!hasInput) {
            toast.error('Please fill in at least one PICO field.');
            setIsLoading(false);
            return;
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
        const prompt = `For each PICO category provided in ${JSON.stringify(picoData)}, generate search terms. For "keywords", provide a JSON array of 5-7 synonym strings. ${vocabInstructions} Return ONLY a single, valid JSON object with keys "population", "intervention", "comparison", "outcome".`;
        try {
            const result = await callGeminiAPI(prompt);
            const formattedKeywords = {};
            for (const category of ['population', 'intervention', 'comparison', 'outcome']) {
                const keywordsArray = Array.isArray(result[category]?.keywords) ? result[category].keywords : [];
                const vocabArray = Array.isArray(result[category]?.controlled_vocabulary) ? result[category].controlled_vocabulary : [];
                formattedKeywords[category] = {
                    keywords: keywordsArray.map(term => ({ term, active: true, source: 'ai' })),
                    controlled_vocabulary: vocabArray.map(item => ({ ...item, active: true, source: 'ai' })),
                };
            }
            setKeywords(formattedKeywords);
            setStep(2);
            toast.success("Keywords generated successfully!");
        } catch (err) {
            toast.error(`Keyword generation failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestParameters = () => {
        const testPico = { p: ["adults", "hypertension"], i: ["telemedicine"], c: ["usual care"], o: ["blood pressure control"] };
        const testRQ = "In adults with hypertension, is telemedicine effective compared to usual care for blood pressure control?";
        setPico(testPico);
        setResearchQuestion(testRQ);
        toast("Test parameters loaded!");
        handleGenerateKeywords(testPico);
    };
    
    const generateSingleQuery = (dbKey) => {
        if (!keywords) return '';
        const { syntax } = DB_CONFIG[dbKey];
        const picoToKeywordMap = { p: 'population', i: 'intervention', c: 'comparison', o: 'outcome' };
    
        const parts = ['p', 'i', 'c', 'o'].map(catKey => {
            const keywordCategory = keywords[picoToKeywordMap[catKey]];
            if (!keywordCategory) return null;
    
            let activeTerms = [];
    
            // OPTIMIZED LOGIC FOR PUBMED: Combine MeSH and Keywords with OR
            if (dbKey === 'pubmed') {
                const meshTerms = keywordCategory.controlled_vocabulary
                    .filter(v => v.active && v.type.toLowerCase() === 'mesh')
                    .map(v => syntax.mesh(v.term));
    
                const keywordTerms = keywordCategory.keywords
                    .filter(k => k.active)
                    .map(k => syntax.phrase(k.term, searchFieldOptions[dbKey]));
    
                activeTerms = [...meshTerms, ...keywordTerms];
    
            } else {
            // ADVANCED LOGIC FOR ALL OTHER DATABASES
                activeTerms = [
                    ...keywordCategory.keywords.filter(k => k.active).map(k => syntax.phrase(k.term, searchFieldOptions[dbKey])),
                    ...keywordCategory.controlled_vocabulary.filter(v => v.active).map(v => syntax[v.type.toLowerCase()] ? syntax[v.type.toLowerCase()](v.term) : syntax.phrase(v.term, searchFieldOptions[dbKey]))
                ];
            }
    
            return activeTerms.length > 0 ? `(${activeTerms.join(' OR ')})` : null;
        }).filter(Boolean);
    
        let finalQuery = parts.join(` ${syntax.separator} `);
    
        const activeNegative = negativeKeywords.filter(k => k.trim() !== '');
        if (activeNegative.length > 0) {
            const negativePart = activeNegative.map(k => `"${k}"`).join(' OR ');
            if (finalQuery) {
               finalQuery += ` ${syntax.not} (${negativePart})`;
            }
        }
        return finalQuery.trim();
    };

    const fetchAndSetCount = async (dbKey) => {
        const query = generateSingleQuery(dbKey);
        setQueries(prev => ({ ...prev, [dbKey]: query }));
        setSearchCounts(prev => ({ ...prev, [dbKey]: { ...prev[dbKey], loading: true } }));
        if (!query) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 0, loading: false } }));
            return;
        }
        try {
            let count = 'N/A';
            if (dbKey === 'pubmed') count = await getPubmedCount(query);
            else if (dbKey === 'scopus' || dbKey === 'embase') count = await getElsevierCount(dbKey, query);
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: count, loading: false } }));
        } catch (err) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 'Error', loading: false } }));
            toast.error(`Failed to get count for ${dbKey}: ${err.message}`);
        }
    };
    
    const handleDbSelectionChange = (dbKey, isChecked) => {
        setSelectedDBs(prev => ({ ...prev, [dbKey]: isChecked }));
        if (isChecked && step === 3) {
            fetchAndSetCount(dbKey);
        }
    };
    
    const handleSearchFieldChange = (dbKey, newField) => {
        setSearchFieldOptions(prev => ({...prev, [dbKey]: newField }));
        setTimeout(() => fetchAndSetCount(dbKey), 0);
    };

    useEffect(() => {
        if (step === 3) {
            Object.keys(selectedDBs).forEach(dbKey => {
                if (selectedDBs[dbKey]) {
                    fetchAndSetCount(dbKey);
                }
            });
        }
    }, [step]);
    
    const handleRunSearch = async (isUpdate = false) => {
        console.log("1. Search function started.");
        setIsSearching(true);
        if (!isUpdate) {
            setDeduplicationResult(null);
            setIrrelevantArticles(new Set());
        }
    
        const currentQueries = {};
        Object.keys(selectedDBs).forEach(dbKey => {
            if (selectedDBs[dbKey]) {
                currentQueries[dbKey] = generateSingleQuery(dbKey);
            }
        });
        console.log("2. Queries generated:", currentQueries);
        setQueries(currentQueries);
        setAllArticles([]);
        setSearchResults(null);
        let results = {};
        let allFetchedArticles = [];
    
        for (const dbKey in currentQueries) {
            console.log(`3. Searching ${dbKey}...`);
            try {
                let articles = [];
                if (dbKey === 'pubmed') articles = await searchPubmed(currentQueries[dbKey], retmax);
                else if (dbKey === 'scopus' || dbKey === 'embase') articles = await searchElsevier(dbKey, currentQueries[dbKey], retmax);
    
                console.log(`4. Found ${articles.length} articles from ${dbKey}.`);
                results[dbKey] = { status: 'success', data: articles };
                allFetchedArticles.push(...articles);
            } catch (err) {
                console.error(`Error searching ${dbKey}:`, err);
                results[dbKey] = { status: 'error', message: err.message };
                toast.error(`Search failed for ${dbKey}: ${err.message}`);
            }
        }
        console.log("5. All searches complete. Final results:", results);
        setSearchResults(results);
        setAllArticles(allFetchedArticles);
        setIsSearching(false);
    
        if (!isUpdate) {
            console.log("6. Navigating to Step 4.");
            setStep(4);
        }
    };

    const handleDeduplicate = () => {
        if (allArticles.length === 0) return toast.error("No articles to deduplicate.");
        const seen = new Set();
        let duplicateCount = 0;
        const updatedArticles = allArticles.map(article => {
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
        setAllArticles(updatedArticles);
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

    const exportHandler = (format, options) => {
        let itemsToExport = [...allArticles];
        if (options.excludeIrrelevant) {
            itemsToExport = itemsToExport.filter(item => !irrelevantArticles.has(item.uniqueId));
        }
        if (!options.includeDuplicates && deduplicationResult) {
            itemsToExport = itemsToExport.filter(item => !item.isDuplicate);
        }
        if (itemsToExport.length === 0) return toast.error('No articles to export with selected options.');
        
        if (format === 'csv') {
            const headers = ['Title', 'Authors', 'Year', 'Journal/Venue', 'DOI', 'Abstract', 'Source'];
            const escapeCsvCell = (cell) => `"${(cell || '').replace(/"/g, '""')}"`;
            const rows = itemsToExport.map(item => [
                escapeCsvCell(item.title),
                escapeCsvCell(item.authors?.map(a => a.name).join('; ')),
                escapeCsvCell(item.year || item.pubdate),
                escapeCsvCell(item.venue || item.source),
                escapeCsvCell(item.doi || item.externalIds?.DOI),
                escapeCsvCell(item.abstract),
                escapeCsvCell(item.sourceDB)
            ].join(','));
            const csvContent = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${project.name}_export.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } else if (format === 'ris') {
            const risContent = itemsToExport.map(item => {
                let ris = `TY  - JOUR\n`;
                if(item.title) ris += `TI  - ${item.title}\n`;
                item.authors?.forEach(author => { ris += `AU  - ${author.name}\n`; });
                if(item.year || item.pubdate) ris += `PY  - ${item.year || item.pubdate}\n`;
                if(item.venue || item.source) ris += `JO  - ${item.venue || item.source}\n`;
                const doi = item.doi || item.externalIds?.DOI;
                if(doi) ris += `DO  - ${doi}\n`;
                if(item.abstract) ris += `AB  - ${item.abstract}\n`;
                ris += `ER  - \n`;
                return ris;
            }).join('');
            const blob = new Blob([risContent], { type: 'application/x-research-info-systems' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = `${project.name}_export.ris`;
            link.click();
            URL.revokeObjectURL(link.href);
        } else if (format === 'printable') {
            const reportWindow = window.open('', '_blank');
            reportWindow.document.write(`<html><head><title>Printable Report - ${project.name}</title><style>body{font-family:sans-serif;line-height:1.5;padding:20px}article{border-bottom:1px solid #eee;padding-bottom:1rem;margin-bottom:1rem}h3{font-size:1.2rem;margin-bottom:0.5rem}p{margin:0.25rem 0}.meta{font-size:0.9rem;color:#555}</style></head><body><h1>Results for: ${project.name}</h1>${itemsToExport.map((item, index) => `<article><h3>${index + 1}. ${item.title || 'No Title'}</h3><p class="meta"><strong>Authors:</strong> ${item.authors?.map(a => a.name).join(', ')}</p><p class="meta"><strong>Journal/Venue:</strong> ${item.venue || item.source || 'N/A'} (${item.year || item.pubdate || 'N/A'})</p><p class="meta"><strong>DOI:</strong> ${item.doi || item.externalIds?.DOI || 'N/A'}</p><p><strong>Abstract:</strong> ${item.abstract || 'No abstract available.'}</p></article>`).join('')}</body></html>`);
            reportWindow.document.close();
            reportWindow.focus();
        }
        toast.success(`Exported ${itemsToExport.length} articles.`);
    };

    const renderStepIndicator = () => (
        <nav aria-label="Progress"><ol role="list" className="flex items-center">
            {['Define', 'Keywords', 'Query', 'Results'].map((name, index) => {
                const s = index + 1;
                const canNavigate = !!keywords;
                return (<li key={name} className={cn("relative", index !== 3 ? "pr-8 sm:pr-20" : "")}>
                    {step > s ? (<><div className="absolute inset-0 flex items-center"><div className="h-0.5 w-full bg-indigo-600" /></div><button disabled={!canNavigate} onClick={() => setStep(s)} className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-900 disabled:bg-gray-400"><CheckIcon className="h-5 w-5 text-white" /></button></>) 
                    : step === s ? (<><div className="absolute inset-0 flex items-center"><div className="h-0.5 w-full bg-gray-200" /></div><span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /></span></>) 
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
                onApplyChanges={setKeywords}
            />
            {selectedArticle && <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
            {isExportModalOpen && <ExportModal onClose={() => setIsExportModalOpen(false)} allArticles={allArticles} hasDeduplicated={!!deduplicationResult} irrelevantArticles={irrelevantArticles} onExport={exportHandler} />}
            
            <header className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">PreVue | <span className="text-indigo-600">{project.name}</span></h1>
                    <div className="flex items-center gap-x-4"><button onClick={onBackToDashboard} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><HomeIcon className="h-5 w-5 text-gray-400" />Dashboard</button></div>
                </div>
            </header>
            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="rounded-lg border bg-white p-6 md:p-10 shadow-lg">
                        <div className="mb-8">{renderStepIndicator()}</div>
                        {step === 1 && <PicoBuilder state={{ researchQuestion, pico, isLoading }} actions={{ setResearchQuestion, setPico, handleGenerateKeywords, handleTestParameters, handleGeneratePicoFromQuestion, handleSuggestPicoTerms }} />}
                        {step === 2 && <KeywordViewer state={{ keywords, pico }} actions={{ setKeywords, setStep, showMenu, findSynonyms, handleAddKeyword }} />}
                        {step === 3 && <QueryBuilder state={{ queries, searchCounts, isSearching, selectedDBs, negativeKeywords, searchFieldOptions, keywords }} actions={{ setStep, handleRunSearch, setNegativeKeywords, handleDbSelectionChange, handleSearchFieldChange, setRefineModalData }} />}
                        {step === 4 && <ResultsViewer state={{ searchResults, allArticles, deduplicationResult, irrelevantArticles, retmax, isSearching }} actions={{ setStep, setSelectedArticle, setIsExportModalOpen, setAllArticles, setDeduplicationResult, toggleIrrelevant, setRetmax, handleRunSearch, handleDeduplicate }} />}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectEditor;