import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { EXPORT_CAPS } from '../../config/exportConfig.js';
import { XCircleIcon } from './Icons.jsx';
import { cn } from '../../utils/cn.js';

function ExportModal({ onClose, onExport, allArticles, hasDeduplicated }) {
    const availableDBs = [...new Set(allArticles.map(a => a.sourceDB))];
    const [selectedExportDBs, setSelectedExportDBs] = useState(() =>
        availableDBs.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );
    const [includeDuplicates, setIncludeDuplicates] = useState(false);
    const [exportFullDataset, setExportFullDataset] = useState(false);

    const handleExport = async (format) => {
        const options = {
            selectedDBs: Object.keys(selectedExportDBs).filter(key => selectedExportDBs[key]),
            includeDuplicates,
            exportFullDataset
        };
        
        try {
            await onExport(format, options);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-gray-900">Export Options</h3>
                        <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-md font-semibold text-gray-800">Databases to Include</h4>
                        <fieldset className="mt-2">
                            <div className="space-y-2">
                                {availableDBs.map(dbKey => (
                                    <div key={dbKey} className="relative flex items-start">
                                        <div className="flex h-6 items-center">
                                            <input
                                                id={`export-${dbKey}`} type="checkbox"
                                                checked={!!selectedExportDBs[dbKey]}
                                                onChange={(e) => setSelectedExportDBs(prev => ({ ...prev, [dbKey]: e.target.checked }))}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            />
                                        </div>
                                        <div className="ml-3 text-sm leading-6">
                                            <label htmlFor={`export-${dbKey}`} className="font-medium text-gray-900">{DB_CONFIG[dbKey]?.name || dbKey}</label>
                                            <p className="text-xs text-gray-500 mt-1">
                                                📊 Cap: {EXPORT_CAPS[dbKey]?.toLocaleString() || 'No limit'} records
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    </div>
                    <div>
                        <h4 className="text-md font-semibold text-gray-800">Content Filters</h4>
                        <div className="relative flex items-start mt-2">
                            <div className="flex h-6 items-center">
                                <input id="exclude-duplicates" type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} disabled className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="exclude-duplicates" className="font-medium text-gray-400">
                                    Exclude duplicates (disabled)
                                </label>
                            </div>
                        </div>

                        <div className="relative flex items-start mt-2">
                            <div className="flex h-6 items-center">
                                <input id="export-full-dataset" type="checkbox" checked={exportFullDataset} onChange={(e) => setExportFullDataset(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="export-full-dataset" className="font-medium text-gray-900">
                                    Export full dataset (all available records)
                                </label>
                                <p className="text-xs text-orange-600 mt-1 font-medium">
                                    📋 Note: Export caps apply (PubMed: 250, Scopus/Embase: 250, Core: 1000 records)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-b-lg border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button 
                        onClick={() => handleExport('ris')} 
                        className="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
                    >
                        RIS
                    </button>
                    <button 
                        onClick={() => handleExport('csv')} 
                        className="w-full inline-flex justify-center items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                        CSV
                    </button>
                    <button 
                        onClick={() => handleExport('printable')} 
                        className="w-full inline-flex justify-center items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                        Printable
                    </button>
                </div>
            </div>
        </div>
    );
}

ExportModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onExport: PropTypes.func.isRequired,
    allArticles: PropTypes.arrayOf(PropTypes.object).isRequired,
    hasDeduplicated: PropTypes.bool.isRequired,
};

export default ExportModal;