// Centralized access control configuration

export const ACCESS_LEVELS = {
    guest: {
        canUseAiProject: false,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: 1,
        canSeeLiveCounts: true,          // changed: guest can see PubMed live counts
        maxProjectsPerLifetime: 0,
        maxConceptGenerationsPerProject: 1,
        maxKeywordGenerationsPerProject: 1,
        canUseRefineFeature: false,
        requiresLoginForSearch: false,   // changed: guest can run the PubMed live search
        canExport: false                 // new: export is locked for guests
    },
    free: {
        canUseAiProject: false,
        canGenerateConceptsAndKeywords: true,
        maxDatabases: 2,
        canSeeLiveCounts: false,
        maxProjectsPerLifetime: 2,
        maxConceptGenerationsPerProject: 2,
        maxKeywordGenerationsPerProject: 2,
        canUseRefineFeature: false,
        requiresLoginForSearch: false,
        canExport: true                  // new
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
        requiresLoginForSearch: false,
        canExport: true                  // new
    }
};

export function getCapabilities(accessLevel) {
    if (accessLevel && ACCESS_LEVELS[accessLevel]) return ACCESS_LEVELS[accessLevel];
    return ACCESS_LEVELS.free;
}