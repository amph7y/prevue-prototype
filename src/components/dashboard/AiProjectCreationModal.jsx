import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { callGeminiAPI } from '../../api/geminiApi.js';
import { XCircleIcon, SparklesIcon, FolderPlusIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

function AiProjectCreationModal({ onClose, onCreateProject, isCreating }) {
    const [researchTopic, setResearchTopic] = useState('');
    const [generatedData, setGeneratedData] = useState(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState(null);

    const handleGenerate = async () => {
        if (!researchTopic.trim()) return toast.error("Please enter a research topic.");
        setIsLoadingAI(true);
        setAiError(null);

        const prompt = `Given the research topic: "${researchTopic}", generate a concise research question and the corresponding PICO framework (Population, Intervention, Comparison, Outcome). Each PICO component should be a short phrase. Return ONLY a single JSON object with keys "researchQuestion", and "pico" (which is an object with keys "p", "i", "c", "o"). The value for each pico key should be an array containing one string.`;
        
        try {
            const result = await callGeminiAPI(prompt);
            setGeneratedData(result);
            toast.success("AI generated project details!");
        } catch (err) {
            setAiError(err.message);
            toast.error(`AI generation failed: ${err.message}`);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleCreate = () => {
        if (generatedData) {
            onCreateProject(generatedData.researchQuestion, generatedData.pico, generatedData.researchQuestion);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b"><div className="flex justify-between items-start"><h3 className="text-xl font-bold text-gray-900">Generate Project with AI</h3><button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" /></button></div></div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div>
                        <label htmlFor="research-topic" className="block text-sm font-medium text-gray-700">Enter a broad research topic:</label>
                        <input type="text" id="research-topic" value={researchTopic} onChange={(e) => setResearchTopic(e.target.value)} placeholder="e.g., telehealth for chronic diseases" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" disabled={isLoadingAI} />
                    </div>
                    <button onClick={handleGenerate} disabled={isLoadingAI || !researchTopic.trim()} className="w-full inline-flex items-center justify-center gap-x-2 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isLoadingAI ? <Spinner /> : <SparklesIcon className="h-5 w-5" />}
                        {isLoadingAI ? 'Generating...' : 'Generate Research Question & PICO'}
                    </button>
                    {aiError && <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">{aiError}</div>}
                    {generatedData && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                            <h4 className="text-md font-semibold text-gray-800">Generated Research Question:</h4>
                            <p className="mt-1 text-gray-700 italic">{generatedData.researchQuestion}</p>
                            <h4 className="text-md font-semibold text-gray-800 mt-4">Generated PICO:</h4>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li><strong>P:</strong> {generatedData.pico.p.join(', ')}</li>
                                <li><strong>I:</strong> {generatedData.pico.i.join(', ')}</li>
                                <li><strong>C:</strong> {generatedData.pico.c.join(', ')}</li>
                                <li><strong>O:</strong> {generatedData.pico.o.join(', ')}</li>
                            </ul>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleCreate} disabled={!generatedData || isCreating} className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:bg-green-300">
                        {isCreating ? <Spinner /> : <FolderPlusIcon className="h-5 w-5 mr-2" />}
                        {isCreating ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AiProjectCreationModal;