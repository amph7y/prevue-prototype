const ELSEVIER_API_KEY = import.meta.env.VITE_ELSEVIER_API_KEY;

async function fetchElsevierData(dbKey, query, retmax = 25, start = 0) {
    if (!ELSEVIER_API_KEY) throw new Error("Elsevier API Key is required.");
    if (!query) return { 'search-results': { 'opensearch:totalResults': 0, entry: [] } };
    
    const url = `https://api.elsevier.com/content/search/${dbKey}?query=${encodeURIComponent(query)}&count=${retmax}&start=${start}&httpAccept=application/json`;
    const response = await fetch(url, { headers: { 'X-ELS-APIKey': ELSEVIER_API_KEY } });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`API Error (${response.status}): ${errorBody['service-error']?.status?.statusText || `Unknown ${dbKey} Error`}`);
    }

    return await response.json();
}

export async function getElsevierCount(dbKey, query) {
    const data = await fetchElsevierData(dbKey, query, 1);
    return data['search-results']['opensearch:totalResults'];
}

export async function searchElsevier(dbKey, query, retmax, start = 0) {
    const data = await fetchElsevierData(dbKey, query, retmax, start);
    return {total: data['search-results']['opensearch:totalResults'], data: data['search-results'].entry.map(item => ({
        title: item['dc:title'],
        authors: item['dc:creator'] ? [{ name: item['dc:creator'] }] : [],
        year: item['prism:coverDate']?.substring(0, 4),
        venue: item['prism:publicationName'],
        doi: item['prism:doi'],
        abstract: item['dc:description'],
        sourceDB: dbKey,
        uniqueId: `${dbKey}_${item['dc:identifier']}`
    }))};
}