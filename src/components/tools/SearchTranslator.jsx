import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { databaseLink } from '../../utils/databaseLinks.js';
import { highlightSearch } from '../../utils/searchHighlight.js';
import { QUESTION_AI_REQUESTS, QuestionSearchError, searchFromQuestion } from '../../utils/questionSearch.js';
import { runConceptTask } from '../../api/fanarApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
    EXAMPLE_SEARCH,
    MAX_SEARCH_CHARS,
    SYNTAXES,
    SearchSyntaxError,
    detectSyntax,
    looksLikeQuestion,
    normalizeSearchText,
    translateSearch,
} from '../../utils/searchTranslator.js';

// Colors only (no padding or bold), so the colored copy lines up with the text being edited
const PIECE_STYLES = {
    operator: 'text-purple-700',
    field: 'text-emerald-700',
    heading: 'rounded-sm bg-sky-100 text-sky-900',
    paren: 'text-gray-500',
    term: '',
    space: '',
};
const FLAG_STYLE = 'underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4';
const AUTO = 'auto';
const QUESTION = 'question';
const oneLineOf = (text) => text.replace(/\s+/g, ' ').trim();
const without = (object, key) => {
    const copy = { ...object };
    delete copy[key];
    return copy;
};

// Runs the translation without breaking the page: a search that can't be read gives a message
function runTranslation(search, syntax) {
    try {
        return { ...translateSearch(search, { syntax }), error: null };
    } catch (error) {
        if (error instanceof SearchSyntaxError) return { empty: false, notes: [], results: [], error };
        throw error;
    }
}

// The text around the place where the search can't be read
function errorSnippet(search, position) {
    if (!Number.isInteger(position)) return '';
    const text = normalizeSearchText(search);
    const start = Math.max(0, position - 20);
    return `${start > 0 ? '…' : ''}${text.slice(start, position + 20).replace(/\s+/g, ' ')}${position + 20 < text.length ? '…' : ''}`;
}

// A clear message when the AI request fails. Messages are shown as text, never as HTML.
function aiErrorMessage(error) {
    if (error instanceof QuestionSearchError) return error.message;
    const message = error && typeof error.message === 'string' ? error.message : '';
    if (!message || /^API error|Failed to fetch|NetworkError|Load failed|unexpected response/i.test(message)) {
        return "PreVue couldn't reach its AI service. Please try again in a minute, or paste a search instead.";
    }
    return message.length > 200 ? `${message.slice(0, 200)}…` : message;
}

const BOX = 'm-0 block w-full whitespace-pre-wrap break-words rounded-md border p-3 font-mono text-sm leading-7';
const MAX_EDIT_CHARS = 100000; // translations can be longer than the search (CINAHL repeats TI and AB)

// An editable search. A colored copy sits behind the text box, which has see-through text,
// so the search keeps its colors while it is being edited. Text only, never HTML.
function EditableQuery({ value, pieces, onChange, label, describedBy, testId }) {
    const areaRef = useRef(null);
    useLayoutEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        // The box grows with the text, so it never scrolls away from its colored copy
        area.style.height = '0px';
        area.style.height = `${Math.max(area.scrollHeight, 48)}px`;
    }, [value]);
    return (
        <div className="relative rounded-md bg-gray-50">
            <pre
                aria-hidden="true"
                className={cn(BOX, 'pointer-events-none absolute inset-0 overflow-hidden border-transparent text-gray-900')}
                data-testid="translated-query"
            >
                {pieces.map((p, i) => (
                    <span key={i} className={cn(PIECE_STYLES[p.kind] || '', p.flag && FLAG_STYLE)}>
                        {p.text}
                    </span>
                ))}
            </pre>
            <textarea
                ref={areaRef}
                value={value}
                rows={1}
                maxLength={MAX_EDIT_CHARS}
                spellCheck={false}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
                aria-describedby={describedBy}
                data-testid={testId}
                className={cn(
                    BOX,
                    'relative resize-none overflow-hidden border-gray-200 bg-transparent text-transparent caret-gray-900',
                    'selection:bg-sky-300/40 selection:text-transparent focus:border-main focus:ring-main',
                )}
            />
        </div>
    );
}

function TranslationCard({ result, edit, onEdit, onReset }) {
    const { key, name, where, text, checks } = result;
    const value = edit ? edit.text : text;
    const oneLine = edit ? oneLineOf(value) : result.oneLine;
    const link = oneLine ? databaseLink(key, oneLine) : null;
    const pieces = useMemo(() => (edit ? highlightSearch(value, key) : result.pieces), [edit, value, key, result.pieces]);
    const changedSince = Boolean(edit) && edit.base !== text;
    const checksId = `translation-checks-${key}`;
    const handleOpen = () => {
        // Databases that can't take the search in the link: copy it, ready to paste
        if (link && !link.prefilled && oneLine) copyToClipboard(oneLine);
    };
    return (
        <li id={`translation-${key}`} className="scroll-mt-6 rounded-lg border bg-white p-4 shadow-sm" data-testid={`translation-${key}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">
                        {name}
                        {edit && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800" data-testid={`translation-edited-${key}`}>
                                Edited
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-gray-500">{where}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {edit && (
                        <button
                            type="button"
                            onClick={() => onReset(key)}
                            className="rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        >
                            Undo my edits
                        </button>
                    )}
                    {oneLine && (
                        <button
                            type="button"
                            onClick={() => copyToClipboard(oneLine)}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                            aria-label={`Copy the ${name} search`}
                        >
                            Copy
                        </button>
                    )}
                    {oneLine && link && (
                        <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleOpen}
                            className="inline-flex items-center gap-1 rounded-md bg-main px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-main-dark"
                            data-testid={`translation-link-${key}`}
                        >
                            {link.prefilled ? `Search ${name}` : `Open ${name}`}
                            <span aria-hidden="true">↗</span>
                            <span className="sr-only">(opens in a new tab{link.prefilled ? '' : '; the search is copied so you can paste it'})</span>
                        </a>
                    )}
                </div>
            </div>
            {changedSince && (
                <p className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid={`translation-outdated-${key}`}>
                    Your main search has changed since you edited this one.
                    <button type="button" onClick={() => onReset(key)} className="font-semibold underline hover:no-underline">
                        Use the new translation
                    </button>
                </p>
            )}
            <div className="mt-3">
                {!text && !edit && (
                    <p className="mb-2 text-sm text-gray-600">Nothing in this search can be translated for {name}. You can type a search here yourself.</p>
                )}
                <EditableQuery
                    value={value}
                    pieces={pieces}
                    onChange={(next) => onEdit(key, next, text)}
                    label={`${name} search. You can edit it.`}
                    describedBy={checks.length > 0 ? checksId : undefined}
                    testId={`translation-input-${key}`}
                />
            </div>
            {checks.length > 0 && (
                <>
                    <ul id={checksId} className="mt-3 space-y-1" aria-label={`Things to check for ${name}`}>
                        {checks.map((check) => (
                            <li key={check.message} className="flex gap-2 text-sm text-amber-800">
                                <span aria-hidden="true">⚠</span>
                                <span>
                                    {check.message}
                                    {check.items.length > 0 && <span className="text-gray-600"> ({check.items.join('; ')})</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {edit && <p className="mt-1 text-xs text-gray-500">These checks are for PreVue's translation, before your edits.</p>}
                </>
            )}
        </li>
    );
}

// The Search Translator: paste a search from any database (or write a research question)
// and get it written for each database. Pasted searches are translated in the browser and
// aren't sent anywhere; a research question is sent to PreVue's AI service (signed-in users only).
const SearchTranslator = ({
    initialQuery = '',
    titleId = 'search-translator-title',
    isPage = true,
    onRequireLogin = null,
    runAiTask = runConceptTask,
}) => {
    const { isAuthenticated } = useAuth();
    const canUseAi = Boolean(isAuthenticated);
    const [search, setSearch] = useState(initialQuery);
    const [translated, setTranslated] = useState(initialQuery);
    const [syntaxChoice, setSyntaxChoice] = useState(AUTO);
    // Searches the researcher edited, by database: { text, base } (base: the translation then)
    const [edits, setEdits] = useState({});
    // The question-to-search AI request
    const [ai, setAi] = useState({ status: 'idle', message: '', question: null, concepts: [] });
    const mounted = useRef(true);
    const aiRunning = useRef(false);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // Translate shortly after typing stops
    useEffect(() => {
        const timer = setTimeout(() => setTranslated(search), 250);
        return () => clearTimeout(timer);
    }, [search]);

    const mode = syntaxChoice === QUESTION || (syntaxChoice === AUTO && looksLikeQuestion(translated)) ? QUESTION : 'search';
    const outcome = useMemo(
        () => (mode === QUESTION ? { empty: false, notes: [], results: [], error: null } : runTranslation(translated, syntaxChoice)),
        [translated, syntaxChoice, mode],
    );
    const detected = useMemo(() => {
        if (syntaxChoice !== AUTO || !translated.trim()) return null;
        if (mode === QUESTION) return { key: QUESTION, name: 'a research question' };
        return SYNTAXES.find((syntax) => syntax.key === detectSyntax(translated)) || null;
    }, [syntaxChoice, translated, mode]);
    const Title = isPage ? 'h1' : 'h2';

    const jumpTo = (key) => {
        const card = document.getElementById(`translation-${key}`);
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Replaces the whole search (example, clear, drafted search): edits no longer apply
    const setNow = (value) => {
        setSearch(value);
        setTranslated(value);
        setEdits({});
        setSyntaxChoice(AUTO);
    };
    const resetAi = () => setAi({ status: 'idle', message: '', question: null, concepts: [] });

    const handleEdit = (key, value, translation) => {
        setEdits((previous) => {
            const base = previous[key] ? previous[key].base : translation;
            if (value === translation && base === translation) return without(previous, key);
            return { ...previous, [key]: { text: value, base } };
        });
    };
    const handleReset = (key) => setEdits((previous) => without(previous, key));

    const buildFromQuestion = async () => {
        if (!canUseAi || aiRunning.current) return;
        aiRunning.current = true;
        const question = search;
        setAi({ status: 'running', message: '', question: null, concepts: [] });
        try {
            const draft = await searchFromQuestion(question, runAiTask);
            if (!mounted.current) return;
            setNow(draft.search);
            setAi({ status: 'done', message: '', question, concepts: draft.concepts });
        } catch (error) {
            if (!mounted.current) return;
            setAi({ status: 'error', message: aiErrorMessage(error), question: null, concepts: [] });
        } finally {
            aiRunning.current = false;
        }
    };

    const backToQuestion = () => {
        const question = ai.question;
        resetAi();
        setNow(question || '');
    };

    return (
        <section aria-labelledby={titleId} data-testid="search-translator">
            <Title id={titleId} className="text-2xl font-bold text-gray-900">Search Translator</Title>
            <p className="mt-2 max-w-3xl text-gray-600">
                Paste a search from any database, or write a research question, and PreVue writes it for each database below.
                Only the syntax changes, so check the highlighted parts, especially subject headings, which each database names differently.
            </p>

            <div className="mt-6">
                <label htmlFor="search-translator-input" className="block text-sm font-semibold text-gray-700">Your search or research question</label>
                <textarea
                    id="search-translator-input"
                    rows={7}
                    value={search}
                    maxLength={MAX_SEARCH_CHARS}
                    spellCheck={false}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={'For example: ("Acne Vulgaris"[Mesh] OR acne[tiab]) AND ("blue light"[tiab] OR phototherap*[tiab])\nor: Does blue light therapy improve acne in adolescents?'}
                    aria-describedby="search-translator-help"
                    aria-invalid={outcome.error ? 'true' : 'false'}
                    className="mt-2 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-main focus:ring-main"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <label htmlFor="search-translator-syntax" className="font-medium text-gray-700">Read as</label>
                        <select
                            id="search-translator-syntax"
                            value={syntaxChoice}
                            onChange={(e) => setSyntaxChoice(e.target.value)}
                            className="rounded-md border-gray-300 py-1 pl-2 pr-8 text-sm shadow-sm focus:border-main focus:ring-main"
                        >
                            <option value={AUTO}>Detect automatically</option>
                            <option value={QUESTION}>A research question (AI)</option>
                            {SYNTAXES.map((syntax) => <option key={syntax.key} value={syntax.key}>{syntax.name}</option>)}
                        </select>
                        {detected && <span className="text-xs text-gray-500" data-testid="detected-syntax">Detected: {detected.name}</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                resetAi();
                                setNow(EXAMPLE_SEARCH);
                            }}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            Try an example
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                resetAi();
                                setNow('');
                            }}
                            disabled={!search}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                <p id="search-translator-help" className="mt-2 text-xs text-gray-500">
                    Reads searches written for PubMed, Ovid, Embase, Cochrane, CINAHL, Web of Science, Scopus or Google Scholar, including numbered search histories.
                    {' '}{search.length.toLocaleString('en-US')} / {MAX_SEARCH_CHARS.toLocaleString('en-US')} characters.
                </p>
                {detected && detected.key === 'ovidMedline' && (
                    <p className="mt-1 text-xs text-gray-500">
                        From Embase or APA PsycInfo on Ovid? Choose it under "Read as" so subject headings are checked against the right thesaurus.
                    </p>
                )}
            </div>

            <div aria-live="polite">
                {mode === QUESTION && (
                    <div className="mt-4 rounded-md border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900" data-testid="question-panel">
                        <p className="font-semibold">{syntaxChoice === QUESTION ? 'Reading this as a research question.' : 'This looks like a research question.'}</p>
                        {canUseAi ? (
                            <>
                                <p className="mt-1">
                                    PreVue can draft a search from it with AI ({QUESTION_AI_REQUESTS} AI requests), then translate it for every database.
                                    Your question is sent to PreVue's AI service.
                                </p>
                                <button
                                    type="button"
                                    onClick={buildFromQuestion}
                                    disabled={ai.status === 'running' || !search.trim()}
                                    className="mt-3 rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
                                >
                                    {ai.status === 'running' ? 'Drafting your search…' : 'Draft searches from my question'}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="mt-1">
                                    Turning a question into searches uses AI, so it needs a free PreVue account. You can still paste a search from any database.
                                </p>
                                {onRequireLogin && (
                                    <button
                                        type="button"
                                        onClick={() => onRequireLogin(search)}
                                        className="mt-3 rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
                                    >
                                        Sign in to use it
                                    </button>
                                )}
                            </>
                        )}
                        {ai.status === 'error' && (
                            <p className="mt-2 font-medium text-red-700" role="alert" data-testid="question-error">{ai.message}</p>
                        )}
                    </div>
                )}
                {mode !== QUESTION && ai.status === 'done' && ai.question && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900" data-testid="question-draft-note">
                        <span>
                            PreVue drafted this PubMed search from your question
                            {ai.concepts.length > 0 ? ` (concepts: ${ai.concepts.join(', ')})` : ''}. Edit it above if you need to.
                        </span>
                        <button type="button" onClick={backToQuestion} className="font-semibold underline hover:no-underline">
                            Back to my question
                        </button>
                    </div>
                )}
                {outcome.error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" data-testid="translator-error">
                        <p className="font-semibold">PreVue can't read this search yet.</p>
                        <p className="mt-1">{outcome.error.message}</p>
                        {errorSnippet(translated, outcome.error.position) && (
                            <p className="mt-1">
                                Near character {(outcome.error.position + 1).toLocaleString('en-US')}:{' '}
                                <code className="rounded bg-white px-1 font-mono">{errorSnippet(translated, outcome.error.position)}</code>
                            </p>
                        )}
                    </div>
                )}
                {outcome.notes.length > 0 && (
                    <ul className="mt-4 space-y-1 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="translator-notes">
                        {outcome.notes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                )}
            </div>

            {outcome.results.length > 0 && (
                <div className="mt-6">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span><span className={PIECE_STYLES.operator}>Purple</span>: operators</span>
                        <span><span className={PIECE_STYLES.field}>Green</span>: field codes</span>
                        <span><span className={PIECE_STYLES.heading}>Blue</span>: subject headings</span>
                        <span><span className={FLAG_STYLE}>Dotted line</span>: check this (see the list under each search)</span>
                        <span>Every search can be edited before you copy it.</span>
                    </p>
                    <nav className="mt-3 flex flex-wrap gap-2" aria-label="Jump to a database">
                        {outcome.results.map((result) => (
                            <button
                                key={result.key}
                                type="button"
                                onClick={() => jumpTo(result.key)}
                                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {result.name}
                                {result.checks.length > 0 && <span className="ml-1 text-amber-700" aria-label={`${result.checks.length} things to check`}>⚠{result.checks.length}</span>}
                            </button>
                        ))}
                    </nav>
                    <ul className="mt-4 space-y-4" data-testid="translations">
                        {outcome.results.map((result) => (
                            <TranslationCard key={result.key} result={result} edit={edits[result.key] || null} onEdit={handleEdit} onReset={handleReset} />
                        ))}
                    </ul>
                    <p className="mt-4 text-xs text-gray-500">
                        Copy gives the search on one line, ready to paste. Many of these databases need access through your library:
                        if a link asks you to sign in, open the database from your library&apos;s website. Pasted searches stay in your browser.
                    </p>
                </div>
            )}
        </section>
    );
};

export default SearchTranslator;
