import React from 'react';

const QueryComparisonDisplay = ({ comparisonResult, savedEntry, currentCount }) => {
    if (!comparisonResult || !comparisonResult.success) {
        return (
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                <p className="text-sm text-red-800">
                    Unable to compare queries. {comparisonResult?.error || 'Unknown error'}
                </p>
            </div>
        );
    }

    const { display, summary } = comparisonResult;

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                        Comparing with: <span className="text-indigo-600">{savedEntry?.name || 'Saved Query'}</span>
                    </h4>
                    <div className="text-xs text-gray-500">
                        {new Date(savedEntry?.date).toLocaleDateString()}
                    </div>
                </div>

                {/* Counts comparison */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-md p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Saved Query</div>
                        <div className="text-lg font-bold text-gray-900">
                            {savedEntry?.count !== undefined ? Number(savedEntry.count).toLocaleString() : 'N/A'}
                        </div>
                    </div>
                    <div className="bg-white rounded-md p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Current Query</div>
                        <div className="text-lg font-bold text-gray-900">
                            {currentCount !== undefined ? Number(currentCount).toLocaleString() : 'N/A'}
                        </div>
                    </div>
                    <div className="bg-white rounded-md p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Difference</div>
                        <div className="text-lg font-bold">
                            {(() => {
                                const saved = Number(savedEntry?.count);
                                const current = Number(currentCount);
                                if (isNaN(saved) || isNaN(current)) return 'N/A';
                                const diff = current - saved;
                                const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600';
                                return (
                                    <span className={color}>
                                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Summary badges */}
                <div className="flex flex-wrap gap-2">
                    {summary.unchanged > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {summary.unchanged} unchanged
                        </span>
                    )}
                    {summary.modified > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {summary.modified} modified
                        </span>
                    )}
                    {summary.added > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {summary.added} added
                        </span>
                    )}
                    {summary.removed > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {summary.removed} removed
                        </span>
                    )}
                </div>
            </div>

            {/* Detailed clause-by-clause comparison */}
            <div className="space-y-3">
                {display.map((section, idx) => (
                    <ClauseComparisonSection key={idx} section={section} />
                ))}
            </div>
        </div>
    );
};

const ClauseComparisonSection = ({ section }) => {
    if (section.type === 'unchanged') {
        return (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                        ✓ {section.label}
                    </span>
                </div>
                <div className="text-sm font-mono text-gray-700 bg-white p-3 rounded border">
                    {section.content}
                </div>
            </div>
        );
    }

    if (section.type === 'modified') {
        return (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800">
                        ↻ {section.label}
                    </span>
                    <span className="text-xs text-blue-700">
                        {Math.round(section.similarity * 100)}% similar
                    </span>
                </div>

                {/* Show common terms */}
                {section.common && section.common.length > 0 && (
                    <div className="mb-3">
                        <div className="text-xs font-medium text-gray-600 mb-1.5">Common terms:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {section.common.map((term, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-white text-gray-700 border border-gray-300">
                                    {term}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Show added terms */}
                {section.added && section.added.length > 0 && (
                    <div className="mb-3">
                        <div className="text-xs font-medium text-green-700 mb-1.5">Added terms:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {section.added.map((term, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800 border border-green-300 font-medium">
                                    + {term}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Show removed terms */}
                {section.removed && section.removed.length > 0 && (
                    <div className="mb-3">
                        <div className="text-xs font-medium text-red-700 mb-1.5">Removed terms:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {section.removed.map((term, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800 border border-red-300 line-through">
                                    − {term}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Expandable full text view */}
                <details className="mt-3">
                    <summary className="text-xs text-blue-700 cursor-pointer hover:text-blue-900 font-medium">
                        View full clause text
                    </summary>
                    <div className="mt-2 space-y-2">
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Saved:</div>
                            <div className="text-xs font-mono text-gray-700 bg-white p-2 rounded border">
                                {section.savedRaw}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Current:</div>
                            <div className="text-xs font-mono text-gray-700 bg-white p-2 rounded border">
                                {section.currentRaw}
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        );
    }

    if (section.type === 'added') {
        return (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800">
                        + {section.label}
                    </span>
                </div>
                <div className="text-sm font-mono text-green-900 bg-white p-3 rounded border border-green-300">
                    {section.content}
                </div>
                {section.terms && section.terms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {section.terms.map((term, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                {term}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (section.type === 'removed') {
        return (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-800">
                        − {section.label}
                    </span>
                </div>
                <div className="text-sm font-mono text-red-900 bg-white p-3 rounded border border-red-300 line-through">
                    {section.content}
                </div>
                {section.terms && section.terms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {section.terms.map((term, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                                {term}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default QueryComparisonDisplay;