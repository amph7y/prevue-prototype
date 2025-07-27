import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn.js';
import { PROJECT_COLORS } from '../../config/constants.js';
import { FolderPlusIcon, SearchIcon, SparklesIcon, LightBulbIcon } from '../common/Icons.jsx';
import AiProjectCreationModal from './AiProjectCreationModal.jsx';
import GapFinderModal from './GapFinderModal.jsx';
import Spinner from '../common/Spinner.jsx';

function ProjectDashboard({ onSelectProject, userId }) {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isGapFinderModalOpen, setIsGapFinderModalOpen] = useState(false);

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
            toast.error(`Error fetching projects: ${error.message}`);
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
                pico: pico || { p: [''], i: [''], c: [''], o: [''] },
                researchQuestion: researchQuestion,
                initialStep: pico ? 2 : 1 // Start at step 2 if PICO is pre-filled
            };
            const docRef = await addDoc(collection(db, projectsCollectionPath), newProjectData);
            toast.success(`Project '${name}' created!`);
            onSelectProject({ id: docRef.id, ...newProjectData });
        } catch (error) {
            console.error("Error creating project: ", error);
            toast.error(`Error creating project: ${error.message}`);
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
    
    return (
        <div className="bg-gray-50 min-h-screen">
            {isAiModalOpen && <AiProjectCreationModal onClose={() => setIsAiModalOpen(false)} onCreateProject={handleCreateProject} isCreating={isCreating} />}
            {isGapFinderModalOpen && <GapFinderModal onClose={() => setIsGapFinderModalOpen(false)} />}

            <header className="bg-white shadow-sm"><div className="mx-auto max-w-7xl py-4 px-4 sm:px-6 lg:px-8"><h1 className="text-3xl font-bold tracking-tight text-gray-900">Project Dashboard</h1></div></header>
            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0 space-y-8">
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center"><LightBulbIcon className="h-6 w-6 mr-2 text-yellow-500" />Find Research Gaps</h2>
                            <p className="text-sm text-gray-600 mt-1">Not sure where to start? Enter a topic to find potential research gaps.</p>
                            <div className="mt-4"><button onClick={() => setIsGapFinderModalOpen(true)} className="inline-flex items-center gap-x-2 rounded-md border border-transparent bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-200"><SearchIcon className="h-5 w-5" />Launch Gap Finder</button></div>
                        </div>

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
                                    <div className="mt-1"><button onClick={() => setIsAiModalOpen(true)} disabled={isCreating} className="w-full inline-flex items-center justify-center gap-x-2 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"><SparklesIcon className="h-5 w-5" />Generate with AI</button></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h2 className="text-xl font-semibold text-gray-800">Your Projects</h2>
                            {isLoading ? (<div className="flex justify-center items-center mt-4"><Spinner /><p className="ml-2">Loading projects...</p></div>) 
                            : projects.length === 0 ? (<p className="mt-4 text-gray-500">You have no projects yet. Create one to get started!</p>) 
                            : (<ul role="list" className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {projects.map((project) => (
                                    <li key={project.id} className="col-span-1 flex rounded-md shadow-sm">
                                        <div className={cn(project.color || 'bg-gray-600', "flex w-16 flex-shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white")}>{project.name.substring(0, 2).toUpperCase()}</div>
                                        <div className="flex flex-1 items-center justify-between truncate rounded-r-md border-b border-r border-t border-gray-200 bg-white">
                                            <div className="flex-1 truncate px-4 py-2 text-sm"><button onClick={() => onSelectProject(project)} className="font-medium text-gray-900 hover:text-indigo-600 text-left w-full truncate">{project.name}</button><p className="text-gray-500">{project.createdAt?.toDate().toLocaleDateString()}</p></div>
                                        </div>
                                    </li>
                                ))}
                            </ul>)}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ProjectDashboard;