import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { XCircleIcon } from './Icons.jsx';
import Spinner from './Spinner.jsx';

function ArticleDetailModal({ article, onClose }) {
    const [details, setDetails] = useState({ abstract: '', doi: '', url: '#' });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!article) return;
            setIsLoading(true);
            
            let abstract = article.abstract || "No abstract available.";
            let doi = article.externalIds?.DOI || article.doi || '';
            let url = doi ? `https://doi.org/${doi}` : '#';

            if (article.sourceDB === 'pubmed') {
                url = `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`;
            } else if (article.sourceDB === 'semanticScholar') {
                url = article.externalIds?.DOI ? `https://doi.org/${article.externalIds.DOI}` : `https://www.semanticscholar.org/paper/${article.paperId}`;
            } else if (article.sourceDB === 'core') {
                url = article.doi ? `https://doi.org/${doi}` : (article.downloadUrl || '#');
            }

            setDetails({ abstract, doi, url });
            setIsLoading(false);
        };

        fetchDetails();
    }, [article]);

    if (!article) return null;

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-gray-900">{article.title}</h3>
                        <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{article.authors?.map(a => a.name).join(', ')}</p>
                    <p className="text-sm text-gray-500 mt-1">{article.source || article.venue || 'N/A'} ({article.pubdate || article.year || 'N/A'})</p>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    <h4 className="font-semibold text-gray-800">Abstract</h4>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-8"><Spinner /><p className="ml-2 text-gray-500">Loading details...</p></div>
                    ) : (
                        <p className="mt-2 text-gray-700 whitespace-pre-wrap">{details.abstract}</p>
                    )}
                </div>
                <div className="p-6 bg-gray-50 rounded-b-lg border-t border-gray-200 flex justify-between items-center">
                    <p className="text-sm text-gray-600">DOI: {details.doi || 'N/A'}</p>
                    <a href={details.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                        View Source Article
                    </a>
                </div>
            </div>
        </div>
    );
}

export default ArticleDetailModal;