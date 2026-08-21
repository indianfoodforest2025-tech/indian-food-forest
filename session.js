// ==========================================================================
// SESSION SECURITY & LANDING PAGE LOGIC
// ==========================================================================

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { saveSession, getSession, saveCustomerDetails } from "./auth.js";

// DOM Elements
const loaderScreen = document.getElementById('session-loader');
const errorScreen = document.getElementById('security-error-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const marketingModal = document.getElementById('marketing-modal');

// Parse URL Parameters (e.g., ?table=5&secret=abc123xyz)
const urlParams = new URLSearchParams(window.location.search);
const urlTable = urlParams.get('table');
const urlSecret = urlParams.get('secret');

/**
 * On Page Load: Verify URL and Security Token
 */
window.addEventListener('DOMContentLoaded', async () => {
    // If we are on index.html, run the security check
    if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
        
        // 1. Check if URL has valid params
        if (urlTable && urlSecret) {
            await verifyTableSecret(urlTable, urlSecret);
        } 
        // 2. Check if a valid session already exists in LocalStorage
        else if (getSession()) {
            const currentSession = getSession();
            // Verify if the local session is still valid in database
            await verifyTableSecret(currentSession.tableNo, currentSession.secret);
        } 
        // 3. No URL params and no local session = Invalid Access
        else {
            showError();
        }
    }
});

/**
 * Verify Table Token with Firestore Database
 */
async function verifyTableSecret(tableNo, secretToken) {
    try {
        const tableRef = doc(db, "tables", tableNo.toString());
        const tableSnap = await getDoc(tableRef);

        if (tableSnap.exists()) {
            const tableData = tableSnap.data();
            
            // SECURITY CHECK: Does the secret match what's in the database?
            if (tableData.secret === secretToken) {
                // Success: Secure session
                saveSession(tableNo, secretToken);
                showWelcomeScreen(tableNo);
                
                // If it's a fresh scan (status is 'free'), mark table as 'occupied'
                if (tableData.status === 'free') {
                    await updateDoc(tableRef, { status: 'occupied' });
                }
            } else {
                // Token mismatch (Old or fake QR)
                showError();
            }
        } else {
            // Table doesn't exist
            showError();
        }
    } catch (error) {
        console.error("Session Verification Error: ", error);
        showError();
    }
}

/**
 * UI State Controllers
 */
function showError() {
    loaderScreen.classList.remove('active');
    loaderScreen.classList.add('hidden');
    errorScreen.classList.remove('hidden');
}

function showWelcomeScreen(tableNo) {
    loaderScreen.classList.remove('active');
    loaderScreen.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    
    // Update UI with Table Info
    const displayTable = document.getElementById('display-table-no');
    const displayTime = document.getElementById('session-time-display');
    
    if (displayTable) displayTable.innerText = `Table ${tableNo}`;
    if (displayTime) displayTime.innerText = getSession().startTime;
}

/**
 * Event Listeners for Buttons on index.html
 */

// "Explore Menu" Button Click
const btnStartOrder = document.getElementById('btn-start-order');
if (btnStartOrder) {
    btnStartOrder.addEventListener('click', () => {
        // Show the Optional Marketing Modal before redirecting to menu
        marketingModal.classList.remove('hidden');
    });
}

// "Skip / Continue as Guest" Button Click
const btnSkipDetails = document.getElementById('btn-skip-details');
if (btnSkipDetails) {
    btnSkipDetails.addEventListener('click', () => {
        // Direct to menu without saving details
        window.location.href = "menu.html";
    });
}

// "Save & Continue" Form Submit (Marketing Modal)
const detailsForm = document.getElementById('customer-details-form');
if (detailsForm) {
    detailsForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop page refresh
        
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        
        // Save to local storage
        saveSession(getSession().tableNo, getSession().secret); // Ensure session is tight
        saveCustomerDetails(name, phone);
        
        // Go to menu
        window.location.href = "menu.html";
    });
}

// "Request Water" from Landing Page
const btnCallWater = document.getElementById('btn-call-water-landing');
if (btnCallWater) {
    btnCallWater.addEventListener('click', async () => {
        const session = getSession();
        if (session) {
            btnCallWater.innerHTML = '<i class="fa-solid fa-check"></i> Request Sent';
            btnCallWater.disabled = true;
            btnCallWater.classList.add('btn-success');
            btnCallWater.classList.remove('btn-secondary', 'outline');
            
            // Push alert to Firestore so Admin gets notification
            const tableRef = doc(db, "tables", session.tableNo.toString());
            await updateDoc(tableRef, {
                waterRequest: true,
                lastRequestTime: new Date().toISOString()
            });
            
            setTimeout(() => {
                btnCallWater.innerHTML = '<i class="fa-solid fa-glass-water"></i> Request Water';
                btnCallWater.disabled = false;
                btnCallWater.classList.remove('btn-success');
                btnCallWater.classList.add('btn-secondary', 'outline');
            }, 5000);
        }
    });
}
