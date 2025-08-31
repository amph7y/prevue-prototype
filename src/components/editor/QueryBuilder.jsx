import React from 'react';
import { DB_CONFIG, UNIFIED_SEARCH_FIELDS } from '../../config/dbConfig.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { ArrowUturnLeftIcon, SearchIcon, ClipboardIcon, PlusCircleIcon, MinusCircleIcon, SparklesIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const ALLOWED_DBS = ['pubmed', 'scopus', 'core'];

const QueryBuilder = ({ state, actions }) => {
    const { queries, searchCounts, isSearching, selectedDBs, concepts } = state;
    const { setStep, handleRunSearch, handleDbSelectionChange, setRefineModalData } = actions;

    const navButtons = (
        <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />
                Back to Define
            </button>

            <button type="button" onClick={() => handleRunSearch()} disabled={isSearching} className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                {isSearching ? <><Spinner /> <span className='ml-2'>Searching...</span></> : <><SearchIcon className="h-5 w-5 mr-2" /><span>Run Live Search</span></>}
            </button>
        </div>
    );

    return (
        <div className="mt-10">
            <h2 className="text-2xl font-bold mt-8">2. Build & Run Your Search</h2>
            <p className="mt-2 text-gray-600">Review the queries for each database. They update automatically when you change keywords or options.</p>
            
            <div className="mt-8 space-y-4">
                <div className="p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Select Databases</h3>
                    <fieldset className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(DB_CONFIG).map(([key, { name }]) => {
                            const isAllowed = ALLOWED_DBS.includes(key);
                            return (
                                <div key={key} className="relative flex items-start">
                                    <div className="flex h-6 items-center">
                                        <input
                                            id={key}
                                            name={key}
                                            type="checkbox"
                                            checked={selectedDBs[key] || false}
                                            onChange={(e) => isAllowed && handleDbSelectionChange(key, e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            disabled={!isAllowed}
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor={key} className={isAllowed ? "font-medium text-gray-900" : "font-medium text-gray-400"}>{name}</label>
                                    </div>
                                </div>
                            );
                        })}
                    </fieldset>
                </div>
            </div>

            <div className="mt-6 space-y-6">
                {Object.keys(DB_CONFIG).map((dbKey) => {
                    if (!selectedDBs[dbKey]) return null;
                    return (
                        <div key={dbKey} className="p-4 border rounded-lg bg-white shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-2">
                                <label className="text-lg font-semibold">{DB_CONFIG[dbKey].name}</label>
                                <div className='flex items-center gap-2'>
                                     {/* <label htmlFor={`field-${dbKey}`} className="text-sm font-medium text-gray-700">Search In:</label>
                                     <select id={`field-${dbKey}`} value={searchFieldOptions[dbKey]} onChange={(e) => handleSearchFieldChange(dbKey, parseInt(e.target.value))} className="block w-full rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 sm:text-sm">
                                         {Object.entries(UNIFIED_SEARCH_FIELDS).map(([fieldKey, fieldName]) => (
                                             <option key={fieldKey} value={fieldKey}>{fieldName}</option>
                                         ))}
                                     </select> */}
                                </div>
                                <div className='flex items-center justify-end gap-x-2'>
                                     <div className="text-sm font-medium text-gray-700 w-32 text-right flex items-center justify-end">
                                         {searchCounts[dbKey]?.loading ? (
                                             <Spinner />
                                         ) : (
                                             (searchCounts[dbKey]?.count !== undefined && searchCounts[dbKey]?.count !== 'Error') 
                                                 ? `${Number(searchCounts[dbKey].count).toLocaleString()} results` 
                                                 : (searchCounts[dbKey]?.count === 'Error' ? 'Error' : 'N/A')
                                         )}
                                     </div>
                                     <button 
                                        onClick={() => setRefineModalData({ dbKey, query: queries[dbKey], currentCount: searchCounts[dbKey]?.count, keywords, searchField: '1' })}
                                        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                     >
                                        <SparklesIcon className="h-4 w-4 text-purple-500"/>Refine
                                     </button>
                                     <button onClick={() => copyToClipboard(queries[dbKey] || '')} className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Copy <ClipboardIcon className="h-5 w-5 text-gray-400" /></button>
                                </div>
                            </div>
                            <textarea rows={10} className="block w-full rounded-md border-gray-300 bg-gray-50 font-mono text-sm" value={queries[dbKey] || ''} readOnly />
                        </div>
                    )
                })}
            </div>
            <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default QueryBuilder;