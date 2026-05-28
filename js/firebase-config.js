// firebase-config.js - Handles Firebase SDK imports and configuration

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let app = null;
let auth = null;
let db = null;

// Default Hardcoded Firebase Configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA_yHruQxa0uC7Hrxt1pTEFyhjMNor0xgs",
  authDomain: "biltybook-49c50.firebaseapp.com",
  projectId: "biltybook-49c50",
  storageBucket: "biltybook-49c50.firebasestorage.app",
  messagingSenderId: "47851556947",
  appId: "1:47851556947:web:16172ebb9beeeffd1776a6",
  measurementId: "G-4F8S2XMBZK"
};

export function getFirebaseStatus() {
  const configStr = localStorage.getItem('biltybook_firebase_config');
  const config = configStr ? JSON.parse(configStr) : DEFAULT_FIREBASE_CONFIG;
  return {
    isConfigured: !!(config && config.apiKey),
    isInitialized: app !== null,
    config: config
  };
}

export async function initializeFirebase() {
  let config = DEFAULT_FIREBASE_CONFIG;
  const configStr = localStorage.getItem('biltybook_firebase_config');
  
  if (configStr) {
    try {
      config = JSON.parse(configStr);
    } catch (e) {
      console.warn('Failed to parse localStorage firebase config, using default.');
    }
  }

  if (!config || !config.apiKey || !config.projectId) {
    return false;
  }

  try {
    // Initialize standard instances statically
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('Firebase initialized successfully.');
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return false;
  }
}

export function saveFirebaseConfig(config) {
  if (!config || !config.apiKey || !config.projectId) {
    throw new Error('Invalid Firebase Config');
  }
  localStorage.setItem('biltybook_firebase_config', JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem('biltybook_firebase_config');
  app = null;
  auth = null;
  db = null;
}

export async function signUpUser(email, password) {
  if (!auth) throw new Error('Firebase is not initialized. Please configure database first.');
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInUser(email, password) {
  if (!auth) throw new Error('Firebase is not initialized. Please configure database first.');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  if (!auth) throw new Error('Firebase is not initialized.');
  return signOut(auth);
}

export function onAuthChanged(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getDb() {
  return db;
}

export function getAuth() {
  return auth;
}
