// Centralized access control configuration

export const ACCESS_LEVELS = {
    free: {
        canUseAiProject: false,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: 2,
        canSeeLiveCounts: false,
        maxProjectsPerWeek: 2,
        canGenerateConceptsOncePerProject: true,
        canGenerateKeywordsOncePerProject: true
    },
    premium: {
        canUseAiProject: true,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: Infinity,
        canSeeLiveCounts: true,
        maxProjectsPerWeek: Infinity,
        canGenerateConceptsOncePerProject: true,
        canGenerateKeywordsOncePerProject: true
    }
    
};

export function getCapabilities(accessLevel) {
    if (accessLevel && ACCESS_LEVELS[accessLevel]) return ACCESS_LEVELS[accessLevel];
    return ACCESS_LEVELS.free;
}


