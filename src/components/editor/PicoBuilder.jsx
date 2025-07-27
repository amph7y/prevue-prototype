import React from 'react';
import { PlusCircleIcon, MinusCircleIcon, MainSparklesIcon, SparklesIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const PicoBuilder = ({ state, actions }) => {
    const { researchQuestion, pico, isLoading } = state;
    const { setResearchQuestion, setPico, handleGenerateKeywords, handleTestParameters, handleGeneratePicoFromQuestion, handleSuggestPicoTerms } = actions;

    const handlePicoFieldChange = (e, category, index) => {
        const newPico = { ...pico };
        newPico[category][index] = e.target.value;
        setPico(newPico);
    };

    const addPicoField = (category) => setPico(prev => ({ ...prev, [category]: [...prev[category], ''] }));
    const removePicoField = (category, index) => {
        if (pico[category].length > 1) {
            const newPico = { ...pico };
            newPico[category].splice(index, 1);
            setPico(newPico);
        }
    };

    const navButtons = (
        <div className="flex justify-between items-center">
            <button 
                type="button" 
                onClick={handleTestParameters} 
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
                Test Parameters
            </button>
            <button 
                type="button" 
                onClick={() => handleGenerateKeywords()} 
                disabled={isLoading} 
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"
            >
                {isLoading ? <><Spinner /> <span className="ml-2">Generating...</span></> : <><MainSparklesIcon className="h-5 w-5 mr-2" /><span>Generate Keywords</span></>}
            </button>
        </div>
    );

    return (
        <div className="mt-10">
            {navButtons}
            <h2 className="text-2xl font-bold mt-8">1. Define Your Research Question</h2>
            <div className="mt-6 space-y-8">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-lg font-semibold">Research Question</label>
                        <button type="button" onClick={handleGeneratePicoFromQuestion} disabled={isLoading || !researchQuestion.trim()} className="inline-flex items-center gap-x-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-100">
                            <SparklesIcon className="h-4 w-4" /> Generate PICO
                        </button>
                    </div>
                    <textarea rows={3} value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" placeholder="e.g., What is the effectiveness of mindfulness on anxiety in healthcare professionals?" />
                </div>
                {Object.entries({ p: 'Population', i: 'Intervention', c: 'Comparison', o: 'Outcome' }).map(([key, label]) => (
                    <div key={key}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-lg font-semibold">{label}</label>
                            <button type="button" onClick={() => handleSuggestPicoTerms(key)} disabled={isLoading} className="inline-flex items-center gap-x-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100">
                                <SparklesIcon className="h-4 w-4" /> Suggest Terms
                            </button>
                        </div>
                        {pico[key].map((value, index) => (
                            <div key={index} className="mt-2 flex items-center gap-x-2">
                                <input type="text" value={value} onChange={(e) => handlePicoFieldChange(e, key, index)} className="block w-full rounded-md border-gray-300 shadow-sm" placeholder={`e.g., "Healthcare Professionals"`} />
                                <button type="button" onClick={() => removePicoField(key, index)} disabled={pico[key].length <= 1}><MinusCircleIcon className="h-6 w-6 text-gray-400 hover:text-red-500 disabled:opacity-50" /></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addPicoField(key)} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><PlusCircleIcon className="h-5 w-5" /> Add Concept</button>
                    </div>
                ))}
            </div>
            <div className="mt-12 pt-5 border-t border-gray-200">
                {navButtons}
            </div>
        </div>
    );
};

export default PicoBuilder;