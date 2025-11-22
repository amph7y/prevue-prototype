import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { callGeminiAPI } from '../../api/geminiApi.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { getPubmedCount } from '../../api/pubmedApi.js';
import { getElsevierCount } from '../../api/elsevierApi.js';
import { XCircleIcon, SparklesIcon, ArrowPathIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import { cn } from '../../utils/cn.js';
import { getCoreCount } from '../../api/coreApi.js';
import { getSemanticScholarCount } from '../../api/semanticScholarApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';
import { loadHistoryFromFirestore, saveSnapshotToFirestore, clearHistoryInFirestore } from '../../api/refineHistoryApi.js';
import logger from '../../utils/logger.js';
import { compareQueries } from '../../utils/queryComparison';
import QueryComparisonDisplay from './QueryComparisonDisplay';

const QueryRefinementModal = ({ modalData, onClose, onApplyChanges }) => {
    const [editedQuery, setEditedQuery] = useState('');
    const [newKeywords, setNewKeywords] = useState(null);
    const [suggestions, setSuggestions] = useState(null);
    const [history, setHistory] = useState([]);
    const [compareId, setCompareId] = useState(null);
    const [comparisonResult, setComparisonResult] = useState(null);
    // const [showDebug, setShowDebug] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [tempCount, setTempCount] = useState(null);
    const [isCounting, setIsCounting] = useState(false);
    const [queryName, setQueryName] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState('keywords'); // 'keywords' or 'saved'

    const authContext = useAuth();
    const { userAccessLevel } = authContext;
    const capabilities = getCapabilities(userAccessLevel);

    // This effect resets the modal's internal state whenever it's opened with new data
    useEffect(() => {
        if (modalData) {
            setNewKeywords(JSON.parse(JSON.stringify(modalData.keywords)));
            setTempCount(modalData.currentCount);
            setSuggestions(null); // Clear previous suggestions
            handleLoadHistoryForModal();
        }
    }, [modalData]);

    const generateQueryFromKeywords = (dbKey, keywordsObject) => {
        // This is a local copy of the query generation logic for instant feedback
        if (!keywordsObject) return '';
        const { syntax, searchFields } = DB_CONFIG[dbKey] || {};
        const picoToKeywordMap = { p: 'population', i: 'intervention', c: 'comparison', o: 'outcome' };

        // Resolve the provided numeric searchField (if any) to the DB token (e.g. 'all', 'tiab', 'TITLE')
        const rawField = modalData?.searchField;
        const fieldToken = rawField !== undefined && searchFields ? (searchFields[String(rawField)] || rawField) : rawField;

        const parts = ['p', 'i', 'c', 'o'].map(catKey => {
            const keywordCategory = keywordsObject[picoToKeywordMap[catKey]];
            if (!keywordCategory) return null;
            const activeTerms = [
                ...keywordCategory.keywords.filter(k => k.active).map(k => syntax.phrase(k.term, fieldToken)),
                ...keywordCategory.controlled_vocabulary.filter(v => v.active).map(v => syntax.phrase(v.term, fieldToken))
            ];
            return activeTerms.length > 0 ? `(${activeTerms.join(' OR ')})` : null;
        }).filter(Boolean);
        return parts.join(` ${syntax.separator} `);
    };

    useEffect(() => {
        if (newKeywords && modalData) {
            const query = generateQueryFromKeywords(modalData.dbKey, newKeywords);
            setEditedQuery(query);
        }
    }, [newKeywords, modalData]);

    const diffTimeoutRef = useRef(null);
    useEffect(() => {
    if (!compareId) {
        setComparisonResult(null);
        return;
    }
    
    const entry = history.find(h => h.id === compareId);
    if (!entry) {
        setComparisonResult(null);
        return;
    }

    // Debounce comparison computation
    if (diffTimeoutRef.current) clearTimeout(diffTimeoutRef.current);
    diffTimeoutRef.current = setTimeout(() => {
        try {
            const result = compareQueries(entry.query || '', editedQuery || '');
            setComparisonResult({ ...result, entry });
        } catch (e) {
            console.error('Comparison error:', e);
            setComparisonResult(null);
        }
    }, 120);

    return () => {
        if (diffTimeoutRef.current) {
            clearTimeout(diffTimeoutRef.current);
            diffTimeoutRef.current = null;
        }
    };
}, [editedQuery, compareId, history]);

    const handleKeywordToggle = (category, type, index) => {
        const updatedKeywords = JSON.parse(JSON.stringify(newKeywords));
        updatedKeywords[category][type][index].active = !updatedKeywords[category][type][index].active;
        setNewKeywords(updatedKeywords);
    };

	const handleRecalculateCount = async () => {
		if (!capabilities.canSeeLiveCounts) {
			toast.error('Upgrade to see live counts.');
			return;
		}
        setIsCounting(true);
        try {
            let count = 'N/A';
            if (modalData.dbKey === 'pubmed') count = await getPubmedCount(editedQuery);
            else if (modalData.dbKey === 'scopus' || modalData.dbKey === 'embase') count = await getElsevierCount(modalData.dbKey, editedQuery);
            else if (modalData.dbKey === 'core') count = await getCoreCount(editedQuery);
            else if (modalData.dbKey === 'semanticScholar') count = await getSemanticScholarCount(editedQuery);
            setTempCount(count);
            toast.success("Count refreshed!");
        } catch (err) {
            toast.error(`Failed to update count: ${err.message}`);
        } finally {
            setIsCounting(false);
        }
    };

    const HISTORY_KEY = (projectId, dbKey) => `query_refine_history:${String(projectId || 'global')}:${dbKey}`;

    const loadHistory = async (projectId, dbKey, userId) => {
        if (!dbKey) return [];
        try {
            // Prioritize Firestore if available and user/project provided
            if (userId && projectId && typeof loadHistoryFromFirestore === 'function') {
                const remote = await loadHistoryFromFirestore(userId, projectId, dbKey);
                if (remote && remote.length) return remote;
            }
            const raw = localStorage.getItem(HISTORY_KEY(projectId, dbKey));
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.debug('history load error', e);
            return [];
        }
    };

    const saveHistoryArray = async (projectId, dbKey, arr, userId) => {
        try {
            localStorage.setItem(HISTORY_KEY(projectId, dbKey), JSON.stringify(arr.slice(0, 50)));
            if (userId && projectId && typeof saveSnapshotToFirestore === 'function') {
                await Promise.all((arr || []).map(e => saveSnapshotToFirestore(userId, projectId, dbKey, e)));
            }
        } catch (e) {
            console.debug('history save error', e);
        }
    };

    const saveHistoryEntry = async (projectId, dbKey, entry, userId) => {
        if (!dbKey || !entry) return;
        const existing = await loadHistory(projectId, dbKey, userId) || [];
        // Avoid duplicate consecutive entries with same query
        if (existing.length > 0 && existing[0].query === entry.query) {
            // update timestamp/count
            existing[0] = { ...existing[0], count: entry.count, date: entry.date };
            setHistory(existing);
            await saveHistoryArray(projectId, dbKey, existing, userId);
            return;
        }
        const next = [entry, ...existing].slice(0, 50);
        setHistory(next);
        await saveHistoryArray(projectId, dbKey, next, userId);
    };

    const handleLoadHistoryForModal = async () => {
        const arr = await loadHistory(modalData?.projectId || null, modalData?.dbKey, authContext?.userId || null);
        setHistory(arr || []);
    };

    const handleCopyHistory = async (entry) => {
        try {
            await navigator.clipboard.writeText(entry.query || '');
            toast.success('Query copied to clipboard');
            await logger.logFeatureUsed(null, 'copy_refine_history', { db: modalData?.dbKey, projectId: modalData?.projectId });
        } catch (e) {
            toast.error('Failed to copy');
        }
    };

    const handleCompare = (entry) => {
    if (!entry) {
        setCompareId(null);
        setComparisonResult(null);
        return;
    }
    setCompareId(entry.id);
    // Computation happens in useEffect
};

    const handleClearHistory = async () => {
        try {
            // clear local
            setHistory([]);
            localStorage.removeItem(HISTORY_KEY(modalData?.projectId || null, modalData?.dbKey));
            // clear remote if possible
            if (authContext?.userId && modalData?.projectId) {
                await clearHistoryInFirestore(authContext.userId, modalData.projectId, modalData.dbKey);
            }
            toast.success('Saved queries cleared');
            setShowClearConfirm(false);
        } catch (e) {
            console.debug('clear history error', e);
            toast.error('Failed to clear saved queries');
        }
    };

    if (!modalData) return null;

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[9999] flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
                <div className="px-8 py-6 border-b bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Refine Query for {DB_CONFIG[modalData.dbKey].name}</h3>
					<p className="mt-2 text-sm text-gray-600">Current estimated count: {capabilities.canSeeLiveCounts ? (
                                <span className="font-semibold text-lg">{isCounting ? '...' : (tempCount !== undefined ? Number(tempCount).toLocaleString() : 'N/A')}</span>
					) : (
						<span className="text-gray-500 font-medium">Upgrade to see live counts</span>
					)}</p>
                </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <XCircleIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                <div className="px-8 py-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-8">
                        {/* Left Side: Tabbed Interface */}
                        <div className="col-span-1">
                            {/* Tab Navigation */}
                            <div className="flex border-b border-gray-200 mb-4">
                                <button
                                    onClick={() => setActiveTab('keywords')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                                        activeTab === 'keywords'
                                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Keywords
                                </button>
                                <button
                                    onClick={() => setActiveTab('saved')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                                        activeTab === 'saved'
                                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Saved Queries
                                    {history.length > 0 && (
                                        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                                            {history.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="max-h-[calc(95vh-350px)] overflow-y-auto">
                                {activeTab === 'keywords' ? (
                                    <div className="space-y-5 p-4 border rounded-lg bg-gray-50">
                                        {newKeywords && Object.entries(newKeywords).map(([category, data]) => (
                                            <div key={category} className="bg-white rounded-lg p-4 border border-gray-200">
                                                <h5 className="font-semibold text-sm text-gray-800 capitalize mb-3">{category}</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {data.keywords.map((kw, i) => (
                                                        <button 
                                                            key={`kw-${i}`} 
                                                            onClick={() => handleKeywordToggle(category, 'keywords', i)} 
                                                            className={cn(
                                                                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                                                                kw.active ? 'bg-main/10 text-main ring-1 ring-main/20' : 'bg-gray-100 text-gray-600 line-through hover:bg-gray-200'
                                                            )}
                                                        >
                                                            {kw.term}
                                                        </button>
                                                    ))}
                                                    {data.controlled_vocabulary.map((vocab, i) => (
                                                        <button 
                                                            key={`cv-${i}`} 
                                                            onClick={() => handleKeywordToggle(category, 'controlled_vocabulary', i)} 
                                                            className={cn(
                                                                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                                                                vocab.active ? 'bg-green-100 text-green-800 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600 line-through hover:bg-gray-200'
                                                            )}
                                                        >
                                                            {vocab.term}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                    <div className="space-y-4">
                         <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-600">Manage your saved queries</p>
                                            {history.length > 0 && (
                                                <button 
                                                    onClick={() => setShowClearConfirm(true)} 
                                                    className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                        {showClearConfirm && (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800 mb-3">Are you sure you want to clear all saved queries? This action cannot be undone.</p>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={handleClearHistory}
                                                        className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition-colors"
                                                    >
                                                        Yes, Clear All
                                                    </button>
                                                    <button 
                                                        onClick={() => setShowClearConfirm(false)}
                                                        className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                             </div>
                         </div>
                                        )}
                                        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                {history.length === 0 ? (
                                                <div className="text-sm text-gray-500 text-center py-8">
                                                    No saved queries yet.<br />
                                                    <span className="text-xs">Save your first query from the Query Preview section!</span>
                                                </div>
                                ) : (
                                    history.map(h => (
                                                    <div key={h.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                                                        <div className="mb-2">
                                                            <div className="font-semibold text-sm text-gray-900 mb-1">{h.name || `Query ${new Date(h.date).toLocaleString()}`}</div>
                                                            <div className="text-xs text-gray-500">{new Date(h.date).toLocaleString()}</div>
                                                </div>
                                                        <div className="text-xs text-gray-600 break-words font-mono bg-gray-50 p-2 rounded border mb-3 max-h-24 overflow-y-auto">
                                                            {h.query || ''}
                                            </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-xs text-gray-600">
                                                                Count: <span className="font-semibold text-gray-900">{h.count !== undefined ? Number(h.count).toLocaleString() : 'N/A'}</span>
                                                </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <button 
                                                                    onClick={() => { handleCopyHistory(h); }} 
                                                                    className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                                                                    title="Copy query"
                                                                >
                                                                    Copy
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleCompare(h)} 
                                                                    className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                                                                    title="Compare with current"
                                                                >
                                                                    Compare
                                                                </button>
                                                                <button 
                                                                    onClick={() => { 
                                                                        setEditedQuery(h.query || ''); 
                                                                        setActiveTab('keywords'); // Switch to keywords tab when loading
                                                                        toast.success('Query loaded into preview'); 
                                                                    }} 
                                                                    className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
                                                                    title="Load this query"
                                                                >
                                                                    Load
                                                                </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                                     </div>
                                )}
                         </div>
                    </div>

                        {/* Right Side: Query Preview and Actions */}
                        <div className="col-span-1">
                            <h4 className="font-semibold text-lg text-gray-800 mb-4">Query Preview</h4>
                    <div className="space-y-4">
                                <textarea 
                                    rows={10} 
                                    className="block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm sm:text-sm font-mono p-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                    value={editedQuery} 
                                    readOnly 
                                />
                                
                                <div className="space-y-3">
                                 <div>
                                        <label htmlFor="query-name" className="block text-sm font-medium text-gray-700 mb-2">Query Name (optional)</label>
                                        <input
                                            id="query-name"
                                            type="text"
                                            value={queryName}
                                            onChange={(e) => setQueryName(e.target.value)}
                                            placeholder="e.g., 'Initial search' or 'Refined query'"
                                            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm px-3 py-2 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        
                                    <button 
                                        onClick={async () => {
                                            if (!editedQuery.trim()) {
                                                toast.error('Cannot save empty query');
                                                return;
                                            }
                                            
                                            // Check capabilities
                                            if (!capabilities.canSeeLiveCounts) {
                                                toast.error('Upgrade to see live counts.');
                                                return;
                                            }
                                            
                                            try {
                                                // Show loading state
                                                setIsCounting(true);
                                                toast.loading('Calculating count...', { id: 'save-query-count' });
                                                
                                                // Calculate the count first
                                                let count = 'N/A';
                                                try {
                                                    if (modalData.dbKey === 'pubmed') {
                                                        count = await getPubmedCount(editedQuery);
                                                    } else if (modalData.dbKey === 'scopus' || modalData.dbKey === 'embase') {
                                                        count = await getElsevierCount(modalData.dbKey, editedQuery);
                                                    } else if (modalData.dbKey === 'core') {
                                                        count = await getCoreCount(editedQuery);
                                                    } else if (modalData.dbKey === 'semanticScholar') {
                                                        count = await getSemanticScholarCount(editedQuery);
                                                    }
                                                    
                                                    // Update the temp count so it's visible
                                                    setTempCount(count);
                                                } catch (countError) {
                                                    console.error('Error calculating count:', countError);
                                                    toast.dismiss('save-query-count');
                                                    toast.error('Failed to calculate count, but saving query anyway');
                                                    // Continue with 'N/A' count
                                                }
                                                
                                                // Save the query with the calculated count
                                                const entry = { 
                                                    id: Date.now(), 
                                                    query: editedQuery, 
                                                    count: count, // Use the freshly calculated count
                                                    date: (new Date()).toISOString(),
                                                    name: queryName.trim() || `Query ${new Date().toLocaleString()}`
                                                };
                                                
                                                await saveHistoryEntry(
                                                    modalData?.projectId || null, 
                                                    modalData?.dbKey, 
                                                    entry, 
                                                    authContext?.userId || null
                                                );
                                                
                                                toast.dismiss('save-query-count');
                                                toast.success('Query saved with current count!');
                                                setQueryName('');
                                                await handleLoadHistoryForModal();
                                                
                                            } catch (e) {
                                                console.error('Error saving query:', e);
                                                toast.dismiss('save-query-count');
                                                toast.error('Failed to save query');
                                            } finally {
                                                setIsCounting(false);
                                            }
                                        }} 
                                        disabled={isCounting || !capabilities.canSeeLiveCounts}
                                        className="flex-1 inline-flex items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isCounting ? (
                                            <>
                                                <Spinner />
                                                <span className="ml-2">Calculating & Saving...</span>
                                            </>
                                        ) : (
                                            'Save Query'
                                        )}
                                    </button>
                                    <button 
                                            onClick={handleRecalculateCount} 
                                            disabled={isCounting || !capabilities.canSeeLiveCounts} 
                                            className="flex-1 inline-flex items-center justify-center rounded-md border border-transparent bg-main px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50 disabled:cursor-not-allowed transition-colors" 
                                            title={!capabilities.canSeeLiveCounts ? 'Upgrade to unlock live counts' : undefined}
                                        >
                                            {isCounting ? <Spinner /> : <ArrowPathIcon className="h-4 w-4 mr-2" />}
                                            Recalculate
                                    </button>
                                </div>
                             </div>

                             {/* Diff view when comparing */}
                            {comparisonResult && (
    <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
            <button 
                onClick={() => { setCompareId(null); setComparisonResult(null); }} 
                className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            >
                ← Back to Saved Queries
            </button>
        </div>
        <QueryComparisonDisplay 
            comparisonResult={comparisonResult}
            savedEntry={comparisonResult.entry}
            currentCount={tempCount}
        />
    </div>
)}
                                             

                           
                            </div>
                                        {/* <div className="mt-3 flex items-center gap-2">
                                            <button onClick={() => setShowDebug(s => !s)} className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors">
                                                {showDebug ? 'Hide debug' : 'Show debug info'}
                                            </button>
                                        </div> */}
                                      
                         </div>
                    </div>
                </div>
                <div className="px-8 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => { onApplyChanges(newKeywords); onClose(); }} 
                        className="inline-flex items-center rounded-md border border-transparent bg-main px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-main-dark transition-colors"
                    >
                        Apply Changes & Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QueryRefinementModal;