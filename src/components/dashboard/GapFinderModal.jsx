import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { callGeminiAPI } from '../../api/geminiApi.js';
import { XCircleIcon, SearchIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

function GapFinderModal({ onClose }) {
    const [topic, setTopic] = useState('');
    const [gaps, setGaps] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFindGaps = async () => {
        if (!topic.trim()) return toast.error("Please enter a topic.");
        setIsLoading(true);
        setError(null);
        setGaps(null);

        const prompt = `Given the research topic: "${topic}", identify 3-5 potential research gaps that could be explored in a systematic review. Output ONLY a raw JSON array of strings, like ["Gap 1", "Gap 2"].`;

        try {
            const result = await callGeminiAPI(prompt);
            setGaps(result);
            toast.success("Research gaps identified!");
        } catch (err) {
            setError(err.message);
            toast.error(`AI gap finding failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b"><div className="flex justify-between items-start"><h3 className="text-xl font-bold text-gray-900">AI Research Gap Finder</h3><button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button></div></div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div>
                        <label htmlFor="gap-topic" className="block text-sm font-medium text-gray-700">Enter a research topic:</label>
                        <input type="text" id="gap-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., AI in medical diagnostics" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" disabled={isLoading} />
                    </div>
                    <button onClick={handleFindGaps} disabled={isLoading || !topic.trim()} className="w-full inline-flex items-center justify-center gap-x-2 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isLoading ? <Spinner /> : <SearchIcon className="h-5 w-5" />}
                        {isLoading ? 'Finding Gaps...' : 'Find Research Gaps'}
                    </button>
                    {error && <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">{error}</div>}
                    {gaps && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                            <h4 className="text-md font-semibold text-gray-800">Potential Research Gaps:</h4>
                            <ul className="list-disc list-inside mt-2 space-y-2 text-sm text-gray-700">
                                {gaps.map((gap, index) => <li key={index}>{gap}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-gray-50 border-t flex justify-end"><button onClick={onClose} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Close</button></div>
            </div>
        </div>
    );
}

export default GapFinderModal;