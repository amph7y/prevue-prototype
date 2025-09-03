import React from 'react';
import { cn } from '../../utils/cn.js';
import { BookOpenIcon } from '../common/Icons.jsx';
import { UNIFIED_SEARCH_FIELDS } from '../../config/dbConfig.js';

const ConceptKeywordViewer = ({ concepts, actions }) => {
    const { setConcepts, showMenu, findSynonyms } = actions;

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
                            
                            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                                {/* Keywords Section */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                        Keywords
                                    </h4>
                                    <div className="space-y-3">
                                        {concept.keywords.map((kw, i) => (
                                            <div key={i} className="flex items-center gap-x-3 p-3 bg-gray-50 rounded-lg">
                                                <button 
                                                    onClick={() => handleKeywordToggle(concept.id, 'keywords', i)} 
                                                    onContextMenu={(e) => showMenu(e, [{ 
                                                        label: 'Find Synonyms', 
                                                        icon: <BookOpenIcon className="h-4 w-4" />, 
                                                        action: () => findSynonyms(kw.term, { conceptId: concept.id, type: 'keywords' }) 
                                                    }])} 
                                                    className={cn(
                                                        'flex-1 text-left px-3 py-2 rounded border transition-colors',
                                                        kw.active 
                                                            ? 'bg-white border-blue-300 text-blue-800 shadow-sm' 
                                                            : 'bg-gray-100 border-gray-200 text-gray-500 line-through'
                                                    )}
                                                >
                                                    {kw.term}
                                                </button>
                                                
                                                <select
                                                    value={kw.searchField || 4}
                                                    onChange={(e) => handleSearchFieldChange(concept.id, 'keywords', i, e.target.value)}
                                                    className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                                                >
                                                    {getSearchFieldOptions().map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                        
                                        <div className="mt-3">
                                            <input 
                                                type="text" 
                                                onKeyDown={(e) => handleAddKeywordFromInput(e, concept.id, 'keywords')} 
                                                placeholder="Add keyword and press Enter" 
                                                className="block w-full rounded-md border-gray-300 shadow-sm text-sm" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Controlled Vocabulary Section */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                                        <span className="w-2 h-2 bg-teal-500 rounded-full mr-2"></span>
                                        Controlled Vocabulary
                                    </h4>
                                    <div className="space-y-3">
                                        {concept.controlled_vocabulary.map((vocab, i) => (
                                            <div key={i} className="flex items-center gap-x-3 p-3 bg-gray-50 rounded-lg">
                                                <button 
                                                    onClick={() => handleKeywordToggle(concept.id, 'controlled_vocabulary', i)}
                                                    onContextMenu={(e) => showMenu(e, [{ 
                                                        label: 'Find Synonyms', 
                                                        icon: <BookOpenIcon className="h-4 w-4"/>, 
                                                        action: () => findSynonyms(vocab.term, {conceptId: concept.id, type: 'controlled_vocabulary'}) 
                                                    }])}
                                                    className={cn(
                                                        'flex-1 text-left px-3 py-2 rounded border transition-colors',
                                                        vocab.active 
                                                            ? 'bg-white border-teal-300 text-teal-800 shadow-sm' 
                                                            : 'bg-gray-100 border-gray-200 text-gray-500 line-through'
                                                    )}
                                                >
                                                    <span>{vocab.term}</span>
                                                    <span className="ml-2 text-xs opacity-70">({vocab.type})</span>
                                                </button>
                                                
                                                {/* Controlled vocabulary terms don't need search field selection as they use their specific syntax */}
                                                <div className="px-2 py-1 text-xs text-gray-500 bg-gray-200 rounded">
                                                    Auto
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <div className="mt-3">
                                            <input 
                                                type="text" 
                                                onKeyDown={(e) => handleAddKeywordFromInput(e, concept.id, 'controlled_vocabulary')} 
                                                placeholder="Add vocab term and press Enter" 
                                                className="block w-full rounded-md border-gray-300 shadow-sm text-sm" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConceptKeywordViewer;
