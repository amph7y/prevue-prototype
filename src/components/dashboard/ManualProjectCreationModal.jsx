import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { XCircleIcon, FolderPlusIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

function ManualProjectCreationModal({ onClose, onCreateProject, isCreating, projectLimit, userAccessLevel }) {
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState('');
    const [discipline, setDiscipline] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [outcomesNeeded, setOutcomesNeeded] = useState('');
    const [outcomesNotNeeded, setOutcomesNotNeeded] = useState('');
    const [questionTemplate, setQuestionTemplate] = useState('');
    const [showGuide, setShowGuide] = useState(false);

    const handleCreate = () => {
        if (!projectName.trim()) {
            return;
        }
        const extraData = {
            projectType: projectType.trim() || null,
            discipline: discipline.trim() || null,
            specialty: specialty.trim() || null,
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
            {/* Guide Modal */}
            {showGuide && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowGuide(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 p-6 bg-[#39d0c4] rounded-t-2xl flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">Question Format Guide</h3>
                            <button 
                                onClick={() => setShowGuide(false)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <XCircleIcon className="h-6 w-6 text-white" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* PICO */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">PICO (Population, Intervention, Comparison, Outcome)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For clinical or quantitative research questions (RCTs, interventions, treatments).</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>P:</strong> Who is the patient/population?</p>
                                    <p><strong>I:</strong> What is the intervention or exposure?</p>
                                    <p><strong>C:</strong> What is the comparator?</p>
                                    <p><strong>O:</strong> What are the outcomes?</p>
                                    <p className="text-gray-600 italic mt-3">Example: In adults with hypertension, does beta-blocker therapy (I) compared to ACE inhibitors (C) reduce blood pressure (O)?</p>
                                </div>
                            </div>

                            {/* PICOS */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">PICOS (Population, Intervention, Comparison, Outcome, Study Design)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> Used in systematic reviews needing clear study design criteria (e.g., include only RCTs).</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>Adds S – Study Design to PICO.</strong></p>
                                    <p className="text-gray-600 italic mt-3">Example: In adults with diabetes (P), do exercise programs (I) compared to standard care (C) improve HbA1c levels (O) in randomized controlled trials (S)?</p>
                                </div>
                            </div>

                            {/* PEO */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">PEO (Population, Exposure, Outcome)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For observational or etiological research (e.g., risk factors, associations).</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>P:</strong> Population</p>
                                    <p><strong>E:</strong> Exposure</p>
                                    <p><strong>O:</strong> Outcome</p>
                                    <p className="text-gray-600 italic mt-3">Example: Among smokers (P), does nicotine exposure (E) increase risk of lung cancer (O)?</p>
                                </div>
                            </div>

                            {/* SPICE */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">SPICE (Setting, Perspective, Intervention, Comparison, Evaluation)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For service delivery, policy, or qualitative studies.</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>S:</strong> Setting</p>
                                    <p><strong>P:</strong> Perspective (population/user)</p>
                                    <p><strong>I:</strong> Intervention</p>
                                    <p><strong>C:</strong> Comparison</p>
                                    <p><strong>E:</strong> Evaluation</p>
                                    <p className="text-gray-600 italic mt-3">Example: In hospital emergency departments (S), how do nurses (P) perceive telemedicine (I) compared to in-person triage (C) for improving workflow (E)?</p>
                                </div>
                            </div>

                            {/* PCC */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">PCC (Population, Concept, Context)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> Used for scoping reviews exploring breadth of evidence.</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>P:</strong> Population</p>
                                    <p><strong>C1:</strong> Concept</p>
                                    <p><strong>C2:</strong> Context</p>
                                    <p className="text-gray-600 italic mt-3">Example: What is known about (C1) digital health interventions (C2) among older adults (P)?</p>
                                </div>
                            </div>

                            {/* SPIDER */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">SPIDER (Sample, Phenomenon of Interest, Design, Evaluation, Research Type)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For qualitative or mixed-method evidence synthesis.</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>S:</strong> Sample</p>
                                    <p><strong>PI:</strong> Phenomenon of Interest</p>
                                    <p><strong>D:</strong> Design</p>
                                    <p><strong>E:</strong> Evaluation</p>
                                    <p><strong>R:</strong> Research Type</p>
                                    <p className="text-gray-600 italic mt-3">Example: Among nursing students (S), how do they experience (PI) online learning (D), evaluated through interviews (E), in qualitative research (R)?</p>
                                </div>
                            </div>

                            {/* CIMO */}
                            <div className="border-b pb-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">CIMO (Context, Intervention, Mechanism, Outcome)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For theoretical or management/organizational reviews.</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>C:</strong> Context</p>
                                    <p><strong>I:</strong> Intervention</p>
                                    <p><strong>M:</strong> Mechanism</p>
                                    <p><strong>O:</strong> Outcome</p>
                                    <p className="text-gray-600 italic mt-3">Example: In hospital teams (C), how does leadership training (I) influence motivation (M) and team performance (O)?</p>
                                </div>
                            </div>

                            {/* ECLIPSE */}
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 mb-2">ECLIPSE (Expectation, Client Group, Location, Impact, Professionals, Service)</h4>
                                <p className="text-sm text-gray-600 mb-3"><strong>Use Case:</strong> For policy, management, or service evaluation questions.</p>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>E:</strong> Expectation</p>
                                    <p><strong>C:</strong> Client Group</p>
                                    <p><strong>L:</strong> Location</p>
                                    <p><strong>I:</strong> Impact</p>
                                    <p><strong>P:</strong> Professionals</p>
                                    <p><strong>S:</strong> Service</p>
                                    <p className="text-gray-600 italic mt-3">Example: What are the expectations (E) of diabetic patients (C) in urban clinics (L) about multidisciplinary care (S) provided by healthcare teams (P) to improve treatment adherence (I)?</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                    {/* NEW: Helpful tip banner - MOVED TO TOP */}
                    <div className="mb-6 p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
                        💡 <strong>Tip:</strong> The more details you provide below, the more accurate and relevant your results will be.
                    </div>

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
                        {/*  Project Type dropdown */}
                        <div>
                            <label htmlFor="project-type" className="block text-sm font-semibold text-gray-700 mb-2">
                                Project Type (optional)
                            </label>
                            <select
                                id="project-type"
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value)}
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none bg-white"
                            >
                                <option value="">Select a project type</option>
                                <option value="Systematic Review">Systematic Review</option>
                                <option value="Scoping Review">Scoping Review</option>
                                <option value="Rapid Review">Rapid Review</option>
                                <option value="Umbrella Review">Umbrella Review</option>
                                <option value="Narrative Reviews">Narrative Reviews</option>
                            </select>
                        </div>

                        {/*Discipline dropdown */}
                        <div>
                            <label htmlFor="discipline" className="block text-sm font-semibold text-gray-700 mb-2">
                                Discipline (optional)
                            </label>
                            <select
                                id="discipline"
                                value={discipline}
                                onChange={(e) => setDiscipline(e.target.value)}
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none bg-white"
                            >
                                <option value="">Select a discipline</option>
                                <option value="Medicine">Medicine</option>
                                <option value="Pharmacy">Pharmacy</option>
                                <option value="Nursing">Nursing</option>
                                <option value="Dentistry">Dentistry</option>
                                <option value="Public Health">Public Health</option>
                                <option value="Psychology">Psychology</option>
                                <option value="Health Policy & Management">Health Policy & Management</option>
                                <option value="Biomedical Sciences">Biomedical Sciences</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Computer Science">Computer Science</option>
                                <option value="Social Sciences">Social Sciences</option>
                                <option value="Education">Education</option>
                                <option value="Business & Management">Business & Management</option>
                                <option value="Environmental Science">Environmental Science</option>
                            </select>
                        </div>

                        {/*Specialty field */}
                        <div>
                            <label htmlFor="specialty" className="block text-sm font-semibold text-gray-700 mb-2">
                                Specialty (optional)
                            </label>
                            <input
                                type="text"
                                id="specialty"
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                                placeholder="Your Specific Specialty (Ex: Pharmacy --> Pharmacoeconomics)"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="outcomes-needed" className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="text-green-700">Desired</span> Outcomes (optional)
                            </label>
                            <textarea
                                id="outcomes-needed"
                                rows={2}
                                value={outcomesNeeded}
                                onChange={(e) => setOutcomesNeeded(e.target.value)}
                                placeholder="List or Describe the outcomes of your project"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="outcomes-not-needed" className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="text-red-700">Undesired</span> Outcomes (optional)
                            </label>
                            <textarea
                                id="outcomes-not-needed"
                                rows={2}
                                value={outcomesNotNeeded}
                                onChange={(e) => setOutcomesNotNeeded(e.target.value)}
                                placeholder="List or Describe the outcomes you wish to exclude from the results"
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="question-template" className="block text-sm font-semibold text-gray-700">
                                    Question Template (optional)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowGuide(true)}
                                    className="text-xs text-[#39d0c4] hover:text-[#32c3b5] font-medium flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    View Guide
                                </button>
                            </div>
                            <select
                                id="question-template"
                                value={questionTemplate}
                                onChange={(e) => setQuestionTemplate(e.target.value)}
                                className="block w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-[#39d0c4] focus:ring-2 focus:ring-[#39d0c4]/20 focus:outline-none bg-white"
                            >
                                <option value="">Select a template</option>
                                <option value="PICO">PICO</option>
                                <option value="PICOS">PICOS</option>
                                <option value="PEO">PEO</option>
                                <option value="PCC">PCC</option>
                                <option value="SPICE">SPICE</option>
                                <option value="SPIDER">SPIDER</option>
                                <option value="ECLIPSE">ECLIPSE</option>
                                <option value="CIMO">CIMO</option>
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