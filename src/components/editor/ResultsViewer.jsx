import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { DownloadIcon, ArrowPathIcon as RefreshIcon, ChevronDownIcon, CheckCircleIcon, ExclamationCircleIcon, ChevronUpIcon, ArrowUturnLeftIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const ResultsViewer = ({ state, actions }) => {
    const { searchResults, allArticles, deduplicationResult, irrelevantArticles, retmax, isSearching } = state;
    const { setStep, setSelectedArticle, setIsExportModalOpen, toggleIrrelevant, setRetmax, handleRunSearch, handleDeduplicate } = actions;

    const [expandedDb, setExpandedDb] = useState(null);
    const [visibleArticles, setVisibleArticles] = useState(15);
    const [sortBy, setSortBy] = useState({ field: 'year', order: 'desc' });
    const [filter, setFilter] = useState('');

    const filteredAndSortedArticles = useMemo(() => {
        if (!allArticles) return [];
        let articlesToProcess = deduplicationResult ? allArticles.filter(a => !a.isDuplicate) : [...allArticles];

        return articlesToProcess
            .filter(a => filter ? (a.title || '').toLowerCase().includes(filter.toLowerCase()) : true)
            .sort((a, b) => {
                const aVal = a[sortBy.field] || '';
                const bVal = b[sortBy.field] || '';
                if (sortBy.order === 'asc') return String(aVal).localeCompare(String(bVal));
                return String(bVal).localeCompare(String(aVal));
            });
    }, [allArticles, sortBy, filter, deduplicationResult]);

    const handleSort = (field) => {
        setSortBy(current => ({
            field,
            order: current.field === field && current.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    const toggleExpandDb = (dbKey) => setExpandedDb(current => (current === dbKey ? null : dbKey));

    const renderSortArrow = (field) => {
        if (sortBy.field !== field) return null;
        return sortBy.order === 'desc' ? <ChevronDownIcon className="h-4 w-4 ml-1" /> : <ChevronUpIcon className="h-4 w-4 ml-1" />;
    };

    const navButtons = (
       <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />Back to Queries</button>
            <button onClick={() => setIsExportModalOpen(true)} className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">
                <DownloadIcon className="h-5 w-5" /> Export All
            </button>
        </div>
    );

    return (
        <div className="space-y-6 mt-10">
            {navButtons}
            <h2 className="text-2xl font-bold text-gray-800 pt-8">Step 4: Review & Export Results</h2>

            {isSearching && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
                    <Spinner />
                    <p className="mt-4 text-lg font-medium text-gray-600">Searching databases...</p>
                </div>
            )}

            {!isSearching && searchResults && (
                <div className="border rounded-lg overflow-hidden bg-white shadow">
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-semibold">Search Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            {Object.entries(searchResults).map(([dbKey, result]) => (
                                <div key={dbKey} className="p-3 bg-gray-50 rounded-md">
                                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpandDb(dbKey)}>
                                        <span className="font-bold capitalize">{DB_CONFIG[dbKey]?.name || dbKey}</span>
                                        {result.status === 'success' ? (
                                            <span className="flex items-center text-green-600"><CheckCircleIcon className="h-5 w-5 mr-1"/>{result.data?.length || 0} results</span>
                                        ) : (
                                            <span className="flex items-center text-red-600"><ExclamationCircleIcon className="h-5 w-5 mr-1"/>Error</span>
                                        )}
                                        {expandedDb === dbKey ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                                    </div>
                                    {expandedDb === dbKey && (
                                        <div className="mt-2 text-xs text-gray-500 break-all">
                                            {result.status === 'error' ? <p className="text-red-500">{result.message}</p> : <p>Query successful.</p>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center gap-x-4">
                        <button onClick={handleDeduplicate} className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200">Deduplicate</button>
                        {deduplicationResult && (
                            <p className="text-sm text-green-700">{deduplicationResult.count} duplicates found and hidden.</p>
                        )}
                    </div>
                    <div className="flex items-center gap-x-2">
                         <label htmlFor="retmax" className="text-sm font-medium text-gray-700">Results per search:</label>
                        <select id="retmax" value={retmax} onChange={e => setRetmax(Number(e.target.value))} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option>10</option><option>25</option><option>50</option><option>100</option>
                        </select>
                        <button onClick={() => handleRunSearch(true)} className="p-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"><RefreshIcon className="h-5 w-5"/></button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4">
                        <div className="flex justify-between items-center">
                           <h3 className="text-lg font-semibold">Combined Results ({filteredAndSortedArticles.length} articles)</h3>
                           <div className="w-1/3">
                               <input type="text" placeholder="Filter articles by title..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                           </div>
                        </div>
                        <p className="text-sm text-gray-500">
                            Showing {Math.min(visibleArticles, filteredAndSortedArticles.length)} of {filteredAndSortedArticles.length} unique articles.
                            <span className="ml-2">({irrelevantArticles.size} marked as irrelevant)</span>
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2 cursor-pointer" onClick={() => handleSort('title')}>Title {renderSortArrow('title')}</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('year')}>Year {renderSortArrow('year')}</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedArticles.slice(0, visibleArticles).map(article => (
                                    <tr key={article.uniqueId} className={irrelevantArticles.has(article.uniqueId) ? 'bg-red-50' : ''}>
                                        <td className="px-6 py-4 whitespace-normal text-sm">
                                            <button onClick={() => setSelectedArticle(article)} className="font-medium text-indigo-600 hover:underline text-left">{article.title || 'No Title Available'}</button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{article.year || article.pubdate || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{article.sourceDB}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => toggleIrrelevant(article.uniqueId)} className={`px-2 py-1 text-xs rounded-full ${irrelevantArticles.has(article.uniqueId) ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                                                {irrelevantArticles.has(article.uniqueId) ? 'Irrelevant' : 'Relevant'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {visibleArticles < filteredAndSortedArticles.length && (
                        <div className="p-4 text-center border-t">
                            <button onClick={() => setVisibleArticles(prev => prev + 15)} className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200">
                                Show More
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default ResultsViewer;