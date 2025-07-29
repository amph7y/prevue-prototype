import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import toast from 'react-hot-toast';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmtqz0twcs8hbiBUm-HCZhzC9sdc2qv6o",
  authDomain: "prevue-prototype.firebaseapp.com",
  projectId: "prevue-prototype",
  storageBucket: "prevue-prototype.appspot.com",
  messagingSenderId: "169571241072",
  appId: "1:169571241072:web:12540d6ce47f61728ef8b5",
  measurementId: "G-C1QQQVJ2RQ"
};

let app, auth, db, analytics;

try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);

    // Initialize and export the services your app will use
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);

} catch (error) {
    console.error("Firebase initialization failed:", error);
    toast.error("Could not connect to the database. Please check your connection and refresh the page.");
}

export { app, auth, db, analytics };