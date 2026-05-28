// app.js - Main Application Controller

import { 
  getFirebaseStatus, 
  initializeFirebase, 
  saveFirebaseConfig, 
  clearFirebaseConfig, 
  signInUser, 
  signUpUser, 
  signOutUser, 
  onAuthChanged 
} from './firebase-config.js';

import {
  getLocalClients,
  getLocalTransactions,
  addClient,
  deleteClient,
  addTransaction,
  deleteTransaction,
  syncDataWithCloud,
  recalculateDueAmounts
} from './db.js';

import { generateInvoicePDF, generatePaymentPDF } from './pdf.js';

// Application State
let currentUser = null;
let currentClientId = null;
let activeScreen = 'screen-auth';
let isSignupMode = false;
let isLocalMode = false;

// DOM Elements
const screens = {
  auth: document.getElementById('screen-auth'),
  dashboard: document.getElementById('screen-dashboard'),
  details: document.getElementById('screen-client-details')
};

// Overlay & Modals
const modalOverlay = document.getElementById('modal-overlay');
const drawers = {
  addClient: document.getElementById('drawer-add-client'),
  addPayment: document.getElementById('drawer-add-payment'),
  addBill: document.getElementById('drawer-add-bill'),
  settings: document.getElementById('dialog-settings'),
  preview: document.getElementById('dialog-invoice-preview')
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Register PWA Service Worker (only if protocol is secure or localhost)
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('PWA Service Worker registered.'))
      .catch(err => console.warn('Service Worker registration failed:', err));
  }

  // Render icons initial pass
  lucide.createIcons();

  // Try initializing Firebase
  const isFbInit = await initializeFirebase();
  
  if (isFbInit) {
    // Listen for Auth changes
    onAuthChanged((user) => {
      if (user) {
        currentUser = user;
        isLocalMode = false;
        showScreen('dashboard');
        loadDashboardData(true);
      } else {
        currentUser = null;
        if (!isLocalMode) {
          showScreen('auth');
        }
      }
    });
  } else {
    // If not configured, default to local mode
    console.log('Firebase not configured. Defaulting to Local Offline Mode.');
    // Check if user has previously used Local Mode
    const lastSessionLocal = localStorage.getItem('biltybook_local_session') === 'true';
    if (lastSessionLocal) {
      isLocalMode = true;
      showScreen('dashboard');
      loadDashboardData(false);
    } else {
      showScreen('auth');
    }
  }

  // Attach Event Listeners
  setupEventListeners();
});

// ==================== SCREEN ROUTING ====================
function showScreen(screenId) {
  activeScreen = `screen-${screenId}`;
  Object.keys(screens).forEach(key => {
    const scr = screens[key];
    if (scr.id === activeScreen) {
      scr.classList.remove('hidden');
    } else {
      scr.classList.add('hidden');
    }
  });

  // Load screen-specific behaviors
  if (screenId === 'dashboard') {
    loadDashboardData(!isLocalMode);
  } else if (screenId === 'auth') {
    const status = getFirebaseStatus();
    const localLink = document.getElementById('btn-local-mode');
    if (!status.isConfigured) {
      localLink.textContent = "Continue in Local Offline Mode (No DB configured)";
      document.getElementById('btn-auth-submit').disabled = true;
      document.getElementById('btn-auth-submit').style.opacity = '0.5';
    } else {
      localLink.textContent = "Or continue in Local Offline Mode";
      document.getElementById('btn-auth-submit').disabled = false;
      document.getElementById('btn-auth-submit').style.opacity = '1';
    }
  }
}

// Modal open/close helpers
function openModal(drawerElement) {
  modalOverlay.classList.add('active');
  drawerElement.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
  Object.values(drawers).forEach(drawer => drawer.classList.remove('active'));
}

// ==================== DATA RENDERING ====================

// 1. Dashboard View
async function loadDashboardData(shouldSync = false) {
  const status = getFirebaseStatus();
  
  // Header profile text
  const avatar = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-display-name');
  
  if (isLocalMode) {
    avatar.textContent = 'L';
    avatar.style.color = 'var(--accent-amber)';
    nameEl.innerHTML = 'Local Mode <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">(Offline)</span>';
  } else if (currentUser) {
    avatar.textContent = currentUser.email.charAt(0).toUpperCase();
    avatar.style.color = 'var(--accent-emerald)';
    nameEl.textContent = currentUser.email.split('@')[0];
  }

  // Trigger Cloud Sync if requested
  let clients = [];
  if (shouldSync && currentUser) {
    // Show spinner in outstanding total
    document.getElementById('dashboard-total-due').innerHTML = '<div class="spinner"></div>';
    clients = await syncDataWithCloud(currentUser.uid);
  } else {
    clients = recalculateDueAmounts();
  }

  renderClientsList(clients);
  updateDashboardSummary(clients);
}

function updateDashboardSummary(clients) {
  let totalDue = 0;
  clients.forEach(c => totalDue += c.totalDueAmount);

  const outstandingEl = document.getElementById('dashboard-total-due');
  outstandingEl.textContent = `Rs. ${totalDue.toFixed(2)}`;
  
  if (totalDue > 0) {
    outstandingEl.className = 'summary-value text-crimson';
  } else if (totalDue < 0) {
    outstandingEl.className = 'summary-value text-emerald';
  } else {
    outstandingEl.className = 'summary-value';
  }

  document.getElementById('dashboard-total-clients').textContent = clients.length;
}

function renderClientsList(clients) {
  const listContainer = document.getElementById('client-list');
  listContainer.innerHTML = '';

  const searchVal = document.getElementById('search-clients-input').value.toLowerCase();
  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchVal) || 
    c.place.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="users"></i>
        <p>${clients.length === 0 ? 'No clients added yet.' : 'No clients match your search.'}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filtered.forEach(client => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.dataset.id = client.id;
    
    let dueClass = 'settled';
    let dueSymbol = '';
    if (client.totalDueAmount > 0) {
      dueClass = 'positive';
      dueSymbol = 'Rs. ';
    } else if (client.totalDueAmount < 0) {
      dueClass = 'credit';
      dueSymbol = 'Rs. -';
    }

    card.innerHTML = `
      <div class="client-info">
        <span class="client-title">${client.name}</span>
        <span class="client-subtitle"><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${client.place}</span>
      </div>
      <div class="client-due-badge">
        <span class="due-label">Due Amount</span>
        <span class="due-value ${dueClass}">${dueSymbol}${Math.abs(client.totalDueAmount).toFixed(2)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      openClientDetails(client.id);
    });

    listContainer.appendChild(card);
  });
  
  lucide.createIcons();
}

// 2. Client Details View
function openClientDetails(clientId) {
  currentClientId = clientId;
  showScreen('client-details');
  renderClientDetailsData();
}

function renderClientDetailsData() {
  const clients = getLocalClients();
  const client = clients.find(c => c.id === currentClientId);
  if (!client) {
    showScreen('dashboard');
    return;
  }

  document.getElementById('detail-client-name').textContent = client.name;
  document.getElementById('detail-client-place').innerHTML = `<i data-lucide="map-pin" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${client.place}`;
  
  const dueVal = client.totalDueAmount;
  const dueEl = document.getElementById('detail-client-due');
  dueEl.textContent = `Rs. ${Math.abs(dueVal).toFixed(2)}`;
  if (dueVal > 0) {
    dueEl.className = 'client-stats-value text-crimson';
  } else if (dueVal < 0) {
    dueEl.className = 'client-stats-value text-emerald';
    dueEl.textContent = `Rs. -${Math.abs(dueVal).toFixed(2)} (Advance)`;
  } else {
    dueEl.className = 'client-stats-value';
  }

  // Transactions list
  const transactions = getLocalTransactions();
  const clientTxs = transactions.filter(t => t.clientId === currentClientId)
                                 .sort((a, b) => new Date(b.date) - new Date(a.date));

  const timelineContainer = document.getElementById('transaction-list');
  timelineContainer.innerHTML = '';

  if (clientTxs.length === 0) {
    timelineContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="file-text"></i>
        <p>No transaction history for this client.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  clientTxs.forEach(tx => {
    const card = document.createElement('div');
    card.className = `transaction-card ${tx.type}`;
    
    const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let extraHTML = '';
    let pdfBtnText = 'Receipt';
    
    if (tx.type === 'BILL') {
      pdfBtnText = 'Bill PDF';
      const biltysCount = tx.numBiltys || (tx.biltys ? tx.biltys.length : 0);
      extraHTML = `
        <span class="transaction-bilty-badge">
          <i data-lucide="truck" style="width: 10px; height: 10px; vertical-align: middle;"></i> 
          ${biltysCount} Biltys
        </span>
      `;
    }

    card.innerHTML = `
      <div class="transaction-main">
        <span class="transaction-desc">${tx.type === 'BILL' ? 'Bill Generated' : 'Payment Received'}</span>
        <div class="transaction-meta">
          <span>Date: ${formattedDate}</span>
          ${tx.description ? `<span>Desc: ${tx.description}</span>` : ''}
          ${extraHTML}
        </div>
      </div>
      <div class="transaction-amount-container">
        <span class="transaction-amt ${tx.type}">${tx.type === 'BILL' ? '+' : '-'} Rs. ${Number(tx.amount).toFixed(2)}</span>
        <div class="transaction-actions">
          <button class="btn btn-mini btn-secondary btn-pdf" data-txid="${tx.id}">
            <i data-lucide="file-down"></i> ${pdfBtnText}
          </button>
          <button class="btn btn-mini btn-secondary btn-delete-tx" data-txid="${tx.id}">
            <i data-lucide="trash" class="text-crimson"></i>
          </button>
        </div>
      </div>
    `;

    // PDF Click Handler
    card.querySelector('.btn-pdf').addEventListener('click', (e) => {
      e.stopPropagation();
      openInvoicePreview(client, tx);
    });

    // Delete Click Handler
    card.querySelector('.btn-delete-tx').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this transaction?')) {
        const userId = currentUser ? currentUser.uid : null;
        await deleteTransaction(userId, tx.id);
        renderClientDetailsData();
      }
    });

    timelineContainer.appendChild(card);
  });

  lucide.createIcons();
}

// 3. Invoice Summary Dialog Preview
function openInvoicePreview(client, transaction) {
  const content = document.getElementById('invoice-preview-content');
  content.innerHTML = '';

  const billDateStr = new Date(transaction.dateOfBill || transaction.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let biltysHTML = '';
  if (transaction.biltys && transaction.biltys.length > 0) {
    biltysHTML = `
      <div style="margin-top: 10px; padding: 10px; background-color: var(--bg-secondary); border-radius: var(--border-radius-sm);">
        <h4 style="font-size: 13px; color: var(--accent-amber); margin-bottom: 6px;">Bilty Info (${transaction.biltys.length})</h4>
        ${transaction.biltys.map(b => `
          <div style="font-size: 11px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding: 4px 0;">
            <span><strong>No:</strong> ${b.biltyNo || 'N/A'}</span>
            <span><strong>Transport:</strong> ${b.transportName || 'N/A'}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  let tableRowsHTML = '';
  if (transaction.items && transaction.items.length > 0) {
    tableRowsHTML = transaction.items.map(item => `
      <tr>
        <td>${item.slNo}</td>
        <td>${item.item}</td>
        <td style="text-align: right;">${item.numCartons}</td>
        <td style="text-align: right;">${item.qtyPerCarton}</td>
        <td style="text-align: right;">${Number(item.rate).toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');
  } else {
    // If payment or standard transaction summary
    tableRowsHTML = `
      <tr>
        <td>1</td>
        <td>${transaction.description || 'Ledger Credit'}</td>
        <td style="text-align: right;">-</td>
        <td style="text-align: right;">-</td>
        <td style="text-align: right;">-</td>
        <td style="text-align: right; font-weight: 600;">${Number(transaction.amount).toFixed(2)}</td>
      </tr>
    `;
  }

  content.innerHTML = `
    <div class="bill-preview-header">
      <h3 style="font-size: 16px; margin-bottom: 4px;">${client.name}</h3>
      <span style="font-size: 12px; color: var(--text-secondary);"><i data-lucide="map-pin" style="width: 11px; height: 11px; vertical-align: middle;"></i> ${client.place}</span>
      <div style="margin-top: 10px; font-size: 11px; display: flex; justify-content: space-between; color: var(--text-muted);">
        <span>Date: ${billDateStr}</span>
        <span>Tx ID: ${transaction.id.substring(2, 10).toUpperCase()}</span>
      </div>
    </div>
    
    ${biltysHTML}
    
    <div style="margin-top: 15px;">
      <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">Billing Items</h4>
      <div class="items-table-container">
        <table class="bill-preview-table">
          <thead>
            <tr>
              <th>Sl</th>
              <th>Item</th>
              <th style="text-align: right;">Crt</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
    </div>

    <div class="bill-preview-total">
      Grand Total: Rs. ${Number(transaction.amount).toFixed(2)}
    </div>
  `;

  // Attach download listener dynamically to download button
  const downloadBtn = document.getElementById('btn-download-pdf-invoice');
  
  // Remove old listeners by replacing button with a clone
  const newDownloadBtn = downloadBtn.cloneNode(true);
  downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
  
  newDownloadBtn.addEventListener('click', () => {
    if (transaction.type === 'BILL') {
      generateInvoicePDF(client, transaction);
    } else {
      generatePaymentPDF(client, transaction);
    }
    closeModal();
  });

  openModal(drawers.preview);
  lucide.createIcons();
}

// ==================== DYNAMIC BILL TABLES ROW GENERATION ====================

function addBiltyRow() {
  const container = document.getElementById('bilty-rows-container');
  const count = container.children.length;
  
  const div = document.createElement('div');
  div.className = 'bilty-row';
  div.innerHTML = `
    <input type="text" class="form-input bilty-no" placeholder="Bilty No" style="padding: 8px 12px; font-size: 13px;">
    <input type="text" class="form-input bilty-transport" placeholder="Transport Name" style="padding: 8px 12px; font-size: 13px;">
    <button type="button" class="btn-remove-row flex-center"><i data-lucide="trash-2"></i></button>
  `;
  
  div.querySelector('.btn-remove-row').addEventListener('click', () => {
    div.remove();
  });
  
  container.appendChild(div);
  lucide.createIcons();
}

function addItemRow() {
  const tbody = document.getElementById('items-table-body');
  const slNo = tbody.children.length + 1;
  
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sl-no">${slNo}</td>
    <td><input type="text" class="item-desc" placeholder="Item details" required></td>
    <td><input type="number" class="item-cartons" placeholder="0" min="1" required style="width: 60px;"></td>
    <td><input type="number" class="item-qty" placeholder="0" min="1" required style="width: 65px;"></td>
    <td><input type="number" class="item-rate" placeholder="0.00" min="0" step="any" required style="width: 70px;"></td>
    <td class="table-row-total">0.00</td>
    <td><button type="button" class="btn-remove-row flex-center"><i data-lucide="trash-2"></i></button></td>
  `;
  
  // Attach keyup and change events for auto total calculation
  const cartonsInput = tr.querySelector('.item-cartons');
  const qtyInput = tr.querySelector('.item-qty');
  const rateInput = tr.querySelector('.item-rate');
  const totalTd = tr.querySelector('.table-row-total');
  
  const recalculateRow = () => {
    const cartons = Number(cartonsInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;
    const rate = Number(rateInput.value) || 0;
    const rowTotal = cartons * qty * rate;
    totalTd.textContent = rowTotal.toFixed(2);
    recalculateBillGrandTotal();
  };
  
  cartonsInput.addEventListener('input', recalculateRow);
  qtyInput.addEventListener('input', recalculateRow);
  rateInput.addEventListener('input', recalculateRow);
  
  tr.querySelector('.btn-remove-row').addEventListener('click', () => {
    tr.remove();
    reorderTableSlNos();
    recalculateBillGrandTotal();
  });
  
  tbody.appendChild(tr);
  lucide.createIcons();
}

function reorderTableSlNos() {
  const tbody = document.getElementById('items-table-body');
  Array.from(tbody.children).forEach((tr, index) => {
    tr.querySelector('.sl-no').textContent = index + 1;
  });
}

function recalculateBillGrandTotal() {
  const tbody = document.getElementById('items-table-body');
  let grandTotal = 0;
  Array.from(tbody.children).forEach(tr => {
    const totalText = tr.querySelector('.table-row-total').textContent;
    grandTotal += Number(totalText) || 0;
  });
  
  document.getElementById('bill-grand-total').textContent = `Rs. ${grandTotal.toFixed(2)}`;
}

// ==================== EVENT BINDINGS ====================
function setupEventListeners() {
  
  // Auth view toggles
  document.getElementById('btn-toggle-auth').addEventListener('click', () => {
    isSignupMode = !isSignupMode;
    const emailGroup = document.getElementById('auth-email').parentNode;
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleLabel = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('btn-toggle-auth');
    
    if (isSignupMode) {
      submitBtn.textContent = 'Sign Up / Create Account';
      toggleLabel.textContent = 'Already have an account?';
      toggleLink.textContent = 'Login';
    } else {
      submitBtn.textContent = 'Login';
      toggleLabel.textContent = "Don't have an account?";
      toggleLink.textContent = 'Sign Up';
    }
  });

  // Local Offline Bypass Link
  document.getElementById('btn-local-mode').addEventListener('click', () => {
    isLocalMode = true;
    localStorage.setItem('biltybook_local_session', 'true');
    showScreen('dashboard');
  });

  // Form Submit: Auth
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    
    const initialText = submitBtn.textContent;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: auto;"></div>';
    submitBtn.disabled = true;

    try {
      if (isSignupMode) {
        await signUpUser(email, password);
        alert('Account created and logged in!');
      } else {
        await signInUser(email, password);
      }
      isLocalMode = false;
      localStorage.removeItem('biltybook_local_session');
    } catch (err) {
      alert(`Authentication Error: ${err.message}`);
      submitBtn.textContent = initialText;
      submitBtn.disabled = false;
    }
  });

  // Action: Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (isLocalMode) {
      isLocalMode = false;
      localStorage.removeItem('biltybook_local_session');
      showScreen('auth');
    } else {
      if (confirm('Are you sure you want to sign out?')) {
        await signOutUser();
        showScreen('auth');
      }
    }
  });

  // Action: Search Client
  document.getElementById('search-clients-input').addEventListener('input', () => {
    const clients = getLocalClients();
    renderClientsList(clients);
  });

  // Modal Closures
  modalOverlay.addEventListener('click', closeModal);
  document.getElementById('btn-close-add-client').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-add-client').addEventListener('click', closeModal);
  document.getElementById('btn-close-payment').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-payment').addEventListener('click', closeModal);
  document.getElementById('btn-close-bill').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-bill').addEventListener('click', closeModal);
  document.getElementById('btn-close-settings').addEventListener('click', closeModal);
  document.getElementById('btn-close-invoice-preview').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-invoice-preview').addEventListener('click', closeModal);

  // Screen Change: Back to Dashboard
  document.getElementById('btn-back-to-dashboard').addEventListener('click', () => {
    showScreen('dashboard');
  });

  // Drawer Trigger: Add Client
  document.getElementById('btn-open-add-client').addEventListener('click', () => {
    document.getElementById('form-add-client').reset();
    openModal(drawers.addClient);
  });

  // Form Submit: Add Client
  document.getElementById('form-add-client').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('client-name').value;
    const place = document.getElementById('client-place').value;
    const phone = document.getElementById('client-phone').value;
    const email = document.getElementById('client-email').value;
    const notes = document.getElementById('client-notes').value;

    const userId = currentUser ? currentUser.uid : null;
    await addClient(userId, name, place, phone, email, notes);
    
    closeModal();
    loadDashboardData(!isLocalMode);
  });

  // Action: Delete Client
  document.getElementById('btn-delete-client').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this client and all transaction history?')) {
      const userId = currentUser ? currentUser.uid : null;
      await deleteClient(userId, currentClientId);
      showScreen('dashboard');
    }
  });

  // Drawer Trigger: Add Payment
  document.getElementById('btn-open-payment').addEventListener('click', () => {
    document.getElementById('form-add-payment').reset();
    document.getElementById('payment-date').value = new Date().toISOString().substring(0, 10);
    openModal(drawers.addPayment);
  });

  // Form Submit: Add Payment
  document.getElementById('form-add-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('payment-amount').value;
    const date = document.getElementById('payment-date').value;
    const desc = document.getElementById('payment-desc').value;

    const userId = currentUser ? currentUser.uid : null;
    await addTransaction(userId, currentClientId, 'PAYMENT', amount, date, desc);
    
    closeModal();
    renderClientDetailsData();
  });

  // Drawer Trigger: Create Bill
  document.getElementById('btn-open-bill').addEventListener('click', () => {
    document.getElementById('form-add-bill').reset();
    document.getElementById('bill-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('bilty-rows-container').innerHTML = '';
    document.getElementById('items-table-body').innerHTML = '';
    document.getElementById('bill-grand-total').textContent = 'Rs. 0.00';
    
    // Add default single row to items table for better startup experience
    addItemRow();
    
    openModal(drawers.addBill);
  });

  // Items Table actions
  document.getElementById('btn-add-item-row').addEventListener('click', addItemRow);
  document.getElementById('btn-add-bilty-row').addEventListener('click', addBiltyRow);

  // Form Submit: Create Bill
  document.getElementById('form-add-bill').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('bill-date').value;
    const desc = document.getElementById('bill-desc').value;
    
    // Read Biltys
    const biltyRows = document.querySelectorAll('#bilty-rows-container .bilty-row');
    const biltys = Array.from(biltyRows).map(row => ({
      biltyNo: row.querySelector('.bilty-no').value || '',
      transportName: row.querySelector('.bilty-transport').value || '',
      date: date // default to invoice date
    })).filter(b => b.biltyNo !== '' || b.transportName !== '');

    // Read Items Table
    const itemRows = document.querySelectorAll('#items-table-body tr');
    const items = Array.from(itemRows).map(tr => {
      const slNo = Number(tr.querySelector('.sl-no').textContent);
      const item = tr.querySelector('.item-desc').value;
      const numCartons = Number(tr.querySelector('.item-cartons').value);
      const qtyPerCarton = Number(tr.querySelector('.item-qty').value);
      const rate = Number(tr.querySelector('.item-rate').value);
      const total = numCartons * qtyPerCarton * rate;
      return { slNo, item, numCartons, qtyPerCarton, rate, total };
    });

    if (items.length === 0) {
      alert('Please add at least one item to generate a bill.');
      return;
    }

    // Calculate Grand Total
    const amount = items.reduce((sum, item) => sum + item.total, 0);

    const extraData = {
      dateOfBill: date,
      numBiltys: biltys.length,
      biltys,
      items
    };

    const userId = currentUser ? currentUser.uid : null;
    await addTransaction(userId, currentClientId, 'BILL', amount, date, desc, extraData);
    
    closeModal();
    renderClientDetailsData();
  });

  // Settings Dialog handlers
  const settingsBtn = document.getElementById('btn-settings');
  settingsBtn.addEventListener('click', () => {
    const status = getFirebaseStatus();
    const banner = document.getElementById('db-status-banner');
    const bannerText = document.getElementById('db-status-text');
    
    if (status.isInitialized) {
      banner.className = 'firebase-config-status active';
      bannerText.textContent = 'Firebase Cloud Connected';
    } else {
      banner.className = 'firebase-config-status offline';
      bannerText.textContent = 'Running in Local Mode (Offline)';
    }

    // Load inputs if configured
    if (status.config) {
      document.getElementById('fb-api-key').value = status.config.apiKey || '';
      document.getElementById('fb-project-id').value = status.config.projectId || '';
      document.getElementById('fb-auth-domain').value = status.config.authDomain || '';
      document.getElementById('fb-app-id').value = status.config.appId || '';
    } else {
      document.getElementById('fb-api-key').value = '';
      document.getElementById('fb-project-id').value = '';
      document.getElementById('fb-auth-domain').value = '';
      document.getElementById('fb-app-id').value = '';
    }

    openModal(drawers.settings);
  });

  // Settings Save
  document.getElementById('form-firebase-config').addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('fb-api-key').value.trim();
    const projectId = document.getElementById('fb-project-id').value.trim();
    const authDomain = document.getElementById('fb-auth-domain').value.trim();
    const appId = document.getElementById('fb-app-id').value.trim();

    if (!apiKey || !projectId) {
      alert('API Key and Project ID are required to initialize Firebase.');
      return;
    }

    const config = { apiKey, projectId, authDomain, appId };
    saveFirebaseConfig(config);
    alert('Firebase configuration saved. The page will reload to connect.');
    window.location.reload();
  });

  // Settings Reset to Local Mode
  document.getElementById('btn-clear-settings').addEventListener('click', () => {
    if (confirm('Clear database credentials and revert to local storage?')) {
      clearFirebaseConfig();
      localStorage.removeItem('biltybook_local_session');
      alert('Credentials cleared. Reverting to Local Offline Mode.');
      window.location.reload();
    }
  });

}
