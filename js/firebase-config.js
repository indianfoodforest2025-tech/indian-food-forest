// ==========================================================================
// FIREBASE CONFIGURATION & INITIALIZATION (GitHub Pages Compatible)
// ==========================================================================

// Import Firebase core and Firestore directly from Google CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your web app's Firebase configuration (Locked & Verified)
const firebaseConfig = {
    apiKey: "AIzaSyBnv5rwWBKO69YNGQiOUi-2LUcLJgfZ_LA",
    authDomain: "indian-food-forest.firebaseapp.com",
    projectId: "indian-food-forest",
    storageBucket: "indian-food-forest.firebasestorage.app",
    messagingSenderId: "254445513979",
    appId: "1:254445513979:web:f7d6798a7ba9e87990945e"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and export it for use in other files
export const db = getFirestore(app);

console.log("🔥 Firebase initialized successfully for Indian Food Forest.");
