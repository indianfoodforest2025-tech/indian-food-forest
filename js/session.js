// ==========================================================================
// SESSION SECURITY, GEOFENCING TRIGGER & LANDING PAGE LOGIC
// ==========================================================================

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { saveSession, getSession, saveCustomerDetails, clearSession } from "./auth.js";

// DOM Elements (Only present on index.html)
const loaderScreen = document.getElementById('session-loader');
const errorScreen = document.getElementById('security-error-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const marketingModal = document.getElementById('marketing-modal');

// Parse URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const urlTable = urlParams.get('table');
const urlSecret = urlParams.get('secret');

const isLandingPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html');

// ==========================================================================
// 1. ROUTING & INITIALIZATION LOGIC
// ==========================================================================
if (isLandingPage) {
    // Wait for the GPS Geofencing logic in index.html to pass
    window.addEventListener('LocationVerified', async () => {
        await initializeSession();
    });
} else {
    // If user is directly on menu.html or status.html, constantly verify their session
    verifyOngoingSession();
}

// ==========================================================================
// 2. SESSION VERIFICATION (LANDING PAGE)
// ==========================================================================
async function initializeSession() {
    if (urlTable && urlSecret) {
        // New scan from QR Code
        await verifyTableSecret(urlTable, urlSecret, true);
    } 
    else if (getSession()) {
        // Returning from background (Refresh)
        const currentSession = getSession();
        await verifyTableSecret(currentSession.tableNo, currentSession.secret, true);
    } 
    else {
        showError("Invalid Link", "Please scan the QR code placed on your table to access the menu.");
    }
}

async function verifyTableSecret(tableNo, secretToken, isInit = false) {
    try {
        const tableRef = doc(db, "tables", tableNo.toString());
        const tableSnap = await getDoc(tableRef);

        if (tableSnap.exists()) {
            const tableData = tableSnap.data();
            
            // SECURITY CHECK: Does the secret match?
            if (tableData.secret === secretToken) {
                saveSession(tableNo, secretToken);
                
                if (isInit) {
                    showWelcomeScreen(tableNo);
                    
                    // Mark table as occupied when they scan and enter
                    if (tableData.status === 'free') {
                        await updateDoc(tableRef, { status: 'occupied' });
                    }
                }
            } else {
                // Token mismatch (Admin cleared the table and changed token)
                if(isInit) showError("Session Expired", "This QR code session has ended. Please scan again.");
                else forceLogout();
            }
        } else {
            if(isInit) showError("Invalid Table", "This table does not exist in our system.");
            else forceLogout();
        }
    } catch (error) {
        console.error("Session Verification Error: ", error);
        if(isInit) showError("Network Error", "Could not verify session. Please check your internet connection.");
    }
}

// ==========================================================================
// 3. BACKGROUND SECURITY (MENU & STATUS PAGES)
// ==========================================================================
async function verifyOngoingSession() {
    const session = getSession();
    if (!session) {
        forceLogout();
        return;
    }
    
    // Check if Admin cleared the table while customer was browsing
    try {
        const tableSnap = await getDoc(doc(db, "tables", session.tableNo.toString()));
        if (tableSnap.exists()) {
            const tableData = tableSnap.data();
            // If secret changed OR status became free, kill local session
            if (tableData.secret !== session.secret || tableData.status === 'free') {
                console.log("Admin cleared table. Logging out customer.");
                forceLogout();
            }
        }
    } catch (e) {
        console.error("Ongoing session check failed", e);
    }
}

function forceLogout() {
    clearSession();
    window.location.href = "index.html";
}

// ==========================================================================
// 4. UI STATE CONTROLLERS
// ==========================================================================
function showError(title, message) {
    if (!loaderScreen) return; 
    loaderScreen.classList.remove('active');
    loaderScreen.classList.add('hidden');
    
    document.getElementById('error-title-display').innerText = title;
    document.getElementById('error-msg-text').innerText = message;
    document.getElementById('error-icon-display').className = "fa-solid fa-triangle-exclamation text-danger fa-4x mb-4";
    
    errorScreen.classList.remove('hidden');
}

function showWelcomeScreen(tableNo) {
    if (!loaderScreen) return;
    loaderScreen.classList.remove('active');
    loaderScreen.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    
    const displayTable = document.getElementById('display-table-no');
    const displayTime = document.getElementById('session-time-display');
    
    if (displayTable) displayTable.innerText = `Table ${tableNo}`;
    if (displayTime) displayTime.innerText = getSession().startTime;
}

// ==========================================================================
// 5. EVENT LISTENERS FOR LANDING PAGE
// ==========================================================================
const btnStartOrder = document.getElementById('btn-start-order');
if (btnStartOrder) {
    btnStartOrder.addEventListener('click', () => {
        marketingModal.classList.remove('hidden');
    });
}

const btnSkipDetails = document.getElementById('btn-skip-details');
if (btnSkipDetails) {
    btnSkipDetails.addEventListener('click', () => {
        window.location.href = "menu.html";
    });
}

const detailsForm = document.getElementById('customer-details-form');
if (detailsForm) {
    detailsForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        
        saveCustomerDetails(name, phone);
        window.location.href = "menu.html";
    });
}

const btnCallWater = document.getElementById('btn-call-water-landing');
if (btnCallWater) {
    btnCallWater.addEventListener('click', async () => {
        const sessionData = getSession();
        if (sessionData) {
            btnCallWater.innerHTML = '<i class="fa-solid fa-check"></i> Request Sent';
            btnCallWater.disabled = true;
            btnCallWater.style.background = '#16A34A';
            btnCallWater.style.color = 'white';
            btnCallWater.style.border = 'none';
            
            const tableRef = doc(db, "tables", sessionData.tableNo.toString());
            await updateDoc(tableRef, {
                waterRequest: true,
                lastRequestTime: new Date().toISOString()
            });
            
            setTimeout(() => {
                btnCallWater.innerHTML = '<i class="fa-solid fa-glass-water"></i> Request Water';
                btnCallWater.disabled = false;
                btnCallWater.style.background = 'white';
                btnCallWater.style.color = '#2563EB';
                btnCallWater.style.border = '2px solid #2563EB';
            }, 5000);
        }
    });
}
