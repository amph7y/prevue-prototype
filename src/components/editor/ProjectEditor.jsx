import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Config & Utils
import { db } from '../../config/firebase.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { useContextMenu } from '../../hooks/useContextMenu.jsx';
import { copyToClipboard } from '../../utils/clipboard.js';
import { cn } from '../../utils/cn.js';
import { CONCEPT_COLORS } from '../../config/constants.js';

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
import { HomeIcon, ClockIcon, CheckIcon } from '../common/Icons.jsx';

// Main Editor Component
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
    
    // UI & Loading State
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    // Database & API Key State
    const [selectedDBs, setSelectedDBs] = useState({ pubmed: true, scopus: true, embase: false, semanticScholar: false, core: false, googleScholar: true });
    const [searchFieldOptions, setSearchFieldOptions] = useState(Object.keys(DB_CONFIG).reduce((acc, key) => ({ ...acc, [key]: Object.keys(DB_CONFIG[key].searchFields)[0] }), {}));

    // Custom Hooks & Refs
    const { showMenu, ContextMenuComponent } = useContextMenu();
    const debounceTimeout = useRef(null);

    // --- DATA LOADING & SAVING ---
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

    // --- AI KEYWORD GENERATION ---
    const handleGenerateKeywords = async (picoData = pico) => {
        setIsLoading(true);
        const hasInput = Object.values(picoData).some(arr => arr.some(item => item.trim() !== ''));
        if (!hasInput) {
            toast.error('Please fill in at least one PICO field.');
            setIsLoading(false);
            return;
        }

        const prompt = `For the given PICO framework, generate relevant keywords and controlled vocabulary terms (like MeSH). PICO: ${JSON.stringify(picoData)}. Return ONLY a JSON object with keys "population", "intervention", "comparison", "outcome". Each key should have a value of an object with two keys: "keywords" (an array of 5-7 strings) and "controlled_vocabulary" (an array of 2-3 objects with "term" and "type" keys, e.g., {"term": "Diabetes Mellitus", "type": "MeSH"}).`;

        try {
            const result = await callGeminiAPI(prompt);
            const formattedKeywords = {};
            for (const category of ['population', 'intervention', 'comparison', 'outcome']) {
                formattedKeywords[category] = {
                    keywords: result[category]?.keywords.map(term => ({ term, active: true, source: 'ai' })) || [],
                    controlled_vocabulary: result[category]?.controlled_vocabulary.map(item => ({ ...item, active: true, source: 'ai' })) || [],
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

    // --- TEST PARAMETERS ---
    const handleTestParameters = () => {
        const testPico = {
            p: ["adults", "hypertension"],
            i: ["telemedicine"],
            c: ["usual care"],
            o: ["blood pressure control"]
        };
        const testRQ = "In adults with hypertension, is telemedicine effective compared to usual care for blood pressure control?";
        
        setPico(testPico);
        setResearchQuestion(testRQ);
        toast("Test parameters loaded!");
        handleGenerateKeywords(testPico); // Pass testPico directly
    };

    // --- QUERY GENERATION ---
    useEffect(() => {
        if (!keywords) return;
        const newQueries = {};
        for (const dbKey in DB_CONFIG) {
            if (selectedDBs[dbKey]) {
                const { syntax } = DB_CONFIG[dbKey];
                const parts = ['p', 'i', 'c', 'o'].map(catKey => {
                    const picoToKeywordMap = { p: 'population', i: 'intervention', c: 'comparison', o: 'outcome' };
                    const keywordCategory = keywords[picoToKeywordMap[catKey]];
                    if (!keywordCategory) return null;

                    const activeTerms = [
                        ...keywordCategory.keywords.filter(k => k.active).map(k => syntax.phrase(k.term, searchFieldOptions[dbKey])),
                        ...keywordCategory.controlled_vocabulary.filter(v => v.active).map(v => syntax[v.type.toLowerCase()] ? syntax[v.type.toLowerCase()](v.term) : syntax.phrase(v.term, searchFieldOptions[dbKey]))
                    ];
                    
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
                newQueries[dbKey] = finalQuery;
            }
        }
        setQueries(newQueries);
    }, [keywords, selectedDBs, negativeKeywords, searchFieldOptions]);

    // --- LIVE SEARCH & COUNTING ---
    const handleGetCounts = async () => {
        setSearchCounts(prev => ({...prev, loading: true}));
        const counts = {};
        for (const dbKey in queries) {
            try {
                if (queries[dbKey]) {
                    if (dbKey === 'pubmed') counts[dbKey] = await getPubmedCount(queries[dbKey]);
                    else if (dbKey === 'scopus' || dbKey === 'embase') counts[dbKey] = await getElsevierCount(dbKey, queries[dbKey]);
                    else counts[dbKey] = 'N/A';
                }
            } catch (err) {
                counts[dbKey] = 'Error';
                toast.error(`Failed to get count for ${dbKey}: ${err.message}`);
            }
        }
        setSearchCounts({ ...counts, loading: false});
    };
    
    useEffect(() => {
        if (Object.keys(queries).length > 0) {
            handleGetCounts();
        }
    }, [queries]);

    const handleRunSearch = async () => {
        setIsSearching(true);
        setAllArticles([]);
        setSearchResults(null);
        let results = {};
        let allFetchedArticles = [];

        for (const dbKey in queries) {
            if (!selectedDBs[dbKey] || !queries[dbKey]) continue;
            try {
                let articles = [];
                if (dbKey === 'pubmed') articles = await searchPubmed(queries[dbKey], 25);
                else if (dbKey === 'scopus' || dbKey === 'embase') articles = await searchElsevier(dbKey, queries[dbKey], 25);
                else if (dbKey === 'googleScholar') {
                    results[dbKey] = { status: 'redirect', query: queries[dbKey]};
                    continue;
                }
                results[dbKey] = { status: 'success', data: articles };
                allFetchedArticles.push(...articles);
            } catch (err) {
                results[dbKey] = { status: 'error', message: err.message };
                toast.error(`Search failed for ${dbKey}: ${err.message}`);
            }
        }
        setSearchResults(results);
        setAllArticles(allFetchedArticles);
        setIsSearching(false);
        setStep(4);
    };

    const renderStepIndicator = () => (
        <nav aria-label="Progress"><ol role="list" className="flex items-center">
            {['Define', 'Keywords', 'Query', 'Results'].map((name, index) => {
                const s = index + 1;
                const canNavigate = keywords ? true : false;
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
            {selectedArticle && <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
            {isExportModalOpen && <ExportModal onClose={() => setIsExportModalOpen(false)} allArticles={allArticles} hasDeduplicated={!!deduplicationResult} irrelevantArticles={irrelevantArticles} onExport={() => {}} />}
            
            <header className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">PreVue | <span className="text-indigo-600">{project.name}</span></h1>
                    <div className="flex items-center gap-x-4">
                        <button onClick={onBackToDashboard} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><HomeIcon className="h-5 w-5 text-gray-400" />Dashboard</button>
                    </div>
                </div>
            </header>
            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="rounded-lg border bg-white p-6 md:p-10 shadow-lg">
                        <div className="mb-8">{renderStepIndicator()}</div>
                        {step === 1 && <PicoBuilder state={{ researchQuestion, pico, isLoading }} actions={{ setResearchQuestion, setPico, handleGenerateKeywords, handleTestParameters }} />}
                        {step === 2 && <KeywordViewer state={{ keywords, pico }} actions={{ setKeywords, setStep, showMenu }} />}
                        {step === 3 && <QueryBuilder state={{ queries, searchCounts, isSearching, selectedDBs, negativeKeywords, searchFieldOptions }} actions={{ setStep, handleRunSearch, setNegativeKeywords, setSelectedDBs, setSearchFieldOptions }} />}
                        {step === 4 && <ResultsViewer state={{ searchResults, allArticles, deduplicationResult, irrelevantArticles }} actions={{ setStep, setSelectedArticle, setIsExportModalOpen, setAllArticles, setDeduplicationResult, setIrrelevantArticles }} />}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectEditor;