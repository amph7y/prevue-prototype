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

ELSEVIER_API_KEY="f5a540d49e1e963ac02842649e16d0ad"

CORE_API_KEY="wcCDB4VhpHMeSqWFUov7fxulbgLastO1"

PUBMED_API_KEY="7aff2bbbacd835c155196f6f0ad3b56cc309"

exports.searchCore = functions.https.onRequest((req, res) => {
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
          'Authorization': `Bearer ${CORE_API_KEY}`
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

exports.searchPubMed = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { endpoint, params } = req.body;
      
      if (!endpoint || !params) {
        return res.status(400).json({ error: 'Endpoint and params are required' });
      }

      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}?api_key=${PUBMED_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({...params, 'api_key': PUBMED_API_KEY})
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

exports.searchElsevier = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { dbKey, query, limit = 25, offset = 0 } = req.body;
      
      if (!dbKey || !query) {
        return res.status(400).json({ error: 'Database key and query are required' });
      }

      const url = `https://api.elsevier.com/content/search/${dbKey}?apiKey=${ELSEVIER_API_KEY}&query=${encodeURIComponent(query)}&count=${limit}&start=${offset}`;
      
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
