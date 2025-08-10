const CORE_API_URL = 'https://api.core.ac.uk/v3/search';
const CORE_API_KEY = import.meta.env.VITE_CORE_API_KEY;

async function fetchCoreData(query, offset = 0, limit = 25) {
  if (!CORE_API_KEY) throw new Error('CORE API Key is required.');
  if (!query) return { totalHits: 0, data: [] };

  const url = `${CORE_API_URL}/works?apiKey=${CORE_API_KEY}`;
  const payload = {
    q: query,
    exclude: ['fullText'],
    limit: limit,
    offset: offset,
    entity_type: "works"
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`CORE API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

export async function getCoreCount(query) {
  const data = await fetchCoreData(query);
  return data.totalHits || 0;
}

export async function searchCore(query, limit = 25) {
  const data = await fetchCoreData(query, 0, limit);
  return (data.results || []).map(item => ({
    title: item.title,
    authors: item.authors || [],
    year: item.yearPublished,
    // venue: item.journal,
    downloadUrl: item.downloadUrl,
    doi: item.doi,
    abstract: item.abstract,
    sourceDB: 'core',
    uniqueId: `core_${item.id}`
  }));
}