import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon } from './Icons.jsx';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

function Header({
  title = "ReVue",
  showNav = false,

  // ✅ new props for landing nav
  navItems = [
    { id: 'hero', label: 'Home' },
    { id: 'how-it-works', label: 'How It Works'},
    { id: 'features', label: 'Features'},
    { id: 'pricing', label: 'Pricing' },
    { id: 'contact', label: 'Contact' },
  ],
  activeSection = 'hero',
  onNavItemClick = null,

  // existing props
  onBackButtonClicked,
  backButtonText = null,
  showDownloadButton = false,
  onLogoClick = null,
  actionButton = null,
  onGoToAdmin = null,
}) {
  const { downloads, setIsOpen } = useGlobalDownload();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleNavClick = (id) => {
    if (typeof onNavItemClick === 'function') onNavItemClick(id);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">

          {/* Left: Logo */}
          <div className="flex items-center gap-3 min-w-[180px]">
            {onLogoClick ? (
              <button
                onClick={onLogoClick}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <img src="/PreVue Logo.png" alt="PreVue" className="h-9 w-auto" />
              </button>
            ) : (
              <img src="/PreVue Logo.png" alt="PreVue" className="h-9 w-auto" />
            )}

            {/* Optional title (hide on landing if you want) */}
            <span className="hidden sm:inline text-lg font-semibold text-gray-900">
              {title}
            </span>
          </div>

          {/* Center: Nav */}
          {showNav && (
            <nav className="hidden md:flex items-center justify-center gap-7 flex-1">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`text-sm font-medium transition-colors ${
                      isActive ? 'text-main' : 'text-gray-600 hover:text-main'
                    }`}
                  >
                    <span className="relative">
                      {item.label}
                      {isActive && (
                        <span className="absolute -bottom-2 left-0 right-0 h-[2px] bg-main rounded-full" />
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right: Actions + User */}
          <div className="flex items-center gap-3 min-w-[220px] justify-end">

            {/* Download Center */}
            {showDownloadButton && downloads && downloads.length > 0 && (
              <button
                onClick={() => setIsOpen(true)}
                className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-semibold rounded-md text-white bg-main hover:bg-main-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Downloads ({downloads.filter(d => d.status === 'completed' || d.status === 'partial').length})
              </button>
            )}

            {/* Back Button */}
            {onBackButtonClicked && (
              <button
                onClick={onBackButtonClicked}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                {backButtonText || 'Back'}
              </button>
            )}

            {/* Action Button (Join waitlist / admin etc) */}
            {actionButton && <div className="flex items-center">{actionButton}</div>}

            {/* User Menu */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 text-gray-700 hover:text-gray-900 focus:outline-none rounded-md px-2 py-1"
                >
                  {user.photoURL ? (
                    <img className="h-8 w-8 rounded-full" src={user.photoURL} alt={user.displayName || 'User'} />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-main flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <span className="hidden lg:inline text-sm font-medium max-w-36 truncate">
                    {user.displayName || user.email || 'User'}
                  </span>

                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                        <div className="font-medium">Signed in as</div>
                        <div className="truncate text-gray-700" title={user.email}>
                          {user.email}
                        </div>
                      </div>

                      {onGoToAdmin && (
                        <button
                          onClick={() => {
                            onGoToAdmin();
                            setShowUserMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <svg className="h-4 w-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Admin Dashboard
                        </button>
                      )}

                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <svg className="h-4 w-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
