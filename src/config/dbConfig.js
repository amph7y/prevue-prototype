// Unified search field definitions
const UNIFIED_SEARCH_FIELDS = {
    1: 'Title/Abstract',
    2: 'Title Only',
    3: 'Abstract Only', 
    4: 'All Fields'
};

const DB_CONFIG = {
    pubmed: {
        name: 'PubMed',
        searchFields: {
            // 'tiab': 'Title/Abstract',
            // 'ti': 'Title Only',
            // 'tw': 'Text Word',
            // 'all': 'All Fields'
            '1': 'tiab',
            '2': 'ti',
            '3': 'ab',
            '4': 'all'
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
            // 'TITLE-ABS-KEY': 'Title/Abstract/Keyword',
            // 'TITLE': 'Title Only',
            // 'ABS': 'Abstract Only',
            // 'ALL': 'All Fields'
            '1': 'TITLE-ABS-KEY',
            '2': 'TITLE',
            '3': 'ABS',
            '4': 'ALL'
        },
        syntax: {
            // This syntax correctly uses the selected field, e.g., TITLE("term")
            phrase: (term, field) => `${field}("${term}")`,
            // mesh: (term, field) => `TITLE-ABS-KEY("${term}")`, // Scopus uses generic field searches
            emtree: (term, field) => `INDEXTERMS("${term}")`, // Scopus can search Emtree index terms
            separator: ' AND ',
            not: 'AND NOT'
        }
    },
    core: {
        name: 'CORE',
        searchFields: {
            // 'all': 'Title/Abstract',
            // 'title': 'Title Only',
            // 'abstract': 'Abstract Only',
            // 'all': 'All Fields',
            '1': 'all',
            '2': 'title',
            '3': 'abstract',
            '4': 'all'
        },
        syntax: {
            phrase: (term, field) => field === 'all' ? `"${term}"` : `${field}:"${term}"`,
            // mesh: (term) => `"${term}"`,
            emtree: (term) => `"${term}"`,
            separator: ' AND ',
            not: 'NOT'
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
};

export { DB_CONFIG, UNIFIED_SEARCH_FIELDS };