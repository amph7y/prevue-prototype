import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import toast from 'react-hot-toast';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC25eYX5kwBwRL6oYPVV7OGeozXEJWVJxI",
    authDomain: "prevue-id.firebaseapp.com",
    projectId: "prevue-id",
    storageBucket: "prevue-id.firebasestorage.app",
    messagingSenderId: "219132116677",
    appId: "1:219132116677:web:cf10088594f06a84c3faac",
    measurementId: "G-NN2GHBWBGK"
  };
    
let app, auth, db, analytics;

try {
    // Check if Firebase app is already initialized
    if (getApps().length === 0) {
        // Initialize Firebase only if it hasn't been initialized yet
        app = initializeApp(firebaseConfig);
        console.log("Firebase app initialized successfully");
    } else {
        // Use the existing Firebase app
        app = getApp();
        console.log("Using existing Firebase app");
    }

    // Initialize and export the services your app will use
    auth = getAuth(app);
    console.log("Firebase auth initialized successfully");
    
    try {
        db = getFirestore(app);
        console.log("Firestore initialized successfully");
    } catch (firestoreError) {
        console.warn("Firestore initialization failed:", firestoreError);
        console.warn("Please set up Firestore database in Firebase Console");
        db = null;
    }
    
    try {
        analytics = getAnalytics(app);
        console.log("Analytics initialized successfully");
    } catch (analyticsError) {
        console.warn("Analytics initialization failed:", analyticsError);
        analytics = null;
    }

} catch (error) {
    console.error("Firebase initialization failed:", error);
    toast.error("Could not connect to the database. Please check your connection and refresh the page.");
}

export { app, auth, db, analytics };