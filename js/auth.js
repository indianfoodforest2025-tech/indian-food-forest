// ==========================================================================
// AUTHENTICATION & LOCAL STORAGE MANAGER (Customer Side)
// ==========================================================================

const STORAGE_PREFIX = "iff_"; // Indian Food Forest secure prefix

/**
 * Save Table & Session Secret to LocalStorage
 */
export function saveSession(tableNo, secretToken) {
    localStorage.setItem(`${STORAGE_PREFIX}table`, tableNo);
    localStorage.setItem(`${STORAGE_PREFIX}secret`, secretToken);
    
    // Set session start time if not already set for this visit
    if (!localStorage.getItem(`${STORAGE_PREFIX}startTime`)) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem(`${STORAGE_PREFIX}startTime`, timeString);
    }
}

/**
 * Get current active session details
 * @returns {Object|null} - Session data or null if not found
 */
export function getSession() {
    const tableNo = localStorage.getItem(`${STORAGE_PREFIX}table`);
    const secret = localStorage.getItem(`${STORAGE_PREFIX}secret`);
    const startTime = localStorage.getItem(`${STORAGE_PREFIX}startTime`);

    if (tableNo && secret) {
        return { tableNo, secret, startTime };
    }
    return null;
}

/**
 * Save Optional Customer Marketing Details (Name & Phone)
 */
export function saveCustomerDetails(name, phone) {
    if (name) localStorage.setItem(`${STORAGE_PREFIX}cust_name`, name);
    if (phone) localStorage.setItem(`${STORAGE_PREFIX}cust_phone`, phone);
}

/**
 * Get Customer Details (for pre-filling cart or pushing to DB)
 */
export function getCustomerDetails() {
    return {
        name: localStorage.getItem(`${STORAGE_PREFIX}cust_name`) || "Guest",
        phone: localStorage.getItem(`${STORAGE_PREFIX}cust_phone`) || null
    };
}

/**
 * Clear Entire Session 
 * (Triggered automatically when Admin marks table as Paid/Clear)
 */
export function clearSession() {
    // Save phone/name temporarily so we remember them next time they visit
    const phone = localStorage.getItem(`${STORAGE_PREFIX}cust_phone`);
    const name = localStorage.getItem(`${STORAGE_PREFIX}cust_name`);
    
    // Nuke the storage to force logout
    localStorage.clear();
    
    // Restore marketing details silently
    if (phone) localStorage.setItem(`${STORAGE_PREFIX}cust_phone`, phone);
    if (name) localStorage.setItem(`${STORAGE_PREFIX}cust_name`, name);
}

/**
 * Global Logout / Reset (For Admin Panel Button)
 */
export function adminLogout() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "index.html"; 
}

console.log("🔐 Auth Storage Module Loaded.");
