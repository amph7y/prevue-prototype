import React from 'react';
import { getAuth, applyActionCode } from 'firebase/auth';
import { db } from './config/firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ProjectDashboard from './components/dashboard/ProjectDashboard.jsx';
import ProjectEditor from './components/editor/ProjectEditor.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import RegisterPage from './components/auth/RegisterPage.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import Spinner from './components/common/Spinner.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { GlobalDownloadProvider } from './contexts/GlobalDownloadContext.jsx';
import DownloadCenter from './components/common/DownloadCenter.jsx';

function AppContent() {
  const { user, loading, isAuthenticated, userId, isAdmin } = useAuth();
  const [activeProject, setActiveProject] = React.useState(null);
  const [currentView, setCurrentView] = React.useState('landing');

  React.useEffect(() => {
    // Handle email verification links
    const auth = getAuth();
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'verifyEmail' && oobCode) {
      (async () => {
        try {
          await applyActionCode(auth, oobCode);
          toast.success('Email verified successfully. You can now sign in.');
          if (auth.currentUser && db) {
            try {
              await setDoc(doc(db, 'users', auth.currentUser.uid), { verifyEmail: true }, { merge: true });
            } catch (e) {
              console.warn('Could not set verifyEmail flag after verification:', e);
            }
          }
        } catch (e) {
          toast.error('Invalid or expired verification link.');
        } finally {
          // Clean query params
          const cleanUrl = url.split('?')[0];
          window.history.replaceState({}, document.title, cleanUrl);
        }
      })();
    }
    if (!loading) {
      if (isAuthenticated) {
        if (currentView === 'login' || currentView === 'register') {
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

  const handleRegisterSuccess = () => {
    setCurrentView('login');
  };

  const handleGoToRegister = () => {
    setCurrentView('register');
  };

  const handleBackToLogin = () => {
    setCurrentView('login');
  };

  const handleGoToAdmin = () => {
    setCurrentView('admin');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  if (currentView === 'landing') {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
         <LandingPage onGetStarted={handleGetStarted} onGoToAdmin={isAdmin ? handleGoToAdmin : null} />
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  if (currentView === 'login' && !isAuthenticated) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        <LoginPage onSuccess={handleLoginSuccess} onBackToLanding={handleBackToLanding} onGoToRegister={handleGoToRegister} />
        <DownloadCenter />
      </GlobalDownloadProvider>);
  }

  if (currentView === 'register' && !isAuthenticated) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        <RegisterPage onSuccess={handleRegisterSuccess} onBackToLogin={handleBackToLogin} onBackToLanding={handleBackToLanding} />
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  if (currentView === 'admin' && isAuthenticated && isAdmin) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
        <AdminDashboard onBackToLanding={handleBackToLanding} />
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
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
            user={user}
            onBackToLanding={handleBackToLanding}
            onGoToAdmin={isAdmin ? handleGoToAdmin : null}
          />
        )}
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  return (
    <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
       <LandingPage onGetStarted={handleGetStarted} onGoToAdmin={isAdmin ? handleGoToAdmin : null} />
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
