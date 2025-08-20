import React from 'react';
import { DownloadIcon } from './Icons.jsx';
import { useGlobalDownload } from '../../contexts/GlobalDownloadContext.jsx';

function Header({ title = "Prevue", subtitle = null, showNav = false, onBackButtonClicked, backButtonText = null, showDownloadButton = false }) {
  const { downloads, setIsOpen } = useGlobalDownload();
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
          <div className="flex items-center space-x-4">
            {/* Download Center Button */}
            {showDownloadButton && downloads && downloads.length > 0 && (
              <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
        </div>
      </div>
    </nav>
  );
}

export default Header; 