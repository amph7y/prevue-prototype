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

exports.callGeminiApi = functions.https.onRequest({
  secrets: ["GEMINI_API_KEY"]
}, (req, res) => {
  return cors(req, res, async () => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Could not parse error response.' }));
        throw new Error(`Gemini API error: ${response.statusText} - ${errorBody.error?.message || 'Unknown API error'}`);
      }

      const result = await response.json();
      
      try {
        const parsedResult = JSON.parse(result.candidates[0].content.parts[0].text);
        res.json(parsedResult);
      } catch (parseError) {
        console.error("Failed to parse Gemini API response:", result.candidates[0].content.parts[0].text);
        throw new Error("The AI returned an invalid response format.");
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.searchCore = functions.https.onRequest({
    secrets: ["CORE_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    try {
      const { query, limit = 25, offset = 0, exclude = ['fullText', 'links', 'outputs'] } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const response = await fetch('https://api.core.ac.uk/v3/search/works', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CORE_API_KEY}`
        },
        body: JSON.stringify({
          q: query,
          exclude: exclude,
          limit: limit,
          offset: offset,
          entity_type: "works"
        })
      });

      if (!response.ok) {
        throw new Error(`Core API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Core API error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.searchPubMed = functions.https.onRequest({
    secrets: ["PUBMED_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    try {
      const { endpoint, params } = req.body;
      
      if (!endpoint || !params) {
        return res.status(400).json({ error: 'Endpoint and params are required' });
      }

      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}?api_key=${process.env.PUBMED_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({...params, 'api_key': process.env.PUBMED_API_KEY})
      });

      if (!response.ok) {
        throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('PubMed API error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.searchElsevier = functions.https.onRequest({
    secrets: ["ELSEVIER_API_KEY"]
  }, (req, res) => {
  return cors(req, res, async () => {
    try {
      const { dbKey, query, limit = 25, offset = 0 } = req.body;
      
      if (!dbKey || !query) {
        return res.status(400).json({ error: 'Database key and query are required' });
      }

      const url = `https://api.elsevier.com/content/search/${dbKey}?apiKey=${process.env.ELSEVIER_API_KEY}&query=${encodeURIComponent(query)}&count=${limit}&start=${offset}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Elsevier API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Elsevier API error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Semantic Scholar proxy to avoid CORS and centralize rate limiting
exports.searchSemanticScholar = functions.https.onRequest({
  secrets: ["SEMANTIC_SCHOLAR_API_KEY"]
}, (req, res) => {
  return cors(req, res, async () => {
    try {
      const { query, limit = 25, offset = 0, fields } = req.body || {};

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const defaultFields = 'paperId,title,authors,year,citationCount,referenceCount,isOpenAccess,venue,abstract,url,fieldsOfStudy,externalIds';
      const params = new URLSearchParams({
        query: query,
        fields: fields || defaultFields,
        limit: String(limit),
        offset: String(offset)
      });

      const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
      const headers = { 'Accept': 'application/json' };
      // if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      //   headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
      // }

      const maxAttempts = 30;
      let attempt = 0;
      let apiResponse = null;
      let last429 = false;
      while (attempt < maxAttempts) {
        logger.info('SemanticScholar proxy request', { query, limit, offset, url, attempt });
        apiResponse = await fetch(url, { headers });
        if (apiResponse.status !== 429) {
          last429 = false;
          break;
        }
        last429 = true;
        const retryAfterHeader = apiResponse.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const baseDelayMs = !Number.isNaN(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : Math.min(60000, 2000 * Math.pow(2, attempt));
        const jitter = Math.floor(Math.random() * 1000);
        logger.warn('SemanticScholar returned 429, will retry', { attempt, baseDelayMs, jitter });
        await new Promise(r => setTimeout(r, baseDelayMs + jitter));
        attempt += 1;
      }

      if (last429 && apiResponse && apiResponse.status === 429) {
        // Give up and forward the 429. Never send a status 500 for this.
        const errorText = await apiResponse.text().catch(() => '');
        return res.status(429).json({ error: `Upstream 429 Too Many Requests: ${errorText}` });
      }

      if (!apiResponse) {
        return res.status(500).json({ error: 'Semantic Scholar proxy: could not get any response' });
      }
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text().catch(() => '');
        throw new Error(`Semantic Scholar API error: ${apiResponse.status} ${apiResponse.statusText} ${errorText}`);
      }

      const data = await apiResponse.json();
      logger.info('SemanticScholar proxy response', { status: apiResponse.status, total: data?.total, count: data?.data?.length });
      res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      res.json(data);
    } catch (error) {
      console.error('Semantic Scholar API error (proxy):', error);
      res.status(500).json({ error: error.message });
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
    throw new Error('No authorization token provided');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  // Check if user is admin
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new Error('Insufficient permissions');
  }
  
  return decodedToken;
};

// Get all users
exports.getUsers = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      await verifyAdminAccess(req);
      
      const usersSnapshot = await db.collection('users').get();
      const users = [];
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role || 'user',
          accessLevel: userData.accessLevel || 'free',
          createdAt: userData.createdAt,
          lastLoginAt: userData.lastLoginAt,
          isActive: userData.isActive !== false
        });
      });
      
      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: error.message });
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
    try {
      await verifyAdminAccess(req);

      const { email, password, displayName, accessLevel = 'free', role = 'user' } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName
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
                <p>Hello${displayName ? ' ' + displayName : ''},</p>
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
        displayName,
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
      console.error('Create user error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Update user access level
exports.updateUserAccess = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      await verifyAdminAccess(req);
      
      const { userId, accessLevel, role } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const updateData = {};
      if (accessLevel) updateData.accessLevel = accessLevel;
      if (role) updateData.role = role;

      await db.collection('users').doc(userId).update(updateData);

      res.json({ success: true });
    } catch (error) {
      console.error('Update user access error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Delete user
exports.deleteUser = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      await verifyAdminAccess(req);
      
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Delete from Firebase Auth
      await admin.auth().deleteUser(userId);
      
      // Delete from Firestore
      await db.collection('users').doc(userId).delete();

      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Health check function
exports.healthCheck = functions.https.onRequest((req, res) => {
  return cors(req, res, () => {
    res.json({ status: 'OK', message: 'Firebase Functions are running' });
  });
});
