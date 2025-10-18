import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { EXPORT_CAPS } from '../../config/exportConfig.js';
import { XCircleIcon } from './Icons.jsx';
import { cn } from '../../utils/cn.js';
import logger from '../../utils/logger.js';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';

function ExportModal({ onClose, onExport, allArticles, hasDeduplicated }) {
    const availableDBs = [...new Set(allArticles.map(a => a.sourceDB))];
    const { userAccessLevel } = useAuth();
    const capabilities = getCapabilities(userAccessLevel);
    const isPremium = capabilities.maxDatabases === Infinity || capabilities.canUseAiProject;

    const [selectedExportDBs, setSelectedExportDBs] = useState(() =>
        availableDBs.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );
    const [includeDuplicates, setIncludeDuplicates] = useState(false);
    const [exportMode, setExportMode] = useState('capped'); // 'capped' | 'full'

    const handleExport = async (format) => {
        const options = {
            selectedDBs: Object.keys(selectedExportDBs).filter(key => selectedExportDBs[key]),
            includeDuplicates,
            exportFullDataset: exportMode === 'full',
            exportQuotaPercent: isPremium ? 1 : 0.5
        };
        
        try {
            // Log export initiation
            await logger.logExportInitiated(null, {
                format,
                selectedDBs: options.selectedDBs,
                includeDuplicates,
                exportFullDataset: options.exportFullDataset,
                totalArticles: allArticles.length
            });
            
            await onExport(format, options);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[9999] flex justify-center items-center p-4 overflow-auto" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-gray-900">Export Options</h3>
                        <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    {!isPremium && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">
                                        Free Account Limitation
                                    </h3>
                                    <div className="mt-1 text-sm text-yellow-700">
                                        <p>You can export up to 50% of available records from selected databases. Upgrade to Premium for unlimited exports.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                                                onChange={(e) => {
                                                    const next = e.target.checked;
                                                    setSelectedExportDBs(prev => ({ ...prev, [dbKey]: next }));
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            />
                                        </div>
                                        <div className="ml-3 text-sm leading-6">
                                            <label htmlFor={`export-${dbKey}`} className="font-medium text-gray-900">{DB_CONFIG[dbKey]?.name || dbKey}</label>
                                            <p className="text-xs text-gray-500 mt-1">
                                                📊 Cap: {EXPORT_CAPS[dbKey]?.toLocaleString() || 'No limit'} records
                                                {!isPremium && (
                                                    <span className="text-red-500"> • Free: 50% limit</span>
                                                )}
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

                        <fieldset className="mt-2">
                            <legend className="sr-only">Export size</legend>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="radio" name="export-size" value="capped" checked={exportMode === 'capped'} onChange={() => setExportMode('capped')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" />
                                    <span className="font-medium text-gray-900">Capped export (faster, per-DB limits)</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="radio" name="export-size" value="full" checked={exportMode === 'full'} onChange={() => setExportMode('full')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" />
                                    <span className="font-medium text-gray-900">Full dataset (all available records)</span>
                                </label>
                                <p className="text-xs text-orange-600 mt-1 font-medium">
                                    📋 Note: Capped export limits per DB (PubMed: 250, Scopus/Embase: 250, Core: 1000). Full dataset fetches all available results.
                                </p>
                                {!isPremium && (
                                    <p className="text-xs text-red-600 mt-1 font-medium">
                                        ⚠️ Free users are limited to 50% of available records from selected databases.
                                    </p>
                                )}
                            </div>
                        </fieldset>
                    </div>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-b-lg border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button 
                        onClick={() => handleExport('ris')} 
                        className="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-main px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-main-dark"
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