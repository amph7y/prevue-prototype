/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const {
  ValidationError,
  validateGeminiRequest,
  validateFanarRequest,
  validatePubMedRequest,
  validateElsevierRequest,
  validateCoreRequest,
  validateSemanticScholarRequest,
  validateCreateUserRequest,
  validateUpdateUserAccessRequest,
  validateDeleteUserRequest,
  validateConceptTaskRequest,
} = require('./validation');
const { AiResponseError, buildConceptTaskPrompt, readConceptTaskResult } = require('./conceptTasks');

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// ---------- Safe request handling ----------

// An error whose message is safe to show to the user
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Only accept the HTTP method the app actually uses
const allowMethod = (req, res, method) => {
  if (req.method === method) return true;
  res.set('Allow', method);
  res.status(405).json({ error: 'Method not allowed' });
  return false;
};

// Send a safe error to the browser. Details stay in the server logs only.
const sendError = (res, error, context) => {
  if (error instanceof ValidationError || error instanceof HttpError || error instanceof AiResponseError) {
    return res.status(error.status).json({ error: error.message });
  }
  logger.error(`${context} failed`, { name: error?.name, message: error?.message });
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

const readErrorBody = (response) => response.text().catch(() => '');

// Turn an error from an outside service into a safe error.
// The service's reply is logged on the server (shortened), never sent to the browser.
const upstreamError = (serviceName, status, bodyText) => {
  logger.error(`${serviceName} returned an error`, { status, body: String(bodyText || '').slice(0, 500) });
  if (status === 429) {
    return new HttpError(429, `${serviceName} is busy right now (Too Many Requests). Please try again shortly.`);
  }
  return new HttpError(502, `${serviceName} is not available right now. Please try again later.`);
};

// Escape text before putting it inside an HTML email
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

exports.callGeminiApi = functions.https.onRequest({
  secrets: ["GEMINI_API_KEY"]
}, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      const { prompt } = validateGeminiRequest(req.body);

      // The API key goes in a header, not in the URL, so it can't leak through error messages or logs
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw upstreamError('The AI service', response.status, await readErrorBody(response));
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      let parsedResult;
      try {
        parsedResult = JSON.parse(text);
      } catch (parseError) {
        // Log only the size: the AI's answer can contain users' research content
        logger.error('Failed to parse Gemini API response', { length: typeof text === 'string' ? text.length : 0 });
        throw new HttpError(502, 'The AI returned an invalid response format.');
      }
      res.json(parsedResult);
    } catch (error) {
      sendError(res, error, 'Gemini request');
    }
  });
});

exports.searchCore = functions.https.onRequest({
    secrets: ["CORE_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      const { query, limit, offset } = validateCoreRequest(req.body);

      const response = await fetch('https://api.core.ac.uk/v3/search/works', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CORE_API_KEY}`
        },
        body: JSON.stringify({
          q: query,
          // Fixed list: the app always sends this same list
          exclude: ['fullText', 'links', 'outputs'],
          limit: limit,
          offset: offset,
          entity_type: "works"
        })
      });

      if (!response.ok) {
        throw upstreamError('CORE', response.status, await readErrorBody(response));
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      sendError(res, error, 'CORE search');
    }
  });
});

exports.searchPubMed = functions.https.onRequest({
    secrets: ["PUBMED_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      // Only known PubMed endpoints and parameters are accepted
      const { endpoint, params } = validatePubMedRequest(req.body);

      // The API key goes in the request body only, never in the URL
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({...params, 'api_key': process.env.PUBMED_API_KEY})
      });

      if (!response.ok) {
        throw upstreamError('PubMed', response.status, await readErrorBody(response));
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      sendError(res, error, 'PubMed search');
    }
  });
});

exports.searchElsevier = functions.https.onRequest({
    secrets: ["ELSEVIER_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      // dbKey becomes part of the URL, so only 'scopus' and 'embase' are accepted
      const { dbKey, query, limit, offset } = validateElsevierRequest(req.body);

      // The API key goes in a header, not in the URL
      const url = `https://api.elsevier.com/content/search/${dbKey}?query=${encodeURIComponent(query)}&count=${limit}&start=${offset}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-ELS-APIKey': process.env.ELSEVIER_API_KEY
        }
      });

      if (!response.ok) {
        throw upstreamError('Scopus/Embase', response.status, await readErrorBody(response));
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      sendError(res, error, 'Elsevier search');
    }
  });
});

// Semantic Scholar proxy to avoid CORS and centralize rate limiting
exports.searchSemanticScholar = functions.https.onRequest({
  secrets: ["SEMANTIC_SCHOLAR_API_KEY"]
}, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      const { query, limit, offset } = validateSemanticScholarRequest(req.body);

      // Fixed field list: the app always asks for these same fields
      const fields = 'paperId,title,authors,year,citationCount,referenceCount,isOpenAccess,venue,abstract,url,fieldsOfStudy,externalIds';
      const params = new URLSearchParams({
        query: query,
        fields: fields,
        limit: String(limit),
        offset: String(offset)
      });

      const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
      const headers = { 'Accept': 'application/json' };
      // if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      //   headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
      // }

      // Retry a few times on "Too Many Requests", but finish well within the
      // function's time limit (the app also retries on its own)
      const maxAttempts = 4;
      const maxDelayMs = 10000;
      let apiResponse = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // Log sizes only: the search text can reveal a user's research topic
        logger.info('SemanticScholar proxy request', { queryLength: query.length, limit, offset, attempt });
        apiResponse = await fetch(url, { headers });
        if (apiResponse.status !== 429 || attempt === maxAttempts - 1) break;

        const retryAfterSeconds = Number(apiResponse.headers.get('retry-after'));
        const baseDelayMs = retryAfterSeconds > 0
          ? Math.min(maxDelayMs, retryAfterSeconds * 1000)
          : Math.min(maxDelayMs, 2000 * Math.pow(2, attempt));
        const jitter = Math.floor(Math.random() * 1000);
        logger.warn('SemanticScholar returned 429, will retry', { attempt, baseDelayMs, jitter });
        await new Promise(r => setTimeout(r, baseDelayMs + jitter));
      }

      if (!apiResponse.ok) {
        const errorText = await readErrorBody(apiResponse);
        // End of the results: the app treats this as "no more results"
        if (apiResponse.status === 400 && /not available/i.test(errorText)) {
          return res.status(400).json({ error: 'Requested results are not available.' });
        }
        // A final 429 is passed on as 429 (never as a 500); other errors become a safe 502
        throw upstreamError('Semantic Scholar', apiResponse.status, errorText);
      }

      const data = await apiResponse.json();
      logger.info('SemanticScholar proxy response', { status: apiResponse.status, total: data?.total, count: data?.data?.length });
      res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      res.json(data);
    } catch (error) {
      sendError(res, error, 'Semantic Scholar search');
    }
  });
});


// Admin functions for user management
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
// Helper to create SMTP transporter at request time (secrets available only then)
const createSmtpTransport = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  // Accept common truthy values for secure
  const secureEnv = (process.env.SMTP_SECURE || '').toString().toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || secureEnv === 'yes';
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));
  try {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  } catch (e) {
    console.warn('Failed to build SMTP transporter:', e);
    return null;
  }
};

const db = admin.firestore();

// Helper function to verify admin access
const verifyAdminAccess = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'No authorization token provided');
  }

  const token = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    throw new HttpError(401, 'Your session is invalid or has expired. Please sign in again.');
  }

  // Check if user is admin
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new HttpError(403, 'Insufficient permissions');
  }

  return decodedToken;
};

// Clear, safe messages for common admin errors (shown in the admin dashboard)
const ADMIN_ERROR_MESSAGES = new Map([
  ['auth/email-already-exists', [409, 'A user with this email already exists.']],
  ['auth/invalid-email', [400, 'Email is invalid']],
  ['auth/invalid-password', [400, 'Password must be 8+ chars with upper, lower, number, symbol']],
  ['auth/user-not-found', [404, 'User not found.']],
]);

const toAdminError = (error) => {
  const known = ADMIN_ERROR_MESSAGES.get(error?.code);
  if (known) return new HttpError(known[0], known[1]);
  // Firestore "not found" when updating a user that doesn't exist
  if (error?.code === 5 || error?.code === 'not-found') return new HttpError(404, 'User not found.');
  return error;
};

// Get all users
exports.getUsers = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'GET')) return;
    try {
      await verifyAdminAccess(req);
      
      const usersSnapshot = await db.collection('users').get();
      const users = [];
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          email: userData.email || '',
          displayName: userData.displayName || '',
          role: userData.role || 'user',
          accessLevel: userData.accessLevel || 'free',
          createdAt: userData.createdAt || null,
          lastLoginAt: userData.lastLoginAt || null,
          isActive: userData.isActive !== false
        });
      });
      
      res.json({ users });
    } catch (error) {
      sendError(res, error, 'Get users');
    }
  });
});

// Create user
exports.createUser = functions.https.onRequest({
  secrets: [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "SMTP_SECURE",
  ]
}, (req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      await verifyAdminAccess(req);

      // Check the input on the server too (same rules as the create-user form)
      const { email, password, displayName, accessLevel, role } = validateCreateUserRequest(req.body);

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        ...(displayName ? { displayName } : {})
      });

      // Generate a verification link
      const fallbackUrl = 'https://prevue-testing.vercel.app/#';
      const actionCodeSettings = {
        url: fallbackUrl,
        handleCodeInApp: false
      };
      const verificationLink = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);

      // Send email via SMTP if transporter is configured
      const mailTransporter = createSmtpTransport();
      if (mailTransporter) {
        try {
          const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
          await mailTransporter.sendMail({
            from: fromAddress,
            to: email,
            subject: 'Verify your PreVue account',
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Welcome to PreVue</h2>
                <p>Hello${displayName ? ' ' + escapeHtml(displayName) : ''},</p>
                <p>An administrator created an account for you. Please verify your email to activate your account:</p>
                <p><a href="${verificationLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p><a href="${verificationLink}">${verificationLink}</a></p>
              </div>
            `,
            text: `Hello${displayName ? ' ' + displayName : ''},\n\nAn administrator created an account for you. Verify your email to activate: ${verificationLink}\n\nIf you did not expect this, you can ignore this message.`
          });
        } catch (mailError) {
          console.warn('Failed to send verification email via SMTP:', mailError);
        }
      } else {
        console.warn('Mail transporter is not configured.');
      }

      // Create Firestore document
      await db.collection('users').doc(userRecord.uid).set({
        email,
        displayName: displayName || '',
        role,
        accessLevel,
        createdAt: FieldValue.serverTimestamp(),
        isActive: true,
        verifyEmail: false
      });

      res.json({
        success: true,
        message: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
          ? 'User created and verification email sent.'
          : 'User created; verification link generated (email not sent: SMTP not configured).',
        user: {
          id: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          role,
          accessLevel
        }
      });
    } catch (error) {
      sendError(res, toAdminError(error), 'Create user');
    }
  });
});

// Update user access level
exports.updateUserAccess = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      await verifyAdminAccess(req);
      
      // Only known plans ('free', 'premium') and roles ('user', 'admin') are accepted
      const { userId, update: updateData } = validateUpdateUserAccessRequest(req.body);

      await db.collection('users').doc(userId).update(updateData);

      res.json({ success: true });
    } catch (error) {
      sendError(res, toAdminError(error), 'Update user access');
    }
  });
});

// Delete user
exports.deleteUser = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      await verifyAdminAccess(req);
      
      const { userId } = validateDeleteUserRequest(req.body);

      // Delete from Firebase Auth
      await admin.auth().deleteUser(userId);
      
      // Delete from Firestore
      await db.collection('users').doc(userId).delete();

      res.json({ success: true });
    } catch (error) {
      sendError(res, toAdminError(error), 'Delete user');
    }
  });
});



// Admin-only backfill to enforce Firestore users schema for existing Auth users
exports.backfillUsersSchema = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (!allowMethod(req, res, 'POST')) return;
    try {
      await verifyAdminAccess(req); 
      const results = { created: 0, updated: 0, checked: 0, errors: 0, errorSamples: [] };

      
      const safeTimestamp = (date) => {
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date; 
  }
  return null;
};


      const processPage = async (nextPageToken) => {
        const listResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const userRecord of listResult.users) {
          try {
            results.checked += 1;
            const uid = userRecord.uid;
            const userDocRef = db.collection('users').doc(uid);
            const userDoc = await userDocRef.get();

            const authEmail = userRecord.email || '';
            const authDisplayName = userRecord.displayName || '';

            const createdAtDate = userRecord.metadata?.creationTime
              ? new Date(userRecord.metadata.creationTime)
              : null;
            const lastLoginDate = userRecord.metadata?.lastSignInTime
              ? new Date(userRecord.metadata.lastSignInTime)
              : null;
              
            const createdAt = safeTimestamp(createdAtDate);
            const lastLoginAt = safeTimestamp(lastLoginDate);

            if (!userDoc.exists) {
              await userDocRef.set({
                email: authEmail,
                displayName: authDisplayName,
                role: 'user',
                accessLevel: 'free',
                createdAt: createdAt || admin.firestore.Timestamp.now(),
                lastLoginAt: lastLoginAt || null,
                isActive: true,
                verifyEmail: !!userRecord.emailVerified
              }, { merge: true });
              results.created += 1;
            } else {
              const data = userDoc.data() || {};
              const updateData = {};

              if (!data.email && authEmail) updateData.email = authEmail;
              if (!data.displayName && authDisplayName) updateData.displayName = authDisplayName;
              if (!data.role) updateData.role = 'user';
              if (!data.accessLevel) updateData.accessLevel = 'free';
              if (!data.createdAt) updateData.createdAt = createdAt || admin.firestore.Timestamp.now();
              if (!data.lastLoginAt && lastLoginAt) updateData.lastLoginAt = lastLoginAt;
              if (data.isActive === undefined) updateData.isActive = true;
              if (data.verifyEmail === undefined) updateData.verifyEmail = !!userRecord.emailVerified;

              if (Object.keys(updateData).length > 0) {
                await userDocRef.set(updateData, { merge: true });
                results.updated += 1;
              }
            }
          } catch (e) {
            console.error('Backfill error for user', userRecord.uid, e);
            results.errors += 1;
            if (results.errorSamples.length < 10) {
              results.errorSamples.push({ uid: userRecord.uid, message: e?.message || String(e) });
            }
          }
        }

        if (listResult.pageToken) {
          await processPage(listResult.pageToken);
        }
      };

      await processPage();

      res.json({ success: true, ...results });
    } catch (error) {
      sendError(res, error, 'Backfill users schema');
    }
  });
});

// Health check function
exports.healthCheck = functions.https.onRequest((req, res) => {
  return cors(req, res, () => {
    res.json({ status: 'OK', message: 'Firebase Functions are running' });
  });
});

const FANAR_DEFAULT_MODEL = "Fanar-C-2-27B";

// Sends instructions to Fanar and returns only the reply text
const askFanar = async (prompt, { model = FANAR_DEFAULT_MODEL, maxTokens }) => {
  const response = await fetch("https://api.fanar.qa/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.FANAR_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw upstreamError("The AI service", response.status, await readErrorBody(response));
  }

  const data = await response.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content ?? "";
};

exports.callFanarApi = functions.https.onRequest(
  // Keyword replies can be long, so allow up to 2 minutes
  { secrets: ["FANAR_API_KEY"], timeoutSeconds: 120 },
  (req, res) => {
    return cors(req, res, async () => {
      if (!allowMethod(req, res, 'POST')) return;
      try {
        // Step 1 AI tasks: the server writes the AI instructions and checks the reply
        if (req.body && typeof req.body === 'object' && req.body.task !== undefined) {
          const task = validateConceptTaskRequest(req.body);
          const { prompt, maxTokens } = buildConceptTaskPrompt(task);
          const text = await askFanar(prompt, { maxTokens });
          try {
            return res.json({ data: readConceptTaskResult(task, text) });
          } catch (error) {
            // Log only the size: the reply can contain the researcher's content
            logger.warn('Fanar task reply could not be used', {
              task: task.task,
              length: typeof text === 'string' ? text.length : 0,
            });
            throw error;
          }
        }

        // Older mode: the browser sends its own prompt. The new website no longer uses it,
        // so it can be switched off once the new website is live everywhere.
        // Only a plain prompt and the model the app uses are accepted.
        const { prompt, model } = validateFanarRequest(req.body);
        const text = await askFanar(prompt, { model, maxTokens: 600 });
        // Return only the generated text, not the provider's full reply
        return res.json({ text });
      } catch (error) {
        return sendError(res, error, "Fanar request");
      }
    });
  }
);
