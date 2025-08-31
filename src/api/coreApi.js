
async function fetchCoreData(query, offset = 0, limit = 25) {
  if (!query) return { totalHits: 0, data: [] };

  const response = await fetch(`${import.meta.env.VITE_CORE_FB_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      limit,
      offset,
      exclude: ['fullText', 'links', 'outputs']
    })
  });
  
  if (!response.ok) {
    throw new Error(`Core API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

export async function getCoreCount(query) {
  const data = await fetchCoreData(query);
  return data.totalHits || 0;
}

export async function searchCore(query, limit = 25, offset = 0) {
  const data = await fetchCoreData(query, offset, limit);
  return {total: data.totalHits, data: (data.results || []).map(item => ({
    title: item.title,
    authors: item.authors || [],
    year: item.yearPublished,
    // venue: item.journal,
    downloadUrl: item.downloadUrl,
    doi: item.doi,
    abstract: item.abstract,
    sourceDB: 'core',
    uniqueId: `core_${item.id}`
  }))};
}