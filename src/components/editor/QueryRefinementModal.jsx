import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { callGeminiAPI } from '../../api/geminiApi.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { getPubmedCount } from '../../api/pubmedApi.js';
import { getElsevierCount } from '../../api/elsevierApi.js';
import { XCircleIcon, SparklesIcon, ArrowPathIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import { cn } from '../../utils/cn.js';
import { getCoreCount } from '../../api/coreApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';

const QueryRefinementModal = ({ modalData, onClose, onApplyChanges }) => {
    const [editedQuery, setEditedQuery] = useState('');
    const [newKeywords, setNewKeywords] = useState(null);
    const [suggestions, setSuggestions] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [tempCount, setTempCount] = useState(null);
    const [isCounting, setIsCounting] = useState(false);

	const { userAccessLevel } = useAuth();
	const capabilities = getCapabilities(userAccessLevel);

    // This effect resets the modal's internal state whenever it's opened with new data
    useEffect(() => {
        if (modalData) {
            setNewKeywords(JSON.parse(JSON.stringify(modalData.keywords)));
            setTempCount(modalData.currentCount);
            setSuggestions(null); // Clear previous suggestions
        }
    }, [modalData]);

    const generateQueryFromKeywords = (dbKey, keywordsObject) => {
        // This is a local copy of the query generation logic for instant feedback
        if (!keywordsObject) return '';
        const { syntax } = DB_CONFIG[dbKey];
        const picoToKeywordMap = { p: 'population', i: 'intervention', c: 'comparison', o: 'outcome' };
        // ... (The full query generation logic would go here, but for simplicity we'll just join terms)
         const parts = ['p', 'i', 'c', 'o'].map(catKey => {
            const keywordCategory = keywordsObject[picoToKeywordMap[catKey]];
            if (!keywordCategory) return null;
            const activeTerms = [
                ...keywordCategory.keywords.filter(k => k.active).map(k => syntax.phrase(k.term, modalData.searchField)),
                ...keywordCategory.controlled_vocabulary.filter(v => v.active).map(v => syntax.phrase(v.term, modalData.searchField))
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
            setTempCount(count);
            toast.success("Count refreshed!");
        } catch (err) {
            toast.error(`Failed to update count: ${err.message}`);
        } finally {
            setIsCounting(false);
        }
    };

    if (!modalData) return null;

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-gray-900">Refine Query for {DB_CONFIG[modalData.dbKey].name}</h3>
                        <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                    </div>
					<p className="mt-2 text-sm text-gray-600">Current estimated count: {capabilities.canSeeLiveCounts ? (
						<span className="font-semibold">{isCounting ? '...' : (tempCount !== undefined ? Number(tempCount).toLocaleString() : 'N/A')}</span>
					) : (
						<span className="text-gray-500 font-medium">Upgrade to see live counts</span>
					)}</p>
                </div>
                <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-6">
                    {/* Left Side: Keyword Toggles */}
                    <div className="space-y-4">
                         <h4 className="font-semibold text-lg text-gray-800">Toggle Keywords</h4>
                         <div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded-md">
                             {newKeywords && Object.entries(newKeywords).map(([category, data]) => (
                                 <div key={category}>
                                     <h5 className="font-medium text-gray-700 capitalize">{category}</h5>
                                     <div className="mt-2 flex flex-wrap gap-1">
                                         {data.keywords.map((kw, i) => (<button key={`kw-${i}`} onClick={() => handleKeywordToggle(category, 'keywords', i)} className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', kw.active ? 'bg-main/10 text-main' : 'bg-gray-100 text-gray-600 line-through')}>{kw.term}</button>))}
                                         {data.controlled_vocabulary.map((vocab, i) => (<button key={`cv-${i}`} onClick={() => handleKeywordToggle(category, 'controlled_vocabulary', i)} className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', vocab.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 line-through')}>{vocab.term}</button>))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                    {/* Right Side: Query and Actions */}
                    <div className="space-y-4">
                         <div>
                            <h4 className="font-semibold text-lg text-gray-800">Updated Query Preview</h4>
                            <textarea rows={8} className="mt-2 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm font-mono" value={editedQuery} readOnly />
                             <div className="mt-2 flex justify-end">
								<button onClick={handleRecalculateCount} disabled={isCounting || !capabilities.canSeeLiveCounts} className="inline-flex items-center rounded-md border border-transparent bg-main px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50" title={!capabilities.canSeeLiveCounts ? 'Upgrade to unlock live counts' : undefined}>
                                     {isCounting ? <Spinner /> : <ArrowPathIcon className="h-4 w-4 mr-1" />}
									Recalculate Count
                                 </button>
                             </div>
                         </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={() => { onApplyChanges(newKeywords); onClose(); }} className="inline-flex items-center rounded-md border border-transparent bg-main px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-main-dark">Apply Changes & Close</button>
                    <button onClick={onClose} className="ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default QueryRefinementModal;