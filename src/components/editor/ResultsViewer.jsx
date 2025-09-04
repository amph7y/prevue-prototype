import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { DownloadIcon, ArrowPathIcon as RefreshIcon, ChevronDownIcon, ChevronUpIcon, ArrowUturnLeftIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const ResultsViewer = ({ state, actions }) => {
    const { searchResults, initialArticles, deduplicationResult, pageSize, isSearching, searchTotals } = state;
    const { setStep, setSelectedArticle, setIsExportModalOpen, setPageSize, handleRunSearch, handleDeduplicate, handlePaginatedSearch } = actions;

    const [activeTab, setActiveTab] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentArticles, setCurrentArticles] = useState([]);
    const [loadingPage, setLoadingPage] = useState(false);
    const [sortBy, setSortBy] = useState({ field: 'year', order: 'desc' });
    const [filter, setFilter] = useState('');
    
    // Get available databases from search results, sorted by count (highest first)
    const availableDatabases = useMemo(() => {
        if (!searchResults) return [];
        const databases = Object.keys(searchResults).filter(dbKey => {
            const isSuccessful = searchResults[dbKey].status === 'success';
            const hasRecords = (searchTotals?.[dbKey] || 0) > 0;
            return isSuccessful && hasRecords;
        });
        
        // Sort databases by count (highest first)
        return databases.sort((a, b) => {
            const countA = searchTotals?.[a] || 0;
            const countB = searchTotals?.[b] || 0;
            return countB - countA; // Descending order (highest first)
        });
    }, [searchResults, searchTotals]);

    React.useEffect(() => {
        if (availableDatabases.length > 0 && !activeTab) {
            setActiveTab(availableDatabases[0]);
        }
    }, [availableDatabases, activeTab]);

    React.useEffect(() => {
        console.log('[ResultsViewer] Page size changed to:', pageSize);
        setCurrentPage(1);
        setCurrentArticles([]);
    }, [pageSize]);

    React.useEffect(() => {
        if (activeTab && initialArticles) {
            const initialTabArticles = initialArticles.filter(a => a.sourceDB === activeTab);
            setCurrentArticles(initialTabArticles);
            setCurrentPage(1);
        }
    }, [activeTab, initialArticles]);

    // Get current page articles with filtering and sorting
    const currentTabArticles = useMemo(() => {
        if (!activeTab) return [];
        
        let articles = [...currentArticles];
        
        // Apply client-side search filter
        if (filter && filter.trim() !== '') {
            const searchTerm = filter.toLowerCase().trim();
            articles = articles.filter(article => 
                (article.title || '').toLowerCase().includes(searchTerm) ||
                (article.venue || article.journal || '').toLowerCase().includes(searchTerm) ||
                (article.authors || []).some(author => 
                    typeof author === 'string' ? author.toLowerCase().includes(searchTerm) : 
                    (author.name || '').toLowerCase().includes(searchTerm)
                )
            );
        }
        
        // Apply client-side sorting
        if (sortBy.field && articles.length > 0) {
            articles = [...articles].sort((a, b) => {
                let valueA, valueB;
                
                if (sortBy.field === 'title') {
                    valueA = (a.title || '').toLowerCase();
                    valueB = (b.title || '').toLowerCase();
                } else if (sortBy.field === 'year') {
                    // Handle different year formats and convert to numbers for proper sorting
                    valueA = parseInt(a.year || a.pubdate || '0', 10);
                    valueB = parseInt(b.year || b.pubdate || '0', 10);
                    
                    // For numeric sorting
                    if (sortBy.order === 'desc') {
                        return valueB - valueA;
                    } else {
                        return valueA - valueB;
                    }
                }
                
                // For string sorting (title)
                if (sortBy.order === 'desc') {
                    return valueB.localeCompare(valueA);
                } else {
                    return valueA.localeCompare(valueB);
                }
            });
        }
        
        return articles;
    }, [activeTab, currentArticles, filter, sortBy]);

    // Get total items and pages for current tab
    const getTotalItemsForTab = (dbKey) => {
        return searchTotals?.[dbKey] || 0;
    };
    
    const getTotalPagesForTab = (dbKey) => {
        const totalItems = getTotalItemsForTab(dbKey);
        return Math.ceil(totalItems / pageSize);
    };
    
    const getCurrentPage = () => {
        return currentPage;
    };

    const handleSort = (field) => {
        setSortBy(current => ({
            field,
            order: current.field === field && current.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handlePageChange = async (page) => {
        if (!activeTab || !handlePaginatedSearch) return;
        
        setLoadingPage(true);
        setCurrentPage(page);
        
        try {
            const articles = await handlePaginatedSearch(activeTab, page, pageSize);
            setCurrentArticles(articles);
        } catch (error) {
            console.error(`Failed to load page ${page} for ${activeTab}:`, error);
        } finally {
            setLoadingPage(false);
        }
    };

    const renderSortArrow = (field) => {
        if (sortBy.field !== field) return null;
        return sortBy.order === 'desc' ? <ChevronDownIcon className="h-4 w-4 ml-1" /> : <ChevronUpIcon className="h-4 w-4 ml-1" />;
    };

    const navButtons = (
       <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />Back to Queries</button>
            <button onClick={() => setIsExportModalOpen(true)} className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-medium text-white bg-main border border-transparent rounded-md shadow-sm hover:bg-main-dark">
                <DownloadIcon className="h-5 w-5" /> Export All
            </button>
        </div>
    );

    return (
        <div className="space-y-6 mt-10">
            {navButtons}
            <h2 className="text-2xl font-bold text-gray-800 pt-8">Step 3: Review & Export Results</h2>

            {isSearching && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
                    <Spinner />
                    <p className="mt-4 text-lg font-medium text-gray-600">Searching databases...</p>
                </div>
            )}

                            <div className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center gap-x-4">
                        {deduplicationResult && (
                            <p className="text-sm text-green-700">{deduplicationResult.count} duplicates found and hidden.</p>
                        )}
                    </div>
                    <div className="flex items-center gap-x-4">
                        <div className="w-64">
                            <input 
                                type="text" 
                                placeholder="Filter articles by title, journal, or author..." 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-x-2">
                            <label htmlFor="pageSize" className="text-sm font-medium text-gray-700">Results per page:</label>
                            <select id="pageSize" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option>10</option><option>25</option><option>50</option><option>100</option>
                            </select>
                            <button onClick={() => handleRunSearch(true)} className="p-2 text-white bg-main rounded-md hover:bg-main-dark"><RefreshIcon className="h-5 w-5"/></button>
                        </div>
                    </div>
                </div>

                {/* Database Tabs */}
                {availableDatabases.length > 0 && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        {/* Tab Headers */}
                        <div className="border-b border-gray-200">
                            <nav className="flex space-x-8 px-4" aria-label="Tabs">
                                {availableDatabases.map(dbKey => {
                                    const totalCount = getTotalItemsForTab(dbKey);
                                    
                                    return (
                                        <button
                                            key={dbKey}
                                            onClick={() => setActiveTab(dbKey)}
                                            className={cn(
                                                activeTab === dbKey
                                                    ? 'border-indigo-500 text-indigo-600'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
                                            )}
                                        >
                                            {DB_CONFIG[dbKey]?.name || dbKey}
                                            <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                                                {totalCount.toLocaleString()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Tab Content */}
                        {activeTab && (
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-md font-medium">
                                        {DB_CONFIG[activeTab]?.name || activeTab} Results
                                        <span className="ml-2 text-sm text-gray-500">
                                            (Page {getCurrentPage()} of {getTotalPagesForTab(activeTab)} • {getTotalItemsForTab(activeTab)} articles)
                                        </span>
                                    </h4>
                                </div>

                                {loadingPage && (
                                    <div className="flex justify-center items-center py-8">
                                        <Spinner />
                                        <span className="ml-2">Loading page...</span>
                                    </div>
                                )}
                                
                                {!loadingPage && (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5 cursor-pointer" onClick={() => handleSort('title')}>
                                                        Title {renderSortArrow('title')}
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 cursor-pointer" onClick={() => handleSort('year')}>
                                                        Year {renderSortArrow('year')}
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                                                        Journal/Venue
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentTabArticles.map(article => (
                                                    <tr key={article.uniqueId}>
                                                        <td className="px-6 py-4 text-sm">
                                                            <button 
                                                                onClick={() => setSelectedArticle(article)} 
                                                                className="font-medium text-indigo-600 hover:underline text-left block w-full"
                                                                title={article.title || 'No Title Available'}
                                                            >
                                                                <div className="leading-5 overflow-hidden" style={{ 
                                                                    display: '-webkit-box', 
                                                                    WebkitLineClamp: 3, 
                                                                    WebkitBoxOrient: 'vertical',
                                                                    maxHeight: '3.75rem' /* 3 lines * 1.25rem line-height */
                                                                }}>
                                                                    {article.title || 'No Title Available'}
                                                                </div>
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {article.year || article.pubdate || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            <div className="leading-5 overflow-hidden" style={{ 
                                                                display: '-webkit-box', 
                                                                WebkitLineClamp: 2, 
                                                                WebkitBoxOrient: 'vertical',
                                                                maxHeight: '2.5rem' /* 2 lines * 1.25rem line-height */
                                                            }} title={article.venue || article.journal || 'N/A'}>
                                                                {article.venue || article.journal || 'N/A'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {getTotalPagesForTab(activeTab) > 1 && (
                                            <div className="p-4 border-t">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm text-gray-700">
                                                        Showing {((getCurrentPage() - 1) * pageSize) + 1} to{' '}
                                                        {Math.min(getCurrentPage() * pageSize, getTotalItemsForTab(activeTab))} of{' '}
                                                        {getTotalItemsForTab(activeTab)} results
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handlePageChange(1)}
                                                            disabled={getCurrentPage() === 1 || loadingPage}
                                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            First
                                                        </button>
                                                        <button
                                                            onClick={() => handlePageChange(getCurrentPage() - 1)}
                                                            disabled={getCurrentPage() === 1 || loadingPage}
                                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Previous
                                                        </button>
                                                        
                                                        {/* Page Numbers */}
                                                        <div className="flex space-x-1">
                                                            {Array.from({ length: Math.min(5, getTotalPagesForTab(activeTab)) }, (_, i) => {
                                                                let pageNum;
                                                                const totalPages = getTotalPagesForTab(activeTab);
                                                                const currentPageNum = getCurrentPage();
                                                                if (totalPages <= 5) {
                                                                    pageNum = i + 1;
                                                                } else if (currentPageNum <= 3) {
                                                                    pageNum = i + 1;
                                                                } else if (currentPageNum >= totalPages - 2) {
                                                                    pageNum = totalPages - 4 + i;
                                                                } else {
                                                                    pageNum = currentPageNum - 2 + i;
                                                                }
                                                                return (
                                                                    <button
                                                                        key={pageNum}
                                                                        onClick={() => handlePageChange(pageNum)}
                                                                        disabled={loadingPage}
                                                                        className={`px-3 py-1 text-sm border rounded-md disabled:opacity-50 ${
                                                                            pageNum === currentPageNum
                                                                                ? 'bg-main text-white border-main'
                                                                                : 'border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                    >
                                                                        {pageNum}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        
                                                        <button
                                                            onClick={() => handlePageChange(getCurrentPage() + 1)}
                                                            disabled={getCurrentPage() === getTotalPagesForTab(activeTab) || loadingPage}
                                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Next
                                                        </button>
                                                        <button
                                                            onClick={() => handlePageChange(getTotalPagesForTab(activeTab))}
                                                            disabled={getCurrentPage() === getTotalPagesForTab(activeTab) || loadingPage}
                                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Last
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default ResultsViewer;