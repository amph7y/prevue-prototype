import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { XCircleIcon, FolderPlusIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

function ManualProjectCreationModal({ onClose, onCreateProject, isCreating, projectLimit, userAccessLevel }) {
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState('');
    const [discipline, setDiscipline] = useState('');
    const [outcomesNeeded, setOutcomesNeeded] = useState('');
    const [outcomesNotNeeded, setOutcomesNotNeeded] = useState('');
    const [questionTemplate, setQuestionTemplate] = useState('');

    const handleCreate = () => {
        if (!projectName.trim()) {
            return;
        }
        const extraData = {
            projectType: projectType.trim() || null,
            discipline: discipline.trim() || null,
            outcomesNeeded: outcomesNeeded.trim() || null,
            outcomesNotNeeded: outcomesNotNeeded.trim() || null,
            questionTemplate: questionTemplate || null,
        };
        onCreateProject(projectName, null, '', extraData);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            handleCreate();
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 bg-[#39d0c4] rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 border-2 border-white/30">
                                    <span className="text-xl font-bold text-white">2</span>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Create Project Manually</h3>
                            </div>
                            <p className="text-sm text-white/90">Give your project a name to get started</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <XCircleIcon className="h-6 w-6 text-white" />
                        </button>
                    </div>
                </div>

                {/* Body: scrollable content */}
                <div className="p-8 overflow-y-auto max-h-[65vh]">
                    <div>
                        <label htmlFor="project-name" className="block text-sm font-semibold text-gray-700 mb-3">
                            Project Name
                        </label>
                        <input
                            type="text"
                            id="project-name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., Effectiveness of Exercise Therapy..."
                            className="block w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            autoFocus
                        />
                        <p className="mt-2 text-xs text-gray-500">Press Enter to create</p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5">
                        <div>
                            <label htmlFor="project-type" className="block text-sm font-semibold text-gray-700 mb-2">
                                Project Type (optional)
                            </label>
                            <input
                                type="text"
                                id="project-type"
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value)}
                                placeholder="e.g., Systematic Review, RCT, Meta-analysis"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="discipline" className="block text-sm font-semibold text-gray-700 mb-2">
                                Discipline (optional)
                            </label>
                            <input
                                type="text"
                                id="discipline"
                                value={discipline}
                                onChange={(e) => setDiscipline(e.target.value)}
                                placeholder="e.g., Cardiology, Public Health, Psychology"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="outcomes-needed" className="block text-sm font-semibold text-gray-700 mb-2">
                                Outcomes Needed (optional)
                            </label>
                            <textarea
                                id="outcomes-needed"
                                rows={2}
                                value={outcomesNeeded}
                                onChange={(e) => setOutcomesNeeded(e.target.value)}
                                placeholder="List outcomes/parameters you need (comma-separated or free text)"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="outcomes-not-needed" className="block text-sm font-semibold text-gray-700 mb-2">
                                Outcomes/Parameters Not Needed (optional)
                            </label>
                            <textarea
                                id="outcomes-not-needed"
                                rows={2}
                                value={outcomesNotNeeded}
                                onChange={(e) => setOutcomesNotNeeded(e.target.value)}
                                placeholder="List outcomes/parameters you want to exclude"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="question-template" className="block text-sm font-semibold text-gray-700 mb-2">
                                Question Template (optional)
                            </label>
                            <select
                                id="question-template"
                                value={questionTemplate}
                                onChange={(e) => setQuestionTemplate(e.target.value)}
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none bg-white"
                            >
                                <option value="">Select a template</option>
                                <option value="PICO">PICO</option>
                                <option value="SPIDER">SPIDER</option>
                                <option value="CIMO">CIMO</option>
                                <option value="ECLIPSE">ECLIPSE</option>
                                <option value="SPICE">SPICE</option>
                            </select>
                        </div>
                    </div>

                    {userAccessLevel === 'free' && !projectLimit?.canCreate && (
                        <div className="mt-4 p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                            ⚠️ You have reached your lifetime project creation limit
                        </div>
                    )}
                </div>

                {/* Sticky footer */}
                <div className="p-6 bg-gray-50 border-t rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !projectName.trim() || (userAccessLevel === 'free' && !projectLimit?.canCreate)}
                        className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-[#39d0c4] px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:bg-[#32c3b5] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                    >
                        {isCreating ? (
                            <>
                                <Spinner />
                                Creating...
                            </>
                        ) : (
                            <>
                                <FolderPlusIcon className="h-5 w-5" />
                                {(userAccessLevel === 'free' && !projectLimit?.canCreate) ? 'Limit Reached' : 'Create Project'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

ManualProjectCreationModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onCreateProject: PropTypes.func.isRequired,
    isCreating: PropTypes.bool.isRequired,
    projectLimit: PropTypes.shape({
        canCreate: PropTypes.bool.isRequired,
        currentCount: PropTypes.number.isRequired,
        limit: PropTypes.number.isRequired,
        resetDate: PropTypes.instanceOf(Date)
    }),
    userAccessLevel: PropTypes.string.isRequired
};

export default ManualProjectCreationModal;
