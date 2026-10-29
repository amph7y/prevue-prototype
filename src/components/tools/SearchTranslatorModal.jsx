import React, { useEffect, useRef } from 'react';
import SearchTranslator from './SearchTranslator.jsx';

// The Search Translator in a window over the project, opened from Step 2 with the project's PubMed search
const SearchTranslatorModal = ({ initialQuery = '', onClose, onRequireLogin = null }) => {
    const closeRef = useRef(null);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        if (closeRef.current) closeRef.current.focus();
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 p-4" data-testid="search-translator-modal">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="search-translator-modal-title"
                className="relative mx-auto my-8 w-full max-w-5xl rounded-lg bg-white p-6 shadow-xl"
            >
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close the Search Translator"
                    className="absolute right-4 top-4 rounded-md px-2 py-1 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                    ×
                </button>
                <SearchTranslator initialQuery={initialQuery} titleId="search-translator-modal-title" isPage={false} onRequireLogin={onRequireLogin} />
            </div>
        </div>
    );
};

export default SearchTranslatorModal;
