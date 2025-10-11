import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Spinner from '../common/Spinner.jsx';
import Header from '../common/Header.jsx';

const RegisterPage = ({ onSuccess, onBackToLogin, onBackToLanding }) => {
    const { registerWithEmail, loading } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordStrength, setPasswordStrength] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const evaluatePassword = (pwd) => {
        const hasMinLength = pwd.length >= 8;
        const hasUpper = /[A-Z]/.test(pwd);
        const hasLower = /[a-z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
        const score = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
        if (!pwd) return '';
        if (score <= 2) return 'weak';
        if (score === 3 || score === 4) return 'medium';
        return 'strong';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setConfirmPasswordError('');

        if (password !== confirmPassword) {
            // Simple alert; in app codebase there is toast utility but keep simple here
            setConfirmPasswordError('Passwords do not match');
            return;
        }
        // Enforce strength
        const strength = evaluatePassword(password);
        if (strength !== 'strong') {
            setPasswordError('Password must be at least 8 chars and include upper, lower, number, and symbol.');
            return;
        } else {
            setPasswordError('');
        }
        setIsSubmitting(true);
        try {
            const result = await registerWithEmail(email, password, displayName);
            if (result.success && onSuccess) {
                onSuccess();
            }
        } finally {
            setIsSubmitting(false);
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
                            Create your account
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Start building your search strategy in minutes
                        </p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-main focus:ring-main p-3"
                                placeholder="Ada Lovelace"
                            />
                        </div>
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
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPassword(val);
                                    setPasswordStrength(evaluatePassword(val));
                                }}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-main focus:ring-main p-3"
                                placeholder="••••••••"
                            />
                            {passwordStrength && (
                                <p className={`mt-1 text-sm ${passwordStrength === 'strong' ? 'text-green-600' : passwordStrength === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                                    Password strength: {passwordStrength}
                                </p>
                            )}
                            {passwordError && (
                                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-main focus:ring-main p-3"
                                placeholder="••••••••"
                            />
                            {confirmPasswordError && (
                                <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-6 rounded-lg bg-main text-white font-medium hover:bg-main-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isSubmitting ? <Spinner /> : 'Create account'}
                        </button>
                        <div className="text-center">
                            <p className="text-sm text-gray-600 mt-2">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={onBackToLogin}
                                    className="text-main hover:underline"
                                >
                                    Sign in
                                </button>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default RegisterPage;



