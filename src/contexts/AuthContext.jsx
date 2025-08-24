import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import toast from 'react-hot-toast';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
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
                toast.error(`Sign-in failed: ${error.message}`);
            }
            
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
            
            await signOut(auth);
            toast.success('Signed out successfully');
            return { success: true };
        } catch (error) {
            console.error('Sign-out error:', error);
            toast.error(`Sign-out failed: ${error.message}`);
            return { success: false, error };
        }
    };

    const value = {
        user,
        loading,
        signInWithGoogle,
        logout,
        isAuthenticated: !!user,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        userPhoto: user?.photoURL || null
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
