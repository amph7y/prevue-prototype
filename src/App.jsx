import React from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './config/firebase.js';
import toast from 'react-hot-toast';
import ProjectDashboard from './components/dashboard/ProjectDashboard.jsx';
import ProjectEditor from './components/editor/ProjectEditor.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import Spinner from './components/common/Spinner.jsx';
import { GlobalDownloadProvider } from './contexts/GlobalDownloadContext.jsx';
import DownloadCenter from './components/common/DownloadCenter.jsx';

export default function App() {
  const [userId, setUserId] = React.useState(null);
  const [activeProject, setActiveProject] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showLandingPage, setShowLandingPage] = React.useState(true);

  React.useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Authentication failed", error);
          toast.error(`Authentication failed: ${error.message}`);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Spinner />
        <span className="ml-2">Authenticating...</span>
      </div>
    );
  }

  const handleGetStarted = () => {
    setShowLandingPage(false);
  };

  const handleBackToLanding = () => {
    setShowLandingPage(true);
  };

  if (showLandingPage) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        <LandingPage onGetStarted={handleGetStarted} />
        <DownloadCenter />
      </GlobalDownloadProvider>

    );
  }

  return (
    <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
      {activeProject ? (
        <ProjectEditor
          project={activeProject}
          onBackToDashboard={() => setActiveProject(null)}
          userId={userId}
        />
      ) : (
        <ProjectDashboard onSelectProject={setActiveProject} userId={userId} onBackToLanding={handleBackToLanding} />
      )}
      <DownloadCenter />
    </GlobalDownloadProvider>
  );
}