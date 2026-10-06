'use strict';

/**
 * Input checks for the HTTP functions in index.js.
 *
 * Each check throws a ValidationError. Its message is safe to show to users,
 * and the function handlers turn it into a 400 response.
 *
 * The limits are set above what the PreVue app itself sends today, so normal
 * use is not affected. They block oversized or malformed requests.
 */

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

const LIMITS = Object.freeze({
  PROMPT_MAX_CHARS: 50000, // the app's prompts are about 4,000 characters plus the user's text
  QUERY_MAX_CHARS: 20000, // long Boolean search strings
  PUBMED_MAX_RESULTS: 500, // the app asks for up to 100 per page and 50 per export batch
  PUBMED_MAX_IDS: 500,
  ELSEVIER_MAX_RESULTS: 200, // the app asks for up to 100 per page and 25 per export batch
  CORE_MAX_RESULTS: 1000, // the app asks for up to 500 per export batch
  SEMANTIC_SCHOLAR_MAX_RESULTS: 100, // Semantic Scholar's own maximum
  MAX_OFFSET: 100000,
  EMAIL_MAX_CHARS: 254,
  PASSWORD_MAX_CHARS: 128,
  DISPLAY_NAME_MAX_CHARS: 100,
  USER_ID_MAX_CHARS: 128,
});

const PUBMED_ENDPOINTS = Object.freeze(['esearch.fcgi', 'esummary.fcgi', 'efetch.fcgi']);
const ELSEVIER_DATABASES = Object.freeze(['scopus', 'embase']);
const FANAR_MODELS = Object.freeze(['Fanar-C-2-27B']);
const ROLES = Object.freeze(['user', 'admin']);
const ACCESS_LEVELS = Object.freeze(['free', 'premium']);

// Same rule and message as the create-user form in the admin dashboard
const PASSWORD_RULE_MESSAGE = 'Password must be 8+ chars with upper, lower, number, symbol';

// ---------- Generic checks ----------

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function asObject(value, name = 'Request body') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be a JSON object`);
  }
  return value;
}

function requireText(value, name, maxChars) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${name} is required`);
  }
  if (value.length > maxChars) {
    throw new ValidationError(`${name} is too long`);
  }
  return value;
}

function optionalText(value, name, maxChars) {
  if (isMissing(value)) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be text`);
  }
  if (value.length > maxChars) {
    throw new ValidationError(`${name} is too long`);
  }
  return value;
}

function optionalWholeNumber(value, name, { min, max, fallback }) {
  if (isMissing(value)) return fallback;
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${name} must be a whole number from ${min} to ${max}`);
  }
  return number;
}

function requireOneOf(value, name, allowed) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${name} is not supported`);
  }
  return value;
}

// ---------- AI functions ----------

function validateGeminiRequest(body) {
  const { prompt } = asObject(body);
  return { prompt: requireText(prompt, 'Prompt', LIMITS.PROMPT_MAX_CHARS) };
}

function validateFanarRequest(body) {
  const { prompt, model } = asObject(body);
  return {
    prompt: requireText(prompt, 'Prompt', LIMITS.PROMPT_MAX_CHARS),
    model: isMissing(model) ? FANAR_MODELS[0] : requireOneOf(model, 'Model', FANAR_MODELS),
  };
}

// ---------- Search functions ----------

function validatePubMedIds(value) {
  if (typeof value !== 'string' || !/^\d+(,\d+)*$/.test(value)) {
    throw new ValidationError('Article IDs must be a comma-separated list of numbers');
  }
  if (value.split(',').length > LIMITS.PUBMED_MAX_IDS) {
    throw new ValidationError(`No more than ${LIMITS.PUBMED_MAX_IDS} article IDs per request`);
  }
  return value;
}

function validatePubMedRequest(body) {
  const { endpoint, params } = asObject(body);
  if (!endpoint || !params) {
    throw new ValidationError('Endpoint and params are required');
  }
  requireOneOf(endpoint, 'Endpoint', PUBMED_ENDPOINTS);
  asObject(params, 'Params');
  if (!isMissing(params.db) && params.db !== 'pubmed') {
    throw new ValidationError('Database is not supported');
  }

  // Rebuild the parameters from known fields only; anything else is dropped
  const clean = { db: 'pubmed' };
  const term = optionalText(params.term, 'Search query', LIMITS.QUERY_MAX_CHARS);
  if (term !== undefined) clean.term = term;
  if (!isMissing(params.id)) clean.id = validatePubMedIds(params.id);
  if (!isMissing(params.retmode)) {
    clean.retmode = requireOneOf(params.retmode, 'Response format', ['json', 'xml']);
  }
  const retmax = optionalWholeNumber(params.retmax, 'Number of results', { min: 0, max: LIMITS.PUBMED_MAX_RESULTS });
  if (retmax !== undefined) clean.retmax = retmax;
  const retstart = optionalWholeNumber(params.retstart, 'Start position', { min: 0, max: LIMITS.MAX_OFFSET });
  if (retstart !== undefined) clean.retstart = retstart;

  if (endpoint === 'esearch.fcgi' && clean.term === undefined) {
    throw new ValidationError('Search query is required');
  }
  if (endpoint !== 'esearch.fcgi' && clean.id === undefined) {
    throw new ValidationError('Article IDs are required');
  }
  return { endpoint, params: clean };
}

function validateElsevierRequest(body) {
  const { dbKey, query, limit, offset } = asObject(body);
  if (!dbKey || !query) {
    throw new ValidationError('Database key and query are required');
  }
  return {
    dbKey: requireOneOf(dbKey, 'Database', ELSEVIER_DATABASES),
    query: requireText(query, 'Query', LIMITS.QUERY_MAX_CHARS),
    limit: optionalWholeNumber(limit, 'Limit', { min: 1, max: LIMITS.ELSEVIER_MAX_RESULTS, fallback: 25 }),
    offset: optionalWholeNumber(offset, 'Offset', { min: 0, max: LIMITS.MAX_OFFSET, fallback: 0 }),
  };
}

function validateCoreRequest(body) {
  const { query, limit, offset } = asObject(body);
  return {
    query: requireText(query, 'Query', LIMITS.QUERY_MAX_CHARS),
    limit: optionalWholeNumber(limit, 'Limit', { min: 1, max: LIMITS.CORE_MAX_RESULTS, fallback: 25 }),
    offset: optionalWholeNumber(offset, 'Offset', { min: 0, max: LIMITS.MAX_OFFSET, fallback: 0 }),
  };
}

function validateSemanticScholarRequest(body) {
  const { query, limit, offset } = asObject(body);
  return {
    query: requireText(query, 'Query', LIMITS.QUERY_MAX_CHARS),
    limit: optionalWholeNumber(limit, 'Limit', { min: 1, max: LIMITS.SEMANTIC_SCHOLAR_MAX_RESULTS, fallback: 25 }),
    offset: optionalWholeNumber(offset, 'Offset', { min: 0, max: LIMITS.MAX_OFFSET, fallback: 0 }),
  };
}

// ---------- Admin functions ----------

// User IDs become part of a database path, so "/" and spaces are not allowed
function validateUserId(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.USER_ID_MAX_CHARS
      || /[/\s]/.test(value) || value === '.' || value === '..') {
    throw new ValidationError('User ID is invalid');
  }
  return value;
}

function isStrongPassword(password) {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function validateCreateUserRequest(body) {
  const { email, password, displayName, accessLevel, role } = asObject(body);
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }
  if (typeof email !== 'string' || email.length > LIMITS.EMAIL_MAX_CHARS
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Email is invalid');
  }
  if (typeof password !== 'string' || password.length > LIMITS.PASSWORD_MAX_CHARS
      || !isStrongPassword(password)) {
    throw new ValidationError(PASSWORD_RULE_MESSAGE);
  }
  return {
    email,
    password,
    displayName: optionalText(displayName, 'Display name', LIMITS.DISPLAY_NAME_MAX_CHARS),
    accessLevel: isMissing(accessLevel) ? 'free' : requireOneOf(accessLevel, 'Access level', ACCESS_LEVELS),
    role: isMissing(role) ? 'user' : requireOneOf(role, 'Role', ROLES),
  };
}

function validateUpdateUserAccessRequest(body) {
  const { userId, accessLevel, role } = asObject(body);
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  const update = {};
  if (accessLevel) update.accessLevel = requireOneOf(accessLevel, 'Access level', ACCESS_LEVELS);
  if (role) update.role = requireOneOf(role, 'Role', ROLES);
  if (Object.keys(update).length === 0) {
    throw new ValidationError('Nothing to update');
  }
  return { userId: validateUserId(userId), update };
}

function validateDeleteUserRequest(body) {
  const { userId } = asObject(body);
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  return { userId: validateUserId(userId) };
}

module.exports = {
  ValidationError,
  LIMITS,
  validateGeminiRequest,
  validateFanarRequest,
  validatePubMedRequest,
  validateElsevierRequest,
  validateCoreRequest,
  validateSemanticScholarRequest,
  validateCreateUserRequest,
  validateUpdateUserAccessRequest,
  validateDeleteUserRequest,
};
