const SEMANTIC_SCHOLAR_FB_URL = import.meta.env.VITE_SEMANTIC_SCHOLAR_FB_URL;
let pending = Promise.resolve();

async function fetchSemanticScholarData(query, offset = 0, limit = 100) {
    if (!query) return { total: 0, data: [] };

    try {
        const fields = 'paperId,title,authors,year,citationCount,referenceCount,isOpenAccess,venue,abstract,url,fieldsOfStudy,externalIds';
        const sanitizedQuery = sanitizeForSemanticScholar(query);

        async function retryUntilSuccess() {
            while (true) {
                const response = await fetch(`${SEMANTIC_SCHOLAR_FB_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: sanitizedQuery, limit, offset, fields })
                });
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const retryMs = retryAfter ? Number(retryAfter) * 1000 : 2000;
                    await new Promise(r => setTimeout(r, retryMs));
                    continue;
                }
                // Handle wrapped backend error (status 429 or 500 with Too Many Requests)
                if (!response.ok) {
                    let errorMsg = '';
                    try { errorMsg = (await response.json()).error || ''; } catch {
                        try { errorMsg = await response.text(); } catch {}
                    }
                    if (response.status === 429 || /Too Many Requests/i.test(errorMsg)) {
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText} ${errorMsg}`);
                }
                const data = await response.json();
                await new Promise(r => setTimeout(r, 200));
                return data;
            }
        }

        pending = pending.then(retryUntilSuccess);
        return await pending;
    } catch (error) {
        console.error('Semantic Scholar API error:', error);
        throw error;
    }
}

// Make complex boolean queries acceptable for Semantic Scholar
function sanitizeForSemanticScholar(raw) {
    if (!raw) return '';
    let q = String(raw);
    // Normalize whitespace and remove newlines
    q = q.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Remove parentheses 
    q = q.replace(/[()]/g, ' ');
    // Uppercase boolean operators
    q = q.replace(/\s+or\s+/gi, ' OR ').replace(/\s+and\s+/gi, ' AND ').replace(/\s+not\s+/gi, ' AND NOT ');
    // Remove commas inside quoted phrases 
    q = q.replace(/"([^"]+)"/g, (m, p1) => `"${p1.replace(/,/g, ' ')}"`);
    // Collapse multiple spaces again after punctuation changes
    q = q.replace(/\s+/g, ' ').trim();
    // If query is extremely long, trim OR lists per AND segment to first 6 terms
    const MAX_TERMS_PER_GROUP = 6;
    const andGroups = q.split(/\s+AND\s+/);
    const trimmedGroups = andGroups.map(group => {
        const parts = group.split(/\s+OR\s+/);
        if (parts.length > MAX_TERMS_PER_GROUP) {
            return parts.slice(0, MAX_TERMS_PER_GROUP).join(' OR ');
        }
        return group;
    });
    q = trimmedGroups.join(' AND ');
    // Final cleanup
    q = q.replace(/\s+/g, ' ').trim();
    return q;
}

/**
 * Get total count of results from Semantic Scholar
 */
export async function getSemanticScholarCount(query) {
    try {
        const data = await fetchSemanticScholarData(query, 0, 1);
        return data.total || 0;
    } catch (error) {
        console.error('Error getting Semantic Scholar count:', error);
        return 'N/A';
    }
}

/**
 * Search Semantic Scholar and return formatted results
 */
export async function searchSemanticScholar(query, limit = 100, offset = 0) {
    try {
        const data = await fetchSemanticScholarData(query, offset, limit);
        
        return {
            total: data.total || 0,
            data: (data.data || []).map(item => ({
                title: item.title,
                authors: Array.isArray(item.authors) ? item.authors.map(a => ({ name: a.name })) : [],
                year: item.year,
                venue: item.venue || '',
                abstract: item.abstract,
                url: item.url,
                citationCount: item.citationCount || 0,
                referenceCount: item.referenceCount || 0,
                isOpenAccess: item.isOpenAccess || false,
                fieldsOfStudy: item.fieldsOfStudy || [],
                doi: item.externalIds?.best?.DOI || item.externalIds?.DOI,
                pmid: item.externalIds?.best?.PubMed || item.externalIds?.PubMed,
                sourceDB: 'semanticScholar',
                uniqueId: `semantic_${item.paperId}`
            }))
        };
    } catch (error) {
        console.error('Error searching Semantic Scholar:', error);
        return { total: 0, data: [] };
    }
}
