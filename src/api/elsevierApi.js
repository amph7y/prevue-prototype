
async function fetchElsevierData(dbKey, query, retmax = 25, start = 0) {
    if (!query) return { 'search-results': { 'opensearch:totalResults': 0, entry: [] } };
    
    const response = await fetch(`${import.meta.env.VITE_ELSEVIER_FB_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dbKey,
            query,
            limit: retmax,
            offset: start
        })
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`API Error (${response.status}): ${errorBody.error || `Unknown ${dbKey} Error`}`);
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