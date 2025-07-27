import React, { useState, useEffect } from 'react';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { cn } from '../../utils/cn.js';
import { ArrowUturnLeftIcon, DocumentDuplicateIcon, XCircleIcon, ArrowPathIcon } from '../common/Icons.jsx';
import Pagination from '../common/Pagination.jsx';
import Spinner from '../common/Spinner.jsx';

const ResultsViewer = ({ state, actions }) => {
    const { searchResults, allArticles, deduplicationResult, irrelevantArticles, retmax, isSearching } = state;
    const { setStep, setSelectedArticle, setIsExportModalOpen, toggleIrrelevant, setRetmax, handleRunSearch, handleDeduplicate } = actions;

    const [activeTab, setActiveTab] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showDuplicates, setShowDuplicates] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => {
        if (searchResults && !activeTab) {
            const firstTab = Object.keys(searchResults)[0];
            if(firstTab) setActiveTab(firstTab);
        }
    }, [searchResults, activeTab]);

    const navButtons = (
         <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />Back to Queries</button>
            <div className='flex items-center gap-x-4'>
                {allArticles.length > 0 && <button onClick={handleDeduplicate} className="inline-flex items-center gap-x-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600"><DocumentDuplicateIcon className="h-5 w-5"/>Deduplicate</button>}
                <button onClick={() => setIsExportModalOpen(true)} className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700">Export Results</button>
            </div>
        </div>
    );

    const resultForTab = searchResults && activeTab ? searchResults[activeTab] : null;
    const dataToDisplay = resultForTab?.data || [];
    const filteredData = showDuplicates ? dataToDisplay : dataToDisplay.filter(a => !a.isDuplicate);

    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    return (
        <div className="mt-10">
            {navButtons}
            <h2 className="text-2xl font-bold mt-8">4. Search Results</h2>

            <div className="flex justify-between items-center mt-4">
                 {deduplicationResult ? (
                    <div className="flex items-center gap-x-4">
                        <p className="text-sm font-medium text-gray-700">{deduplicationResult.count} duplicates found.</p>
                        <div className="relative flex items-start">
                            <div className="flex h-6 items-center"><input id="show-duplicates" type="checkbox" checked={showDuplicates} onChange={(e) => setShowDuplicates(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" /></div>
                            <div className="ml-3 text-sm"><label htmlFor="show-duplicates" className="font-medium text-gray-900">Show Duplicates</label></div>
                        </div>
                    </div>
                ) : <div />}
                 <div className="flex items-center gap-x-2">
                    <label htmlFor="retmax" className="block text-sm font-medium text-gray-700">Results Limit:</label>
                    <input type="number" id="retmax" value={retmax} onChange={(e) => setRetmax(Number(e.target.value))} className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    <button onClick={() => handleRunSearch(true)} disabled={isSearching} className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                        {isSearching ? <Spinner /> : <ArrowPathIcon className="h-4 w-4"/>} Update
                    </button>
                </div>
            </div>

            {searchResults ? (
                <>
                    <div className="border-b border-gray-200 mt-6"><nav className="-mb-px flex space-x-8">
                        {Object.keys(searchResults).map(dbKey => (<button key={dbKey} onClick={() => {setActiveTab(dbKey); setCurrentPage(1);}} className={cn('whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium', activeTab === dbKey ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300')}>
                            {DB_CONFIG[dbKey]?.name || dbKey} ({searchResults[dbKey]?.data?.length || 0})
                        </button>))}
                    </nav></div>

                    <div className="border border-t-0 rounded-b-md">
                        <ul role="list" className="divide-y divide-gray-200">
                            {paginatedData.map((item, index) => (
                                <li key={item.uniqueId} className={cn("p-4 hover:bg-gray-50", item.isDuplicate && "bg-yellow-50 opacity-60", irrelevantArticles.has(item.uniqueId) && "bg-red-50 opacity-50")}>
                                    <div className="flex items-start gap-x-4">
                                        <span className="text-sm font-medium text-gray-500 w-8 text-right">{(currentPage - 1) * itemsPerPage + index + 1}.</span>
                                        <div className="flex-1">
                                            <button onClick={() => setSelectedArticle(item)} className="text-md font-semibold text-indigo-700 text-left hover:underline">{item.title}</button>
                                            {item.isDuplicate && <span className="ml-2 inline-flex items-center rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Duplicate</span>}
                                            <p className="text-sm text-gray-600 mt-1">{item.authors?.map(a => a.name).join(', ')}</p>
                                            <p className="text-sm text-gray-500 mt-1">{item.source || item.venue} ({item.pubdate || item.year})</p>
                                        </div>
                                        <button onClick={() => toggleIrrelevant(item.uniqueId)} title="Mark as Irrelevant"><XCircleIcon className={cn("h-6 w-6", irrelevantArticles.has(item.uniqueId) ? "text-red-500" : "text-gray-400 hover:text-gray-600")} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
                    </div>
                </>
            ) : (
                <div className="mt-6 text-center py-10 border rounded-lg"><p>Run a search in Step 3 to see results here.</p></div>
            )}
             <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default ResultsViewer;