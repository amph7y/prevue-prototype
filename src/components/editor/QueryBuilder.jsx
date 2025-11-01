import React, { useState, useMemo } from 'react';
import { DB_CONFIG, UNIFIED_SEARCH_FIELDS } from '../../config/dbConfig.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { ArrowUturnLeftIcon, SearchIcon, ClipboardIcon, PlusCircleIcon, MinusCircleIcon, SparklesIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import { cn } from '../../utils/cn.js';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';

const DISABLED_DBS = ['googleScholar', 'embase'];

const QueryBuilder = ({ state, actions }) => {
    const { userAccessLevel } = useAuth();
    const capabilities = getCapabilities(userAccessLevel);
    const { queries, searchCounts, isSearching, selectedDBs, concepts, enabledControlledVocabTypes } = state;
    const { setStep, handleRunSearch, handleDbSelectionChange, setRefineModalData, setEnabledControlledVocabTypes } = actions;

    const [activeTab, setActiveTab] = useState(null);

    const availableDatabases = useMemo(() => {
        return Object.keys(DB_CONFIG).filter(dbKey => selectedDBs[dbKey]);
    }, [selectedDBs]);

    React.useEffect(() => {
        if (availableDatabases.length > 0 && !activeTab) {
            setActiveTab(availableDatabases[0]);
        } else if (availableDatabases.length > 0 && !availableDatabases.includes(activeTab)) {
            setActiveTab(availableDatabases[0]);
        }
    }, [availableDatabases, activeTab]);

    const navButtons = (
        <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />
                Back to Define
            </button>

            <button type="button" onClick={async () => {
                // Log search initiation
                await logger.logLiveSearchInitiated(null, {
                    selectedDatabases: Object.keys(selectedDBs).filter(key => selectedDBs[key]),
                    conceptsCount: concepts.length
                });
                handleRunSearch();
            }} disabled={isSearching} className="inline-flex items-center rounded-md border border-transparent bg-main px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50">
                {isSearching ? <><Spinner /> <span className='ml-2'>Searching...</span></> : <><SearchIcon className="h-5 w-5 mr-2" /><span>Run Live Search</span></>}
            </button>
        </div>
    );

    return (
        <div className="mt-10">
            {navButtons}
            <h2 className="text-2xl font-bold mt-8">Step 2. Build & Run Your Search</h2>
            <p className="mt-2 text-gray-600">Review the queries for each database. They update automatically when you change keywords or options.</p>
            
            <div className="mt-8 space-y-4">
                <div className="p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Select Databases</h3>
                    {capabilities.maxDatabases !== Infinity && (
                        <div className="mt-2 text-xs text-gray-500">Free users can select up to {capabilities.maxDatabases} databases. Upgrade for more.</div>
                    )}
                    <fieldset className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(DB_CONFIG).map(([key, { name }]) => {
                            const isImplemented = !DISABLED_DBS.includes(key);
                            const isAllowed = isImplemented; // all implemented DBs are selectable; free is limited by count below
                            const currentSelectedCount = Object.values(selectedDBs || {}).filter(Boolean).length;
                            const reachedLimit = currentSelectedCount >= (capabilities.maxDatabases || Infinity);
                            const disableCheckbox = !isAllowed || (!selectedDBs[key] && reachedLimit);
                            return (
                                <div key={key} className="relative flex items-start">
                                    <div className="flex h-6 items-center">
                                        <input
                                            id={key}
                                            name={key}
                                            type="checkbox"
                                            checked={selectedDBs[key] || false}
                                            onChange={(e) => {
                                                if (!isAllowed) return;
                                                const next = e.target.checked;
                                                const nextCount = currentSelectedCount + (next && !selectedDBs[key] ? 1 : (!next && selectedDBs[key] ? -1 : 0));
                                                if (next && capabilities.maxDatabases !== Infinity && nextCount > capabilities.maxDatabases) {
                                                    toast.error(`Free plan allows selecting up to ${capabilities.maxDatabases} databases.`);
                                                    return;
                                                }
                                                handleDbSelectionChange(key, next);
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            disabled={disableCheckbox}
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor={key} className={(isAllowed && !disableCheckbox) ? "font-medium text-gray-900" : "font-medium text-gray-400"}>{name}</label>
                                        {!isImplemented && (
                                            <div className="text-xs text-gray-400">Coming soon</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </fieldset>
                    
                </div>
            </div>

            {/* Database Tabs */}
            {availableDatabases.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
                    {/* Summary Section */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Search Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Total Count */}
                            <div className="bg-white p-4 rounded-lg border-2 border-indigo-200 shadow-sm md:col-span-2 lg:col-span-3">
                                <div className="text-sm font-medium text-gray-500 mb-1">Total Results Across All Databases</div>
                                <div className="text-4xl font-bold text-indigo-600">
                                    {capabilities.canSeeLiveCounts ? (
                                        (() => {
                                            const total = availableDatabases.reduce((sum, dbKey) => {
                                                const count = searchCounts[dbKey]?.count;
                                                if (count !== undefined && count !== 'Error' && !isNaN(count)) {
                                                    return sum + Number(count);
                                                }
                                                return sum;
                                            }, 0);
                                            return total.toLocaleString();
                                        })()
                                    ) : (
                                        <span className="text-base font-semibold text-gray-500">Upgrade to see live counts</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Individual Database Counts */}
                            {availableDatabases.map(dbKey => {
                                const count = searchCounts[dbKey]?.count;
                                const isLoading = searchCounts[dbKey]?.loading;
                                
                                return (
                                    <div key={dbKey} className="bg-white p-3 rounded-lg border">
                                        <div className="text-sm font-medium text-gray-500">{DB_CONFIG[dbKey]?.name || dbKey}</div>
                                        <div className="text-lg font-semibold text-gray-800">
                                            {capabilities.canSeeLiveCounts ? (
                                                isLoading ? (
                                                    <div className="flex items-center gap-2">
                                                        <Spinner className="h-4 w-4" />
                                                        <span>Loading...</span>
                                                    </div>
                                                ) : (
                                                    count !== undefined && count !== 'Error' 
                                                        ? Number(count).toLocaleString() 
                                                        : (count === 'Error' ? 'Error' : 'N/A')
                                                )
                                            ) : (
                                                <span className="text-sm text-gray-500">Upgrade to view</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab Headers */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-4" aria-label="Tabs">
                            {availableDatabases.map(dbKey => {
                                return (
                                    <button
                                        key={dbKey}
                                        onClick={() => setActiveTab(dbKey)}
                                        className={cn(
                                            activeTab === dbKey
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                                        )}
                                    >
                                        {DB_CONFIG[dbKey]?.name || dbKey}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    {activeTab && (
                        <div className="p-4">
                            {/* Query Options */}
                            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Query Options</h4>
                                <div className="space-y-3">
                                    {/* Use Truncation - Available for all databases */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-medium text-gray-900">Enable Truncation</label>
                                            <p className="text-xs text-gray-500">Enable wildcard searching for broader results</p>
                                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Future Feature</span>
                                        </div>
                                        <button
                                            type="button"
                                            disabled
                                            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 bg-gray-200 opacity-50"
                                            role="switch"
                                            aria-checked={false}
                                            aria-disabled={true}
                                            title="This feature is coming soon"
                                        >
                                            <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0" />
                                        </button>
                                    </div>

                                    {/* Use Parallel Mesh Search - PubMed only */}
                                    {activeTab === 'pubmed' && (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-sm font-medium text-gray-900">Parallel Mesh Search</label>
                                                <p className="text-xs text-gray-500">Enable parallel MeSH term searching</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEnabledControlledVocabTypes(prev => ({ ...prev, mesh: !prev.mesh }))}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                                    enabledControlledVocabTypes.mesh ? 'bg-main' : 'bg-gray-200'
                                                }`}
                                                role="switch"
                                                aria-checked={enabledControlledVocabTypes.mesh}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        enabledControlledVocabTypes.mesh ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
                                <label className="text-lg font-semibold">{DB_CONFIG[activeTab].name}</label>
                                <div className='flex items-center gap-x-2'>
                                     {/* <label htmlFor={`field-${activeTab}`} className="text-sm font-medium text-gray-700">Search In:</label>
                                     <select id={`field-${activeTab}`} value={searchFieldOptions[activeTab]} onChange={(e) => handleSearchFieldChange(activeTab, parseInt(e.target.value))} className="block w-full rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 sm:text-sm">
                                         {Object.entries(UNIFIED_SEARCH_FIELDS).map(([fieldKey, fieldName]) => (
                                             <option key={fieldKey} value={fieldKey}>{fieldName}</option>
                                         ))}
                                     </select> */}
                                </div>
                                <div className='flex items-center justify-end gap-x-2'>
                                     <button 
                                        onClick={() => {
                                            toast('Query refinement is a future feature coming soon! 🔮', {
                                                duration: 4000
                                            });
                                        }}
                                        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                     >
                                        <SparklesIcon className="h-4 w-4 text-purple-500"/>Refine
                                     </button>
                                    <button 
                                        onClick={async () => {
                                            const q = queries[activeTab] || '';
                                            await logger.logFeatureUsed(null, 'copy_query', { db: activeTab});
                                            copyToClipboard(q);
                                        }} 
                                        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    >
                                        Copy <ClipboardIcon className="h-5 w-5 text-gray-400" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Query Display Section */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-1">
                                <div className="bg-white rounded-md p-4 border border-blue-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Generated Query</h4>
                                        <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                            {DB_CONFIG[activeTab]?.name || activeTab}
                                        </div>
                                    </div>
                                    <textarea 
                                        rows={10} 
                                        className="block w-full rounded-md border-blue-200 bg-blue-50 font-mono text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
                                        value={queries[activeTab] || ''} 
                                        readOnly 
                                        placeholder="Query will be generated based on your PICO concepts and selected options..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default QueryBuilder;