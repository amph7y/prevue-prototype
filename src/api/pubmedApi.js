
const SEARCH_PUBMED_URL = 'https://searchpubmed-mq6lqjahiq-uc.a.run.app';

async function fetchPubmed(endpoint, params, retmode = 'json') {
    try {
        const response = await fetch(`${SEARCH_PUBMED_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint,
                params
            })
        });

        if (!response.ok) {
            throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
        }

        if (retmode === 'json') {
            try {
                return await response.json();
            } catch (error) {
                throw new Error("PubMed returned an invalid (non-JSON) response.");
            }
        } else if (retmode === 'xml') {
            return await response.text(); // Return raw XML for parsing
        } else {
            return await response.text(); // Default to text for other retmodes
        }
    } catch (error) {
        if (error.name === "TypeError" && error.message === "Failed to fetch") {
            throw new Error("Network error: Could not connect to PubMed API. Please check your internet connection.");
        }
        throw error; // Re-throw other errors
    }
}

export async function getPubmedCount(query) {
    if (!query || query.trim() === "") return 0;
    const params = { db: 'pubmed', term: query, retmode: 'json' };
    try {
        const data = await fetchPubmed('esearch.fcgi', params);
        return data.esearchresult?.count || 0;
    } catch (error) {
        console.error("Error fetching PubMed count:", error);
        throw error;
    }
}

export async function getPubmedArticleDetails(idList) {
    if (!idList || idList.length === 0) return [];
    const params = { db: 'pubmed', id: idList.join(','), retmode: 'xml' }; // Request XML for full details
    try {
        const xmlString = await fetchPubmed('efetch.fcgi', params, 'xml');
        // In a real application, you would parse this XML string into a structured object.
        // For demonstration, we'll return the raw XML or a placeholder.
        // A common way to parse XML in browsers is using DOMParser:
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const articles = [];
        const pubmedArticleSet = xmlDoc.querySelector('PubmedArticleSet');
        if (pubmedArticleSet) {
            pubmedArticleSet.querySelectorAll('PubmedArticle').forEach(articleNode => {
                const medlineCitation = articleNode.querySelector('MedlineCitation');
                const article = medlineCitation ? medlineCitation.querySelector('Article') : null;
                const abstract = article ? article.querySelector('Abstract Text') : null;
                const title = article ? article.querySelector('ArticleTitle') : null;
                const pubDate = article ? article.querySelector('Journal Issue PubDate') : null;
                const pmid = medlineCitation ? medlineCitation.querySelector('PMID') : null;

                articles.push({
                    uid: pmid ? pmid.textContent : 'N/A',
                    title: title ? title.textContent : 'No Title Available',
                    abstract: abstract ? abstract.textContent : 'No Abstract Available',
                    pubDate: pubDate ? pubDate.textContent : 'N/A',
                    sourceDB: 'pubmed',
                    uniqueId: `pubmed_${pmid ? pmid.textContent : Math.random().toString(36).substring(7)}`,
                    // Add more fields as needed from the XML
                });
            });
        }
        return articles;
    } catch (error) {
        console.error("Error fetching PubMed article details:", error);
        throw error;
    }
}

export async function searchPubmed(query, retmax = 25, retstart = 0, fetchDetails = false) {
    if (!query || query.trim() === "") return [];
    const searchParams = { db: 'pubmed', term: query, retmode: 'json', retmax: retmax, retstart: retstart };
    try {
        const searchData = await fetchPubmed('esearch.fcgi', searchParams);
        const idList = searchData.esearchresult?.idlist;
        if (!idList || idList.length === 0) return [];

        if (fetchDetails) {
            return await getPubmedArticleDetails(idList);
        } else {
            const summaryParams = { db: 'pubmed', id: idList.join(','), retmode: 'json' };
            const summaryData = await fetchPubmed('esummary.fcgi', summaryParams);
            return {total: searchData.esearchresult?.count, data: Object.values(summaryData.result)
                .filter(item => item.uid)
                .map(item => ({ ...item, sourceDB: 'pubmed', uniqueId: `pubmed_${item.uid}` }))};
        }
    } catch (error) {
        console.error("Error searching PubMed:", error);
        throw error;
    }
}
