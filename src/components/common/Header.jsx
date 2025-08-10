import React from 'react';

function Header({ title = "Prevue", subtitle = null, showNav = false, onBackButtonClicked, backButtonText = null }) {
  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
                      <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-indigo-600">
                  {subtitle ? (
                    <>
                      {title}
                      <span className="text-gray-900"> | {subtitle}</span>
                    </>
                  ) : (
                    title
                  )}
                </h1>
              </div>
            </div>
          {showNav && (
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
              </div>
            </div>
          )}
          {onBackButtonClicked && (
            <div className="flex items-center space-x-4">
              <button
                onClick={onBackButtonClicked}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                {backButtonText}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Header; 