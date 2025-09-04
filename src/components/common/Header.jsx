import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon } from './Icons.jsx';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

function Header({ title = "PreVue", subtitle = null, showNav = false, onBackButtonClicked, backButtonText = null, showDownloadButton = false, onLogoClick = null, actionButton = null }) {
  const { downloads, setIsOpen } = useGlobalDownload();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close user menu when clicking outside
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
  
  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {onLogoClick ? (
                <button
                  onClick={onLogoClick}
                  className="flex items-center hover:opacity-80 transition-opacity duration-200"
                >
                  <img
                    src="/PreVue Logo.png"
                    alt="PreVue"
                    className="h-10 w-auto"
                  />
                </button>
              ) : (
                <img
                  src="/PreVue Logo.png"
                  alt="PreVue"
                  className="h-10 w-auto"
                />
              )}
            </div>
            <div className="ml-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {subtitle ? (
                  <>
                    {title}
                    <span className="text-gray-600 font-medium"> | {subtitle}</span>
                  </>
                ) : (
                  title
                )}
              </h1>
            </div>
          </div>
          
          {showNav && (
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
              </div>
            </div>
          )}
          
          <div className="flex-1"></div>
          
          <div className="flex items-center space-x-4">
            {/* Action Button */}
            {actionButton && (
              <div className="flex items-center">
                {actionButton}
              </div>
            )}
            
            <div className="flex items-center space-x-4">
            {/* Download Center Button */}
            {showDownloadButton && downloads && downloads.length > 0 && (
              <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-main hover:bg-main-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main"
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
                {backButtonText}
              </button>
            )}
            </div>
            
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md p-2"
                >
                  {user.photoURL ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-main flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium max-w-32 truncate">
                    {user.displayName || user.email || 'User'}
                  </span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                        <div className="font-medium">Signed in as</div>
                        <div className="truncate text-gray-700" title={user.email}>
                          {user.email}
                        </div>
                      </div>
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
    </nav>
  );
}

export default Header; 