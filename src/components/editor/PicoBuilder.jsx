import React, { useState } from 'react';
import { PlusCircleIcon, MinusCircleIcon, MainSparklesIcon, TrashIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

const PicoBuilder = ({ state, actions, showOnlyConcepts = false }) => {
    const { researchQuestion, concepts, isLoading } = state;
    const { setResearchQuestion, setConcepts, handleGeneratePicoFromQuestion } = actions;

    const [newConceptName, setNewConceptName] = useState('');

    const addConcept = (type, name) => {
        const newConcept = {
            id: `concept_${Date.now()}`,
            name: name ?? type,
            type: type,
            synonyms: [],
            keywords: [],
            controlled_vocabulary: []
        };
        setConcepts(prev => [...prev, newConcept]);
    };

    const removeConcept = (conceptId) => {
        setConcepts(prev => prev.filter(c => c.id !== conceptId));
    };

    const updateConceptName = (conceptId, name) => {
        setConcepts(prev => prev.map(c => 
            c.id === conceptId ? { ...c, name } : c
        ));
    };

    const addConceptSynonym = (conceptId) => {
        setConcepts(prev => prev.map(c => 
            c.id === conceptId 
                ? { ...c, synonyms: [...c.synonyms, ''] }
                : c
        ));
    };

    const removeConceptSynonym = (conceptId, index) => {
        setConcepts(prev => prev.map(c => 
            c.id === conceptId 
                ? { ...c, synonyms: c.synonyms.filter((_, i) => i !== index) }
                : c
        ));
    };

    const updateConceptSynonym = (conceptId, index, value) => {
        setConcepts(prev => prev.map(c => 
            c.id === conceptId 
                ? { ...c, synonyms: c.synonyms.map((syn, i) => i === index ? value : syn) }
                : c
        ));
    };

    if (showOnlyConcepts) {
        return (
            <div className="space-y-6">
                {/* PICO Concepts */}
                {['population', 'intervention', 'comparison', 'outcome'].map((type) => {
                    const concept = concepts.find(c => c.type === type);
                    const label = type.charAt(0).toUpperCase() + type.slice(1);
                    
                    return (
                        <div key={type} className="rounded-lg border bg-white p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                                {!concept && (
                                    <button
                                        type="button"
                                        onClick={() => addConcept(type)}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded"
                                    >
                                        <PlusCircleIcon className="h-5 w-5" /> Add Concept
                                    </button>
                                )}
                            </div>
                            
                            {concept ? (
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        value={concept.name} 
                                        onChange={(e) => updateConceptName(concept.id, e.target.value)} 
                                        className="block w-full rounded-md border-gray-300 shadow-sm text-base" 
                                        placeholder={`e.g., "Healthcare Professionals"`} 
                                    />
                                    
                                    {concept.synonyms.map((synonym, index) => (
                                        <div key={index} className="flex items-center gap-x-3">
                                            <input 
                                                type="text" 
                                                value={synonym} 
                                                onChange={(e) => updateConceptSynonym(concept.id, index, e.target.value)} 
                                                className="block flex-1 rounded-md border-gray-300 shadow-sm text-sm" 
                                                placeholder={`Synonym ${index + 1}`} 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => removeConceptSynonym(concept.id, index)} 
                                                disabled={concept.synonyms.length <= 1}
                                                className="text-gray-400 hover:text-red-500 disabled:opacity-500 p-1 rounded hover:bg-gray-50 disabled:hover:bg-transparent"
                                                title="Remove synonym"
                                            >
                                                <MinusCircleIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        type="button" 
                                        onClick={() => addConceptSynonym(concept.id)} 
                                        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded"
                                    >
                                        <PlusCircleIcon className="h-5 w-5" /> Add Synonym
                                    </button>
                                    
                                    <button 
                                        type="button" 
                                        onClick={() => removeConcept(concept.id)} 
                                        className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded"
                                    >
                                        <TrashIcon className="h-5 w-5" /> Remove Concept
                                    </button>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">No {type} concept defined yet.</p>
                            )}
                        </div>
                    );
                })}

                {/* Custom Concepts */}
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">Custom Concepts</h3>
                    </div>
                    
                    {concepts.filter(c => c.type === 'custom').map((concept) => (
                        <div key={concept.id} className="border rounded-lg p-3 mb-3 bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                                <input 
                                    type="text" 
                                    value={concept.name} 
                                    onChange={(e) => updateConceptName(concept.id, e.target.value)} 
                                    className="block flex-1 rounded-md border-gray-300 shadow-sm text-base mr-2" 
                                    placeholder="Concept name" 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => removeConcept(concept.id)} 
                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                    title="Remove concept"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                            
                            {concept.synonyms.map((synonym, index) => (
                                <div key={index} className="flex items-center gap-x-3 mb-2">
                                    <input 
                                        type="text" 
                                        value={synonym} 
                                        onChange={(e) => updateConceptSynonym(concept.id, index, e.target.value)} 
                                        className="block flex-1 rounded-md border-gray-300 shadow-sm text-sm" 
                                        placeholder={`Synonym ${index + 1}`} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => removeConceptSynonym(concept.id, index)} 
                                        disabled={concept.synonyms.length <= 1}
                                        className="text-gray-400 hover:text-red-500 disabled:opacity-500 p-1 rounded hover:bg-gray-50 disabled:hover:bg-transparent"
                                        title="Remove synonym"
                                    >
                                        <MinusCircleIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                            
                            <button 
                                type="button" 
                                onClick={() => addConceptSynonym(concept.id)} 
                                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded"
                            >
                                <PlusCircleIcon className="h-5 w-5" /> Add Synonym
                            </button>
                        </div>
                    ))}
                    
                    <div className="flex items-center gap-x-2">
                        <input 
                            type="text" 
                            value={newConceptName} 
                            onChange={(e) => setNewConceptName(e.target.value)} 
                            className="block flex-1 rounded-md border-gray-300 shadow-sm text-sm" 
                            placeholder="New custom concept name" 
                        />
                        <button 
                            type="button" 
                            onClick={() => {
                                if (newConceptName.trim()) {
                                    addConcept('custom', newConceptName);
                                    setNewConceptName('');
                                }
                            }} 
                            disabled={!newConceptName.trim()}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded disabled:opacity-50"
                        >
                            <PlusCircleIcon className="h-5 w-5" /> Add Concept
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Research Question */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">Research Question</h3>
                </div>
                <textarea 
                    rows={3} 
                    value={researchQuestion} 
                    onChange={(e) => setResearchQuestion(e.target.value)} 
                    className="block w-full rounded-md border-gray-300 shadow-sm" 
                    placeholder="e.g., What is the effectiveness of mindfulness on anxiety in healthcare professionals?" 
                />
                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        onClick={handleGeneratePicoFromQuestion}
                        disabled={isLoading || !researchQuestion.trim()}
                        className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        {isLoading ? (
                            <>
                                <Spinner />
                                <span className="ml-2">Generating...</span>
                            </>
                        ) : (
                            <>
                                <MainSparklesIcon className="h-4 w-4 mr-2" />
                                Generate PICO Concepts
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Concepts Section */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">Review & Edit Concepts</h3>
                </div>
                <PicoBuilder 
                    state={{ researchQuestion, concepts, isLoading }}
                    actions={{ setResearchQuestion, setConcepts, handleGeneratePicoFromQuestion }}
                    showOnlyConcepts={true}
                />
            </div>
        </div>
    );
};

export default PicoBuilder;