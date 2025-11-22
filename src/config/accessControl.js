// Centralized access control configuration

export const ACCESS_LEVELS = {
    free: {
        canUseAiProject: false,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: 2,
        canSeeLiveCounts: false,
        maxProjectsPerLifetime: 2,
        maxConceptGenerationsPerProject: 2,
        maxKeywordGenerationsPerProject: 2,
        canUseRefineFeature: false
    },
    premium: {
        canUseAiProject: true,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: Infinity,
        canSeeLiveCounts: true,
        maxProjectsPerLifetime: Infinity,
        maxConceptGenerationsPerProject: Infinity,
        maxKeywordGenerationsPerProject: Infinity,
        canUseRefineFeature: true,
    }
    
};

export function getCapabilities(accessLevel) {
    if (accessLevel && ACCESS_LEVELS[accessLevel]) return ACCESS_LEVELS[accessLevel];
    return ACCESS_LEVELS.free;
}


