import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { BookOpenIcon } from '../common/Icons.jsx';
import { UNIFIED_SEARCH_FIELDS } from '../../config/dbConfig.js';

const ConceptKeywordViewer = ({ concepts, actions }) => {
    const { setConcepts, showMenu, findSynonyms } = actions;
    const [manageModal, setManageModal] = useState({ open: false, conceptId: null, type: 'keywords' });
    const [internalConceptListModal, setInternalConceptListModal] = useState(false);
    const conceptListModal = actions?.conceptListModal ?? internalConceptListModal;
    const setConceptListModal = actions?.setConceptListModal ?? setInternalConceptListModal;

    const getSearchFieldOptions = () => {
        return Object.entries(UNIFIED_SEARCH_FIELDS).map(([value, label]) => ({
            value: parseInt(value),
            label
        }));
    };

    const getCategoryLabel = (type) => {
        const labels = {
            'population': 'Population',
            'intervention': 'Intervention', 
            'comparison': 'Comparison',
            'outcome': 'Outcome',
            'custom': 'Custom Concept'
        };
        return labels[type] || type;
    };

    const handleKeywordToggle = (conceptId, type, index) => {
        setConcepts(prev => prev.map(concept => {
            if (concept.id === conceptId) {
                const updatedConcept = { ...concept };
                if (type === 'keywords') {
                    updatedConcept.keywords = [...concept.keywords];
                    updatedConcept.keywords[index] = { ...updatedConcept.keywords[index], active: !updatedConcept.keywords[index].active };
                } else if (type === 'controlled_vocabulary') {
                    updatedConcept.controlled_vocabulary = [...concept.controlled_vocabulary];
                    updatedConcept.controlled_vocabulary[index] = { ...updatedConcept.controlled_vocabulary[index], active: !updatedConcept.controlled_vocabulary[index].active };
                }
                return updatedConcept;
            }
            return concept;
        }));
    };

    const handleSearchFieldChange = (conceptId, type, index, value) => {
        setConcepts(prev => prev.map(concept => {
            if (concept.id === conceptId && type === 'keywords') {
                const updatedConcept = { ...concept };
                updatedConcept.keywords = [...concept.keywords];
                updatedConcept.keywords[index] = { ...updatedConcept.keywords[index], searchField: parseInt(value) };
                return updatedConcept;
            }
            return concept;
        }));
    };

    const handleAddKeywordFromInput = (e, conceptId, type) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            const newTerm = e.target.value.trim();
            setConcepts(prev => prev.map(concept => {
                if (concept.id === conceptId) {
                    const updatedConcept = { ...concept };
                    if (type === 'keywords') {
                        updatedConcept.keywords = [...concept.keywords, {
                            term: newTerm,
                            active: true,
                            source: 'manual',
                            searchField: 4 // Default to All Fields
                        }];
                    } else if (type === 'controlled_vocabulary') {
                        updatedConcept.controlled_vocabulary = [...concept.controlled_vocabulary, {
                            term: newTerm,
                            type: 'manual',
                            active: true,
                            source: 'manual'
                        }];
                    }
                    return updatedConcept;
                }
                return concept;
            }));
            e.target.value = '';
        }
    };

    const MAX_VISIBLE_CHIPS = 8;

    const openManageModal = (concept, type) => {
        setConceptListModal(false);
        setManageModal({ open: true, conceptId: concept.id, type });
    };

    const closeManageModal = () => setManageModal({ open: false, conceptId: null, type: 'keywords' });

    const renderChips = (items, concept, type) => {
        const visible = items.map((item, originalIndex) => ({ item, originalIndex })).slice(0, MAX_VISIBLE_CHIPS);
        const remaining = items.length - visible.length;
        return (
            <div className="flex flex-wrap gap-2 items-center">
                {visible.map(({ item, originalIndex }) => (
                    <div
                        key={originalIndex}
                        className={cn(
                            'inline-flex items-center gap-1 pl-2 pr-2.5 py-1 text-xs rounded-full border transition-colors',
                            type === 'keywords' ? (item.active ? 'bg-main/10 border-main text-main' : 'bg-gray-100 border-gray-300 text-gray-500') : (item.active ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-gray-100 border-gray-300 text-gray-500')
                        )}
                        title={item.term}
                    >
                        {(() => {
                            const checkboxId = `chip-${concept.id}-${type}-${originalIndex}`;
                            return (
                                <label htmlFor={checkboxId} className="inline-flex items-center cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={!!item.active}
                                onChange={() => handleKeywordToggle(concept.id, type, originalIndex)}
                                className="sr-only"
                                id={checkboxId}
                            />
                            <span
                                className={cn(
                                    'inline-flex items-center justify-center h-4 w-4 rounded-sm border-2 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-main/40',
                                    type === 'keywords'
                                        ? (item.active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300')
                                        : (item.active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300')
                                )}
                                aria-hidden="true"
                            >
                                {item.active && (
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </span>
                                </label>
                            );
                        })()}
                        <span className={cn(item.active ? '' : 'line-through')}>{item.term}</span>
                    </div>
                ))}
                {remaining > 0 && (
                    <button
                        type="button"
                        onClick={() => openManageModal(concept, type)}
                        className="px-2.5 py-1 text-xs rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                        +{remaining} more
                    </button>
                )}

            </div>
        );
    };


    return (
        <div className="mt-10">
            <div className="mt-6 space-y-8">
                {concepts.map((concept) => {
                    if (!concept.keywords || concept.keywords.length === 0) return null;
                    
                    return (
                        <div key={concept.id} className="rounded-lg border bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-800">
                                        {concept.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {getCategoryLabel(concept.type)}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* Keywords Section (compact chips) */}
                                <div>
                                    <div className="flex items-center mb-2">
                                        <h4 className="font-medium text-gray-700 flex items-center">
                                            <span className="w-2 h-2 bg-main rounded-full mr-2"></span>
                                            Keywords
                                        </h4>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2 mt-1">
                                        💡 Use <strong>Edit Keywords</strong> to customize and configure keywords
                                    </p>
                                    {renderChips(concept.keywords, concept, 'keywords')}
                                </div>

                                {/* Controlled Vocabulary Section (compact chips) */}
                                <div>
                                    <div className="flex items-center mb-2">
                                        <h4 className="font-medium text-gray-700 flex items-center">
                                            <span className="w-2 h-2 bg-teal-500 rounded-full mr-2"></span>
                                            Controlled Vocabulary
                                        </h4>
                                    </div>
                                    {/* <p className="text-xs text-gray-500 mb-2 mt-1">
                                        💡 Use <strong>Manage All Concepts</strong> to customize and configure controlled vocabulary
                                    </p> */}
                                    {renderChips(concept.controlled_vocabulary, concept, 'controlled_vocabulary')}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Concept List Modal */}
            {conceptListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setConceptListModal(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl mx-4 rounded-lg shadow-lg">
                        <div className="px-5 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Select a Concept to Manage</h3>
                            <button onClick={() => setConceptListModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-5 max-h-[70vh] overflow-auto">
                            <div className="space-y-3">
                                {concepts.filter(c => c.keywords?.length > 0).map((concept) => (
                                    <div key={concept.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="font-semibold text-gray-800">{concept.name}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{getCategoryLabel(concept.type)}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openManageModal(concept, 'keywords')}
                                                className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-main/10 border border-main text-main hover:bg-main/20 transition-colors"
                                            >
                                                Edit Keywords ({concept.keywords?.length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openManageModal(concept, 'controlled_vocabulary')}
                                                className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-teal-50 border border-teal-300 text-teal-700 hover:bg-teal-100 transition-colors"
                                            >
                                                Edit Vocabulary ({concept.controlled_vocabulary?.length || 0})
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t flex justify-end">
                            <button onClick={() => setConceptListModal(false)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {manageModal.open && manageModal.conceptId && (() => {
                const activeConcept = concepts.find(c => c.id === manageModal.conceptId);
                if (!activeConcept) return null;
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={closeManageModal}></div>
                    <div className="relative bg-white w-full max-w-3xl mx-4 rounded-lg shadow-lg">
                        <div className="px-5 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Manage {manageModal.type === 'keywords' ? 'Keywords' : 'Controlled Vocabulary'} — {activeConcept.name}</h3>
                            <button onClick={closeManageModal} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-5 max-h-[70vh] overflow-auto">
                            {manageModal.type === 'keywords' ? (
                                <div className="space-y-3">
                                    {activeConcept.keywords.map((kw, i) => (
                                        <div key={i} className="flex items-center gap-x-3 p-3 bg-gray-50 rounded-lg">
                                            <label className="flex-1 flex items-center gap-x-3 cursor-pointer select-none">
                                                <input type="checkbox" checked={kw.active} onChange={() => handleKeywordToggle(activeConcept.id, 'keywords', i)} className="sr-only" />
                                                <span className={cn('inline-flex items-center justify-center h-5 w-5 rounded-sm border-2 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-600/30', kw.active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300')} aria-hidden="true">
                                                    {kw.active && (
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </span>
                                                            <div 
                                                                onContextMenu={(e) => showMenu(e, [{ label: 'Find Synonyms', icon: <BookOpenIcon className="h-4 w-4" />, action: () => findSynonyms(kw.term, { conceptId: activeConcept.id, type: 'keywords' }) }])}
                                                    className={cn('flex-1 text-left px-3 py-2 rounded border transition-colors', kw.active ? 'bg-white border-main shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-500 line-through')}
                                                >
                                                    {kw.term}
                                                </div>
                                            </label>
                                            <select
                                                value={kw.searchField || 4}
                                                onChange={(e) => handleSearchFieldChange(activeConcept.id, 'keywords', i, e.target.value)}
                                                disabled={!kw.active}
                                                className={cn("px-2 py-1 text-sm border border-gray-300 rounded", kw.active ? "bg-white cursor-pointer" : "bg-gray-100 cursor-not-allowed text-gray-400")}
                                            >
                                                {getSearchFieldOptions().map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                    <div className="mt-3">
                                        <input type="text" onKeyDown={(e) => handleAddKeywordFromInput(e, activeConcept.id, 'keywords')} placeholder="Add keyword and press Enter" className="block w-full rounded-md border-gray-300 shadow-sm text-sm" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activeConcept.controlled_vocabulary.map((vocab, i) => (
                                        <div key={i} className="flex items-center gap-x-3 p-3 bg-gray-50 rounded-lg">
                                            <label className="flex-1 flex items-center gap-x-3 cursor-pointer select-none">
                                                <input type="checkbox" checked={vocab.active} onChange={() => handleKeywordToggle(activeConcept.id, 'controlled_vocabulary', i)} className="sr-only" />
                                                <span className={cn('inline-flex items-center justify-center h-5 w-5 rounded-sm border-2 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-600/30', vocab.active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300')} aria-hidden="true">
                                                    {vocab.active && (
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </span>
                                                            <div 
                                                                onContextMenu={(e) => showMenu(e, [{ label: 'Find Synonyms', icon: <BookOpenIcon className="h-4 w-4"/>, action: () => findSynonyms(vocab.term, {conceptId: activeConcept.id, type: 'controlled_vocabulary'}) }])}
                                                    className={cn('flex-1 text-left px-3 py-2 rounded border transition-colors', vocab.active ? 'bg-white border-teal-300 text-teal-800 shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-500 line-through')}
                                                >
                                                    <span>{vocab.term}</span>
                                                    <span className="ml-2 text-xs opacity-70">({vocab.type})</span>
                                                </div>
                                            </label>
                                            <div className="px-2 py-1 text-xs text-gray-500 bg-gray-200 rounded">Auto</div>
                                        </div>
                                    ))}
                                    <div className="mt-3">
                                        <input type="text" onKeyDown={(e) => handleAddKeywordFromInput(e, activeConcept.id, 'controlled_vocabulary')} placeholder="Add vocab term and press Enter" className="block w-full rounded-md border-gray-300 shadow-sm text-sm" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t flex justify-end">
                            <button onClick={closeManageModal} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default ConceptKeywordViewer;