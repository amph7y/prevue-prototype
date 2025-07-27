import React from 'react';
import { cn } from '../../utils/cn.js';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon, BookOpenIcon } from '../common/Icons.jsx';
import { CONCEPT_COLORS } from '../../config/constants.js';

const KeywordViewer = ({ state, actions }) => {
    const { keywords, pico } = state;
    const { setKeywords, setStep, showMenu } = actions;

    const handleKeywordToggle = (category, type, index) => {
        setKeywords(prev => {
            const updated = JSON.parse(JSON.stringify(prev));
            updated[category][type][index].active = !updated[category][type][index].active;
            return updated;
        });
    };

    return (
        <div className="mt-10">
            <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />Back</button>
                <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700">Build Queries<ArrowUturnRightIcon className="h-5 w-5" /></button>
            </div>
            <h2 className="text-2xl font-bold mt-8">2. Review & Refine Keywords</h2>
            <p className="mt-2 text-gray-600">Click to toggle terms. Right-click for more options.</p>

            <div className="mt-6 space-y-8">
                {Object.entries(keywords).map(([key, data]) => (
                    <div key={key} className="rounded-lg border bg-white p-4 shadow-sm">
                        <h3 className="text-lg font-semibold capitalize">{key}</h3>
                        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="font-medium text-gray-600">Keywords</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {data.keywords.map((kw, i) => (
                                        <button key={i} onClick={() => handleKeywordToggle(key, 'keywords', i)} onContextMenu={(e) => showMenu(e, [{ label: 'Find Synonyms', icon: <BookOpenIcon className="h-4 w-4" />, action: () => { } }])} className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', kw.active ? CONCEPT_COLORS[i % CONCEPT_COLORS.length] : 'bg-gray-100 text-gray-600 line-through')}>
                                            {kw.term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-600">Controlled Vocabulary</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {/* Placeholder for controlled vocabulary */}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KeywordViewer;