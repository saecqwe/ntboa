// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-39WRfuAZjKM65Y6tne1-fDLncL9SkXo",
  authDomain: "ntboa-1f087.firebaseapp.com",
  projectId: "ntboa-1f087",
  storageBucket: "ntboa-1f087.appspot.com",
  messagingSenderId: "935045546696",
  appId: "1:935045546696:web:b3ddc1b2d9da97d6225bfd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { app, auth, db, functions, firebaseConfig };