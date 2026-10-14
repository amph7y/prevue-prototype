// Links to each database's own website. The addresses are fixed here; nothing comes from users.
// Where the database is known to accept a search in its address, the link opens with the
// query already filled in. Otherwise it opens the database and the researcher pastes the query.

export const GOOGLE_SCHOLAR_MAX_CHARS = 256; // Google Scholar ignores anything longer
const MAX_LINK_CHARS = 6000; // very long addresses can be refused, so those open the home page

const DATABASE_SITES = Object.freeze({
    pubmed: { home: 'https://pubmed.ncbi.nlm.nih.gov/', search: 'https://pubmed.ncbi.nlm.nih.gov/?term=' },
    scopus: { home: 'https://www.scopus.com/' },
    embase: { home: 'https://www.embase.com/' },
    core: { home: 'https://core.ac.uk/' },
    semanticScholar: { home: 'https://www.semanticscholar.org/' },
    googleScholar: {
        home: 'https://scholar.google.com/',
        search: 'https://scholar.google.com/scholar?q=',
        maxQueryChars: GOOGLE_SCHOLAR_MAX_CHARS,
    },
});

// Returns { href, prefilled, tooLong }, or null for an unknown database.
//   prefilled: the query is already in the link (no need to paste it)
//   tooLong: the query is longer than the database accepts
export function databaseLink(dbKey, query) {
    if (typeof dbKey !== 'string' || !Object.prototype.hasOwnProperty.call(DATABASE_SITES, dbKey)) return null;
    const site = DATABASE_SITES[dbKey];
    const text = typeof query === 'string' ? query.replace(/\s+/g, ' ').trim() : '';
    const tooLong = Boolean(site.maxQueryChars) && text.length > site.maxQueryChars;
    if (site.search && text && !tooLong) {
        const href = site.search + encodeURIComponent(text);
        if (href.length <= MAX_LINK_CHARS) return { href, prefilled: true, tooLong: false };
    }
    return { href: site.home, prefilled: false, tooLong };
}
