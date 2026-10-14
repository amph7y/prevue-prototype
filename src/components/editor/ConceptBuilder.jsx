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
    addAnswerSuggestions,
    addConcepts,
    buildQuestionSegments,
    conceptLimitMessage,
    conceptParts,
    getConceptColor,
    isActive,
    joinNeighbors,
    joinPicked,
    normalizeName,
    questionLayout,
    removeConcept,
    renameConcept,
    separateConcept,
    setAnswerSuggestionStatus,
    splitConceptAt,
    toggleConcept,
} from '../../utils/concepts.js';

// Small icons like 2Dsearch: arrows pointing in (join) and arrows pointing out (split)
const JoinIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 10h6M6 8l2 2-2 2M18 10h-6M14 8l-2 2 2 2M10 5v10" />
    </svg>
);

const SplitIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 10H2M4 8l-2 2 2 2M12 10h6M16 8l2 2-2 2M10 5v10" />
    </svg>
);

const EMPTY_PICK = { conceptIds: [], wordStarts: [] };

// Step 1 concept screen: the question as clickable chips (like 2Dsearch), AI follow-up
// questions and suggestions, the researcher's own concepts, and the list of all concepts.
// All text from the AI is shown as plain text (never as HTML).
const ConceptBuilder = ({ state, actions }) => {
    const { question = '', concepts = [], conceptAssist, answeringFollowUpId, isLoading } = state;
    const { setConcepts, setConceptAssist, handleAnswerFollowUp } = actions;

    const [manualName, setManualName] = useState('');
    const [answers, setAnswers] = useState({});
    const [editingAnswerId, setEditingAnswerId] = useState(null);
    const [joinMode, setJoinMode] = useState(false);
    const [joinPick, setJoinPick] = useState(EMPTY_PICK);
    const [editing, setEditing] = useState({ id: null, value: '' });

    const segments = useMemo(() => buildQuestionSegments(question, concepts), [question, concepts]);
    const layout = useMemo(() => questionLayout(segments), [segments]);
    const conceptIndex = useMemo(() => new Map(concepts.map((c, i) => [c.id, i])), [concepts]);

    // Picks for joining (anything that no longer exists is ignored)
    const pickedConceptIds = joinPick.conceptIds.filter((id) => conceptIndex.has(id));
    const pickedWordStarts = joinPick.wordStarts.filter((start) => segments.some((s) => s.kind === 'word' && s.start === start));
    const pickedCount = pickedConceptIds.length + pickedWordStarts.length;

    const activeCount = activeConcepts(concepts).length;
    const atLimit = concepts.length >= MAX_CONCEPTS;
    const followUps = (conceptAssist?.followUps || []).filter((f) => f.status !== 'skipped');
    const suggestions = (conceptAssist?.suggestions || []).filter((s) => s.status === 'open');
    const isAnswering = Boolean(answeringFollowUpId);
    const questionChanged = Boolean(conceptAssist?.analyzedQuestion) && conceptAssist.analyzedQuestion !== normalizeName(question);
    const limitMessage = conceptLimitMessage();

    // Returns true if something was added; otherwise explains why not
    const reportAdd = (result) => {
        if (result.added > 0 || result.reactivated > 0) return true;
        if (result.overLimit > 0) toast.error(limitMessage);
        else if (result.duplicates > 0) toast('You already have this concept.');
        return false;
    };

    // Applies the result of a join, split or separate (or shows why it could not be done)
    const applyChange = (result) => {
        if (result.error) {
            toast.error(result.error);
            return false;
        }
        setConcepts(result.concepts);
        return true;
    };

    const cancelEdit = () => setEditing({ id: null, value: '' });

    // ---------- The question ----------

    const handleWordClick = (segment) => {
        if (joinMode) {
            setJoinPick((prev) => ({
                ...prev,
                wordStarts: prev.wordStarts.includes(segment.start)
                    ? prev.wordStarts.filter((s) => s !== segment.start)
                    : [...prev.wordStarts, segment.start],
            }));
            return;
        }
        const result = addConcepts(concepts, [{ name: segment.text, questionParts: [segment.text], source: 'words' }]);
        if (reportAdd(result)) setConcepts(result.concepts);
    };

    const handleConceptClick = (id) => {
        if (joinMode) {
            setJoinPick((prev) => ({
                ...prev,
                conceptIds: prev.conceptIds.includes(id) ? prev.conceptIds.filter((x) => x !== id) : [...prev.conceptIds, id],
            }));
            return;
        }
        setConcepts((prev) => toggleConcept(prev, id));
    };

    const handleJoinNeighbors = (left, right) => applyChange(joinNeighbors(concepts, question, left.start, right.start));

    const handleSplit = (conceptId, cutStart) => applyChange(splitConceptAt(concepts, question, conceptId, cutStart));

    const handleSeparate = (conceptId) => applyChange(separateConcept(concepts, conceptId));

    // ---------- Joining anything (also words that are apart) ----------

    const toggleJoinMode = () => {
        setJoinMode((on) => !on);
        setJoinPick(EMPTY_PICK);
        cancelEdit();
    };

    const handleJoin = () => {
        const result = joinPicked(concepts, question, { conceptIds: pickedConceptIds, wordStarts: pickedWordStarts });
        if (!applyChange(result)) return;
        setJoinMode(false);
        setJoinPick(EMPTY_PICK);
        const joined = result.concepts.find((c) => c.id === result.joinedId);
        if (joined) toast.success(`Joined into "${joined.name}"`);
    };

    // ---------- The list ----------

    const handleRemove = (id) => {
        setConcepts((prev) => removeConcept(prev, id));
        setJoinPick((prev) => ({ ...prev, conceptIds: prev.conceptIds.filter((x) => x !== id) }));
    };

    const saveEdit = () => {
        const result = renameConcept(concepts, editing.id, editing.value);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setConcepts(result.concepts);
        cancelEdit();
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

    // ---------- AI suggestions and follow-up questions ----------

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
        if (used) {
            setAnswers((prev) => ({ ...prev, [followUp.id]: '' }));
            setEditingAnswerId(null);
        }
    };

    const startEditAnswer = (followUp) => {
        setEditingAnswerId(followUp.id);
        setAnswers((prev) => ({ ...prev, [followUp.id]: followUp.answer }));
    };

    const cancelEditAnswer = () => setEditingAnswerId(null);

    const handleSkip = (id) => {
        setConceptAssist((prev) => ({
            ...prev,
            followUps: (prev.followUps || []).map((f) => (f.id === id ? { ...f, status: 'skipped' } : f)),
        }));
    };

    // The researcher confirms suggestions from an answer: only then do they become concepts
    const handleAddAnswerSuggestions = (followUpId, suggestionIds) => {
        const result = addAnswerSuggestions(concepts, conceptAssist, followUpId, suggestionIds);
        setConcepts(result.concepts);
        setConceptAssist(result.assist);
        if (result.overLimit > 0) toast.error(limitMessage);
    };

    const dismissAnswerSuggestion = (followUpId, suggestionId) => {
        setConceptAssist((prev) => setAnswerSuggestionStatus(prev, followUpId, suggestionId, 'dismissed'));
    };

    // ---------- Rendering ----------

    // While joining, Join and Cancel take the place of the button that started it, so they
    // stay where the researcher is looking (above the question and above the list)
    const renderJoinControls = (where) => (
        <div className="flex flex-wrap items-center gap-2" data-testid={`join-controls-${where}`}>
            <button
                type="button"
                onClick={handleJoin}
                disabled={pickedCount < 2}
                className="inline-flex items-center gap-1 rounded-md bg-main px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50"
            >
                <JoinIcon className="h-4 w-4" />
                {pickedCount >= 2 ? `Join ${pickedCount}` : 'Join'}
            </button>
            <button
                type="button"
                onClick={toggleJoinMode}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
                Cancel
            </button>
        </div>
    );

    const renderJoinHint = (announce) => (
        <p className="mt-2 rounded-md bg-gray-50 p-2 text-sm text-gray-700" role={announce ? 'status' : undefined} data-testid="join-hint">
            {pickedCount === 0
                ? 'Click words or concepts, in the question or in Your concepts, to pick them. Then click Join.'
                : `${pickedCount} picked. ${pickedCount < 2 ? 'Pick at least one more, then click Join.' : 'Click Join, or pick more.'}`}
        </p>
    );

    const renderPlainWord = (segment) => {
        const picked = pickedWordStarts.includes(segment.start);
        return (
            <button
                key={segment.start}
                type="button"
                onClick={() => handleWordClick(segment)}
                aria-pressed={joinMode ? picked : undefined}
                title={joinMode ? (picked ? 'Unpick this word' : 'Pick this word to join') : 'Click to make this word a concept'}
                data-testid="plain-word"
                data-text={segment.text}
                className={cn(
                    'rounded px-0.5 align-middle text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900',
                    picked && 'bg-gray-800/10 text-gray-900 underline decoration-gray-800 decoration-2 underline-offset-4'
                )}
            >
                {segment.text}
            </button>
        );
    };

    const renderConceptPiece = (segment) => {
        const index = conceptIndex.get(segment.conceptId);
        const concept = concepts[index];
        if (!concept) return <span key={segment.start}>{segment.text}</span>;
        const on = isActive(concept);
        const picked = pickedConceptIds.includes(concept.id);
        const words = segment.words.length ? segment.words : [{ text: segment.text, start: segment.start, end: segment.end }];
        const clickTitle = joinMode
            ? (picked ? 'Unpick this concept' : 'Pick this concept to join')
            : (on ? 'Click to turn this concept off' : 'Click to turn this concept back on');
        return (
            <span
                key={segment.start}
                className={cn(
                    'mx-0.5 inline-flex flex-wrap items-center rounded-full border px-1.5 py-0.5 align-middle leading-6 transition-colors',
                    on ? getConceptColor(concept, index).chip : INACTIVE_CHIP,
                    picked && 'ring-2 ring-gray-800 ring-offset-1'
                )}
                data-testid="concept-piece"
                data-concept-id={concept.id}
                data-text={segment.text}
                data-on={on ? 'true' : 'false'}
                title={concept.name}
            >
                {words.map((word, w) => {
                    // Characters between two words inside the piece (such as a hyphen) stay visible
                    const between = w > 0 ? segment.text.slice(words[w - 1].end - segment.start, word.start - segment.start).trim() : '';
                    return (
                        <React.Fragment key={word.start}>
                            {between && <span className="px-0.5">{between}</span>}
                            {w > 0 && !joinMode && (
                                <button
                                    type="button"
                                    onClick={() => handleSplit(concept.id, word.start)}
                                    aria-label={`Split ${concept.name} between ${words[w - 1].text} and ${word.text}`}
                                    title={`Split between "${words[w - 1].text}" and "${word.text}"`}
                                    data-testid="split-icon"
                                    className="mx-0.5 rounded p-0.5 opacity-50 hover:bg-white/70 hover:opacity-100"
                                >
                                    <SplitIcon className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {w > 0 && joinMode && <span className="w-1" aria-hidden="true" />}
                            <button
                                type="button"
                                onClick={() => handleConceptClick(concept.id)}
                                aria-pressed={joinMode ? picked : on}
                                title={clickTitle}
                                className="rounded-full px-0.5"
                            >
                                {word.text}
                            </button>
                        </React.Fragment>
                    );
                })}
            </span>
        );
    };

    const renderQuestion = () => (
        <p className="mt-4 text-lg leading-[2.75rem] text-gray-800" data-testid="question-with-concepts">
            {layout.map((item, i) => {
                if (item.type === 'gap') {
                    return <span key={`gap-${i}`} className="whitespace-pre-wrap">{item.text}</span>;
                }
                if (item.type === 'join') {
                    if (joinMode) return <span key={`gap-${i}`} className="whitespace-pre-wrap">{item.text}</span>;
                    return (
                        <button
                            key={`join-${i}`}
                            type="button"
                            onClick={() => handleJoinNeighbors(item.left, item.right)}
                            aria-label={`Join ${item.left.text} and ${item.right.text}`}
                            title={`Join "${item.left.text}" and "${item.right.text}"`}
                            data-testid="join-icon"
                            className="mx-0.5 rounded p-0.5 align-middle text-gray-300 hover:bg-gray-100 hover:text-gray-700"
                        >
                            <JoinIcon className="h-4 w-4" />
                        </button>
                    );
                }
                return item.segment.kind === 'concept' ? renderConceptPiece(item.segment) : renderPlainWord(item.segment);
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
            const picked = pickedConceptIds.includes(concept.id);
            return (
                <li key={concept.id}>
                    <button
                        type="button"
                        onClick={() => handleConceptClick(concept.id)}
                        aria-pressed={picked}
                        className={cn('inline-flex items-center rounded-full border px-3 py-1 text-sm', color, picked && 'ring-2 ring-gray-800 ring-offset-1')}
                    >
                        {picked && <CheckIcon className="mr-1 h-4 w-4" />}
                        {concept.name}
                    </button>
                </li>
            );
        }

        const hasPieces = conceptParts(concept).length >= 2;
        return (
            <li key={concept.id} className={cn('inline-flex items-center rounded-full border text-sm', color)}>
                <button
                    type="button"
                    onClick={() => handleConceptClick(concept.id)}
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
                {hasPieces && (
                    <button
                        type="button"
                        onClick={() => handleSeparate(concept.id)}
                        aria-label={`Separate ${concept.name}`}
                        title="Separate into its parts"
                        className="p-1 opacity-60 hover:opacity-100"
                    >
                        <SplitIcon className="h-3.5 w-3.5" />
                    </button>
                )}
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

    const renderFollowUp = (followUp) => {
        const busy = answeringFollowUpId === followUp.id;
        const isEditingAnswer = editingAnswerId === followUp.id;
        const showInput = followUp.status !== 'answered' || isEditingAnswer;
        const typed = answers[followUp.id] || '';
        const waiting = (followUp.suggestions || []).filter((s) => s.status === 'open');
        const added = (followUp.suggestions || []).filter((s) => s.status === 'added');

        return (
            <li key={followUp.id} className="rounded-md border border-gray-200 p-3" data-testid="follow-up">
                <p className="text-sm font-medium text-gray-800">{followUp.question}</p>
                {showInput ? (
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
                                } else if (e.key === 'Escape' && isEditingAnswer) {
                                    cancelEditAnswer();
                                }
                            }}
                            className="block flex-1 rounded-md border-gray-300 text-sm shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={() => handleAnswer(followUp)}
                            disabled={isAnswering || !typed.trim()}
                            className="inline-flex items-center justify-center rounded-md bg-main px-3 py-2 text-sm font-medium text-white hover:bg-main-dark disabled:bg-main/50"
                        >
                            {busy ? (
                                <>
                                    <Spinner />
                                    <span className="ml-2">Finding concepts...</span>
                                </>
                            ) : (isEditingAnswer ? 'Update answer' : 'Suggest concepts')}
                        </button>
                        {isEditingAnswer ? (
                            <button type="button" onClick={cancelEditAnswer} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700">
                                Cancel
                            </button>
                        ) : (
                            <button type="button" onClick={() => handleSkip(followUp.id)} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700">
                                Skip
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                            <CheckIcon className="h-4 w-4 text-green-600" />
                            <span>Your answer: {followUp.answer}</span>
                            <button
                                type="button"
                                onClick={() => startEditAnswer(followUp)}
                                disabled={isAnswering}
                                aria-label={`Edit your answer to: ${followUp.question}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-main hover:underline disabled:opacity-50"
                            >
                                <PencilIcon className="h-3.5 w-3.5" />
                                Edit
                            </button>
                        </p>
                        {waiting.length > 0 && (
                            <div className="mt-2" data-testid="answer-suggestions">
                                <p className="text-xs text-gray-500">Suggested from your answer. Add the ones you want:</p>
                                <ul className="mt-1 flex flex-wrap items-center gap-2">
                                    {waiting.map((suggestion) => (
                                        <li key={suggestion.id} className="inline-flex items-center rounded-full border border-dashed border-gray-300 bg-white text-sm">
                                            <button
                                                type="button"
                                                onClick={() => handleAddAnswerSuggestions(followUp.id, [suggestion.id])}
                                                disabled={atLimit}
                                                title="Add this concept"
                                                className="inline-flex items-center gap-1 rounded-l-full px-3 py-1 text-gray-700 hover:bg-main/10 disabled:opacity-50"
                                            >
                                                <PlusCircleIcon className="h-4 w-4 text-main" />
                                                {suggestion.name}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => dismissAnswerSuggestion(followUp.id, suggestion.id)}
                                                aria-label={`Dismiss ${suggestion.name}`}
                                                title="Dismiss"
                                                className="rounded-r-full px-2 py-1 text-gray-400 hover:text-gray-600"
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                    {waiting.length > 1 && (
                                        <li>
                                            <button
                                                type="button"
                                                onClick={() => handleAddAnswerSuggestions(followUp.id, waiting.map((s) => s.id))}
                                                disabled={atLimit}
                                                className="text-sm font-medium text-main hover:underline disabled:opacity-50"
                                            >
                                                Add all
                                            </button>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                        {added.length > 0 && (
                            <p className="mt-1 text-xs text-gray-500">Added: {added.map((s) => s.name).join(', ')}</p>
                        )}
                    </>
                )}
            </li>
        );
    };

    return (
        // A disabled fieldset turns off every button and box inside it, for mouse and keyboard users alike
        <fieldset disabled={isLoading} className={cn('min-w-0 space-y-6', isLoading && 'opacity-60')} aria-busy={isLoading ? 'true' : 'false'}>
            {/* 1. The question with its concepts */}
            <section className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-800">Concepts in your question</h3>
                    {question.trim() && (joinMode ? renderJoinControls('question') : (
                        <button
                            type="button"
                            onClick={toggleJoinMode}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            <JoinIcon className="h-4 w-4" />
                            Join words
                        </button>
                    ))}
                </div>
                {joinMode ? (question.trim() && renderJoinHint(true)) : (
                    <p className="mt-1 text-sm text-gray-500">
                        Click a word to make it a concept, and click a concept to turn it off or back on.
                        Use <JoinIcon className="inline h-4 w-4 align-text-bottom" /> to join neighbors and{' '}
                        <SplitIcon className="inline h-4 w-4 align-text-bottom" /> to split a concept. To join words that are apart, use <strong>Join words</strong>.
                    </p>
                )}

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
                        <p className="mt-1 text-xs text-gray-500">
                            Answer any that apply. The AI suggests concepts from your answer, and you choose which to add.
                        </p>
                        <ul className="mt-3 space-y-3">
                            {followUps.map(renderFollowUp)}
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
                            {activeCount} of {concepts.length} turned on (up to {MAX_CONCEPTS}). Only concepts that are turned on are used for keywords.
                        </p>
                    </div>
                    {joinMode ? renderJoinControls('list') : concepts.length >= 2 && (
                        <button
                            type="button"
                            onClick={toggleJoinMode}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            Join concepts
                        </button>
                    )}
                </div>
                {joinMode && renderJoinHint(!question.trim())}

                {concepts.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">No concepts yet.</p>
                ) : (
                    <ul className="mt-4 flex flex-wrap gap-2" data-testid="concept-list">
                        {concepts.map((concept, index) => renderConceptChip(concept, index))}
                    </ul>
                )}
            </section>

        </fieldset>
    );
};

export default ConceptBuilder;