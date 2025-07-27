import React from 'react';
import { XCircleIcon } from '../common/Icons.jsx';

const SearchHistoryPanel = ({ isOpen, onClose, history }) => {
    return (
        <div className={`fixed inset-y-0 right-0 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-40 w-full max-w-md bg-white shadow-lg flex flex-col`}>
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Search History</h2>
                <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {history.length === 0 ? (
                    <p className="text-sm text-gray-500">No searches yet.</p>
                ) : (
                    <p>{history.length} searches found.</p>
                )}
            </div>
        </div>
    );
};

export default SearchHistoryPanel;