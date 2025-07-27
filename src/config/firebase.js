// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export the services your app will use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);