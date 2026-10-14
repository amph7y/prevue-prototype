// Search counts the researcher enters by hand, after running the query on the database's own website.
// Plain JavaScript (no React), so it can be tested with Node:  npm test

import { DB_CONFIG } from '../config/dbConfig.js';

export const MAX_MANUAL_COUNT = 1000000000;
const MAX_SAVED_ITEMS = 50;
const FINGERPRINT = /^[0-9a-f]{8}$/;

// Databases PreVue can't search itself: the researcher runs the query there and enters the count
export const MANUAL_ONLY_DATABASES = Object.freeze(['embase', 'googleScholar']);
export const isManualOnly = (dbKey) => MANUAL_ONLY_DATABASES.includes(dbKey);

const isKnownDatabase = (dbKey) => typeof dbKey === 'string' && Object.prototype.hasOwnProperty.call(DB_CONFIG, dbKey);

// Arabic-Indic and Persian digits are read as 0-9
const EASTERN_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;
const toAsciiDigits = (text) => text.replace(EASTERN_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf));

// Reads a count typed by the researcher: "1234", "1,234" and "1 234" all work.
// Empty input means "no count". Returns { value, error }.
export function parseCountInput(raw) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text === '') return { value: null, error: null };
    // Spaces and commas (including Arabic ones) are allowed as thousands separators
    const compact = toAsciiDigits(text).replace(/[\s,\u00a0\u202f\u066c\u060c]/g, '');
    if (!/^[0-9]+$/.test(compact)) return { value: null, error: 'Enter a whole number, for example 1234.' };
    const value = Number(compact);
    if (!Number.isSafeInteger(value) || value > MAX_MANUAL_COUNT) {
        return { value: null, error: `Enter a number up to ${MAX_MANUAL_COUNT.toLocaleString('en-US')}.` };
    }
    return { value, error: null };
}

// A short fingerprint of a query (spacing ignored). Saved with a count, so the app can tell
// when the query has changed since the count was entered.
export function queryFingerprint(query) {
    const text = typeof query === 'string' ? query.replace(/\s+/g, ' ').trim() : '';
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

// Counts saved in a project, as { [dbKey]: { count, enteredAt, queryKey } }.
// Anything unknown, broken or out of range is skipped, so bad data can't break the page.
export function normalizeManualCounts(raw) {
    const counts = {};
    if (!Array.isArray(raw)) return counts;
    for (const item of raw.slice(0, MAX_SAVED_ITEMS)) {
        if (!item || typeof item !== 'object') continue;
        const { db, count, enteredAt, queryKey } = item;
        if (!isKnownDatabase(db) || counts[db]) continue;
        if (!Number.isSafeInteger(count) || count < 0 || count > MAX_MANUAL_COUNT) continue;
        const date = typeof enteredAt === 'string' && enteredAt.length <= 40 ? new Date(enteredAt) : null;
        counts[db] = {
            count,
            enteredAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
            queryKey: typeof queryKey === 'string' && FINGERPRINT.test(queryKey) ? queryKey : null,
        };
    }
    return counts;
}

// The form saved with the project: a list in database order. (A list is replaced as a whole
// when the project is saved, so a removed count is really removed.)
export function serializeManualCounts(counts) {
    return Object.keys(DB_CONFIG)
        .filter((db) => counts && counts[db] && Number.isSafeInteger(counts[db].count))
        .map((db) => ({
            db,
            count: counts[db].count,
            enteredAt: counts[db].enteredAt || null,
            queryKey: counts[db].queryKey || null,
        }));
}

// Saves the researcher's count for one database, or removes it when count is null
export function setManualCount(counts, dbKey, count, query, now = new Date()) {
    const next = { ...(counts || {}) };
    if (!isKnownDatabase(dbKey)) return next;
    if (count === null || count === undefined) {
        delete next[dbKey];
        return next;
    }
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_MANUAL_COUNT) return next;
    next[dbKey] = { count, enteredAt: now.toISOString(), queryKey: queryFingerprint(query) };
    return next;
}

// True when the query has changed since the count was entered
export function countIsOutdated(entry, currentQuery) {
    return Boolean(entry && entry.queryKey) && entry.queryKey !== queryFingerprint(currentQuery);
}

const isUsableLiveCount = (value) => value !== undefined && value !== null && value !== ''
    && value !== 'Error' && value !== 'N/A' && !Number.isNaN(Number(value));

// The total across the selected databases: the researcher's count where there is one,
// otherwise the live count (when the plan shows live counts).
// Returns { total, manual, live }: the total and how many databases each kind came from.
export function combinedTotal(dbKeys, { liveCounts = {}, manualCounts = {}, includeLive = true } = {}) {
    let total = 0;
    let manual = 0;
    let live = 0;
    for (const db of Array.isArray(dbKeys) ? dbKeys : []) {
        const entry = manualCounts && manualCounts[db];
        if (entry && Number.isSafeInteger(entry.count)) {
            total += entry.count;
            manual += 1;
            continue;
        }
        const value = liveCounts && liveCounts[db] ? liveCounts[db].count : undefined;
        if (includeLive && isUsableLiveCount(value)) {
            total += Number(value);
            live += 1;
        }
    }
    return { total, manual, live };
}

// Adds databases that have a saved count to the selection, so the counts stay visible
// when the project is opened again. The plan's database limit and guest rules still apply.
export function selectDatabasesWithCounts(selected, counts, { maxDatabases = Infinity, isGuest = false } = {}) {
    const next = { ...(selected || {}) };
    let chosen = Object.values(next).filter(Boolean).length;
    for (const db of Object.keys(DB_CONFIG)) {
        if (!counts || !counts[db] || next[db]) continue;
        if (isGuest && db !== 'pubmed') continue;
        if (chosen >= maxDatabases) break;
        next[db] = true;
        chosen += 1;
    }
    return next;
}
