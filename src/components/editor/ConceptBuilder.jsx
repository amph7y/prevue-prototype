import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn.js';
import { CheckIcon, LightBulbIcon, PencilIcon, PlusCircleIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import {
    INACTIVE_CHIP,
    MAX_ANSWER_CHARS,
    MAX_CONCEPTS,
    MAX_CONCEPT_NAME_CHARS,
    activeConcepts,
    addConcepts,
    buildQuestionSegments,
    getConceptColor,
    isActive,
    joinConcepts,
    normalizeName,
    phrasesFromSelection,
    removeConcept,
    renameConcept,
    toggleConcept,
} from '../../utils/concepts.js';

// Step 1 concept screen: the question with clickable concept bubbles, AI follow-up
// questions and suggestions, manual concepts, and the list of all concepts.
// All text from the AI is shown as plain text (never as HTML).
const ConceptBuilder = ({ state, actions }) => {
    const { question = '', concepts = [], conceptAssist, answeringFollowUpId, isLoading } = state;
    const { setConcepts, setConceptAssist, handleAnswerFollowUp } = actions;

    const [selectedWordStarts, setSelectedWordStarts] = useState([]);
    const [manualName, setManualName] = useState('');
    const [answers, setAnswers] = useState({});
    const [joinMode, setJoinMode] = useState(false);
    const [joinSelection, setJoinSelection] = useState([]);
    const [editing, setEditing] = useState({ id: null, value: '' });

    const segments = useMemo(() => buildQuestionSegments(question, concepts), [question, concepts]);
    const conceptIndex = useMemo(() => new Map(concepts.map((c, i) => [c.id, i])), [concepts]);
    const selectedStarts = selectedWordStarts.filter((start) => segments.some((s) => s.kind === 'word' && s.start === start));
    const selectionPhrases = phrasesFromSelection(question, segments, selectedStarts);

    const activeCount = activeConcepts(concepts).length;
    const atLimit = concepts.length >= MAX_CONCEPTS;
    const followUps = (conceptAssist?.followUps || []).filter((f) => f.status !== 'skipped');
    const suggestions = (conceptAssist?.suggestions || []).filter((s) => s.status === 'open');
    const isAnswering = Boolean(answeringFollowUpId);
    const questionChanged = Boolean(conceptAssist?.analyzedQuestion) && conceptAssist.analyzedQuestion !== normalizeName(question);
    const limitMessage = `You can have up to ${MAX_CONCEPTS} concepts. Remove or join some to add more.`;

    // Returns true if something was added; otherwise explains why not
    const reportAdd = (result) => {
        if (result.added > 0 || result.reactivated > 0) return true;
        if (result.overLimit > 0) toast.error(limitMessage);
        else if (result.duplicates > 0) toast('You already have this concept.');
        return false;
    };

    const handleToggle = (id) => setConcepts((prev) => toggleConcept(prev, id));

    const handleRemove = (id) => {
        setConcepts((prev) => removeConcept(prev, id));
        setJoinSelection((prev) => prev.filter((x) => x !== id));
    };

    const handleWordClick = (start) => {
        setSelectedWordStarts((prev) => (prev.includes(start) ? prev.filter((s) => s !== start) : [...prev, start]));
    };

    const handleAddSelection = () => {
        const items = selectionPhrases.map((p) => ({ name: p.text, questionText: p.text, source: 'words' }));
        const result = addConcepts(concepts, items);
        if (reportAdd(result)) {
            setConcepts(result.concepts);
            setSelectedWordStarts([]);
        }
    };

    const handleAddManual = () => {
        const name = normalizeName(manualName);
        if (!name) return;
        const result = addConcepts(concepts, [{ name, source: 'manual' }]);
        if (reportAdd(result)) {
            setConcepts(result.concepts);
            setManualName('');
        }
    };

    const updateSuggestion = (id, status) => {
        setConceptAssist((prev) => ({
            ...prev,
            suggestions: (prev.suggestions || []).map((s) => (s.id === id ? { ...s, status } : s)),
        }));
    };

    const handleAddSuggestion = (suggestion) => {
        const result = addConcepts(concepts, [{ name: suggestion.name, source: 'suggested' }]);
        if (reportAdd(result)) setConcepts(result.concepts);
        if (result.added > 0 || result.reactivated > 0 || result.duplicates > 0) updateSuggestion(suggestion.id, 'added');
    };

    const handleAnswer = async (followUp) => {
        const answer = (answers[followUp.id] || '').trim();
        if (!answer || isAnswering) return;
        const used = await handleAnswerFollowUp(followUp.id, answer);
        if (used) setAnswers((prev) => ({ ...prev, [followUp.id]: '' }));
    };

    const handleSkip = (id) => {
        setConceptAssist((prev) => ({
            ...prev,
            followUps: (prev.followUps || []).map((f) => (f.id === id ? { ...f, status: 'skipped' } : f)),
        }));
    };

    const cancelEdit = () => setEditing({ id: null, value: '' });

    const saveEdit = () => {
        const result = renameConcept(concepts, editing.id, editing.value);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setConcepts(result.concepts);
        cancelEdit();
    };

    const toggleJoinMode = () => {
        setJoinMode((on) => !on);
        setJoinSelection([]);
        cancelEdit();
    };

    const toggleJoinPick = (id) => {
        setJoinSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleJoin = () => {
        const result = joinConcepts(concepts, joinSelection, question);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setConcepts(result.concepts);
        setJoinMode(false);
        setJoinSelection([]);
        // Let the researcher adjust the name of the joined concept straight away
        const joined = result.concepts.find((c) => c.id === result.joinedId);
        setEditing({ id: result.joinedId, value: joined ? joined.name : '' });
    };

    const renderQuestion = () => (
        <p className="mt-4 text-lg leading-[2.75rem] text-gray-800" data-testid="question-with-concepts">
            {segments.map((segment) => {
                if (segment.kind === 'concept') {
                    const index = conceptIndex.get(segment.conceptId);
                    const concept = concepts[index];
                    if (!concept) return <span key={segment.start}>{segment.text}</span>;
                    const on = isActive(concept);
                    return (
                        <button
                            key={segment.start}
                            type="button"
                            onClick={() => handleToggle(concept.id)}
                            aria-pressed={on}
                            title={on ? 'Click to turn this concept off' : 'Click to turn this concept back on'}
                            className={cn('mx-0.5 rounded-full border px-2 py-0.5 transition-colors', on ? getConceptColor(concept, index).chip : INACTIVE_CHIP)}
                        >
                            {segment.text}
                        </button>
                    );
                }
                if (segment.kind === 'word') {
                    const selected = selectedStarts.includes(segment.start);
                    return (
                        <button
                            key={segment.start}
                            type="button"
                            onClick={() => handleWordClick(segment.start)}
                            aria-pressed={selected}
                            title={selected ? 'Click to unselect this word' : 'Click to select this word'}
                            className={cn(
                                'rounded px-0.5 transition-colors',
                                selected ? 'bg-main/20 text-gray-900 underline decoration-main decoration-2 underline-offset-4' : 'hover:bg-gray-100'
                            )}
                        >
                            {segment.text}
                        </button>
                    );
                }
                return <span key={segment.start} className="whitespace-pre-wrap">{segment.text}</span>;
            })}
        </p>
    );

    const renderConceptChip = (concept, index) => {
        const on = isActive(concept);
        const color = on ? getConceptColor(concept, index).chip : INACTIVE_CHIP;

        if (editing.id === concept.id) {
            return (
                <li key={concept.id} className="flex items-center gap-1">
                    <input
                        type="text"
                        value={editing.value}
                        autoFocus
                        maxLength={MAX_CONCEPT_NAME_CHARS}
                        aria-label="Concept name"
                        onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                            } else if (e.key === 'Escape') {
                                cancelEdit();
                            }
                        }}
                        className="rounded-md border-gray-300 py-1 text-sm shadow-sm"
                    />
                    <button type="button" onClick={saveEdit} className="rounded-md bg-main px-2 py-1 text-xs font-medium text-white hover:bg-main-dark">
                        Save
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800">
                        Cancel
                    </button>
                </li>
            );
        }

        if (joinMode) {
            const picked = joinSelection.includes(concept.id);
            return (
                <li key={concept.id}>
                    <button
                        type="button"
                        onClick={() => toggleJoinPick(concept.id)}
                        aria-pressed={picked}
                        className={cn('inline-flex items-center rounded-full border px-3 py-1 text-sm', color, picked && 'ring-2 ring-gray-800 ring-offset-1')}
                    >
                        {picked && <CheckIcon className="mr-1 h-4 w-4" />}
                        {concept.name}
                    </button>
                </li>
            );
        }

        return (
            <li key={concept.id} className={cn('inline-flex items-center rounded-full border text-sm', color)}>
                <button
                    type="button"
                    onClick={() => handleToggle(concept.id)}
                    aria-pressed={on}
                    title={on ? 'Click to turn this concept off' : 'Click to turn this concept back on'}
                    className="rounded-l-full py-1 pl-3 pr-1"
                >
                    {concept.name}
                </button>
                <button
                    type="button"
                    onClick={() => setEditing({ id: concept.id, value: concept.name })}
                    aria-label={`Rename ${concept.name}`}
                    title="Rename"
                    className="p-1 opacity-60 hover:opacity-100"
                >
                    <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => handleRemove(concept.id)}
                    aria-label={`Remove ${concept.name}`}
                    title="Remove"
                    className="rounded-r-full p-1 pr-2 opacity-60 hover:opacity-100"
                >
                    ×
                </button>
            </li>
        );
    };

    return (
        // A disabled fieldset turns off every button and box inside it, for mouse and keyboard users alike
        <fieldset disabled={isLoading} className={cn('min-w-0 space-y-6', isLoading && 'opacity-60')} aria-busy={isLoading ? 'true' : 'false'}>
            {/* 1. The question with its concepts */}
            <section className="rounded-lg border bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Concepts in your question</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Click a colored concept to turn it off or back on. To make your own concept, click words in the question, then choose <strong>Add as concept</strong>.
                </p>

                {question.trim() ? renderQuestion() : (
                    <p className="mt-4 text-sm text-gray-500">
                        Type your research question above, then click <strong>Generate Concepts</strong>, or add concepts yourself below.
                    </p>
                )}

                {questionChanged && (
                    <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-700">
                        Your question has changed since the AI read it. Concepts stay highlighted wherever the same words still appear.
                    </p>
                )}

                {selectionPhrases.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-gray-50 p-3">
                        <span className="text-sm text-gray-700">
                            Selected: {selectionPhrases.map((p) => `"${p.text}"`).join(', ')}
                        </span>
                        <button
                            type="button"
                            onClick={handleAddSelection}
                            disabled={atLimit}
                            className="inline-flex items-center gap-1 rounded-md bg-main px-3 py-1.5 text-sm font-medium text-white hover:bg-main-dark disabled:bg-main/50"
                        >
                            <PlusCircleIcon className="h-4 w-4" />
                            {selectionPhrases.length > 1 ? 'Add as concepts' : 'Add as concept'}
                        </button>
                        <button type="button" onClick={() => setSelectedWordStarts([])} className="text-sm text-gray-600 hover:text-gray-800">
                            Clear
                        </button>
                    </div>
                )}
            </section>

            {/* 2. More concepts: AI follow-up questions, AI suggestions, and the researcher's own */}
            <section className="rounded-lg border bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Add more concepts</h3>

                {followUps.length > 0 && (
                    <div className="mt-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <LightBulbIcon className="h-5 w-5 text-main" />
                            Questions from the AI
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">Answer any that apply. Your answers become new concepts.</p>
                        <ul className="mt-3 space-y-3">
                            {followUps.map((followUp) => {
                                const busy = answeringFollowUpId === followUp.id;
                                const typed = answers[followUp.id] || '';
                                return (
                                    <li key={followUp.id} className="rounded-md border border-gray-200 p-3">
                                        <p className="text-sm font-medium text-gray-800">{followUp.question}</p>
                                        {followUp.status === 'answered' ? (
                                            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                                                <CheckIcon className="h-4 w-4 text-green-600" />
                                                Your answer: {followUp.answer}
                                            </p>
                                        ) : (
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <input
                                                    type="text"
                                                    value={typed}
                                                    maxLength={MAX_ANSWER_CHARS}
                                                    disabled={isAnswering}
                                                    aria-label={`Your answer to: ${followUp.question}`}
                                                    placeholder="Type your answer"
                                                    onChange={(e) => setAnswers((prev) => ({ ...prev, [followUp.id]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAnswer(followUp);
                                                        }
                                                    }}
                                                    className="block flex-1 rounded-md border-gray-300 text-sm shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleAnswer(followUp)}
                                                    disabled={isAnswering || !typed.trim() || atLimit}
                                                    className="inline-flex items-center justify-center rounded-md bg-main px-3 py-2 text-sm font-medium text-white hover:bg-main-dark disabled:bg-main/50"
                                                >
                                                    {busy ? (
                                                        <>
                                                            <Spinner />
                                                            <span className="ml-2">Adding...</span>
                                                        </>
                                                    ) : 'Add to concepts'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSkip(followUp.id)}
                                                    disabled={busy}
                                                    className="text-sm text-gray-500 hover:text-gray-700"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {suggestions.length > 0 && (
                    <div className="mt-5">
                        <h4 className="text-sm font-semibold text-gray-700">Suggested concepts</h4>
                        <ul className="mt-2 flex flex-wrap gap-2">
                            {suggestions.map((suggestion) => (
                                <li key={suggestion.id} className="inline-flex items-center rounded-full border border-dashed border-gray-300 bg-white text-sm">
                                    <button
                                        type="button"
                                        onClick={() => handleAddSuggestion(suggestion)}
                                        disabled={atLimit}
                                        title="Add this concept"
                                        className="inline-flex items-center gap-1 rounded-l-full px-3 py-1 text-gray-700 hover:bg-main/10 disabled:opacity-50"
                                    >
                                        <PlusCircleIcon className="h-4 w-4 text-main" />
                                        {suggestion.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSuggestion(suggestion.id, 'dismissed')}
                                        aria-label={`Dismiss ${suggestion.name}`}
                                        title="Dismiss"
                                        className="rounded-r-full px-2 py-1 text-gray-400 hover:text-gray-600"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-5">
                    <label htmlFor="manual-concept" className="text-sm font-semibold text-gray-700">Add your own concept</label>
                    <div className="mt-2 flex gap-2">
                        <input
                            id="manual-concept"
                            type="text"
                            value={manualName}
                            maxLength={MAX_CONCEPT_NAME_CHARS}
                            placeholder="e.g. Arab countries"
                            onChange={(e) => setManualName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddManual();
                                }
                            }}
                            className="block flex-1 rounded-md border-gray-300 text-sm shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={handleAddManual}
                            disabled={!manualName.trim() || atLimit}
                            className="inline-flex items-center gap-1 rounded-md bg-main px-4 py-2 text-sm font-medium text-white hover:bg-main-dark disabled:bg-main/50"
                        >
                            <PlusCircleIcon className="h-5 w-5" />
                            Add
                        </button>
                    </div>
                </div>

                {atLimit && <p className="mt-3 text-sm text-amber-700">{limitMessage}</p>}
            </section>

            {/* 3. All concepts */}
            <section className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Your concepts</h3>
                        <p className="mt-1 text-sm text-gray-500" data-testid="concept-count">
                            {activeCount} of {concepts.length} turned on. Only concepts that are turned on are used for keywords.
                        </p>
                    </div>
                    {concepts.length >= 2 && (
                        <button
                            type="button"
                            onClick={toggleJoinMode}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            {joinMode ? 'Cancel joining' : 'Join concepts'}
                        </button>
                    )}
                </div>

                {joinMode && <p className="mt-3 text-sm text-gray-600">Select two or more concepts to join them into one.</p>}

                {concepts.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">No concepts yet.</p>
                ) : (
                    <ul className="mt-4 flex flex-wrap gap-2" data-testid="concept-list">
                        {concepts.map((concept, index) => renderConceptChip(concept, index))}
                    </ul>
                )}

                {joinMode && (
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleJoin}
                            disabled={joinSelection.length < 2}
                            className="rounded-md bg-main px-4 py-2 text-sm font-medium text-white hover:bg-main-dark disabled:bg-main/50"
                        >
                            {joinSelection.length >= 2 ? `Join ${joinSelection.length} concepts` : 'Join concepts'}
                        </button>
                    </div>
                )}
            </section>
        </fieldset>
    );
};

export default ConceptBuilder;
