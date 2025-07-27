import React from 'react';
import { XCircleIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const ThesaurusModal = ({ thesaurusState, onClose, onAddSynonym }) => {
    if (!thesaurusState.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Synonyms for "{thesaurusState.word}"</h3>
                    <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="mt-4 max-h-64 overflow-y-auto">
                    {thesaurusState.loading ? (
                        <div className="flex justify-center items-center py-8"><Spinner /><p className="ml-2">Searching for synonyms...</p></div>
                    ) : thesaurusState.synonyms.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {thesaurusState.synonyms.map((synonym, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onAddSynonym(synonym)} 
                                    className="bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-sm font-medium hover:bg-purple-200"
                                >
                                    Add: "{synonym}"
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p>No synonyms were found for this term.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThesaurusModal;