import React from 'react';
import ProjectDashboard from './components/dashboard/ProjectDashboard.jsx';
import ProjectEditor from './components/editor/ProjectEditor.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import Spinner from './components/common/Spinner.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { GlobalDownloadProvider } from './contexts/GlobalDownloadContext.jsx';
import DownloadCenter from './components/common/DownloadCenter.jsx';

function AppContent() {
  const { user, loading, isAuthenticated, userId } = useAuth();
  const [activeProject, setActiveProject] = React.useState(null);
  const [currentView, setCurrentView] = React.useState('landing'); // 'landing', 'login', 'dashboard'

  React.useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        if (currentView === 'login') {
          setCurrentView('dashboard');
        }
      } else {
        setActiveProject(null);
      }
    }
  }, [isAuthenticated, loading, currentView]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Spinner />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // User is already signed in, go directly to dashboard
      setCurrentView('dashboard');
    } else {
      // User needs to sign in
      setCurrentView('login');
    }
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  const handleLoginSuccess = () => {
    setCurrentView('dashboard');
  };

  if (currentView === 'landing') {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        <LandingPage onGetStarted={handleGetStarted} />
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  if (currentView === 'login' && !isAuthenticated) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }


  if (currentView === 'dashboard' && isAuthenticated) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        {activeProject ? (
          <ProjectEditor
            project={activeProject}
            onBackToDashboard={() => setActiveProject(null)}
            userId={userId}
          />
        ) : (
          <ProjectDashboard 
            onSelectProject={setActiveProject} 
            userId={userId} 
            onBackToLanding={handleBackToLanding} 
          />
        )}
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  return (
    <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
      <LandingPage onGetStarted={handleGetStarted} />
      <DownloadCenter />
    </GlobalDownloadProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
