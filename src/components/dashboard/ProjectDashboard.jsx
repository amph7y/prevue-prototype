import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn.js';
import { handleError } from '../../utils/utils.js';
import { PROJECT_COLORS } from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { FolderPlusIcon, LightBulbIcon } from '../common/Icons.jsx';
import AiProjectCreationModal from './AiProjectCreationModal.jsx';
import GapFinderModal from './GapFinderModal.jsx';
import ProjectCreationChoiceModal from './ProjectCreationChoiceModal.jsx';
import ManualProjectCreationModal from './ManualProjectCreationModal.jsx';
import Spinner from '../common/Spinner.jsx';
import Header from '../common/Header.jsx';
import { checkLifetimeProjectLimit, formatResetDate, debugLifetimeLimit, testLifetimeCalculation, recordProjectCreationEvent } from '../../utils/projectLimits.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

function ProjectDashboard({ onSelectProject, userId, user, onBackToLanding, onGoToAdmin }) {
    const { userAccessLevel } = useAuth();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isGapFinderModalOpen, setIsGapFinderModalOpen] = useState(false);
    const [showGapSection, setShowGapSection] = useState(() => {
        try { return localStorage.getItem('showGapSection') !== 'false'; } catch { return true; }
    });
    
    // Project limit state
    const [projectLimit, setProjectLimit] = useState({ canCreate: true, currentCount: 0, limit: Infinity, resetDate: new Date() });
    const [isCheckingLimit, setIsCheckingLimit] = useState(false);

    useEffect(() => {
        try { localStorage.setItem('showGapSection', String(showGapSection)); } catch {}
    }, [showGapSection]);

    // Check project limit on component load
    useEffect(() => {
        const checkLimit = async () => {
            if (!userId || !userAccessLevel) return;
            
            // Reset to default state immediately to avoid showing stale data
            setProjectLimit({ canCreate: true, currentCount: 0, limit: Infinity, resetDate: new Date() });
            setIsCheckingLimit(true);
            
            try {
                const limitInfo = await checkLifetimeProjectLimit(userId, userAccessLevel);
                setProjectLimit(limitInfo);
            } catch (error) {
                console.error('Error checking project limit:', error);
                // On error, allow creation to avoid blocking users
                setProjectLimit({ canCreate: true, currentCount: 0, limit: Infinity, resetDate: new Date() });
            } finally {
                setIsCheckingLimit(false);
            }
        };
        
        checkLimit();
    }, [userId, userAccessLevel]);

    // Re-check project limit when choice modal opens to ensure fresh data
    useEffect(() => {
        const checkLimit = async () => {
            if (!userId || !userAccessLevel || !isChoiceModalOpen) return;
            
            setIsCheckingLimit(true);
            try {
                const limitInfo = await checkLifetimeProjectLimit(userId, userAccessLevel);
                setProjectLimit(limitInfo);
            } catch (error) {
                console.error('Error checking project limit:', error);
                setProjectLimit({ canCreate: true, currentCount: 0, limit: Infinity, resetDate: new Date() });
            } finally {
                setIsCheckingLimit(false);
            }
        };
        
        if (isChoiceModalOpen) {
            checkLimit();
        }
    }, [isChoiceModalOpen, userId, userAccessLevel]);

    useEffect(() => {
        if (!userId || !db) return;
        const projectsCollectionPath = `users/${userId}/projects`;
        const q = query(collection(db, projectsCollectionPath), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching projects: ", error);
            handleError(error, 'fetching projects');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const handleCreateProject = async (name, pico = null, researchQuestion = '') => {
        if (!name.trim()) {
            toast.error("Project name cannot be empty.");
            return;
        }
        
        // Check project limit before creating
        if (!projectLimit.canCreate) {
            toast.error(`You have reached your lifetime project limit (${projectLimit.currentCount}/${projectLimit.limit}).`);
            return;
        }
        
        setIsCreating(true);
        const projectsCollectionPath = `users/${userId}/projects`;
        try {
            const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
            const newProjectData = {
                name: name,
                createdAt: serverTimestamp(),
                color: color,
                researchQuestion: researchQuestion,
                initialStep: 1,
                userId: userId,
                userName: user?.displayName || user?.email || 'Unknown User',
                userEmail: user?.email || null
            };
            const docRef = await addDoc(collection(db, projectsCollectionPath), newProjectData);
            
            // Log project creation
            await logger.logProjectCreate(userId, docRef.id, name);
            
            // Record project creation event for lifetime limit tracking
            await recordProjectCreationEvent(userId, docRef.id, name);
            
            // Re-check the project limit to ensure accuracy
            try {
                const limitInfo = await checkLifetimeProjectLimit(userId, userAccessLevel);
                setProjectLimit(limitInfo);
            } catch (error) {
                console.error('Error re-checking project limit:', error);
                // Fallback to optimistic update
                setProjectLimit(prev => ({
                    ...prev,
                    currentCount: prev.currentCount + 1,
                    canCreate: prev.currentCount + 1 < prev.limit
                }));
            }
            
            toast.success(`Project '${name}' created!`);
            onSelectProject({ id: docRef.id, ...newProjectData });
        } catch (error) {
            console.error("Error creating project: ", error);
            handleError(error, 'creating project');
        } finally {
            setIsCreating(false);
            setIsAiModalOpen(false);
            setIsManualModalOpen(false);
            setIsChoiceModalOpen(false);
            setIsGapFinderModalOpen(false);
        }
    };

    const handleCreateProjectClick = () => {
        setIsChoiceModalOpen(true);
    };

    const handleSelectManual = () => {
        setIsChoiceModalOpen(false);
        setIsManualModalOpen(true);
    };

    const handleSelectAI = () => {
        setIsChoiceModalOpen(false);
        setIsAiModalOpen(true);
    };

    const handleGapInterest = async (interested) => {
        if (!userId || !db) return;
        try {
            await addDoc(collection(db, `users/${userId}/feedback`), {
                type: 'gap_feature_interest',
                interested,
                createdAt: serverTimestamp()
            });
            toast.success('Thanks for your feedback!');
        } catch (error) {
            console.error('Failed to record feedback:', error);
            handleError(error, 'recording feedback');
        }
    };

    const handleDeleteProject = async (projectId, projectName) => {
        if (!userId || !db) return;
        
        // Confirm deletion
        if (!window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const projectRef = doc(db, `users/${userId}/projects`, projectId);
            await deleteDoc(projectRef);
            await logger.logProjectDelete(userId, projectId, projectName);
            
            // Note: Project count does NOT decrease when deleting projects
            // The weekly limit is based on total projects created during the week, not current projects
            console.log('Project deleted - count remains the same (based on creation count, not current projects)');
            
            toast.success(`Project "${projectName}" deleted successfully!`);
        } catch (error) {
            console.error('Failed to delete project:', error);
            handleError(error, 'deleting project');
        }
    };
    
    return (
        <div className="bg-gray-50 min-h-screen">
            {isChoiceModalOpen && (
                <ProjectCreationChoiceModal 
                    onClose={() => setIsChoiceModalOpen(false)} 
                    onSelectManual={handleSelectManual}
                    onSelectAI={handleSelectAI}
                    userAccessLevel={userAccessLevel}
                    projectLimit={projectLimit}
                />
            )}
            {isManualModalOpen && (
                <ManualProjectCreationModal 
                    onClose={() => setIsManualModalOpen(false)} 
                    onCreateProject={handleCreateProject}
                    isCreating={isCreating}
                    projectLimit={projectLimit}
                    userAccessLevel={userAccessLevel}
                />
            )}
            {isAiModalOpen && (
                <AiProjectCreationModal 
                    onClose={() => setIsAiModalOpen(false)} 
                    onCreateProject={handleCreateProject} 
                    isCreating={isCreating} 
                    projectLimit={projectLimit} 
                />
            )}
            {isGapFinderModalOpen && <GapFinderModal onClose={() => setIsGapFinderModalOpen(false)} />}

            <Header 
                subtitle="Dashboard" 
                onBackButtonClicked={onBackToLanding} 
                backButtonText="Back to Home" 
                onLogoClick={onBackToLanding}
                onGoToAdmin={onGoToAdmin}
            />
            
            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0 space-y-8">
                        {showGapSection ? (
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                            <LightBulbIcon className="h-6 w-6 mr-2 text-yellow-500" />Research Gaps (Experimental)
                                        </h2>
                                        <p className="text-sm text-gray-600 mt-1">
                                            This is an experimental feature we plan to add to help identify potential research gaps based on your topic. It is not available yet, but we would love your feedback on whether this would be useful to you.
                                        </p>
                                    </div>
                                    <button onClick={() => setShowGapSection(false)} className="text-sm text-gray-500 hover:text-gray-700">Hide</button>
                                </div>
                                {/* Temporarily hidden: Are you interested section
                                <div className="mt-4 flex flex-wrap gap-3 items-center">
                                    <span className="text-sm text-gray-700">Are you interested?</span>
                                    <button onClick={() => handleGapInterest(true)} className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-main/10 px-3 py-1.5 text-sm font-medium text-main shadow-sm hover:bg-main/20">Yes</button>
                                    <button onClick={() => handleGapInterest(false)} className="inline-flex items-center gap-x-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Not right now</button>
                                </div>
                                */}
                            </div>
                        ) : (
                            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                                <p className="text-sm text-gray-600">Research Gaps (experimental) is hidden.</p>
                                <button onClick={() => setShowGapSection(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Show section</button>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Your Projects</h2>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="font-medium">
                                            Access Level: <span className={`font-semibold ${userAccessLevel === 'premium' ? 'text-green-600' : 'text-blue-600'}`}>
                                                {userAccessLevel === 'premium' ? 'Premium' : 'Free'}
                                            </span>
                                        </span>
                                        {projectLimit.limit !== Infinity && (
                                            <span className="text-gray-500">
                                                {isCheckingLimit ? (
                                                    <span className="flex items-center">
                                                        <Spinner />
                                                        <span className="ml-2">Checking...</span>
                                                    </span>
                                                ) : (
                                                    <span>
                                                        {projectLimit.currentCount}/{projectLimit.limit} lifetime
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleCreateProjectClick}
                                    disabled={isCreating || (userAccessLevel === 'free' && !projectLimit.canCreate)}
                                    className="group inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-[#39d0c4] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:bg-[#32c3b5] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:shadow-md"
                                >
                                    <FolderPlusIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
                                    <span>{(userAccessLevel === 'free' && !projectLimit.canCreate) ? 'Limit Reached' : 'Create Project'}</span>
                                </button>
                            </div>
                            
                            {!projectLimit.canCreate && userAccessLevel === 'free' && (
                                <div className="mb-4 p-3 text-sm text-amber-700 bg-amber-50 rounded-md">
                                    You have reached your lifetime project creation limit ({projectLimit.currentCount}/{projectLimit.limit}).
                                </div>
                            )}
                            
                            {projectLimit.canCreate && projectLimit.limit !== Infinity && projectLimit.currentCount > 0 && userAccessLevel === 'free' && (
                                <div className="mb-4 p-3 text-sm text-blue-700 bg-blue-50 rounded-md">
                                    You have created {projectLimit.currentCount} of {projectLimit.limit} projects (lifetime).
                                    <br />
                                    <span className="text-xs text-gray-600 mt-1 block">
                                        Note: Deleting projects does not increase your remaining allowance.
                                    </span>
                                </div>
                            )}
                            
                        </div>

                        <div className="mt-6">
                            {isLoading ? (
                                <div className="flex justify-center items-center mt-4"><Spinner /><p className="ml-2">Loading projects...</p></div>
                            ) : projects.length === 0 ? (
                                <p className="mt-4 text-gray-500">You have no projects yet. Create one to get started!</p>
                            ) : (
                                <ul role="list" className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {projects.map((project) => (
                                        <li key={project.id} className="col-span-1 flex rounded-md shadow-sm">
                                            <div className={cn(project.color || 'bg-gray-600', "flex w-16 flex-shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white")}>{project.name.substring(0, 2).toUpperCase()}</div>
                                            <div className="flex flex-1 items-center justify-between truncate rounded-r-md border-b border-r border-t border-gray-200 bg-white">
                                                <div className="flex-1 truncate px-4 py-2 text-sm">
                                                    <button onClick={async () => {
                                                        await logger.logProjectView(userId, project.id, project.name);
                                                        onSelectProject(project);
                                                    }} className="font-medium text-gray-900 hover:text-indigo-600 text-left w-full truncate">{project.name}</button>
                                                    <p className="text-gray-500">{project.createdAt?.toDate().toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex-shrink-0 pr-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteProject(project.id, project.name);
                                                        }}
                                                        className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                        title="Delete project"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectDashboard;