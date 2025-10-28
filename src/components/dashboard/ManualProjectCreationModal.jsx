import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { XCircleIcon, FolderPlusIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

function ManualProjectCreationModal({ onClose, onCreateProject, isCreating, projectLimit, userAccessLevel }) {
    const [projectName, setProjectName] = useState('');

    const handleCreate = () => {
        if (!projectName.trim()) {
            return;
        }
        onCreateProject(projectName);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            handleCreate();
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
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

                <div className="p-8">
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

                    {userAccessLevel === 'free' && !projectLimit?.canCreate && (
                        <div className="mt-4 p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                            ⚠️ You have reached your weekly project creation limit
                        </div>
                    )}
                </div>

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
        resetDate: PropTypes.instanceOf(Date).isRequired
    }),
    userAccessLevel: PropTypes.string.isRequired
};

export default ManualProjectCreationModal;
