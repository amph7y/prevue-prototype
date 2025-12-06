import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Config & Utils
import { db } from '../../config/firebase.js';
import { DB_CONFIG } from '../../config/dbConfig.js';
import { useContextMenu } from '../../hooks/useContextMenu.jsx';
import { cn } from '../../utils/cn.js';
import { handleError } from '../../utils/utils.js';

// API Calls
import { callGeminiAPI } from '../../api/geminiApi.js';
import { getPubmedCount, searchPubmed } from '../../api/pubmedApi.js';
import { getElsevierCount, searchElsevier } from '../../api/elsevierApi.js';
import { getCoreCount, searchCore } from '../../api/coreApi.js';
import { getSemanticScholarCount, searchSemanticScholar } from '../../api/semanticScholarApi.js';

// Child Components & Modals
import PicoBuilder from './PicoBuilder.jsx';
import QueryBuilder from './QueryBuilder.jsx';
import ResultsViewer from './ResultsViewer.jsx';
import ArticleDetailModal from '../common/ArticleDetailModal.jsx';
import ExportModal from '../common/ExportModal.jsx';

import PicoSuggestionsModal from './PicoSuggestionsModal.jsx';
import ThesaurusModal from './ThesaurusModal.jsx';
import QueryRefinementModal from './QueryRefinementModal.jsx';
import { HomeIcon, CheckIcon, DownloadIcon } from '../common/Icons.jsx';
import Header from '../common/Header.jsx';
import DefineStep from './DefineStep.jsx';
import { retryAsync } from '../../utils/utils.js';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';
import { generateExportFile, downloadBlob, generateExportFilename } from '../../utils/exportUtils.js';
import logger from '../../utils/logger.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';

function ProjectEditor({ project, onBackToDashboard, userId }) {
    const { userAccessLevel } = useAuth();
    const capabilities = getCapabilities(userAccessLevel);
    // Global Download Context
    const { addDownload, setIsOpen: setDownloadCenterOpen } = useGlobalDownload();
    
    // Main State
    const [step, setStep] = useState(project.initialStep || 1);
    const [concepts, setConcepts] = useState([]);
    
    const [researchQuestion, setResearchQuestion] = useState('');
    const [negativeKeywords, setNegativeKeywords] = useState(['']);
    const [keywordStyle, setKeywordStyle] = useState('balanced');
    const [queries, setQueries] = useState({});
    const [searchCounts, setSearchCounts] = useState({});
    const [searchTotals, setSearchTotals] = useState({}); // Store totals from actual search results
    const [searchResults, setSearchResults] = useState(null);
    const [initialArticles, setInitialArticles] = useState([]);
    const [deduplicationResult, setDeduplicationResult] = useState(null);
    const [irrelevantArticles, setIrrelevantArticles] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    // Track generation state and counts for restrictions
    const [conceptsGenerated, setConceptsGenerated] = useState(false);
    const [keywordsGenerated, setKeywordsGenerated] = useState(false);
    const [conceptsGenerationCount, setConceptsGenerationCount] = useState(0);
    const [keywordsGenerationCount, setKeywordsGenerationCount] = useState(0);

    const [selectedDBs, setSelectedDBs] = useState(() => {
        // Implemented DBs
        const implemented = ['pubmed', 'scopus', 'core'];
        const initial = { pubmed: false, scopus: false, embase: false, core: false };
        if (capabilities.maxDatabases === Infinity) {
            // Premium: select all implemented by default
            implemented.forEach(k => { initial[k] = true; });
            return initial;
        }
        // Free: select first two implemented by default
        implemented.slice(0, Math.max(0, Math.min(2, capabilities.maxDatabases || 0))).forEach(k => { initial[k] = true; });
        return initial;
    });
    const [retmax, setRetmax] = useState(25);
    const [enabledControlledVocabTypes, setEnabledControlledVocabTypes] = useState({ mesh: true });

    // State for Modals
    const [picoSuggestions, setPicoSuggestions] = useState({ isOpen: false, category: null, suggestions: [], loading: false });
    const [thesaurusData, setThesaurusData] = useState({ isOpen: false, word: '', synonyms: [], loading: false, context: null });
    const [refineModalData, setRefineModalData] = useState(null);

    const { showMenu, ContextMenuComponent } = useContextMenu();
    const debounceTimeout = useRef(null);

    const keywordGenerationStyles = {
        focused: { value: 'focused', label: 'Focused', description: 'Fewer, more specific terms', aiPrompt: 'For "keywords", provide a JSON array of 3-4 focused, specific synonym strings.' },
        balanced: { value: 'balanced', label: 'Balanced', description: 'Moderate number of terms', aiPrompt: 'For "keywords", provide a JSON array of 5-7 synonym strings.' },
        comprehensive: { value: 'comprehensive', label: 'Comprehensive', description: 'Many terms for broad coverage', aiPrompt: 'For "keywords", provide a JSON array of 8-12 comprehensive synonym strings for broad coverage.' },
    };

    useEffect(() => {
        const docRef = doc(db, `users/${userId}/projects/${project.id}`);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setResearchQuestion(data.researchQuestion || '');

                let loadedConcepts = data.concepts || [];
                setConcepts(loadedConcepts);
                setNegativeKeywords(data.negativeKeywords || ['']);
                setKeywordStyle(data.keywordStyle || 'balanced');
                
                // Load generation state
                setConceptsGenerated(data.conceptsGenerated || false);
                setKeywordsGenerated(data.keywordsGenerated || false);
                setConceptsGenerationCount(Number(data.conceptsGenerationCount || (data.conceptsGenerated ? 1 : 0)));
                setKeywordsGenerationCount(Number(data.keywordsGenerationCount || (data.keywordsGenerated ? 1 : 0)));
            }
        });
    }, [project.id, userId]);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            const docRef = doc(db, `users/${userId}/projects/${project.id}`);
            const dataToSave = { 
                researchQuestion, 
                concepts, 
                negativeKeywords, 
                keywordStyle, 
                conceptsGenerated,
                keywordsGenerated,
                conceptsGenerationCount,
                keywordsGenerationCount,
                lastSaved: serverTimestamp() 
            };
            setDoc(docRef, dataToSave, { merge: true });
        }, 1000);
        return () => clearTimeout(debounceTimeout.current);
    }, [researchQuestion, concepts, negativeKeywords, keywordStyle, conceptsGenerated, keywordsGenerated, conceptsGenerationCount, keywordsGenerationCount, project.id, userId]);

    useEffect(() => {
        if (step === 2) {
            const keys = Object.keys(selectedDBs).filter(k => selectedDBs[k]);
            keys.forEach(dbKey => {
                const query = generateSingleQuery(dbKey, enabledControlledVocabTypes);
                setQueries(prev => ({ ...prev, [dbKey]: query }));

                if (query) {
                    fetchAndSetCount(dbKey);
                }
            });
        }
    }, [enabledControlledVocabTypes, step, selectedDBs]);

    const findSynonyms = async (word, context) => {
        if (!word) return toast.error("Please provide a word to search.");
        setThesaurusData({ isOpen: true, word, synonyms: [], loading: true, context });
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            if (!response.ok) throw new Error('No synonyms found.');
            const data = await response.json();
            const synonyms = data.flatMap(entry => entry.meanings.flatMap(meaning => meaning.synonyms || [])).filter((v, i, a) => a.indexOf(v) === i);
            setThesaurusData(prev => ({ ...prev, synonyms, loading: false }));
        } catch (error) {
            toast.error(error.message);
            setThesaurusData(prev => ({ ...prev, synonyms: [], loading: false }));
        }
    };

    const handleAddSynonym = (synonym) => {
        const { context } = thesaurusData;
        if (context) {
            handleAddKeyword(synonym, context.category, context.type, 'thesaurus');
        }
        setThesaurusData({ isOpen: false, word: '', synonyms: [], loading: false, context: null });
    };

    const handleGeneratePicoFromQuestion = async () => {
        if (!researchQuestion.trim()) return toast.error('Please enter a research question first.');
        
        // Check if concepts generation exceeds limit for this project
        const maxConcepts = capabilities.maxConceptGenerationsPerProject;
        if (Number.isFinite(maxConcepts) && conceptsGenerationCount >= maxConcepts) {
            return toast.error(`Concepts can only be generated up to ${maxConcepts} times per project.`);
        }
        
        setIsLoading(true);
        
        // Extract project data for the prompt
        const projectType = project.projectType || '';
        const discipline = project.discipline || '';
        const desiredOutcomes = project.outcomesNeeded || '';
        const undesiredOutcomes = project.outcomesNotNeeded || negativeKeywords.filter(k => k.trim() !== '').join(', ') || '';
        const questionTemplate = project.questionTemplate || '';
        
        const prompt = `You are an expert information specialist in academic information retrieval, systematic reviews, and database query design.

You are part of ReVue's AI engine, helping researchers build reproducible and context-aware search strategies.

 

Your objective:

1. Identify the key searchable concepts within a research question.

2. Generate academically relevant, diverse search terms for each concept.

3. Output ONLY valid JSON — no commentary or text outside JSON.

 

The process occurs in two independent stages.

 

===========================================================

🔸 STAGE 1: CONCEPT EXTRACTION

===========================================================

 

Analyze the following research question and contextual details to identify its core searchable concepts.

 

Use the provided question framework (if available) to label concepts appropriately.  

If none is given, infer the most logical conceptual breakdown (e.g., PICO, SPIDER, CIMO, SPICE, PCC, or ECLIPSE).  

Only include meaningful and specific concepts directly related to the research question — exclude generic words such as "effect," "impact," or "relationship."

 

If contextual project details are available, use them to improve accuracy and relevance:

- Project Type (study design): adapt the concept framing (e.g., "systematic review" → measurable outcomes and clear interventions).

- Discipline: use domain-specific interpretation (e.g., "pharmacy" → clinical, pharmacological terminology).

- Desired Outcomes: prioritize identifying or weighting concepts related to these outcomes.

- Undesired Outcomes (exclusions): avoid including these in the extracted concepts.

- Question Template: adapt structure accordingly (e.g., PICO → Population, Intervention, Comparison, Outcome).

 

Do NOT use Project Title (it may be generic or irrelevant).  

Do NOT fabricate missing data — only use what is provided.

 

────────────────────────────

Context:

- Research Question: ${researchQuestion}

- Project Type: ${projectType || '(optional)'}

- Discipline: ${discipline || '(optional)'}

- Desired Outcomes: ${desiredOutcomes || '(optional)'}

- Undesired Outcomes: ${undesiredOutcomes || '(optional)'}

- Question Template: ${questionTemplate || '(optional)'}

────────────────────────────

 

Return ONLY valid JSON in the following format:

{

  "concepts": [

    { "name": "Concept Name", "value": "Extracted Concept" }

  ]

}

 

────────────────────────────

Example Input:

{

  "research_question": "What is the effectiveness of mindfulness-based therapy on anxiety among healthcare professionals?",

  "project_type": "systematic review",

  "discipline": "public health",

  "desired_outcomes": ["reduction in anxiety", "mental wellbeing improvement"],

  "undesired_outcomes": ["children", "animal studies"],

  "question_template": "PICO"

}

 

Example Output:

{

  "concepts": [

    { "name": "Population", "value": "healthcare professionals" },

    { "name": "Intervention", "value": "mindfulness-based therapy" },

    { "name": "Outcome", "value": "anxiety reduction" }

  ]

}

 

===========================================================

🔸 OUTPUT RULES

===========================================================

- Always output structured, valid JSON.

- Never include explanations, commentary, or additional text outside JSON.

- Maintain consistent key names exactly as shown.

- If any optional detail (discipline, project type, outcomes) is missing, ignore it — do NOT infer or invent replacements.

 

===========================================================

🔸 REMINDER

===========================================================

Your role is to support reproducible academic research.  

Focus on accuracy, domain-specific sensitivity, and terminological relevance.`;
                
        try {
            const result = await callGeminiAPI(prompt);
            console.log(result);
            const generatedConcepts = [];
            
            if (result.concepts && Array.isArray(result.concepts)) {
                result.concepts.forEach((concept, index) => {
                    if (concept.name && concept.value) {
                        // Determine concept type based on name or create custom type
                        let conceptType = 'custom';
                        const nameLower = concept.name.toLowerCase();
                        
                        if (nameLower.includes('population')) {
                            conceptType = 'population';
                        } else if (nameLower.includes('intervention')) {
                            conceptType = 'intervention';
                        } else if (nameLower.includes('comparison')) {
                            conceptType = 'comparison';
                        } else if (nameLower.includes('outcome')) {
                            conceptType = 'outcome';
                        }
                        
                        // Use the value as the main term
                        generatedConcepts.push({
                            id: `concept_${Date.now()}_${index}`,
                            name: concept.value,
                            type: conceptType,
                            synonyms: [],
                            keywords: [],
                            controlled_vocabulary: []
                        });
                    }
                });
            }
                        
            setConcepts(generatedConcepts);
            setConceptsGenerated(true);
            setConceptsGenerationCount(prev => prev + 1);
            
            // Log concept generation
            await logger.logFeatureUsed(userId, 'concept_generation', {
                projectId: project.id,
                projectName: project.name,
                conceptsCount: generatedConcepts.length,
                researchQuestion: researchQuestion.substring(0, 100)
            });
                        
            toast.success("Concepts generated from your research question!");
        } catch (err) {
            handleError(err, 'concept generation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestPicoTerms = async (category) => {
        const picoLabels = { p: 'Population', i: 'Intervention', c: 'Comparison', o: 'Outcome' };
        const contextPico = { ...pico };
        delete contextPico[category];
        const contextText = Object.entries(contextPico).map(([key, value]) => Array.isArray(value) && value.join(' ').trim() ? `${picoLabels[key]}: ${value.join('; ')}` : null).filter(Boolean).join('\n');
        if (contextText.trim() === '') return toast.error('Please fill in at least one other PICO field for context.');
        
        setPicoSuggestions({ isOpen: true, category, suggestions: [], loading: true });
        const prompt = `Given the PICO context for a systematic review:\n${contextText}\n\nSuggest 5-7 specific terms or short phrases for the "${picoLabels[category]}" component. Return ONLY a raw JSON array of strings.`;
        try {
            const suggestions = await callGeminiAPI(prompt);
            setPicoSuggestions(prev => ({ ...prev, suggestions: Array.isArray(suggestions) ? suggestions : [], loading: false }));
        } catch (err) {
            handleError(err, 'PICO suggestions');
            setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false });
        }
    };

    const handleAddSuggestionToPico = (suggestion, category) => {
        setPico(prev => {
            const newCategoryValues = [...prev[category]];
            const lastIndex = newCategoryValues.length - 1;
            if (lastIndex >= 0 && newCategoryValues[lastIndex].trim() === '') {
                newCategoryValues[lastIndex] = suggestion;
            } else {
                newCategoryValues.push(suggestion);
            }
            return { ...prev, [category]: newCategoryValues };
        });
        setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false });
    };

    const handleGenerateKeywords = async (conceptsData = concepts, keywordStyle = 'balanced') => {
        if (!conceptsData || !Array.isArray(conceptsData) || conceptsData.length === 0) {
            return toast.error('No concepts defined. Please generate PICO concepts first.');
        }
        
        // Check if keywords generation exceeds limit for this project
        const maxKeywords = capabilities.maxKeywordGenerationsPerProject;
        if (Number.isFinite(maxKeywords) && keywordsGenerationCount >= maxKeywords) {
            return toast.error(`Keywords can only be generated up to ${maxKeywords} times per project.`);
        }
        
        setIsLoading(true);
        try {
            // Extract project data for the prompt
            const projectType = project.projectType || '';
            const discipline = project.discipline || '';
            const desiredOutcomes = project.outcomesNeeded || '';
            const undesiredOutcomes = project.outcomesNotNeeded || negativeKeywords.filter(k => k.trim() !== '').join(', ') || '';
            
            // Prepare concepts in the format expected by STAGE 2
            // We need to determine the concept name (label) from the concept type
            const conceptsForPrompt = conceptsData.map(concept => {
                // Determine concept label based on type
                let conceptLabel = concept.name; // Default to the concept name
                const typeLower = (concept.type || '').toLowerCase();
                
                if (typeLower === 'population') {
                    conceptLabel = 'Population';
                } else if (typeLower === 'intervention') {
                    conceptLabel = 'Intervention';
                } else if (typeLower === 'comparison') {
                    conceptLabel = 'Comparison';
                } else if (typeLower === 'outcome') {
                    conceptLabel = 'Outcome';
                }
                
                return {
                    name: conceptLabel,
                    value: concept.name
                };
            });
            
            // Determine number of terms based on keyword style
            let numTerms = 5; // balanced default
            if (keywordStyle === 'focused') {
                numTerms = 3;
            } else if (keywordStyle === 'comprehensive') {
                numTerms = 10;
            }
            
            let vocabInstructions = '';
            if (selectedDBs.pubmed) {
                vocabInstructions += 'Generate 2-3 relevant MeSH terms, where each is an object like {"term": "Term Name", "type": "MeSH"}. ';
            }
            if (selectedDBs.embase) {
                vocabInstructions += 'Generate 2-3 relevant Emtree terms, where each is an object like {"term": "Term Name", "type": "Emtree"}. ';
            }
            if (!selectedDBs.pubmed && !selectedDBs.embase) {
                vocabInstructions = 'The "controlled_vocabulary" array must be empty.';
            }
            
            const prompt = `You are an expert information specialist in academic information retrieval, systematic reviews, and database query design.

You are part of ReVue's AI engine, helping researchers build reproducible and context-aware search strategies.

 

===========================================================

🔸 STAGE 2: TERM EXPANSION

===========================================================

 

Using the provided confirmed concepts, generate up to ${numTerms} relevant academic search terms or synonyms for each concept.

 

Guidelines:

- Use the context (discipline, study design, desired/undesired outcomes) to guide term selection.

- Include common synonyms, abbreviations, and controlled vocabulary equivalents (e.g., MeSH, Emtree).

- Exclude any terms matching undesired outcomes or concepts.

- Maintain diversity and precision — avoid redundancy.

- Do NOT fabricate unrelated or non-academic terms.

- Return ONLY valid JSON.

 

────────────────────────────

Context:

- Research Question: ${researchQuestion}

- Project Type: ${projectType || '(optional)'}

- Discipline: ${discipline || '(optional)'}

- Desired Outcomes: ${desiredOutcomes || '(optional)'}

- Undesired Outcomes: ${undesiredOutcomes || '(optional)'}

────────────────────────────

 

User-confirmed concepts:

${JSON.stringify(conceptsForPrompt, null, 2)}

 

────────────────────────────

Return format:

{

  "concept_terms": [

    {

      "concept": "Concept Name",

      "terms": ["term1", "term2", "term3", "term4", "term5"]

    }

  ]

}

 

────────────────────────────

Example Input:

{

  "research_question": "What is the effectiveness of mindfulness-based therapy on anxiety among healthcare professionals?",

  "project_type": "systematic review",

  "discipline": "public health",

  "desired_outcomes": ["reduction in anxiety", "mental wellbeing improvement"],

  "undesired_outcomes": ["children", "animal studies"],

  "concepts": [

    { "name": "Population", "value": "healthcare professionals" },

    { "name": "Intervention", "value": "mindfulness-based therapy" },

    { "name": "Outcome", "value": "anxiety reduction" }

  ]

}

 

Example Output:

{

  "concept_terms": [

    {

      "concept": "Population",

      "terms": ["healthcare workers", "nurses", "clinicians", "medical staff", "hospital personnel"]

    },

    {

      "concept": "Intervention",

      "terms": ["mindfulness", "mindfulness-based stress reduction", "MBSR", "meditation training", "mindfulness intervention"]

    },

    {

      "concept": "Outcome",

      "terms": ["anxiety", "stress reduction", "emotional regulation", "psychological distress", "mental wellbeing"]

    }

  ]

}

 

===========================================================

🔸 OUTPUT RULES

===========================================================

- Always output structured, valid JSON.

- Never include explanations, commentary, or additional text outside JSON.

- Maintain consistent key names exactly as shown.

- If any optional detail (discipline, project type, outcomes) is missing, ignore it — do NOT infer or invent replacements.

 

===========================================================

🔸 REMINDER

===========================================================

Your role is to support reproducible academic research.  

Focus on accuracy, domain-specific sensitivity, and terminological relevance.

 

${vocabInstructions ? `\n\nAdditional Instructions:\n${vocabInstructions}\n\nFor controlled vocabulary, include it in a separate "controlled_vocabulary" field for each concept in the concept_terms array.` : ''}`;
            
            const result = await callGeminiAPI(prompt);
            
            // Process the result - it should have concept_terms array
            const updatedConcepts = conceptsData.map(concept => {
                // Find matching concept term data
                let conceptTermData = null;
                if (result.concept_terms && Array.isArray(result.concept_terms)) {
                    // Try to match by concept name or by concept type
                    const typeLower = (concept.type || '').toLowerCase();
                    let conceptLabel = concept.name;
                    
                    if (typeLower === 'population') {
                        conceptLabel = 'Population';
                    } else if (typeLower === 'intervention') {
                        conceptLabel = 'Intervention';
                    } else if (typeLower === 'comparison') {
                        conceptLabel = 'Comparison';
                    } else if (typeLower === 'outcome') {
                        conceptLabel = 'Outcome';
                    }
                    
                    conceptTermData = result.concept_terms.find(ct => 
                        ct.concept === conceptLabel || 
                        ct.concept === concept.name ||
                        ct.concept?.toLowerCase() === conceptLabel.toLowerCase()
                    );
                }
                
                let keywords = [];
                let controlled_vocabulary = [];
                
                if (conceptTermData) {
                    keywords = Array.isArray(conceptTermData.terms) ? conceptTermData.terms : [];
                    controlled_vocabulary = Array.isArray(conceptTermData.controlled_vocabulary) ? conceptTermData.controlled_vocabulary : [];
                }
                
                // Fallback: try to find by concept name in result (old format compatibility)
                if (keywords.length === 0 && result[concept.name]) {
                    const conceptData = result[concept.name];
                    if (Array.isArray(conceptData)) {
                        keywords = conceptData;
                    } else if (conceptData && typeof conceptData === 'object') {
                        keywords = Array.isArray(conceptData.keywords) ? conceptData.keywords : [];
                        controlled_vocabulary = Array.isArray(conceptData.controlled_vocabulary) ? conceptData.controlled_vocabulary : [];
                    }
                }
                
                const updatedConcept = {
                    ...concept,
                    keywords: keywords.map(term => ({
                        term,
                        active: true,
                        source: 'ai',
                        searchField: 4
                    })),
                    controlled_vocabulary: controlled_vocabulary.map(item => ({
                        ...item,
                        active: true,
                        source: 'ai'
                    }))
                };
                
                return updatedConcept;
            });
            
            setConcepts(updatedConcepts);
            setKeywordsGenerated(true);
            setKeywordsGenerationCount(prev => prev + 1);
            
            // Log keyword generation
            await logger.logFeatureUsed(userId, 'keyword_generation', {
                projectId: project.id,
                projectName: project.name,
                keywordStyle,
                conceptsCount: conceptsData.length,
                totalKeywords: updatedConcepts.reduce((sum, concept) => sum + concept.keywords.length, 0)
            });
                        
            toast.success(`Keywords generated with ${keywordStyle} style!`);
            
        } catch (err) {
            handleError(err, 'keyword generation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestParameters = () => {
        const testConcepts = [
            {
                id: "pico_p_test",
                name: "adults with hypertension",
                type: "population",
                synonyms: ["adults", "hypertension"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_i_test",
                name: "telemedicine",
                type: "intervention",
                synonyms: ["telemedicine"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_c_test",
                name: "usual care",
                type: "comparison",
                synonyms: ["usual care"],
                keywords: [],
                controlled_vocabulary: []
            },
            {
                id: "pico_o_test",
                name: "blood pressure control",
                type: "outcome",
                synonyms: ["blood pressure control"],
                keywords: [],
                controlled_vocabulary: []
            }
        ];
        const testRQ = "In adults with hypertension, is telemedicine effective compared to usual care for blood pressure control?";
        setConcepts(testConcepts);
        setResearchQuestion(testRQ);
        toast("Test parameters loaded!");
    };
    
    const generateSingleQuery = (dbKey, enabledTypes = {}) => {
        if (!concepts || concepts.length === 0) return '';
        const { syntax } = DB_CONFIG[dbKey];
    
        // Special handling for Semantic Scholar: keep it short and natural-language-like
        if (dbKey === 'semanticScholar') {
            // Prefer concept names; fallback to first active keyword per concept
            const phrases = [];
            concepts.forEach(concept => {
                const name = (concept.name || '').trim();
                if (name) phrases.push(`"${name}"`);
                if (phrases.length >= 6) return; // cap early if enough terms collected
                const firstKeyword = (concept.keywords || []).find(k => k && k.active && (k.term || '').trim());
                if (firstKeyword) phrases.push(`"${firstKeyword.term.trim()}"`);
            });
            // De-duplicate and cap to a safe number of phrases
            const deduped = Array.from(new Set(phrases)).slice(0, 6);
            let finalQuery = deduped.join(' ');

            // Add negative terms using minus style
            const activeNegative = negativeKeywords.filter(k => k.trim() !== '');
            if (activeNegative.length > 0) {
                const ssNegatives = activeNegative.map(k => `-"${k}"`).join(' ');
                finalQuery = `${finalQuery}${finalQuery ? ' ' : ''}${ssNegatives}`.trim();
            }
            return finalQuery;
        }

        const parts = [];
        
        concepts.forEach(concept => {
            if (!concept.keywords || concept.keywords.length === 0) return;
    
            let activeTerms = [];
    
            // OPTIMIZED LOGIC FOR PUBMED: Combine controlled vocabulary and Keywords with OR
            if (dbKey === 'pubmed') {
                // Include controlled vocabulary terms based on enabled types
                const controlledVocabTerms = concept.controlled_vocabulary
                    .filter(v => v.active && enabledTypes[v.type.toLowerCase()])
                    .map(v => syntax[v.type.toLowerCase()] ? syntax[v.type.toLowerCase()](v.term) : null)
                    .filter(term => term !== null);

                const keywordTerms = concept.keywords
                    .filter(k => k.active)
                    .map(k => {
                        const searchField = k.searchField;

                        const dbField = DB_CONFIG[dbKey].searchFields[searchField];
                        return syntax.phrase(k.term, dbField);
                    });

                activeTerms = [...controlledVocabTerms, ...keywordTerms];

            } else {
                // ADVANCED LOGIC FOR ALL OTHER DATABASES
                activeTerms = [
                    ...concept.keywords.filter(k => k.active).map(k => {
                        const searchField = k.searchField;
                        const dbField = DB_CONFIG[dbKey].searchFields[searchField];

                        return syntax.phrase(k.term, dbField);
                    }),
                    ...concept.controlled_vocabulary.filter(v => v.active && syntax[v.type.toLowerCase()]).map(v => syntax[v.type.toLowerCase()](v.term) )
                ];
            }
    
            if (activeTerms.length > 0) {
                parts.push(`(${activeTerms.join(' OR ')})`);
            }
        });
    
        let finalQuery = parts.join(`\n\n${syntax.separator}\n\n `);
    
        const activeNegative = negativeKeywords.filter(k => k.trim() !== '');
        if (activeNegative.length > 0) {
            if (dbKey === 'semanticScholar') {
                // Semantic Scholar supports minus for exclusion
                const ssNegatives = activeNegative.map(k => `-"${k}"`).join(' ');
                finalQuery = `${finalQuery}${finalQuery ? ' ' : ''}${ssNegatives}`.trim();
            } else {
                const negativePart = activeNegative.map(k => `"${k}"`).join(' OR ');
                if (finalQuery) {
                   finalQuery += ` ${syntax.not} (${negativePart})`;
                }
            }
        }
        return finalQuery.trim();
    };

    const fetchAndSetCount = async (dbKey) => {
        const query = generateSingleQuery(dbKey, enabledControlledVocabTypes);
        setQueries(prev => ({ ...prev, [dbKey]: query }));
        setSearchCounts(prev => ({ ...prev, [dbKey]: { ...prev[dbKey], loading: true } }));
        if (!query) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 0, loading: false } }));
            return;
        }
        try {
            const count = await retryAsync(async () => {
                if (dbKey === 'pubmed') return await getPubmedCount(query);
                if (dbKey === 'scopus' || dbKey === 'embase') return await getElsevierCount(dbKey, query);
                if (dbKey === 'core') return await getCoreCount(query);
                if (dbKey === 'semanticScholar') return await getSemanticScholarCount(query);
                return 'N/A';
            });
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: count, loading: false } }));
        } catch (err) {
            setSearchCounts(prev => ({ ...prev, [dbKey]: { count: 'Error', loading: false } }));
            handleError(err, `count retrieval for ${dbKey}`);
        }
    };
    
    const handleDbSelectionChange = (dbKey, isChecked) => {
        setSelectedDBs(prev => ({ ...prev, [dbKey]: isChecked }));
        if (isChecked && step === 2) {
            fetchAndSetCount(dbKey);
        }
    };
    
    useEffect(() => {
        if (step === 2) {
            (async () => {
                const keys = Object.keys(selectedDBs).filter(k => selectedDBs[k]);
                await Promise.allSettled(keys.map(dbKey => fetchAndSetCount(dbKey)));
            })();
        }
    }, [step]);
    
    const handleRunSearch = async (isUpdate = false) => {
        setIsSearching(true);
        if (!isUpdate) {
            setDeduplicationResult(null);
            setIrrelevantArticles(new Set());
        }
    
        const currentQueries = {};
        Object.keys(selectedDBs).forEach(dbKey => {
            if (selectedDBs[dbKey]) {
                currentQueries[dbKey] = generateSingleQuery(dbKey, enabledControlledVocabTypes);
            }
        });
        setQueries(currentQueries);
        setInitialArticles([]);
        setSearchResults(null);
        let results = {};
        let allFetchedArticles = [];
    
        const keys = Object.keys(currentQueries);
        const totals = {};
        const tasks = keys.map(dbKey => (async () => {
            const query = currentQueries[dbKey];
            try {
                const response = await retryAsync(async () => {
                    if (dbKey === 'pubmed') return await searchPubmed(query, retmax);
                    if (dbKey === 'scopus' || dbKey === 'embase') return await searchElsevier(dbKey, query, retmax);
                    if (dbKey === 'core') return await searchCore(query, retmax);
                    if (dbKey === 'semanticScholar') return await searchSemanticScholar(query, retmax);
                    return { total: 0, data: [] };
                });
                
                // Extract articles and total from response
                const articles = response.data || response; // Fallback for old format
                const total = response.total || 0;
                
                results[dbKey] = { status: 'success', data: articles };
                totals[dbKey] = total;
                allFetchedArticles.push(...articles);
            } catch (err) {
                console.error(`Error searching ${dbKey}:`, err);
                results[dbKey] = { status: 'error', message: err.message };
                totals[dbKey] = 0;
                handleError(err, `search for ${dbKey}`);
            }
        })());

        await Promise.all(tasks);

        setSearchResults(results);
        setInitialArticles(allFetchedArticles);
        setSearchTotals(totals); // Store the totals from search results
        setIsSearching(false);
        
        // Log search execution
        const successfulSearches = Object.values(results).filter(r => r.status === 'success').length;
        await logger.logSearchPerform(
            userId,
            currentQueries, // full queries by DB
            totals,         // per-DB counts
            keys.join(',')  // search type: comma-separated DBs
        );
    
        if (!isUpdate) {
            const anyFailure = Object.values(results).some(r => r.status === 'error');
            if (anyFailure) return; // stay on Query step
            setStep(3);
        }
    };

    const handlePaginatedSearch = async (dbKey, page, pageSize = 25) => {
        const query = queries[dbKey];
        if (!query) return [];

        try {
            const offset = (page - 1) * pageSize;
            const response = await retryAsync(async () => {
                if (dbKey === 'pubmed') return await searchPubmed(query, pageSize, offset);
                if (dbKey === 'scopus' || dbKey === 'embase') return await searchElsevier(dbKey, query, pageSize, offset);
                if (dbKey === 'core') return await searchCore(query, pageSize, offset);
                if (dbKey === 'semanticScholar') return await searchSemanticScholar(query, pageSize, offset);
                return { total: 0, data: [] };
            }, { tries: 5, baseDelayMs: 1000, factor: 3 });
            
            // Extract articles from response (handle both old and new format)
            const articles = response.data || response;
            return articles;
        } catch (err) {
            console.error(`Error searching ${dbKey} page ${page}:`, err);
            handleError(err, `loading page ${page} for ${dbKey}`);
            return [];
        }
    };

    const handleDeduplicate = () => {
        if (initialArticles.length === 0) return toast.error("No articles to deduplicate.");
        const seen = new Set();
        let duplicateCount = 0;
        const updatedArticles = initialArticles.map(article => {
            const doi = article.doi || article.externalIds?.DOI;
            const title = (article.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            let isDuplicate = (doi && seen.has(doi)) || (title && seen.has(title));
            if (isDuplicate) {
                duplicateCount++;
                return { ...article, isDuplicate: true };
            } else {
                if (doi) seen.add(doi);
                if (title) seen.add(title);
                return { ...article, isDuplicate: false };
            }
        });
        setInitialArticles(updatedArticles);
        setDeduplicationResult({ count: duplicateCount });
        toast.success(`${duplicateCount} duplicates found.`);
    };

    const toggleIrrelevant = (articleId) => {
        const newSet = new Set(irrelevantArticles);
        if (newSet.has(articleId)) {
            newSet.delete(articleId);
        } else {
            newSet.add(articleId);
        }
        setIrrelevantArticles(newSet);
    };

    const exportHandler = async (format, options) => {
        console.log('Export handler called with:', format, options);
        console.log('🔍 PROJECT EDITOR DEBUG:', {
            userAccessLevel,
            capabilities,
            exportQuotaPercent: options?.exportQuotaPercent,
            exportFullDataset: options?.exportFullDataset
        });
        
        // Always use background export (capped or full), so we can fetch beyond visible page
        console.log('Starting background export...');
        const downloadName = generateExportFilename(project.name, format);
        addDownload({
            name: downloadName,
            format,
            options,
            queries,
            searchTotals,
            progress: 0,
            totalRecords: 0,
            processedRecords: 0
        });
        setDownloadCenterOpen(true);
        toast.success('Export started! Check download center for progress.');
        return;
    };

    const renderStepIndicator = () => {
        const steps = [
            { number: 1, name: 'Define', label: 'Define Your Research Question', description: 'Set up your research concepts' },
            { number: 2, name: 'Query', label: 'Build & Run Your Search', description: 'Create and execute queries' },
            { number: 3, name: 'Results', label: 'Review & Export Results', description: 'Review and export findings' }
        ];

        // Determine if a step can be navigated to
        const canNavigateToStep = (stepNum) => {
            // Always allow backward navigation
            if (stepNum < step) return true;
            
            // Always can go to step 1
            if (stepNum === 1) return true;
            
            // Can go to step 2 if concepts exist with keywords (forward navigation)
            if (stepNum === 2) {
                return concepts && concepts.length > 0 && concepts.some(concept => concept.keywords && concept.keywords.length > 0);
            }
            
            // Can go to step 3 if we have search results (forward navigation)
            if (stepNum === 3) {
                return initialArticles && initialArticles.length > 0;
            }
            
            return false;
        };

        return (
            <nav aria-label="Progress" className="mb-8">
                <ol role="list" className="flex items-center justify-between">
                    {steps.map((stepInfo, index) => {
                        const s = stepInfo.number;
                        const isCompleted = step > s;
                        const isCurrent = step === s;
                        const isUpcoming = step < s;
                        const canNavigate = canNavigateToStep(s);
                        
                        return (
                            <li 
                                key={stepInfo.name} 
                                className={cn(
                                    "relative flex-1",
                                    index !== steps.length - 1 ? "pr-4" : ""
                                )}
                            >
                                <div className="flex flex-col items-center">
                                    {/* Connector Line */}
                                    {index !== steps.length - 1 && (
                                        <div className="absolute top-5 left-[60%] right-0 h-0.5 z-0">
                                            <div 
                                                className={cn(
                                                    "h-full transition-all duration-500",
                                                    isCompleted ? "bg-main" : "bg-gray-200"
                                                )}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Step Circle */}
                                    <div className="relative z-10">
                                        {isCompleted ? (
                                            <button
                                                onClick={() => canNavigate && setStep(s)}
                                                disabled={!canNavigate}
                                                className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                                                    canNavigate 
                                                        ? "bg-main border-main hover:bg-main-dark hover:scale-110 cursor-pointer shadow-md" 
                                                        : "bg-gray-300 border-gray-300 cursor-not-allowed"
                                                )}
                                                title={`Go to ${stepInfo.label}`}
                                            >
                                                <CheckIcon className="h-6 w-6 text-white" />
                                            </button>
                                        ) : isCurrent ? (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-main bg-white shadow-lg ring-4 ring-main ring-opacity-20">
                                                <span className="h-3 w-3 rounded-full bg-main" />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => canNavigate && setStep(s)}
                                                disabled={!canNavigate}
                                                className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                                                    canNavigate
                                                        ? "border-gray-300 bg-white hover:border-main hover:bg-main hover:bg-opacity-10 hover:scale-110 cursor-pointer"
                                                        : "border-gray-200 bg-gray-50 cursor-not-allowed"
                                                )}
                                                title={canNavigate ? `Go to ${stepInfo.label}` : 'Complete previous steps first'}
                                            >
                                                <span className="h-3 w-3 rounded-full bg-transparent" />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Step Label */}
                                    <div className="mt-3 text-center max-w-[140px]">
                                        <div 
                                            className={cn(
                                                "text-xs font-semibold transition-colors duration-300",
                                                isCurrent ? "text-main" : isCompleted ? "text-gray-700" : "text-gray-400"
                                            )}
                                        >
                                            Step {s}
                                        </div>
                                        <div 
                                            className={cn(
                                                "text-xs mt-1 transition-colors duration-300 leading-tight",
                                                isCurrent ? "text-gray-900 font-medium" : "text-gray-500"
                                            )}
                                        >
                                            {stepInfo.name}
                                        </div>
                                        {isCurrent && (
                                            <div className="text-[10px] mt-1 text-gray-500 leading-tight">
                                                {stepInfo.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </nav>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <ContextMenuComponent />
            <ThesaurusModal 
                thesaurusState={thesaurusData}
                onClose={() => setThesaurusData({ isOpen: false, word: '', synonyms: [], loading: false, context: null })}
                onAddSynonym={handleAddSynonym}
            />
            <PicoSuggestionsModal 
                suggestionsState={picoSuggestions}
                onClose={() => setPicoSuggestions({ isOpen: false, category: null, suggestions: [], loading: false })}
                onAddSuggestion={handleAddSuggestionToPico}
            />
            <QueryRefinementModal 
                modalData={refineModalData}
                onClose={() => setRefineModalData(null)}
                onApplyChanges={(updatedKeywords) => {
                    setRefineModalData(null);
                }}
            />
            {selectedArticle && <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
            {isExportModalOpen && <ExportModal onClose={() => setIsExportModalOpen(false)} allArticles={initialArticles} hasDeduplicated={!!deduplicationResult} onExport={exportHandler} />}

            
            <Header 
                subtitle={project.name} 
                onBackButtonClicked={onBackToDashboard} 
                backButtonText="Dashboard"
                showDownloadButton={true}
                onLogoClick={onBackToDashboard}
            />
            

            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="rounded-lg border bg-white p-6 md:p-10 shadow-lg">
                        <div className="mb-8">{renderStepIndicator()}</div>
                        <div className="relative min-h-[400px] overflow-hidden">
                            <div 
                                key={step}
                                style={{
                                    animation: 'fadeInSlide 0.4s ease-in-out'
                                }}
                            >
                                {step === 1 && (
                                    <DefineStep
                                        state={{ researchQuestion, concepts, isLoading, negativeKeywords, keywordGenerationStyles, keywordStyle, conceptsGenerated, keywordsGenerated, conceptsGenerationCount, keywordsGenerationCount, capabilities }}
                                        actions={{ setResearchQuestion, setConcepts, setNegativeKeywords, setKeywordStyle, handleGenerateKeywords, handleGeneratePicoFromQuestion, setStep, showMenu, findSynonyms, onBackToDashboard }}
                                    />
                                )}
                                {step === 2 && (
                                    <QueryBuilder
                                        state={{ queries, searchCounts, isSearching, selectedDBs, concepts, enabledControlledVocabTypes }}
                                        actions={{ setStep, handleRunSearch, handleDbSelectionChange, setRefineModalData: (data) => setRefineModalData({ ...data, projectId: project.id }), setEnabledControlledVocabTypes }}
                                    />
                                )}
                                {step === 3 && (
                                    <ResultsViewer
                                        state={{ searchResults, initialArticles, deduplicationResult, pageSize: retmax, isSearching, searchTotals }}
                                        actions={{ setStep, setSelectedArticle, setIsExportModalOpen, setAllArticles: setInitialArticles, setDeduplicationResult, setPageSize: setRetmax, handleRunSearch, handleDeduplicate, handlePaginatedSearch }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectEditor;