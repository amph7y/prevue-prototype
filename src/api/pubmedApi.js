const EUTILS_BASE_URL = "/pubmed-api/entrez/eutils/";

async function handlePubmedResponse(response) {
    if (!response.ok) {
        throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        // If we get HTML or something else, it's an error from the API
        const errorText = await response.text();
        console.error("PubMed returned non-JSON response:", errorText);
        throw new Error("PubMed returned an invalid response. Check your query syntax.");
    }
}

export async function getPubmedCount(query) {
    if (!query || query.trim() === "") {
        return 0;
    }
    const url = `${EUTILS_BASE_URL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json`;
    const response = await fetch(url);
    const data = await handlePubmedResponse(response);
    return data.esearchresult?.count || 0;
}

export async function searchPubmed(query, retmax = 25) {
    if (!query || query.trim() === "") {
        return [];
    }
    const searchUrl = `${EUTILS_BASE_URL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${retmax}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await handlePubmedResponse(searchResponse);

    const idList = searchData.esearchresult?.idlist;
    if (!idList || idList.length === 0) {
        return [];
    }

    const summaryUrl = `${EUTILS_BASE_URL}esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await handlePubmedResponse(summaryResponse);

    return Object.values(summaryData.result)
        .filter(item => item.uid)
        .map(item => ({ ...item, sourceDB: 'pubmed', uniqueId: `pubmed_${item.uid}` }));
}