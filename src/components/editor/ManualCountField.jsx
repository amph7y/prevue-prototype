import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../utils/clipboard.js';
import { countIsOutdated, parseCountInput } from '../../utils/manualCounts.js';
import { databaseLink, GOOGLE_SCHOLAR_MAX_CHARS } from '../../utils/databaseLinks.js';

const formatDate = (iso) => {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// One database's hand-entered count, plus a link to run the search on the database's own website.
//   entry: the saved count ({ count, enteredAt, queryKey }) or undefined
//   onSave(dbKey, count): count is a whole number, or null to remove it
const ManualCountField = ({ dbKey, dbName, query, entry, onSave }) => {
    const savedText = entry ? String(entry.count) : '';
    const [draft, setDraft] = useState(savedText);
    const [error, setError] = useState('');
    const inputId = `manual-count-${dbKey}`;
    const outdated = countIsOutdated(entry, query);
    const link = databaseLink(dbKey, query);
    const savedOn = entry ? formatDate(entry.enteredAt) : '';

    const save = () => {
        const { value, error: problem } = parseCountInput(draft);
        if (problem) {
            setError(problem);
            return;
        }
        setError('');
        onSave(dbKey, value);
        setDraft(value === null ? '' : String(value));
        toast.success(value === null ? `Your ${dbName} count was removed.` : `Saved your ${dbName} count.`);
    };

    // Databases that can't take the query in the link: copy it, so it can be pasted there
    const handleOpen = () => {
        if (link && !link.prefilled && query) copyToClipboard(query);
    };

    return (
        <div className="mt-3 border-t border-gray-100 pt-3" data-testid={`manual-count-${dbKey}`}>
            <label htmlFor={inputId} className="block text-xs font-medium text-gray-600">
                Your count from {dbName}
            </label>
            <div className="mt-1 flex items-center gap-2">
                <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={20}
                    value={draft}
                    placeholder="e.g. 1,234"
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setError('');
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            save();
                        }
                    }}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className="block w-28 rounded-md border-gray-300 py-1 text-sm shadow-sm"
                />
                <button
                    type="button"
                    onClick={save}
                    disabled={draft.trim() === savedText}
                    className="rounded-md bg-main px-2.5 py-1 text-xs font-medium text-white hover:bg-main-dark disabled:bg-main/40"
                >
                    {draft.trim() === '' && entry ? 'Remove' : 'Save'}
                </button>
            </div>
            {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
            {entry && !error && (
                <p className="mt-1 text-xs text-gray-500">{savedOn ? `Saved ${savedOn}` : 'Saved'}</p>
            )}
            {outdated && (
                <p className="mt-1 text-xs text-amber-700" data-testid={`manual-count-outdated-${dbKey}`}>
                    The query has changed since you entered this count. Run it again and update the number.
                </p>
            )}
            {link && (
                <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleOpen}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-main hover:underline"
                    data-testid={`database-link-${dbKey}`}
                >
                    Open in {dbName}
                    <span aria-hidden="true">↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                </a>
            )}
            {link && !link.prefilled && query && !link.tooLong && (
                <p className="mt-1 text-xs text-gray-500">The query is copied when you open it, so you can paste it into the search box.</p>
            )}
            {link && link.tooLong && (
                <p className="mt-1 text-xs text-amber-700">
                    {dbName} reads only the first {GOOGLE_SCHOLAR_MAX_CHARS} characters of a search. The query is copied when you open it; shorten it there.
                </p>
            )}
        </div>
    );
};

export default ManualCountField;
