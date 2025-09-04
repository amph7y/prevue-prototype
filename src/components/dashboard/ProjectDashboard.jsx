import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn.js';
import { handleError } from '../../utils/utils.js';
import { PROJECT_COLORS } from '../../config/constants.js';
import { FolderPlusIcon, SearchIcon, SparklesIcon, LightBulbIcon } from '../common/Icons.jsx';
import AiProjectCreationModal from './AiProjectCreationModal.jsx';
import GapFinderModal from './GapFinderModal.jsx';
import Spinner from '../common/Spinner.jsx';
import Header from '../common/Header.jsx';

function ProjectDashboard({ onSelectProject, userId, user, onBackToLanding }) {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isGapFinderModalOpen, setIsGapFinderModalOpen] = useState(false);
    const [showGapSection, setShowGapSection] = useState(() => {
        try { return localStorage.getItem('showGapSection') !== 'false'; } catch { return true; }
    });

    useEffect(() => {
        try { localStorage.setItem('showGapSection', String(showGapSection)); } catch {}
    }, [showGapSection]);

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
        setIsCreating(true);
        const projectsCollectionPath = `users/${userId}/projects`;
        try {
            const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
            const newProjectData = {
                name: name,
                createdAt: serverTimestamp(),
                color: color,
                researchQuestion: researchQuestion,
                initialStep: pico ? 2 : 1, // Start at step 2 if PICO is pre-filled
                userId: userId,
                userName: user?.displayName || user?.email || 'Unknown User',
                userEmail: user?.email || null
            };
            const docRef = await addDoc(collection(db, projectsCollectionPath), newProjectData);
            toast.success(`Project '${name}' created!`);
            onSelectProject({ id: docRef.id, ...newProjectData });
        } catch (error) {
            console.error("Error creating project: ", error);
            handleError(error, 'creating project');
        } finally {
            setIsCreating(false);
            setNewProjectName('');
            setIsAiModalOpen(false);
            setIsGapFinderModalOpen(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            handleCreateProject(newProjectName);
        }
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
            toast.success(`Project "${projectName}" deleted successfully!`);
        } catch (error) {
            console.error('Failed to delete project:', error);
            handleError(error, 'deleting project');
        }
    };
    
    return (
        <div className="bg-gray-50 min-h-screen">
            {isAiModalOpen && <AiProjectCreationModal onClose={() => setIsAiModalOpen(false)} onCreateProject={handleCreateProject} isCreating={isCreating} />}
            {isGapFinderModalOpen && <GapFinderModal onClose={() => setIsGapFinderModalOpen(false)} />}

            <Header subtitle="Dashboard" onBackButtonClicked={onBackToLanding} backButtonText="Back to Home" onLogoClick={onBackToLanding} />
            
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
                            <h2 className="text-xl font-semibold text-gray-800">Create a New Project</h2>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">1. Create Manually</label>
                                    <div className="mt-1 flex gap-2">
                                        <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Enter project name..." className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                        <button onClick={() => handleCreateProject(newProjectName)} disabled={isCreating || !newProjectName.trim()} className="inline-flex items-center justify-center gap-x-2 rounded-md border border-transparent bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 disabled:bg-gray-300"><FolderPlusIcon className="h-5 w-5" />Create</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">2. Generate from Research Idea</label>
                                    <div className="mt-1"><button onClick={() => setIsAiModalOpen(true)} disabled={isCreating} className="w-full inline-flex items-center justify-center gap-x-2 rounded-md border border-transparent bg-main px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-main-dark disabled:bg-main/50"><SparklesIcon className="h-5 w-5" />Generate with AI</button></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h2 className="text-xl font-semibold text-gray-800">Your Projects</h2>
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
                                                    <button onClick={() => onSelectProject(project)} className="font-medium text-gray-900 hover:text-indigo-600 text-left w-full truncate">{project.name}</button>
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