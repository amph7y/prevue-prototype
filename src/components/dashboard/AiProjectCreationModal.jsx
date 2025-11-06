import React, { useState } from 'react';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';
import { callGeminiAPI } from '../../api/geminiApi.js';
import { XCircleIcon, SparklesIcon, FolderPlusIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';
import logger from '../../utils/logger.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getCapabilities } from '../../config/accessControl.js';

function AiProjectCreationModal({ onClose, onCreateProject, isCreating, projectLimit }) {
    const { userId, userAccessLevel } = useAuth();
    const capabilities = getCapabilities(userAccessLevel);
    const [researchTopic, setResearchTopic] = useState('');
    const [generatedData, setGeneratedData] = useState(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState(null);

    const handleGenerate = async () => {
        if (!capabilities.canUseAiProject) {
            return toast.error('AI project generation is a premium feature.');
        }
        if (userAccessLevel === 'free' && !projectLimit?.canCreate) {
            return toast.error('You have reached your lifetime project limit.');
        }
        if (!researchTopic.trim()) return toast.error("Please enter a research topic.");
        setIsLoadingAI(true);
        setAiError(null);

        const prompt = `Given the research topic: "${researchTopic}", generate a concise research question and the corresponding PICO framework (Population, Intervention, Comparison, Outcome). Each PICO component should be a short phrase. Return ONLY a single JSON object with keys "researchQuestion", and "pico" (which is an object with keys "p", "i", "c", "o"). The value for each pico key should be an array containing one string.`;
        
        try {
            await logger.logFeatureUsed(userId, 'ai_project_generate_clicked', { researchTopic: researchTopic.substring(0, 200) });
            const result = await callGeminiAPI(prompt);
            setGeneratedData(result);
            await logger.logFeatureUsed(userId, 'ai_project_generated', { hasPico: !!result?.pico, hasRQ: !!result?.researchQuestion });
            toast.success("AI generated project details!");
        } catch (err) {
            setAiError(err.message);
            toast.error(`AI generation failed: ${err.message}`);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleCreate = async () => {
        if (generatedData) {
            await logger.logFeatureUsed(userId, 'ai_project_created', {
                researchQuestion: (generatedData.researchQuestion || '').substring(0, 150)
            });
            onCreateProject(generatedData.researchQuestion, generatedData.pico, generatedData.researchQuestion);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                <div className="p-8 bg-[#39d0c4] rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 border-2 border-white/30">
                                    <span className="text-xl font-bold text-white">2</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white">Generate Project with AI</h3>
                            </div>
                            <p className="text-sm text-white/90">Let AI create your research framework</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <XCircleIcon className="h-6 w-6 text-white" />
                        </button>
                    </div>
                </div>
                <div className="p-8 overflow-y-auto max-h-[60vh] space-y-6">
                    <div>
                        <label htmlFor="research-topic" className="block text-sm font-semibold text-gray-700 mb-3">
                            Enter Your Research Topic
                        </label>
                        <input 
                            type="text" 
                            id="research-topic" 
                            value={researchTopic} 
                            onChange={(e) => setResearchTopic(e.target.value)} 
                            placeholder="e.g., telehealth interventions for chronic diseases" 
                            className="block w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none disabled:bg-gray-100" 
                            disabled={isLoadingAI || !capabilities.canUseAiProject} 
                        />
                        <p className="mt-2 text-xs text-gray-500">AI will generate your research question and PICO framework</p>
                    </div>
                    <button 
                        onClick={handleGenerate} 
                        disabled={isLoadingAI || !researchTopic.trim() || !capabilities.canUseAiProject || (userAccessLevel === 'free' && !projectLimit?.canCreate)} 
                        className="w-full inline-flex items-center justify-center gap-x-3 rounded-xl border border-transparent bg-[#39d0c4] px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:bg-[#32c3b5] disabled:bg-gray-400"
                    >
                        {isLoadingAI ? <Spinner /> : <SparklesIcon className="h-6 w-6" />}
                        {isLoadingAI ? 'Generating...' : ((userAccessLevel === 'free' && !projectLimit?.canCreate) ? 'Project Limit Reached' : capabilities.canUseAiProject ? 'Generate Research Question & PICO' : 'Premium Feature')}
                    </button>
                    {!capabilities.canUseAiProject && (
                        <div className="p-4 text-sm text-[#39d0c4] bg-[#39d0c4]/10 border border-[#39d0c4]/20 rounded-xl">
                            <span className="font-semibold">💎 Premium Feature:</span> Upgrade to Premium to generate full projects with AI.
                        </div>
                    )}
                    {aiError && <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{aiError}</div>}
                    {generatedData && (
                        <div className="mt-6 p-6 border-2 border-[#39d0c4]/30 rounded-2xl bg-[#39d0c4]/5 shadow-inner">
                            <div className="flex items-center gap-2 mb-4">
                                <SparklesIcon className="h-5 w-5 text-[#39d0c4]" />
                                <h4 className="text-lg font-bold text-gray-900">AI Generated Content</h4>
                            </div>
                            <div className="mb-6">
                                <h4 className="text-base font-semibold text-gray-800 mb-2">Research Question:</h4>
                                <p className="text-gray-700 italic bg-white p-4 rounded-xl border border-[#39d0c4]/20">{generatedData.researchQuestion}</p>
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-gray-800 mb-3">PICO Framework:</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-white p-3 rounded-xl border border-[#39d0c4]/20">
                                        <strong className="text-[#39d0c4]">Population:</strong>
                                        <p className="text-gray-700 mt-1">{generatedData.pico.p.join(', ')}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-[#39d0c4]/20">
                                        <strong className="text-[#39d0c4]">Intervention:</strong>
                                        <p className="text-gray-700 mt-1">{generatedData.pico.i.join(', ')}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-[#39d0c4]/20">
                                        <strong className="text-[#39d0c4]">Comparison:</strong>
                                        <p className="text-gray-700 mt-1">{generatedData.pico.c.join(', ')}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-[#39d0c4]/20">
                                        <strong className="text-[#39d0c4]">Outcome:</strong>
                                        <p className="text-gray-700 mt-1">{generatedData.pico.o.join(', ')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-gray-50 border-t rounded-b-2xl flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isCreating}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCreate} 
                        disabled={!generatedData || isCreating || (userAccessLevel === 'free' && !projectLimit?.canCreate)} 
                        className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-[#39d0c4] px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:bg-[#32c3b5] disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isCreating ? <Spinner /> : <FolderPlusIcon className="h-5 w-5" />}
                        {isCreating ? 'Creating...' : ((userAccessLevel === 'free' && !projectLimit?.canCreate) ? 'Project Limit Reached' : 'Create Project')}
                    </button>
                </div>
            </div>
        </div>
    );
}

AiProjectCreationModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onCreateProject: PropTypes.func.isRequired,
    isCreating: PropTypes.bool.isRequired,
    projectLimit: PropTypes.shape({
        canCreate: PropTypes.bool.isRequired,
        currentCount: PropTypes.number.isRequired,
        limit: PropTypes.number.isRequired,
        resetDate: PropTypes.instanceOf(Date)
    })
};

export default AiProjectCreationModal;