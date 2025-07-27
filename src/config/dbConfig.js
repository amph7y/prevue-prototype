export const DB_CONFIG = {
    pubmed: {
        name: 'PubMed',
        searchFields: {
            'tiab': 'Title/Abstract',
            'tw': 'Text Word',
            'all': 'All Fields',
            'ti': 'Title Only'
        },
        syntax: {
            phrase: (term, field) => `"${term}"[${field}]`,
            mesh: (term) => `"${term}"[MeSH Terms]`,
            emtree: (term) => `"${term}"[tw]`,
            separator: ' AND ',
            not: 'NOT'
        }
    },
    scopus: {
        name: 'Scopus',
        searchFields: {
            'TITLE-ABS-KEY': 'Title/Abstract/Keyword',
            'ALL': 'All Fields',
            'TITLE': 'Title Only',
            'ABS': 'Abstract Only'
        },
        syntax: {
            field: (term, field) => `${field}(${term})`,
            phrase: (term, field) => `"${term}"`, // Corrected for basic API keys
            exactPhrase: (term, field) => `{${term}}`,
            proximity: (term1, term2, dist) => `"${term1}" W/${dist} "${term2}"`,
            precedes: (term1, term2, dist) => `"${term1}" PRE/${dist} "${term2}"`,
            separator: ' AND ',
            not: 'AND NOT'
        }
    },
    embase: {
        name: 'Embase',
        searchFields: {
            'ti,ab,kw': 'Title/Abstract/Keyword',
            'mp': 'All Fields (Multi-purpose)',
            'ti': 'Title Only',
            'ab': 'Abstract Only'
        },
        syntax: {
            phrase: (term, field) => `'${term}':${field}`,
            mesh: (term) => `'${term}':ti,ab`,
            emtree: (term) => `'${term}'/exp`,
            separator: ' AND ',
            not: 'NOT'
        }
    },
    googleScholar: {
        name: 'Google Scholar',
        searchFields: {
            'all': 'All Fields',
            'intitle': 'Title Only'
        },
        syntax: {
            phrase: (term, field) => field === 'intitle' ? `intitle:"${term}"` : `"${term}"`,
            mesh: (term) => `"${term}"`,
            emtree: (term) => `"${term}"`,
            separator: ' ',
            not: '-'
        }
    },
    semanticScholar: {
        name: 'Semantic Scholar',
        searchFields: {
            'query': 'Title/Abstract'
        },
        syntax: {
            phrase: (term) => `"${term}"`,
            mesh: (term) => `"${term}"`,
            emtree: (term) => `"${term}"`,
            separator: ' ',
            not: '-'
        }
    },
    core: {
        name: 'CORE',
        searchFields: {
            'all': 'All Fields',
            'title': 'Title Only',
            'abstract': 'Abstract Only',
            'fullText': 'Full Text Only'
        },
        syntax: {
            phrase: (term, field) => field === 'all' ? `"${term}"` : `${field}:"${term}"`,
            mesh: (term) => `"${term}"`,
            emtree: (term) => `"${term}"`,
            separator: ' AND ',
            not: 'NOT'
        }
    },
};