// firebase-config.js - Handles dynamic Firebase SDK imports and configuration

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

// Standard ES imports from official CDN
const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
const FIREBASE_AUTH_URL = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
const FIREBASE_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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
    const config = JSON.parse(configStr);
    
    // Import SDKs dynamically using standard ES modules
    const { initializeApp: initApp } = await import(FIREBASE_APP_URL);
    const { getAuth: initAuth } = await import(FIREBASE_AUTH_URL);
    const { getFirestore: initFirestore } = await import(FIREBASE_FIRESTORE_URL);

    // To prevent re-initialization error
    app = initApp(config);
    auth = initAuth(app);
    db = initFirestore(app);
    
    console.log('Firebase initialized successfully.');
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    // Clear bad config
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
  const { createUserWithEmailAndPassword } = await import(FIREBASE_AUTH_URL);
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInUser(email, password) {
  if (!auth) throw new Error('Firebase is not initialized. Please configure database first.');
  const { signInWithEmailAndPassword } = await import(FIREBASE_AUTH_URL);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  if (!auth) throw new Error('Firebase is not initialized.');
  const { signOut } = await import(FIREBASE_AUTH_URL);
  return signOut(auth);
}

export function onAuthChanged(callback) {
  if (!auth) {
    // If not initialized, wait a moment and register callback or run immediately with null user
    callback(null);
    return () => {};
  }
  
  // Dynamic import of auth listener
  import(FIREBASE_AUTH_URL).then(({ onAuthStateChanged }) => {
    onAuthStateChanged(auth, callback);
  });
}

export function getDb() {
  return db;
}

export function getAuth() {
  return auth;
}
