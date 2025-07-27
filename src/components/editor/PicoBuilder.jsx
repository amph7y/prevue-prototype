import React from 'react';
import { PlusCircleIcon, MinusCircleIcon, MainSparklesIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const PicoBuilder = ({ state, actions }) => {
    const { researchQuestion, pico, isLoading } = state;
    const { setResearchQuestion, setPico, handleGenerateKeywords, handleTestParameters } = actions;

    const handlePicoFieldChange = (e, category, index) => {
        const newPico = { ...pico };
        newPico[category][index] = e.target.value;
        setPico(newPico);
    };

    const addPicoField = (category) => {
        const newPico = { ...pico };
        newPico[category].push('');
        setPico(newPico);
    };

    const removePicoField = (category, index) => {
        if (pico[category].length > 1) {
            const newPico = { ...pico };
            newPico[category].splice(index, 1);
            setPico(newPico);
        }
    };

    return (
        <div className="mt-10">
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
            <h2 className="text-2xl font-bold mt-8">1. Define Your Research Question</h2>
            <div className="mt-6 space-y-8">
                <div>
                    <label className="block text-lg font-semibold">Research Question</label>
                    <textarea 
                        rows={3} 
                        value={researchQuestion} 
                        onChange={(e) => setResearchQuestion(e.target.value)} 
                        className="block w-full rounded-md border-gray-300 shadow-sm mt-2" 
                        placeholder="e.g., What is the effectiveness of mindfulness on anxiety in healthcare professionals?"
                    />
                </div>
                {Object.entries({ p: 'Population', i: 'Intervention', c: 'Comparison', o: 'Outcome' }).map(([key, label]) => (
                    <div key={key}>
                        <label className="block text-lg font-semibold">{label}</label>
                        {pico[key].map((value, index) => (
                            <div key={index} className="mt-2 flex items-center gap-x-2">
                                <input 
                                    type="text" 
                                    value={value} 
                                    onChange={(e) => handlePicoFieldChange(e, key, index)} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm" 
                                    placeholder={`e.g., "Healthcare Professionals"`}
                                />
                                <button type="button" onClick={() => removePicoField(key, index)} disabled={pico[key].length <= 1}>
                                    <MinusCircleIcon className="h-6 w-6 text-gray-400 hover:text-red-500 disabled:opacity-50" />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addPicoField(key)} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            <PlusCircleIcon className="h-5 w-5" /> Add Concept
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PicoBuilder;