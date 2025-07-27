import React from 'react';
import { ArrowUturnLeftIcon } from '../common/Icons.jsx';

const ResultsViewer = ({ state, actions }) => {
    const { setStep } = actions;
    
    return (
        <div className="mt-10">
            <div className="flex justify-start">
                <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />Back</button>
            </div>
            <h2 className="text-2xl font-bold mt-8">4. Search Results</h2>
            <div className="mt-6 text-center py-10 border rounded-lg">
                <p>Search results will appear here after you run a search.</p>
            </div>
        </div>
    );
};

export default ResultsViewer;