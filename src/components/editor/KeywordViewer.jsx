import React from 'react';
import { cn } from '../../utils/cn.js';
import { BookOpenIcon } from '../common/Icons.jsx';
import { CONCEPT_COLORS } from '../../config/constants.js';

const KeywordViewer = ({ state, actions }) => {
    const { keywords, pico } = state;
    const { setKeywords, setStep, showMenu, findSynonyms, handleAddKeyword } = actions;

    const handleKeywordToggle = (category, type, index) => {
        setKeywords(prev => {
            const updated = JSON.parse(JSON.stringify(prev));
            updated[category][type][index].active = !updated[category][type][index].active;
            return updated;
        });
    };

    const handleAddKeywordFromInput = (e, category, type) => {
        if (e.key === 'Enter' && e.target.value.trim() !== '') {
            e.preventDefault();
            handleAddKeyword(e.target.value.trim(), category, type, 'manual');
            e.target.value = '';
        }
    };

    return (
        <div className="mt-10">
            <h2 className="text-2xl font-bold mt-8">Review & Refine Keywords</h2>
            <p className="mt-2 text-gray-600">Click to toggle terms. Right-click for synonyms. Add your own terms by typing and pressing Enter.</p>

            <div className="mt-6 space-y-8">
                {keywords && Object.entries(keywords).map(([category, data]) => (
                    <div key={category} className="rounded-lg border bg-white p-4 shadow-sm">
                        <h3 className="text-lg font-semibold capitalize">{pico[category.charAt(0)][0] || category}</h3>
                        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="font-medium text-gray-600">Keywords</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {data.keywords.map((kw, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleKeywordToggle(category, 'keywords', i)} 
                                            onContextMenu={(e) => showMenu(e, [{ label: 'Find Synonyms', icon: <BookOpenIcon className="h-4 w-4" />, action: () => findSynonyms(kw.term, { category, type: 'keywords' }) }])} 
                                            className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', kw.active ? CONCEPT_COLORS[i % CONCEPT_COLORS.length] : 'bg-gray-100 text-gray-600 line-through')}
                                        >
                                            {kw.term}
                                        </button>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    onKeyDown={(e) => handleAddKeywordFromInput(e, category, 'keywords')} 
                                    placeholder="Add keyword and press Enter" 
                                    className="mt-3 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" 
                                />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-600">Controlled Vocabulary</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {data.controlled_vocabulary.map((vocab, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleKeywordToggle(category, 'controlled_vocabulary', i)}
                                            onContextMenu={(e) => showMenu(e, [{ label: 'Find Synonyms', icon: <BookOpenIcon className="h-4 w-4"/>, action: () => findSynonyms(vocab.term, {category, type: 'controlled_vocabulary'}) }])}
                                            className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', vocab.active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600 line-through')}
                                        >
                                            {vocab.term} <span className="ml-1.5 text-xs opacity-70">({vocab.type})</span>
                                        </button>
                                    ))}
                                </div>
                                 <input 
                                    type="text" 
                                    onKeyDown={(e) => handleAddKeywordFromInput(e, category, 'controlled_vocabulary')} 
                                    placeholder="Add vocab term and press Enter" 
                                    className="mt-3 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" 
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KeywordViewer;