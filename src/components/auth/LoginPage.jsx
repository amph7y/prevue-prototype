import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Spinner from '../common/Spinner.jsx';
import { GoogleIcon } from '../common/Icons.jsx';

const LoginPage = ({ onSuccess }) => {
    const { signInWithGoogle, loading } = useAuth();
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const handleGoogleSignIn = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsGoogleLoading(true);
        try {
            const result = await signInWithGoogle();
            if (result.success && onSuccess) {
                onSuccess();
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Spinner />
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-indigo-100">
                        <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Welcome to Prevue
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in to access your systematic review projects
                    </p>
                </div>

                <div className="space-y-4">
                    
                    {/* Google Sign In Button */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading}
                        className="group relative w-full flex justify-center py-4 px-6 border border-gray-300 text-lg font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                        {isGoogleLoading ? (
                            <Spinner />
                        ) : (
                            <>
                                <GoogleIcon className="h-6 w-6 mr-3" />
                                Sign in with Google
                            </>
                        )}
                    </button>
                </div>

                
            </div>
        </div>
    );
};

export default LoginPage;
