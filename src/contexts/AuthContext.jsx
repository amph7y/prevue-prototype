import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '../config/firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleError } from '../utils/utils.js';
import logger from '../utils/logger.js';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            // If user is not email-verified, force sign-out immediately to avoid UI flicker
            if (user && !user.emailVerified) {
                try {
                    await signOut(auth);
                } catch (e) {
                    console.warn('Auto sign-out for unverified user failed:', e);
                }
                setUser(null);
                setUserProfile(null);
                setLoading(false);
                return;
            }

            setUser(user);
            
            // Set current user ID for logging
            if (user) {
                logger.setCurrentUserId(user.uid);
            } else {
                logger.clearCurrentUserId();
            }
            
            if (user && db) {
                // Load user profile from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const profileData = userDoc.data();
                        setUserProfile(profileData);
                        // If Firebase auth shows verified but Firestore flag not set, update it
                        if (user.emailVerified && profileData?.verifyEmail !== true) {
                            try {
                                await setDoc(
                                    doc(db, 'users', user.uid),
                                    { verifyEmail: true, lastLoginAt: serverTimestamp() },
                                    { merge: true }
                                );
                                setUserProfile({ ...profileData, verifyEmail: true });
                            } catch (e) {
                                console.warn('Could not sync verifyEmail flag:', e);
                            }
                        }
                    } else {
                        // Create user profile if it doesn't exist
                        const newProfile = {
                            email: user.email,
                            displayName: user.displayName,
                            role: 'user',
                            accessLevel: 'free',
                            createdAt: serverTimestamp(),
                            lastLoginAt: serverTimestamp(),
                            isActive: true,
                            verifyEmail: !!user.emailVerified
                        };
                        await setDoc(doc(db, 'users', user.uid), newProfile);
                        setUserProfile(newProfile);
                    }
                } catch (error) {
                    console.error('Error loading user profile:', error);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
            
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            if (!auth) {
                throw new Error('Firebase Auth is not initialized');
            }
            
            // setLoading(true);
            const provider = new GoogleAuthProvider();
            // Add additional scopes if needed
            provider.addScope('email');
            provider.addScope('profile');
            
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Update lastLoginAt on successful sign-in
            if (db && user?.uid) {
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                if (!userDoc.exists()) {
                // Create full user profile
                const newProfile = {
                    email: user.email,
                    displayName: user.displayName,
                    role: 'user',
                    accessLevel: 'free',
                    createdAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp(),
                    isActive: true
                };
                await setDoc(userRef, newProfile);
            } else {
                try {
                    await setDoc(
                        doc(db, 'users', user.uid),
                        { lastLoginAt: serverTimestamp() },
                        { merge: true }
                    );
                } catch (e) {
                    console.warn('Could not update lastLoginAt:', e);
                }
            }
            }

            // Log successful login
            await logger.logUserLogin(user.uid, 'google');

            toast.success(`Welcome, ${user.displayName || user.email}!`);
            return { success: true, user };
        } catch (error) {
            console.error('Google sign-in error:', error);
            
            // Handle specific error cases
            if (error.code === 'auth/popup-closed-by-user') {
                toast.error('Sign-in was cancelled.');
            } else if (error.code === 'auth/popup-blocked') {
                toast.error('Pop-up was blocked. Please allow pop-ups and try again.');
            } else {
                handleError(error, 'sign-in');
            }
            
            return { success: false, error };
        } finally {
            setLoading(false);
        }
    };

    const signInWithEmail = async (email, password) => {
        try {
            if (!auth) {
                throw new Error('Firebase Auth is not initialized');
            }
            const result = await signInWithEmailAndPassword(auth, email, password);
            const signedInUser = result.user;
            if (!signedInUser.emailVerified) {
                toast.error('Please verify your email before signing in. Check your inbox.');
                return { success: false, error: new Error('Email not verified') };
            }
            if (db && signedInUser?.uid) {
                try {
                    const userRef = doc(db, 'users', signedInUser.uid);
                    const userDoc = await getDoc(userRef);
                    const baseProfile = {
                        email: signedInUser.email,
                        displayName: signedInUser.displayName || '',
                        role: 'user',
                        accessLevel: 'free',
                        isActive: true,
                    };
                    if (!userDoc.exists()) {
                        await setDoc(userRef, {
                            ...baseProfile,
                            createdAt: serverTimestamp(),
                            lastLoginAt: serverTimestamp(),
                            verifyEmail: true,
                        });
                    } else {
                        const data = userDoc.data() || {};
                        const missing = {};
                        if (data.email == null) missing.email = baseProfile.email;
                        if (data.displayName == null) missing.displayName = baseProfile.displayName;
                        if (data.role == null) missing.role = baseProfile.role;
                        if (data.accessLevel == null) missing.accessLevel = baseProfile.accessLevel;
                        if (data.isActive == null) missing.isActive = baseProfile.isActive;
                        if (data.createdAt == null) missing.createdAt = serverTimestamp();
                        await setDoc(
                            userRef,
                            { ...missing, lastLoginAt: serverTimestamp(), verifyEmail: true },
                            { merge: true }
                        );
                    }
                } catch (e) {
                    console.warn('Could not ensure full user profile on sign-in:', e);
                }
            }
            
            // Log successful login
            await logger.logUserLogin(signedInUser.uid, 'email');
            
            toast.success(`Welcome, ${signedInUser.displayName || signedInUser.email}!`);
            return { success: true, user: signedInUser };
        } catch (error) {
            handleError(error, 'email sign-in');
            return { success: false, error };
        } finally {
            setLoading(false);
        }
    };

    const registerWithEmail = async (email, password, displayName) => {
        try {
            if (!auth) {
                throw new Error('Firebase Auth is not initialized');
            }
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = result.user;
            if (displayName) {
                await updateProfile(newUser, { displayName });
            }
            // Send email verification
            try {
                const actionCodeSettings = {
                    url: 'https://prevue-testing.vercel.app/#',
                    handleCodeInApp: false
                };
                await sendEmailVerification(newUser, actionCodeSettings);
                toast.success('Verification email sent. Please check your inbox.');
            } catch (e) {
                console.warn('Failed to send verification email:', e);
            }
            // Attempt Firestore profile creation
            if (db) {
                try {
                    const newProfile = {
                        email: newUser.email,
                        displayName: displayName || newUser.displayName || '',
                        role: 'user',
                        accessLevel: 'free',
                        createdAt: serverTimestamp(),
                        lastLoginAt: serverTimestamp(),
                        isActive: true,
                        verifyEmail: false
                    };
                    await setDoc(doc(db, 'users', newUser.uid), newProfile);
                    setUserProfile(newProfile);
                } catch (e) {
                    console.warn('Skipping Firestore profile create (likely rules):', e?.message || e);
                }
            }
            
            // Log user registration
            await logger.logUserRegister(newUser.uid, 'email');
            
            // Sign out to prevent using the account before verification
            try {
                await signOut(auth);
            } catch (e) {
                console.warn('Could not sign out newly created user:', e);
            }
            toast.success('Account created. Check your email to verify, then sign in.');
            return { success: true, user: null };
        } catch (error) {
            handleError(error, 'register');
            return { success: false, error };
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            if (!auth) {
                throw new Error('Firebase Auth is not initialized');
            }
            
            // Log logout before signing out
            if (user) {
                await logger.logUserLogout(user.uid);
            }
            
            await signOut(auth);
            toast.success('Signed out successfully');
            return { success: true };
        } catch (error) {
            console.error('Sign-out error:', error);
            handleError(error, 'sign-out');
            return { success: false, error };
        }
    };

    const value = {
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        logout,
        isAuthenticated: !!user,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        userPhoto: user?.photoURL || null,
        userRole: userProfile?.role || 'user',
        userAccessLevel: userProfile?.accessLevel || 'free',
        isAdmin: userProfile?.role === 'admin',
        isPremium: userProfile?.accessLevel === 'premium'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
