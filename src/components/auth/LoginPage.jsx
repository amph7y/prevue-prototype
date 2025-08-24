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
            <div className="min-h-screen hero-bg flex items-center justify-center font-inter">
                <div className="text-center">
                    <Spinner />
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen hero-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-inter">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-white shadow-lg">
                            <svg className="h-8 w-8 text-main" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                            </svg>
                        </div>
                        <h2 className="mt-6 text-3xl font-extrabold text-text-dark">
                            Welcome to PreVue
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in to forge your definitive search strategy
                        </p>
                    </div>

                    <div className="space-y-4">
                        
                        {/* Google Sign In Button */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isGoogleLoading}
                            className="group relative w-full flex justify-center py-4 px-6 border border-gray-300 text-lg font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg"
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
                        
                        <div className="text-center">
                            <p className="text-xs text-gray-500">
                                Join researchers worldwide using PreVue to revolutionize their search strategies
                            </p>
                        </div>
                    </div>

                </div>
            </div>
    );
};

export default LoginPage;
