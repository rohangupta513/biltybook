// db.js - Offline-First Database Layer and Firebase Synchronization

import { getDb, getFirebaseStatus } from './firebase-config.js';

let currentDbUserId = 'local';

export function setDbUserId(userId) {
  currentDbUserId = userId || 'local';
  console.log('Database user scope updated to:', currentDbUserId);
}

function getClientsKey() {
  return `biltybook_clients_${currentDbUserId}`;
}

function getTransactionsKey() {
  return `biltybook_transactions_${currentDbUserId}`;
}

// Get local data
export function getLocalClients() {
  const data = localStorage.getItem(getClientsKey());
  return data ? JSON.parse(data) : [];
}

export function getLocalTransactions() {
  const data = localStorage.getItem(getTransactionsKey());
  return data ? JSON.parse(data) : [];
}

// Recalculate client due balance
export function recalculateDueAmounts() {
  const clients = getLocalClients();
  const transactions = getLocalTransactions();

  const updatedClients = clients.map(client => {
    const clientTransactions = transactions.filter(t => t.clientId === client.id);
    let totalDue = 0;
    clientTransactions.forEach(t => {
      if (t.type === 'BILL') {
        totalDue += Number(t.amount);
      } else if (t.type === 'PAYMENT') {
        totalDue -= Number(t.amount);
      }
    });
    return { ...client, totalDueAmount: totalDue };
  });

  localStorage.setItem(getClientsKey(), JSON.stringify(updatedClients));
  return updatedClients;
}

// Local CRUD operations
export function addClientLocal(name, place, phone = '', email = '', notes = '') {
  const clients = getLocalClients();
  const newClient = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name,
    place,
    phone,
    email,
    notes,
    totalDueAmount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  clients.push(newClient);
  localStorage.setItem(getClientsKey(), JSON.stringify(clients));
  return newClient;
}

export function deleteClientLocal(clientId) {
  // Delete client
  let clients = getLocalClients();
  clients = clients.filter(c => c.id !== clientId);
  localStorage.setItem(getClientsKey(), JSON.stringify(clients));

  // Delete associated transactions
  let transactions = getLocalTransactions();
  transactions = transactions.filter(t => t.clientId !== clientId);
  localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
}

export function addTransactionLocal(clientId, type, amount, date, description = '', extraData = {}) {
  const transactions = getLocalTransactions();
  const newTx = {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    clientId,
    type,
    amount: Number(amount),
    date,
    description,
    updatedAt: Date.now(),
    ...extraData // Includes biltys, items for BILL
  };
  transactions.push(newTx);
  localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
  recalculateDueAmounts();
  return newTx;
}

export function deleteTransactionLocal(transactionId) {
  let transactions = getLocalTransactions();
  transactions = transactions.filter(t => t.id !== transactionId);
  localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
  recalculateDueAmounts();
}

// Firebase Cloud Sync Engine
export async function syncDataWithCloud(userId) {
  const db = getDb();
  if (!db) {
    console.log('Firebase DB not initialized. Skipping cloud sync.');
    return recalculateDueAmounts();
  }

  // Load Firebase SDK Firestore modules dynamically
  const FIRESTORE_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
  const { 
    collection, getDocs, doc, writeBatch, setDoc, query, where 
  } = await import(FIRESTORE_SDK);

  try {
    console.log('Syncing data with cloud for user:', userId);

    // 1. Fetch Cloud Clients
    const clientsRef = collection(db, 'users', userId, 'clients');
    const cloudClientsSnap = await getDocs(clientsRef);
    const cloudClientsMap = new Map();
    cloudClientsSnap.forEach(docSnap => {
      cloudClientsMap.set(docSnap.id, docSnap.data());
    });

    // 2. Fetch Cloud Transactions
    const txsRef = collection(db, 'users', userId, 'transactions');
    const cloudTxsSnap = await getDocs(txsRef);
    const cloudTxsMap = new Map();
    cloudTxsSnap.forEach(docSnap => {
      cloudTxsMap.set(docSnap.id, docSnap.data());
    });

    const localClients = getLocalClients();
    const localTxs = getLocalTransactions();

    const batch = writeBatch(db);
    let hasUploads = false;

    // Merge Clients
    const mergedClients = [];
    const clientIdsSeen = new Set();

    // Check local clients
    for (const localC of localClients) {
      clientIdsSeen.add(localC.id);
      const cloudC = cloudClientsMap.get(localC.id);

      if (!cloudC) {
        // Exists only locally -> Upload to Cloud
        const docRef = doc(db, 'users', userId, 'clients', localC.id);
        batch.set(docRef, localC);
        hasUploads = true;
        mergedClients.push(localC);
      } else if (localC.updatedAt > (cloudC.updatedAt || 0)) {
        // Local is newer -> Upload to Cloud
        const docRef = doc(db, 'users', userId, 'clients', localC.id);
        batch.set(docRef, localC);
        hasUploads = true;
        mergedClients.push(localC);
      } else {
        // Cloud is newer -> Keep Cloud
        mergedClients.push(cloudC);
      }
    }

    // Add remaining cloud-only clients
    cloudClientsMap.forEach((cloudC, id) => {
      if (!clientIdsSeen.has(id)) {
        mergedClients.push(cloudC);
      }
    });

    // Merge Transactions
    const mergedTxs = [];
    const txIdsSeen = new Set();

    for (const localTx of localTxs) {
      txIdsSeen.add(localTx.id);
      const cloudTx = cloudTxsMap.get(localTx.id);

      if (!cloudTx) {
        // Offline transaction -> Upload to Cloud
        const docRef = doc(db, 'users', userId, 'transactions', localTx.id);
        batch.set(docRef, localTx);
        hasUploads = true;
        mergedTxs.push(localTx);
      } else if (localTx.updatedAt > (cloudTx.updatedAt || 0)) {
        // Local update -> Upload
        const docRef = doc(db, 'users', userId, 'transactions', localTx.id);
        batch.set(docRef, localTx);
        hasUploads = true;
        mergedTxs.push(localTx);
      } else {
        // Cloud newer
        mergedTxs.push(cloudTx);
      }
    }

    // Add remaining cloud-only transactions
    cloudTxsMap.forEach((cloudTx, id) => {
      if (!txIdsSeen.has(id)) {
        mergedTxs.push(cloudTx);
      }
    });

    // Execute cloud batch writes if any local changes need uploading
    if (hasUploads) {
      await batch.commit();
      console.log('Local modifications uploaded to cloud.');
    }

    // Save merged data locally
    localStorage.setItem(getClientsKey(), JSON.stringify(mergedClients));
    localStorage.setItem(getTransactionsKey(), JSON.stringify(mergedTxs));

    // Recalculate dues based on synced records
    return recalculateDueAmounts();
  } catch (error) {
    console.error('Data synchronization failed:', error);
    // Fall back to local dues calculation
    return recalculateDueAmounts();
  }
}

// Unified cloud-write wrappers
export async function addClient(userId, name, place, phone = '', email = '', notes = '') {
  const newClient = addClientLocal(name, place, phone, email, notes);
  const db = getDb();
  if (db && userId) {
    try {
      const FIRESTORE_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
      const { doc, setDoc } = await import(FIRESTORE_SDK);
      await setDoc(doc(db, 'users', userId, 'clients', newClient.id), newClient);
    } catch (e) {
      console.warn('Failed to save to cloud, will sync later.', e);
    }
  }
  return newClient;
}

export async function deleteClient(userId, clientId) {
  deleteClientLocal(clientId);
  const db = getDb();
  if (db && userId) {
    try {
      const FIRESTORE_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
      const { doc, deleteDoc } = await import(FIRESTORE_SDK);
      await deleteDoc(doc(db, 'users', userId, 'clients', clientId));
    } catch (e) {
      console.warn('Failed to delete from cloud, will sync later.', e);
    }
  }
}

export async function addTransaction(userId, clientId, type, amount, date, description = '', extraData = {}) {
  const newTx = addTransactionLocal(clientId, type, amount, date, description, extraData);
  const db = getDb();
  if (db && userId) {
    try {
      const FIRESTORE_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
      const { doc, setDoc } = await import(FIRESTORE_SDK);
      await setDoc(doc(db, 'users', userId, 'transactions', newTx.id), newTx);
    } catch (e) {
      console.warn('Failed to add transaction to cloud, cached locally.', e);
    }
  }
  return newTx;
}

export async function deleteTransaction(userId, transactionId) {
  deleteTransactionLocal(transactionId);
  const db = getDb();
  if (db && userId) {
    try {
      const FIRESTORE_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
      const { doc, deleteDoc } = await import(FIRESTORE_SDK);
      await deleteDoc(doc(db, 'users', userId, 'transactions', transactionId));
    } catch (e) {
      console.warn('Failed to delete transaction from cloud, cached locally.', e);
    }
  }
}
