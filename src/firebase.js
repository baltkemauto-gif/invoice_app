// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBe9QQ1S4tfV4hMNxhK4q78RpYus4H7swk",
  authDomain: "invoice-89512.firebaseapp.com",
  projectId: "invoice-89512",
  storageBucket: "invoice-89512.firebasestorage.app",
  messagingSenderId: "709158283009",
  appId: "1:709158283009:web:b86d372fc7a6bcc8629d00",
  measurementId: "G-TKNW7YKS8J"
};

// Inicializē Firebase
const app = initializeApp(firebaseConfig);

// Pievieno Firestore (mākoņdatu bāze)
export const db = getFirestore(app);
