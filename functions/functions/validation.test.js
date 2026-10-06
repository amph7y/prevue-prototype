'use strict';

// Tests for the server-side input checks.
// Run inside functions/functions with:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('./validation');

const throwsValidation = (fn, messagePattern) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof v.ValidationError, `expected ValidationError, got ${error && error.name}`);
    if (messagePattern) assert.match(error.message, messagePattern);
    return true;
  });
};

test('Gemini: accepts a normal prompt', () => {
  assert.deepEqual(v.validateGeminiRequest({ prompt: 'Find gaps in X' }), { prompt: 'Find gaps in X' });
});

test('Gemini: rejects missing, empty, non-text and oversized prompts', () => {
  throwsValidation(() => v.validateGeminiRequest({}), /Prompt is required/);
  throwsValidation(() => v.validateGeminiRequest({ prompt: '   ' }), /Prompt is required/);
  throwsValidation(() => v.validateGeminiRequest({ prompt: 42 }), /Prompt is required/);
  throwsValidation(() => v.validateGeminiRequest({ prompt: 'x'.repeat(v.LIMITS.PROMPT_MAX_CHARS + 1) }), /too long/);
  throwsValidation(() => v.validateGeminiRequest(null), /JSON object/);
  throwsValidation(() => v.validateGeminiRequest([]), /JSON object/);
});

test('Fanar: uses the app model by default and rejects other models', () => {
  assert.deepEqual(v.validateFanarRequest({ prompt: 'hi' }), { prompt: 'hi', model: 'Fanar-C-2-27B' });
  assert.equal(v.validateFanarRequest({ prompt: 'hi', model: 'Fanar-C-2-27B' }).model, 'Fanar-C-2-27B');
  throwsValidation(() => v.validateFanarRequest({ prompt: 'hi', model: 'some-other-model' }), /not supported/);
  throwsValidation(() => v.validateFanarRequest({ messages: [{ role: 'system', content: 'x' }] }), /Prompt is required/);
});

test('PubMed: keeps only known parameters', () => {
  const result = v.validatePubMedRequest({
    endpoint: 'esearch.fcgi',
    params: { db: 'pubmed', term: 'asthma', retmode: 'json', retmax: 25, retstart: 0, extra: 'dropped' },
  });
  assert.deepEqual(result, {
    endpoint: 'esearch.fcgi',
    params: { db: 'pubmed', term: 'asthma', retmode: 'json', retmax: 25, retstart: 0 },
  });
});

test('PubMed: accepts the summary request the app makes', () => {
  const result = v.validatePubMedRequest({ endpoint: 'esummary.fcgi', params: { db: 'pubmed', id: '1,22,333', retmode: 'json' } });
  assert.equal(result.params.id, '1,22,333');
});

test('PubMed: rejects unknown endpoints and bad parameters', () => {
  throwsValidation(() => v.validatePubMedRequest({ endpoint: '../../other', params: { term: 'x' } }), /not supported/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'einfo.fcgi', params: { term: 'x' } }), /not supported/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esearch.fcgi' }), /required/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esearch.fcgi', params: { db: 'protein', term: 'x' } }), /not supported/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esearch.fcgi', params: { term: 'x', retmax: 100000 } }), /whole number/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esummary.fcgi', params: { id: '1,abc' } }), /numbers/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esummary.fcgi', params: { id: Array(501).fill('1').join(',') } }), /No more than/);
  throwsValidation(() => v.validatePubMedRequest({ endpoint: 'esummary.fcgi', params: {} }), /Article IDs are required/);
});

test('Elsevier: accepts Scopus and Embase with the sizes the app uses', () => {
  assert.deepEqual(
    v.validateElsevierRequest({ dbKey: 'scopus', query: 'TITLE("x")' }),
    { dbKey: 'scopus', query: 'TITLE("x")', limit: 25, offset: 0 }
  );
  assert.equal(v.validateElsevierRequest({ dbKey: 'embase', query: 'x', limit: 100, offset: '50' }).offset, 50);
});

test('Elsevier: rejects other databases and out-of-range sizes', () => {
  throwsValidation(() => v.validateElsevierRequest({ dbKey: 'scopus/../../x', query: 'x' }), /not supported/);
  throwsValidation(() => v.validateElsevierRequest({ dbKey: 'scopus', query: 'x', limit: 0 }), /whole number/);
  throwsValidation(() => v.validateElsevierRequest({ dbKey: 'scopus', query: 'x', limit: 2.5 }), /whole number/);
  throwsValidation(() => v.validateElsevierRequest({ dbKey: 'scopus', query: 'x', offset: -1 }), /whole number/);
  throwsValidation(() => v.validateElsevierRequest({ query: 'x' }), /required/);
});

test('CORE and Semantic Scholar: allow the app batch sizes, reject larger ones', () => {
  assert.equal(v.validateCoreRequest({ query: 'x', limit: 500 }).limit, 500);
  throwsValidation(() => v.validateCoreRequest({ query: 'x', limit: v.LIMITS.CORE_MAX_RESULTS + 1 }), /whole number/);
  throwsValidation(() => v.validateCoreRequest({ limit: 5 }), /Query is required/);
  assert.equal(v.validateSemanticScholarRequest({ query: 'x', limit: 100 }).limit, 100);
  throwsValidation(() => v.validateSemanticScholarRequest({ query: 'x', limit: 101 }), /whole number/);
});

test('Create user: accepts the form defaults and a strong password', () => {
  assert.deepEqual(
    v.validateCreateUserRequest({ email: 'a@b.co', password: 'Str0ng!pass', displayName: 'Ali' }),
    { email: 'a@b.co', password: 'Str0ng!pass', displayName: 'Ali', accessLevel: 'free', role: 'user' }
  );
});

test('Create user: rejects weak passwords, bad emails and unknown roles or plans', () => {
  throwsValidation(() => v.validateCreateUserRequest({ email: 'a@b.co', password: 'weakpass' }), /Password must be/);
  throwsValidation(() => v.validateCreateUserRequest({ email: 'not-an-email', password: 'Str0ng!pass' }), /Email is invalid/);
  throwsValidation(() => v.validateCreateUserRequest({ email: 'a@b.co', password: 'Str0ng!pass', role: 'superadmin' }), /not supported/);
  throwsValidation(() => v.validateCreateUserRequest({ email: 'a@b.co', password: 'Str0ng!pass', accessLevel: 'gold' }), /not supported/);
  throwsValidation(() => v.validateCreateUserRequest({ email: 'a@b.co' }), /required/);
});

test('Update user access: only known roles and plans, and a safe user ID', () => {
  assert.deepEqual(
    v.validateUpdateUserAccessRequest({ userId: 'abc123', accessLevel: 'premium', role: 'user', displayName: 'ignored' }),
    { userId: 'abc123', update: { accessLevel: 'premium', role: 'user' } }
  );
  throwsValidation(() => v.validateUpdateUserAccessRequest({ userId: 'abc123', role: 'owner' }), /not supported/);
  throwsValidation(() => v.validateUpdateUserAccessRequest({ userId: 'abc/projects/p1', role: 'user' }), /User ID is invalid/);
  throwsValidation(() => v.validateUpdateUserAccessRequest({ userId: 'abc123' }), /Nothing to update/);
  throwsValidation(() => v.validateUpdateUserAccessRequest({ role: 'user' }), /User ID is required/);
});

test('Delete user: requires a safe user ID', () => {
  assert.deepEqual(v.validateDeleteUserRequest({ userId: 'abc123' }), { userId: 'abc123' });
  throwsValidation(() => v.validateDeleteUserRequest({}), /User ID is required/);
  throwsValidation(() => v.validateDeleteUserRequest({ userId: '../x' }), /User ID is invalid/);
});
