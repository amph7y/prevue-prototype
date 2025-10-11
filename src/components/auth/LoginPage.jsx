import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Spinner from '../common/Spinner.jsx';
import { GoogleIcon } from '../common/Icons.jsx';
import Header from '../common/Header.jsx';

const LoginPage = ({ onSuccess, onBackToLanding, onGoToRegister }) => {
    const { signInWithGoogle, signInWithEmail, loading } = useAuth();
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

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

    const handleEmailSignIn = async (e) => {
        e.preventDefault();
        setIsEmailLoading(true);
        try {
            const result = await signInWithEmail(email, password);
            if (result.success && onSuccess) {
                onSuccess();
            }
        } finally {
            setIsEmailLoading(false);
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
        <>
            <Header 
                onBackButtonClicked={onBackToLanding}
                backButtonText="Back to Home"
                onLogoClick={onBackToLanding}
            />
            <div className="min-h-screen hero-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-inter">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-white shadow-lg">
                            <img
                                src="/PreVue Logo.png"
                                alt="PreVue"
                                className="h-12 w-auto"
                            />
                        </div>
                        <h2 className="mt-6 text-3xl font-extrabold text-text-dark">
                            Welcome to PreVue
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in to forge your definitive search strategy
                        </p>
                    </div>

                    <div className="space-y-4">
                        <form className="space-y-4" onSubmit={handleEmailSignIn}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-main focus:ring-main p-3"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-main focus:ring-main p-3"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isEmailLoading}
                                className="w-full py-3 px-6 rounded-lg bg-text-dark text-white font-medium hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-text-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isEmailLoading ? <Spinner /> : 'Sign in with Email'}
                            </button>
                        </form>
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-transparent text-gray-500">Or continue with</span>
                            </div>
                        </div>
                        
                        {/* Google Sign In Button */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isGoogleLoading}
                            className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-medium rounded-lg text-white bg-main hover:bg-main-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg hover:shadow-glow"
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
                            <p className="text-sm text-gray-600 mt-2">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={onGoToRegister}
                                    className="text-main hover:underline"
                                >
                                    Create one
                                </button>
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default LoginPage;
