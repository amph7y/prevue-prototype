import React from 'react';
import PicoBuilder from './PicoBuilder.jsx';
import KeywordViewer from './KeywordViewer.jsx';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '../common/Icons.jsx';

const DefineStep = ({ state, actions }) => {
  const { researchQuestion, pico, isLoading, keywords } = state;
  const {
    setResearchQuestion,
    setPico,
    handleGenerateKeywords,
    handleGeneratePicoFromQuestion,
    setKeywords,
    setStep,
    showMenu,
    findSynonyms,
    handleAddKeyword,
    onBackToDashboard,
  } = actions;

  return (
    <>
      <PicoBuilder
        state={{ researchQuestion, pico, isLoading }}
        actions={{ setResearchQuestion, setPico, handleGenerateKeywords, handleGeneratePicoFromQuestion }}
      />
      <div className="my-6 border-t border-gray-200" />
      <KeywordViewer
        state={{ keywords, pico }}
        actions={{ setKeywords, setStep, showMenu, findSynonyms, handleAddKeyword }}
      />

      <div className="mt-12 pt-5 border-t border-gray-200 flex justify-between items-center">
        <button type="button" onClick={() => onBackToDashboard()} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
          <ArrowUturnLeftIcon className="h-5 w-5 text-gray-400" />
          Back to Dashboard
        </button>
        <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700">
          Continue to Query
          <ArrowUturnRightIcon className="h-5 w-5" />
        </button>
      </div>
    </>
  );
};

export default DefineStep;
