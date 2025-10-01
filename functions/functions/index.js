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

// Health check function
exports.healthCheck = functions.https.onRequest((req, res) => {
  return cors(req, res, () => {
    res.json({ status: 'OK', message: 'Firebase Functions are running' });
  });
});
