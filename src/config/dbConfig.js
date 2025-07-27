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
            emtree: (term) => `"${term}"[tw]`, // Fallback for Emtree in PubMed
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
            phrase: (term, field) => `${field}("${term}")`,
            exactPhrase: (term, field) => `{${term}}`,
            proximity: (term1, term2, dist) => `TITLE-ABS-KEY("${term1}" W/${dist} "${term2}")`,
            separator: 'AND',
            not: 'AND NOT'
        }
    },
    embase: {
        name: 'Embase',
        searchFields: {
            'title-abs-key': 'Title/Abstract/Keyword',
            'all': 'All Fields',
            'title': 'Title Only',
            'abstract': 'Abstract Only'
        },
        syntax: {
            phrase: (term, field) => `'${term}'/${field}`,
            emtree: (term) => `'${term}'/exp`,
            mesh: (term) => `'${term}'/de`, // Fallback for MeSH in Embase
            separator: 'AND',
            not: 'AND NOT'
        }
    }
};