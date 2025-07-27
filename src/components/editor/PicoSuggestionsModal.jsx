import React from 'react';
import { XCircleIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const PicoSuggestionsModal = ({ suggestionsState, onClose, onAddSuggestion }) => {
    if (!suggestionsState.isOpen) return null;

    const picoLabels = { p: 'Population', i: 'Intervention', c: 'Comparison', o: 'Outcome' };
    const categoryLabel = picoLabels[suggestionsState.category] || '';

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">AI Suggestions for "{categoryLabel}"</h3>
                    <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="mt-4 max-h-64 overflow-y-auto">
                    {suggestionsState.loading ? (
                        <div className="flex justify-center items-center py-8"><Spinner /><p className="ml-2 text-gray-500">Generating suggestions...</p></div>
                    ) : suggestionsState.suggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {suggestionsState.suggestions.map((suggestion, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onAddSuggestion(suggestion, suggestionsState.category)} 
                                    className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-sm font-medium hover:bg-indigo-200"
                                >
                                    Add: "{suggestion}"
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p>No suggestions found. Try adding more context to other PICO fields.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PicoSuggestionsModal;