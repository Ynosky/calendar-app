// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAXfpY2YDPS6s20CQRIZyP9UhH4yMhJP0g",
  authDomain: "calendar-app-data.firebaseapp.com",
  projectId: "calendar-app-data",
  storageBucket: "calendar-app-data.firebasestorage.app",
  messagingSenderId: "478318818692",
  appId: "1:478318818692:web:8648051db1a8f507dd59d1",
  measurementId: "G-0GCE5T71WH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);