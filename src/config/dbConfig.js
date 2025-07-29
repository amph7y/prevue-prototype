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
            emtree: (term) => `"${term}"[tw]`, // Fallback for Emtree terms in PubMed
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
            // This syntax correctly uses the selected field, e.g., TITLE("term")
            phrase: (term, field) => `${field}("${term}")`,
            mesh: (term, field) => `${field}("${term}")`, // Scopus uses generic field searches
            emtree: (term, field) => `INDEXTERMS("${term}")`, // Scopus can search Emtree index terms
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
            // This syntax correctly uses the selected field, e.g., 'term':ti,ab,kw
            phrase: (term, field) => `'${term}':${field}`,
            mesh: (term, field) => `'${term}':${field}`, // Embase uses generic field searches
            emtree: (term) => `'${term}'/exp`, // Embase has specific Emtree syntax
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
        searchFields: { 'query': 'Title/Abstract' },
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
            'abstract': 'Abstract Only'
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