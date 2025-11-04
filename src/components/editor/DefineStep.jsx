import React, { useState } from 'react';
import PicoBuilder from './PicoBuilder.jsx';
import ConceptKeywordViewer from './ConceptKeywordViewer.jsx';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon, MainSparklesIcon, PencilIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import logger from '../../utils/logger.js';

const DefineStep = ({ state, actions }) => {
  const { researchQuestion, concepts, isLoading, negativeKeywords, keywordGenerationStyles, keywordStyle, conceptsGenerated, keywordsGenerated, capabilities } = state;
  const {
    setResearchQuestion,
    setConcepts,
    setNegativeKeywords,
    setKeywordStyle,
    handleGenerateKeywords,
    handleGeneratePicoFromQuestion,
    setStep,
    showMenu,
    findSynonyms,
    handleAddKeyword,
    onBackToDashboard,
  } = actions;

  const hasConcepts = concepts && concepts.length > 0;

  const hasKeywords = concepts.some(concept => concept.keywords && concept.keywords.length > 0);
  const isFreshProject = !hasConcepts || !hasKeywords;
  
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [conceptListModal, setConceptListModal] = useState(false);

  const handleGenerateConcepts = async () => {
    // Log concept generation initiation
    await logger.logConceptGenerationInitiated(null, {
      researchQuestion: researchQuestion.substring(0, 100)
    });
    await handleGeneratePicoFromQuestion();
  };

  const handleGenerateKeywordsForConcepts = async () => {
    setIsGeneratingKeywords(true);
    try {
      // Log keyword generation initiation
      await logger.logKeywordGenerationInitiated(null, {
        conceptsCount: concepts.length,
        keywordStyle
      });
      await handleGenerateKeywords(concepts, keywordStyle);
      // Scroll to the Keyword Generation Style section after keywords are generated
      setTimeout(() => {
        const keywordStyleSection = document.getElementById('keyword-generation-style-section');
        if (keywordStyleSection) {
          keywordStyleSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } catch (error) {
      console.error('Error generating keywords:', error);
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const handleEditConcepts = () => {
    setConcepts(prev => prev.map(concept => ({
      ...concept,
      keywords: [],
      controlled_vocabulary: []
    })));
  };
  
  const addNegativeKeyword = () => {
    setNegativeKeywords(prev => [...prev, '']);
  };

  const removeNegativeKeyword = (index) => {
    if (negativeKeywords.length > 1) {
      setNegativeKeywords(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateNegativeKeyword = (index, value) => {
    setNegativeKeywords(prev => prev.map((kw, i) => i === index ? value : kw));
  };

  return (
    <>
      <div className="mt-10">
        {!isFreshProject && hasKeywords && (
          <div className="flex justify-between items-center mb-10 ">
            
              <button 
                type="button" 
                onClick={onBackToDashboard} 
                className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />
                Back to Dashboard
              </button>
            
            
              <button 
                type="button" 
                onClick={() => setStep(2)} 
                className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-main px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-main-dark"
              >
                Continue to Query
                <ArrowUturnRightIcon className="h-5 w-5" />
              </button>
          </div>
        )}

        <h2 className="text-2xl font-bold">Step 1. Define Your Research Question</h2>
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-lg font-semibold">Research Question</label>
          </div>
          <div className="mb-4 p-3 text-sm text-gray-600 bg-gray-50 rounded-md">
            <strong>Note:</strong> You can only generate concepts and keywords once per project. 
            If you need to regenerate them, please create a new project.
          </div>
          <textarea 
            rows={3} 
            value={researchQuestion} 
            onChange={(e) => setResearchQuestion(e.target.value)} 
            className="block w-full rounded-md border-gray-300 shadow-sm" 
            placeholder="e.g., What is the effectiveness of mindfulness on anxiety in healthcare professionals?" 
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleGenerateConcepts}
              disabled={isLoading || !researchQuestion.trim() || (conceptsGenerated && capabilities.canGenerateConceptsOncePerProject)}
              className="inline-flex items-center rounded-md border border-transparent bg-main px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  <span className="ml-2">Generating Concepts...</span>
                </>
              ) : conceptsGenerated && capabilities.canGenerateConceptsOncePerProject ? (
                <>
                  <MainSparklesIcon className="h-5 w-5 mr-2" />
                  <span>Concepts Already Generated</span>
                </>
              ) : (
                <>
                  <MainSparklesIcon className="h-5 w-5 mr-2" />
                  <span>Generate Concepts</span>
                </>
              )}
            </button>
          </div>
          {conceptsGenerated && capabilities.canGenerateConceptsOncePerProject && (
            <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
              Concepts can only be generated once per project. You can edit the generated concepts or create a new project.
            </div>
          )}
        </div>
      </div>

      {/* Fresh Project Flow: Show Concepts Section */}
      {isFreshProject && (
        <>
          <div className="mt-10">
            <h2 className="text-2xl font-bold">Review & Refine Concepts</h2>
            <p className="mt-2 text-gray-600">
              Review the generated PICO concepts and add or modify as needed.
            </p>
            
            <div className="mt-6">
                          <PicoBuilder
              state={{ researchQuestion, concepts, isLoading }}
              actions={{ setResearchQuestion, setConcepts, handleGeneratePicoFromQuestion }}
              showOnlyConcepts={true}
            />
            </div>
          </div>

          {/* Generate Keywords Button for Fresh Projects */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleGenerateKeywordsForConcepts}
              disabled={isGeneratingKeywords || (keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject)}
              className="inline-flex items-center rounded-md border border-transparent bg-main px-8 py-4 text-lg font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50 disabled:cursor-not-allowed"
            >
              {isGeneratingKeywords ? (
                <>
                  <Spinner />
                  <span className="ml-2">Generating Keywords...</span>
                </>
              ) : keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject ? (
                <>
                  <MainSparklesIcon className="h-6 w-6 mr-3" />
                  <span>Keywords Already Generated</span>
                </>
              ) : (
                <>
                  <MainSparklesIcon className="h-6 w-6 mr-3" />
                  <span>Generate Keywords</span>
                </>
              )}
            </button>
          </div>
          {keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject && (
            <div className="mt-4 text-sm text-amber-600 bg-amber-50 p-3 rounded-md text-center">
              Keywords can only be generated once per project. You can edit the generated keywords or create a new project.
            </div>
          )}
        </>
      )}

      {/* Existing Project Flow: Show Configuration Options and Keywords */}
      {!isFreshProject && (
        <>
          {/* Negative Keywords Section */}
          <div className="mt-10">
            <h3 className="text-xl font-semibold">Negative Keywords</h3>
            <p className="mt-2 text-gray-600">
              Add terms you want to exclude from your search results.
            </p>
            <div className="mt-4 space-y-3">
              {negativeKeywords.map((keyword, index) => (
                <div key={index} className="flex items-center gap-x-3">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => updateNegativeKeyword(index, e.target.value)}
                    className="block flex-1 rounded-md border-gray-300 shadow-sm"
                    placeholder="e.g., children, case study, review"
                  />
                  <button
                    type="button"
                    onClick={() => removeNegativeKeyword(index)}
                    disabled={negativeKeywords.length <= 1}
                    className="text-red-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded hover:bg-red-50"
                    title="Remove negative keyword"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addNegativeKeyword}
                className="text-sm text-main hover:text-main-dark flex items-center gap-1 hover:bg-main/10 px-3 py-2 rounded"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Negative Keyword
              </button>
            </div>
          </div>

          {/* Keyword Generation Style Section */}
          <div id="keyword-generation-style-section" className="mt-10">
            <h3 className="text-xl font-semibold">Keyword Generation Style</h3>
            <p className="mt-2 text-gray-600">
              Choose how comprehensive you want the generated keywords to be.
            </p>
            <div className="mt-4">
              <div className="grid grid-cols-3 gap-3">
                {Object.values(keywordGenerationStyles).map((option) => (
                  <label key={option.value} className="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none">
                    <input
                      type="radio"
                      name="keyword-style"
                      value={option.value}
                      checked={keywordStyle === option.value}
                      onChange={(e) => setKeywordStyle(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex flex-1">
                      <div className="flex flex-col">
                        <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                        <span className="mt-1 flex items-center text-sm text-gray-500">{option.description}</span>
                      </div>
                    </div>
                    <div className={`ml-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                      keywordStyle === option.value ? 'border-main bg-main' : 'border-gray-300'
                    }`}>
                      {keywordStyle === option.value && (
                        <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Keywords Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleGenerateKeywordsForConcepts}
              disabled={isGeneratingKeywords || (keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject)}
              className="inline-flex items-center rounded-md border border-transparent bg-main px-8 py-4 text-lg font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50 disabled:cursor-not-allowed"
            >
              {isGeneratingKeywords ? (
                <>
                  <Spinner />
                  <span className="ml-2">Generating Keywords...</span>
                </>
              ) : keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject ? (
                <>
                  <MainSparklesIcon className="h-6 w-6 mr-3" />
                  <span>Keywords Already Generated</span>
                </>
              ) : (
                <>
                  <MainSparklesIcon className="h-6 w-6 mr-3" />
                  <span>Generate Keywords</span>
                </>
              )}
            </button>
          </div>
          {keywordsGenerated && capabilities.canGenerateKeywordsOncePerProject && (
            <div className="mt-4 text-sm text-amber-600 bg-amber-50 p-3 rounded-md text-center">
              Keywords can only be generated once per project. You can edit the generated keywords or create a new project.
            </div>
          )}

          {/* Keywords Section */}
          {hasKeywords && (
            <div className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Review & Configure Keywords</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleEditConcepts}
                    className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit Concepts
                  </button>

                  <button
                    type="button"
                    onClick={() => setConceptListModal(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit Keywords
                  </button>
                </div>
              </div>
              
              <ConceptKeywordViewer
                concepts={concepts}
                actions={{ setConcepts, showMenu, findSynonyms, conceptListModal, setConceptListModal }}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-12 pt-5 border-t border-gray-200 flex justify-between items-center">
        <button 
          type="button" 
          onClick={onBackToDashboard} 
          className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />
          Back to Dashboard
        </button>
        
        {!isFreshProject && hasKeywords && (
          <button 
            type="button" 
            onClick={() => setStep(2)} 
            className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-main px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-main-dark"
          >
            Continue to Query
            <ArrowUturnRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );
};

export default DefineStep;
