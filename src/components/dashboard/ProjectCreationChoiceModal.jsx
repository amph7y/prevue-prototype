import React from 'react';
import PropTypes from 'prop-types';
import { XCircleIcon, FolderPlusIcon, SparklesIcon } from '../common/Icons.jsx';

function ProjectCreationChoiceModal({ onClose, onSelectManual, onSelectAI, userAccessLevel, projectLimit }) {
    const canUseAI = userAccessLevel === 'premium';
    const canCreate = projectLimit?.canCreate !== false;

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="p-5 bg-[#39d0c4] rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 border-2 border-white/30">
                                    <span className="text-lg font-bold text-white">1</span>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Choose Creation Method</h3>
                            </div>
                            <p className="text-xs text-white/90">Select how you'd like to create your project</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <XCircleIcon className="h-6 w-6 text-white" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-3">
                    {/* Manual Creation Option */}
                    <button
                        onClick={onSelectManual}
                        disabled={!canCreate}
                        className={`group w-full p-5 text-left border-2 rounded-lg transition-all duration-200 ${
                            !canCreate 
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                                : 'border-gray-200 hover:border-[#39d0c4] hover:shadow-lg hover:scale-[1.02] bg-gradient-to-br from-gray-50 to-white cursor-pointer'
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                                !canCreate ? 'bg-gray-200' : 'bg-[#39d0c4]/10 group-hover:bg-[#39d0c4]/20'
                            }`}>
                                <FolderPlusIcon className={`h-5 w-5 ${!canCreate ? 'text-gray-400' : 'text-[#39d0c4]'}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="text-base font-bold text-gray-900">Create Manually</h4>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Start with a blank project and build your research framework step by step at your own pace.
                                </p>
                                {!canCreate && (
                                    <p className="text-xs text-amber-600 mt-2 font-medium">
                                        ✗ You have reached your weekly project limit
                                    </p>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* AI Generation Option */}
                    <button
                        onClick={onSelectAI}
                        disabled={!canCreate || !canUseAI}
                        className={`group w-full p-5 text-left border-2 rounded-lg transition-all duration-200 relative ${
                            (!canCreate || !canUseAI)
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                                : 'border-gray-200 hover:border-[#39d0c4] hover:shadow-lg hover:scale-[1.02] bg-gradient-to-br from-gray-50 to-white cursor-pointer'
                        }`}
                    >
                        {!canUseAI && (
                            <span className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                                PREMIUM
                            </span>
                        )}
                        <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                                (!canCreate || !canUseAI) ? 'bg-gray-200' : 'bg-[#39d0c4]/10 group-hover:bg-[#39d0c4]/20'
                            }`}>
                                <SparklesIcon className={`h-5 w-5 ${!canCreate || !canUseAI ? 'text-gray-400' : 'text-[#39d0c4]'}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="text-base font-bold text-gray-900">
                                        Generate with AI
                                    </h4>
                                    {!canUseAI && (
                                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Premium</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Enter your research topic and let AI generate a complete research question with PICO framework automatically.
                                </p>
                                {!canUseAI && (
                                    <p className="text-xs text-[#39d0c4] mt-2 font-medium">
                                        💎 Upgrade to Premium to unlock AI-powered project generation
                                    </p>
                                )}
                                {!canCreate && canUseAI && (
                                    <p className="text-xs text-amber-600 mt-2 font-medium">
                                        ✗ You have reached your weekly project limit
                                    </p>
                                )}
                            </div>
                        </div>
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-t rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

ProjectCreationChoiceModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onSelectManual: PropTypes.func.isRequired,
    onSelectAI: PropTypes.func.isRequired,
    userAccessLevel: PropTypes.string.isRequired,
    projectLimit: PropTypes.shape({
        canCreate: PropTypes.bool.isRequired,
        currentCount: PropTypes.number.isRequired,
        limit: PropTypes.number.isRequired,
        resetDate: PropTypes.instanceOf(Date).isRequired
    })
};

export default ProjectCreationChoiceModal;
