import React from 'react';
import { XCircleIcon, DownloadIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon, ArrowPathIcon } from './Icons.jsx';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';

function DownloadCenter() {
    const { 
        downloads, 
        isOpen, 
        setIsOpen, 
        downloadFile, 
        removeDownload, 
        cleanupOldDownloads, 
        getStorageInfo,
        retryDownload
    } = useGlobalDownload();
    if (!isOpen) return null;

    const formatStatus = (status) => {
        switch (status) {
            case 'processing': return { icon: <ClockIcon className="h-5 w-5 text-blue-500" />, text: 'Processing', color: 'text-blue-600' };
            case 'completed': return { icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />, text: 'Complete', color: 'text-green-600' };
            case 'partial': return { icon: <ExclamationCircleIcon className="h-5 w-5 text-orange-500" />, text: 'Partial', color: 'text-orange-600' };
            case 'failed': return { icon: <ExclamationCircleIcon className="h-5 w-5 text-red-500" />, text: 'Failed', color: 'text-red-600' };
            default: return { icon: <ClockIcon className="h-5 w-5 text-gray-500" />, text: 'Unknown', color: 'text-gray-600' };
        }
    };

    const formatDuration = (startTime, completedTime) => {
        if (!startTime || !completedTime) return '';
        const duration = Math.round((completedTime - startTime) / 1000);
        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.round(duration / 60)}m ${duration % 60}s`;
        return `${Math.round(duration / 3600)}h ${Math.round((duration % 3600) / 60)}m`;
    };

    const formatFileSize = (blob) => {
        if (!blob) return '';
        const size = blob.size;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    const formatCreationTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now'; // Less than 1 minute
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; // Less than 1 hour
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; // Less than 1 day
        
        // Same day
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Different day
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Download Center</h3>
                            <p className="text-sm text-gray-500 mt-1">Background exports and downloads</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <XCircleIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                    {downloads.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <DownloadIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No downloads yet</p>
                            <p className="text-sm">Start a full dataset export to see progress here</p>
                        </div>
                    ) : (
                        <div className="p-6 space-y-4">
                            {downloads.map((download) => {
                                const statusInfo = formatStatus(download.status);
                                const duration = formatDuration(download.startTime, download.completedTime);
                                const fileSize = formatFileSize(download.fileBlob);
                                const creationTime = formatCreationTime(download.startTime);
                                
                                return (
                                    <div key={download.id} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    {statusInfo.icon}
                                                    <h4 className="font-medium text-gray-900">{download.name}</h4>
                                                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                                                        {statusInfo.text}
                                                    </span>
                                                    <span className="text-xs text-gray-500 ml-auto">
                                                        {creationTime}
                                                    </span>
                                                </div>
                                                
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    <p>Format: {download.format.toUpperCase()}</p>
                                                    {download.totalRecords > 0 && (
                                                        <p>Records: {download.processedRecords?.toLocaleString() || 0} / {download.totalRecords.toLocaleString()}</p>
                                                    )}
                                                    {download.status === 'partial' && download.expectedCount && (
                                                        <p className="text-orange-600">
                                                            Downloaded {download.articleCount?.toLocaleString() || 0} of {download.expectedCount.toLocaleString()} expected
                                                        </p>
                                                    )}
                                                    {duration && <p>Duration: {duration}</p>}
                                                    {fileSize && <p>Size: {fileSize}</p>}
                                                    {download.error && (
                                                        <div className="text-red-600">
                                                            <p>Error: {download.error}</p>
                                                            {download.failedAt && (
                                                                <p className="text-xs text-red-500 mt-1">
                                                                    Failed at {download.failedAt.database} record {download.failedAt.offset.toLocaleString()}
                                                                    {download.articleCount > 0 && ` • ${download.articleCount.toLocaleString()} articles downloaded before failure`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {download.status === 'processing' && (
                                                    <div className="mt-3">
                                                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                            <span>Progress</span>
                                                            <span>{Math.round(download.progress || 0)}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div 
                                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
                                                                style={{ width: `${download.progress || 0}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex items-center mt-2 text-xs text-gray-500">
                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                                                            <span>Downloading articles...</span>
                                                        </div>
                                                        {download.processedRecords > 0 && (
                                                            <p className="text-xs text-blue-600 mt-1 font-medium">
                                                                {download.processedRecords.toLocaleString()} articles downloaded so far
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center space-x-2 ml-4">
                                                {/* Show download button for completed, partial, or failed downloads with partial data */}
                                                {(download.status === 'completed' || download.status === 'partial' || (download.status === 'failed' && download.articleCount > 0)) && (
                                                    <button
                                                        onClick={() => downloadFile(download.id)}
                                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    >
                                                        <DownloadIcon className="h-4 w-4 mr-2" />
                                                        Download
                                                    </button>
                                                )}
                                                {/* Show retry button for failed downloads or partial downloads */}
                                                {(download.status === 'failed' || download.status === 'partial') && retryDownload && (
                                                    <button
                                                        onClick={() => retryDownload(download.id)}
                                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                    >
                                                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                                                        Retry
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeDownload(download.id)}
                                                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            <p>• Large exports are processed in the background</p>
                            <p>• You can continue using the app while exports run</p>
                            <p>• Completed files are ready for download</p>
                        </div>
                        {(() => {
                            const storageInfo = getStorageInfo();
                            return storageInfo && (
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 mb-2">
                                        Files: {storageInfo.completed}/{storageInfo.maxCompleted} max 
                                        ({storageInfo.totalSize > 0 ? formatFileSize({ size: storageInfo.totalSize }) : '0 B'})
                                    </div>
                                    <div className="text-xs text-gray-400 mb-2">
                                        {storageInfo.maxAge}
                                    </div>
                                    {cleanupOldDownloads && storageInfo.completed > 3 && (
                                        <button
                                            onClick={cleanupOldDownloads}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                                        >
                                            Clean up to 3 files
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DownloadCenter;
