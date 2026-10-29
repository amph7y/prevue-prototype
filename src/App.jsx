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
import Header from './components/common/Header.jsx';
import SearchTranslator from './components/tools/SearchTranslator.jsx';

function AppContent() {
  const { user, loading, isAuthenticated, userId, isAdmin } = useAuth();
  const [activeProject, setActiveProject] = React.useState(null);
  const [currentView, setCurrentView] = React.useState('landing');
  // Where the Search Translator's back button goes
  const [translatorReturnView, setTranslatorReturnView] = React.useState('landing');
  // A research question typed before signing in (kept in memory only), and whether to go back
  // to the Search Translator after signing in
  const [translatorText, setTranslatorText] = React.useState('');
  const [returnToTranslator, setReturnToTranslator] = React.useState(false);

  const createGuestProject = () => ({
    id: 'guest-preview',
    name: 'Guest Preview',
    color: 'bg-gray-600',
    initialStep: 1,
    isGuest: true,
  });

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
          if (activeProject?.isGuest) {
            setActiveProject(null);
          }
          setCurrentView(returnToTranslator ? 'translator' : 'dashboard');
          setReturnToTranslator(false);
        } else if (currentView === 'guestEditor') {
          setActiveProject(null);
          setCurrentView('dashboard');
        }
      } else if (currentView !== 'guestEditor') {
        setActiveProject(null);
      }
    }
  }, [isAuthenticated, loading, currentView, activeProject, returnToTranslator]);

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
      // Guests now land on the dashboard first
      setCurrentView('guestDashboard');
    }
  };

  const handleStartGuestProject = () => {
    setActiveProject(createGuestProject());
    setCurrentView('guestEditor');
  };

  const handleGuestRequiresSignup = () => {
    toast('Create a free account to unlock this feature.');
    setCurrentView('register');
  };

  const handleBackToLanding = () => {
    if (activeProject?.isGuest) {
      setActiveProject(null);
    }
    setReturnToTranslator(false);
    setCurrentView('landing');
  };

  const handleGuestRequiresLogin = () => {
    toast('Sign in to run your live search and save your project.');
    setCurrentView('login');
  };

  const handleLoginSuccess = () => {
    if (activeProject?.isGuest) {
      setActiveProject(null);
    }
    setCurrentView(returnToTranslator ? 'translator' : 'dashboard');
    setReturnToTranslator(false);
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

  // The Search Translator works for everyone, guests included; nothing is sent to the server.
  // Each page that opens it says where Back should return to.
  const openTranslatorFrom = (returnView) => () => {
    setTranslatorReturnView(returnView);
    setTranslatorText('');
    setCurrentView('translator');
  };

  // Turning a question into searches needs an account: sign in, then come back to the question
  const handleTranslatorLogin = (question) => {
    setTranslatorText(typeof question === 'string' ? question : '');
    setReturnToTranslator(true);
    setCurrentView('login');
  };

  const handleCloseTranslator = () => {
    const back = translatorReturnView;
    // Go back to a page the user can still see (for example after signing out on this page)
    if (back === 'dashboard' && !isAuthenticated) setCurrentView('landing');
    else if (back === 'guestDashboard' && isAuthenticated) setCurrentView('dashboard');
    else setCurrentView(back || 'landing');
  };

  if (currentView === 'translator') {
    return (
      <GlobalDownloadProvider currentProjectId={null}>
        <div className="min-h-screen bg-gray-50">
          <Header
            title="Search Translator"
            onBackButtonClicked={handleCloseTranslator}
            backButtonText="Back"
            onLogoClick={handleBackToLanding}
          />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded-lg bg-white p-6 shadow md:p-8">
              <SearchTranslator initialQuery={translatorText} onRequireLogin={isAuthenticated ? null : handleTranslatorLogin} />
            </div>
          </main>
        </div>
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  if (currentView === 'landing') {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
         <LandingPage onGetStarted={handleGetStarted} onGoToAdmin={isAdmin ? handleGoToAdmin : null} onOpenTranslator={openTranslatorFrom('landing')} />
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

  if (currentView === 'guestDashboard' && !isAuthenticated) {
    return (
      <GlobalDownloadProvider currentProjectId={null}>
        <ProjectDashboard
          isGuest={true}
          onStartGuestProject={handleStartGuestProject}
          onBackToLanding={handleBackToLanding}
          onLogin={() => setCurrentView('login')}
          onOpenTranslator={openTranslatorFrom('guestDashboard')}
          userId={null}
          user={null}
        />
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  if (currentView === 'guestEditor' && !isAuthenticated && activeProject?.isGuest) {
    return (
      <GlobalDownloadProvider currentProjectId={activeProject.id}>
        <ProjectEditor
          project={activeProject}
          onBackToDashboard={() => setCurrentView('guestDashboard')}
          onRequireLogin={handleGuestRequiresLogin}
          onRequireSignup={handleGuestRequiresSignup}
          onLogin={() => setCurrentView('login')}
          userId={null}
        />
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
            onOpenTranslator={openTranslatorFrom('dashboard')}
          />
        )}
        <DownloadCenter />
      </GlobalDownloadProvider>
    );
  }

  return (
    <GlobalDownloadProvider currentProjectId={activeProject?.id || null}>
       <LandingPage onGetStarted={handleGetStarted} onGoToAdmin={isAdmin ? handleGoToAdmin : null} onOpenTranslator={openTranslatorFrom('landing')} />
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
