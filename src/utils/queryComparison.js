const parseQueryStructure = (queryString) => {
    if (!queryString || typeof queryString !== 'string') {
        return { type: 'empty', value: '' };
    }

    const normalized = queryString.trim();
    
    const extractTerm = (str) => {
        return str
            .replace(/\[[^\]]*\]$/g, '') 
            .replace(/^["']|["']$/g, '') 
            .trim()
            .toLowerCase();
    };

    // Split by top-level AND operators
    const splitByAND = (str) => {
        const parts = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const next3 = str.slice(i, i + 3).toUpperCase();
            
            if (char === '"') inQuotes = !inQuotes;
            if (!inQuotes) {
                if (char === '(') depth++;
                if (char === ')') depth--;
            }

            // Check for AND at depth 0
            if (depth === 0 && !inQuotes && next3 === 'AND' && 
                (i === 0 || /\s/.test(str[i - 1])) &&
                (i + 3 >= str.length || /\s/.test(str[i + 3]))) {
                if (current.trim()) parts.push(current.trim());
                current = '';
                i += 2; 
                continue;
            }

            current += char;
        }
        if (current.trim()) parts.push(current.trim());
        
        return parts.length > 0 ? parts : [str];
    };

    // Extract OR terms from a parenthesized group
    const extractORTerms = (str) => {
        let inner = str.trim();
        if (inner.startsWith('(') && inner.endsWith(')')) {
            inner = inner.slice(1, -1).trim();
        }

        const terms = [];
        let current = '';
        let inQuotes = false;
        let depth = 0;

        for (let i = 0; i < inner.length; i++) {
            const char = inner[i];
            const next2 = inner.slice(i, i + 2).toUpperCase();
            
            if (char === '"') inQuotes = !inQuotes;
            if (!inQuotes) {
                if (char === '(') depth++;
                if (char === ')') depth--;
            }

            // Check for OR at depth 0
            if (depth === 0 && !inQuotes && next2 === 'OR' &&
                (i === 0 || /\s/.test(inner[i - 1])) &&
                (i + 2 >= inner.length || /\s/.test(inner[i + 2]))) {
                if (current.trim()) terms.push(extractTerm(current.trim()));
                current = '';
                i += 1;
                continue;
            }

            current += char;
        }
        if (current.trim()) terms.push(extractTerm(current.trim()));
        
        return terms;
    };

    // Parse into structured format
    const andClauses = splitByAND(normalized);
    const structure = {
        type: 'query',
        clauses: andClauses.map((clause, idx) => {
            const terms = extractORTerms(clause);
            // Case-sensitive normalized key for matching
            return {
                id: idx,
                raw: clause,
                terms: terms,
                normalized: terms.slice().sort().join('|')
            };
        })
    };

    return structure;
};

const compareQueryStructures = (structureA, structureB) => {
    if (!structureA || !structureB) {
        return { matched: [], added: [], removed: [] };
    }

    const clausesA = structureA.clauses || [];
    const clausesB = structureB.clauses || [];

    const result = [];
    const usedA = new Set();
    const usedB = new Set();

    // Process each clause in the current query (B) in order
    for (let bi = 0; bi < clausesB.length; bi++) {
        const clauseB = clausesB[bi];
        let matchInfo = null;

        // First, try to find an exact match
        for (let ai = 0; ai < clausesA.length; ai++) {
            if (usedA.has(ai)) continue;
            const clauseA = clausesA[ai];
            
            if (clauseA.normalized === clauseB.normalized) {
                matchInfo = {
                    type: 'exact',
                    saved: clauseA,
                    current: clauseB,
                    similarity: 1.0,
                    position: bi
                };
                usedA.add(ai);
                usedB.add(bi);
                break;
            }
        }

        // If no exact match, try partial match
        if (!matchInfo) {
            let bestMatch = null;
            let bestSimilarity = 0;
            let bestAIdx = null;

            for (let ai = 0; ai < clausesA.length; ai++) {
                if (usedA.has(ai)) continue;
                const clauseA = clausesA[ai];

                const termsA = new Set(clauseA.terms);
                const termsB = new Set(clauseB.terms);
                
                const intersection = [...termsA].filter(t => termsB.has(t)).length;
                const union = new Set([...termsA, ...termsB]).size;
                
                const similarity = union > 0 ? intersection / union : 0;

                if (similarity > 0.3 && similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = clauseA;
                    bestAIdx = ai;
                }
            }

            if (bestMatch) {
                const termsA = new Set(bestMatch.terms);
                const termsB = new Set(clauseB.terms);
                
                matchInfo = {
                    type: 'partial',
                    saved: bestMatch,
                    current: clauseB,
                    similarity: bestSimilarity,
                    addedTerms: [...termsB].filter(t => !termsA.has(t)),
                    removedTerms: [...termsA].filter(t => !termsB.has(t)),
                    commonTerms: [...termsA].filter(t => termsB.has(t)),
                    position: bi
                };
                usedA.add(bestAIdx);
                usedB.add(bi);
            }
        }

        // If still no match, it's a new clause
        if (!matchInfo) {
            matchInfo = {
                type: 'added',
                current: clauseB,
                terms: clauseB.terms,
                position: bi
            };
            usedB.add(bi);
        }

        result.push(matchInfo);
    }

    // Add removed clauses at the end (clauses in saved query but not in current)
    for (let ai = 0; ai < clausesA.length; ai++) {
        if (!usedA.has(ai)) {
            result.push({
                type: 'removed',
                saved: clausesA[ai],
                terms: clausesA[ai].terms,
                position: clausesB.length + ai
            });
        }
    }

    // Separate into categories for backward compatibility
    const matched = result.filter(r => r.type === 'exact' || r.type === 'partial');
    const added = result.filter(r => r.type === 'added');
    const removed = result.filter(r => r.type === 'removed');

    return { matched, added, removed, ordered: result };
};


const formatComparisonForDisplay = (comparison) => {
    // Use the ordered result if available, otherwise fall back to old logic
    if (comparison.ordered) {
        return comparison.ordered.map((item, idx) => {
            const clauseNum = idx + 1;
            
            if (item.type === 'exact') {
                return {
                    type: 'unchanged',
                    label: `Clause ${clauseNum} (unchanged)`,
                    content: item.current.raw,
                    status: 'equal',
                    position: item.position
                };
            }
            
            if (item.type === 'partial') {
                return {
                    type: 'modified',
                    label: `Clause ${clauseNum} (modified)`,
                    similarity: item.similarity,
                    removed: item.removedTerms || [],
                    added: item.addedTerms || [],
                    common: item.commonTerms || [],
                    savedRaw: item.saved.raw,
                    currentRaw: item.current.raw,
                    position: item.position
                };
            }
            
            if (item.type === 'added') {
                return {
                    type: 'added',
                    label: `Clause ${clauseNum} (new)`,
                    content: item.current.raw,
                    terms: item.terms || item.current.terms,
                    position: item.position
                };
            }
            
            if (item.type === 'removed') {
                return {
                    type: 'removed',
                    label: `Removed Clause`,
                    content: item.saved.raw,
                    terms: item.terms || item.saved.terms,
                    position: item.position
                };
            }
            
            return null;
        }).filter(Boolean);
    }

    // Fallback to old logic (shouldn't reach here with new implementation)
    const sections = [];

    comparison.matched.forEach((match, idx) => {
        if (match.type === 'exact') {
            sections.push({
                type: 'unchanged',
                label: `Clause ${idx + 1} (unchanged)`,
                content: match.current.raw,
                status: 'equal'
            });
        } else {
            sections.push({
                type: 'modified',
                label: `Clause ${idx + 1} (modified)`,
                similarity: match.similarity,
                removed: match.removedTerms || [],
                added: match.addedTerms || [],
                common: match.commonTerms || [],
                savedRaw: match.saved.raw,
                currentRaw: match.current.raw
            });
        }
    });

    comparison.added.forEach((clause, idx) => {
        sections.push({
            type: 'added',
            label: `New Clause ${idx + 1}`,
            content: clause.raw,
            terms: clause.terms
        });
    });

    comparison.removed.forEach((clause, idx) => {
        sections.push({
            type: 'removed',
            label: `Removed Clause ${idx + 1}`,
            content: clause.raw,
            terms: clause.terms
        });
    });

    return sections;
};


export const compareQueries = (savedQuery, currentQuery) => {
    try {
        const structureA = parseQueryStructure(savedQuery);
        const structureB = parseQueryStructure(currentQuery);
        const comparison = compareQueryStructures(structureA, structureB);
        const display = formatComparisonForDisplay(comparison);
        
        return {
            success: true,
            comparison,
            display,
            summary: {
                totalClauses: comparison.matched.length + comparison.added.length,
                unchanged: comparison.matched.filter(m => m.type === 'exact').length,
                modified: comparison.matched.filter(m => m.type === 'partial').length,
                added: comparison.added.length,
                removed: comparison.removed.length
            }
        };
    } catch (error) {
        console.error('Query comparison error:', error);
        return {
            success: false,
            error: error.message,
            display: []
        };
    }
};
