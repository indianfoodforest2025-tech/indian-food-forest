// ==========================================================================
// KITCHEN KDS LOGIC (Live Orders, Timer, Audio Alarm & Auto-Sync)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================================================
// 0. KITCHEN LOGIN SECURITY (PIN: 7860)
// ==========================================================================
const loginScreen = document.getElementById('kitchen-login-screen');
const btnKitchenLogin = document.getElementById('btn-kitchen-login');
const inputKitchenPass = document.getElementById('kitchen-passcode');
const loginError = document.getElementById('kitchen-login-error');

// Check if authenticated in this current browser session
if (sessionStorage.getItem('kitchenAuthenticated') === 'true') {
    if (loginScreen) loginScreen.classList.add('hidden');
}

if (btnKitchenLogin) {
    btnKitchenLogin.addEventListener('click', () => {
        // Master Kitchen Passcode: 7860
        if (inputKitchenPass.value === '7860') {
            sessionStorage.setItem('kitchenAuthenticated', 'true');
            loginScreen.classList.add('hidden');
        } else {
            loginError.classList.remove('hidden');
            inputKitchenPass.value = ''; // Auto clear on wrong pin
        }
    });
}

// ==========================================================================
// DOM ELEMENTS & SETUP
// ==========================================================================
const ordersGrid = document.getElementById('kds-orders-grid');
const emptyState = document.getElementById('kds-empty-state');
const clockEl = document.getElementById('kds-live-clock');

// Audio Setup for Kitchen Bell
const alarmSound = document.getElementById('kds-audio-bell');
const btnToggleSound = document.getElementById('btn-toggle-sound');
let isSoundEnabled = false;

// Audio Permission Bypass (Browser Policy demands one physical click to allow audio)
btnToggleSound.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    if (isSoundEnabled) {
        btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sound ON';
        btnToggleSound.style.background = '#16A34A'; // Green
        btnToggleSound.style.color = 'white';
        btnToggleSound.style.border = 'none';
        
        // Play and pause instantly to unlock audio context in the browser
        alarmSound.play().catch(e => console.log(e));
        setTimeout(() => alarmSound.pause(), 100);
    } else {
        btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Sound OFF (Tap to Enable)';
        btnToggleSound.style.background = 'transparent';
        btnToggleSound.style.color = '#DC2626';
        btnToggleSound.style.border = '1px solid #DC2626';
        alarmSound.pause();
    }
});

// Live Clock UI
setInterval(() => {
    if(clockEl) clockEl.innerText = new Date().toLocaleTimeString();
}, 1000);

// ==========================================================================
// 1. REAL-TIME FIRESTORE LISTENER (Live Sync)
// ==========================================================================
// Sirf "pending" aur "preparing" orders laayega (Paid ho ya unpaid, farq nahi padta)
const q = query(collection(db, "orders"), where("status", "in", ["pending", "preparing"]));

onSnapshot(q, (snapshot) => {
    const orders = [];
    let hasNewPendingOrder = false;

    snapshot.forEach((doc) => {
        const data = doc.data();
        orders.push(data);
        if (data.status === 'pending') hasNewPendingOrder = true;
    });

    // Sort Orders: Oldest first (FIFO - First In First Out)
    orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    renderKDS(orders);
    handleAlarm(hasNewPendingOrder);
});

// ==========================================================================
// 2. AUDIO ALARM LOGIC
// ==========================================================================
function handleAlarm(hasPending) {
    if (!isSoundEnabled) return; // Muted by chef

    if (hasPending) {
        if (alarmSound.paused) {
            alarmSound.play().catch(err => console.log("Audio play prevented:", err));
        }
    } else {
        alarmSound.pause();
        alarmSound.currentTime = 0; 
    }
}

// ==========================================================================
// 3. RENDER KITCHEN GRID (Dark Mode UI)
// ==========================================================================
function renderKDS(orders) {
    if (orders.length === 0) {
        emptyState.classList.remove('hidden');
        ordersGrid.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    ordersGrid.classList.remove('hidden');
    ordersGrid.innerHTML = '';

    orders.forEach(order => {
        const timeInfo = calculateTime(order.timestamp);
        
        let itemsHtml = '';
        order.items.forEach((item, index) => {
            const checkboxId = `chk-${order.orderId}-${index}`;
            itemsHtml += `
                <li style="border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                    <label class="custom-checkbox" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <input type="checkbox" id="${checkboxId}" style="width: 20px; height: 20px; cursor: pointer; accent-color: #16A34A;">
                        <span class="item-name" style="font-size: 16px; font-weight: 500;">${item.qty}x ${item.name}</span>
                    </label>
                </li>
            `;
        });

        const card = document.createElement('div');
        card.className = `order-card`;
        
        // Timer based border and glow (Red/Yellow/Green)
        card.style.border = `2px solid ${timeInfo.hexColor}`;
        card.style.boxShadow = timeInfo.isRed ? `0 0 15px rgba(220, 38, 38, 0.4)` : `0 4px 10px rgba(0,0,0,0.2)`;

        const isPending = order.status === 'pending';
        const badgeBg = isPending ? '#FEF3C7' : '#DBEAFE';
        const badgeColor = isPending ? '#D97706' : '#2563EB';
        const badgeText = isPending ? 'NEW ORDER' : 'PREPARING';

        card.innerHTML = `
            <div class="kds-card-header d-flex-between" style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 22px; color: white;">Table ${order.tableNo}</h2>
                <span style="background: ${timeInfo.hexColor}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-family: monospace; font-size: 16px;">
                    ${timeInfo.mins} MIN
                </span>
            </div>
            
            <div class="kds-card-meta d-flex-between" style="display: flex; justify-content: space-between; align-items: center;">
                <span>#${order.orderId}</span>
                <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">${badgeText}</span>
            </div>

            <div class="kds-card-body">
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${itemsHtml}
                </ul>
                ${order.instructions 
                    ? `<p class="cooking-note" style="background: #450A0A; border-left: 4px solid #DC2626; color: #FCA5A5; padding: 10px; border-radius: 4px; font-size: 13px; font-weight: 500; margin-top: 15px;">
                         <i class="fa-solid fa-message"></i> ${order.instructions}
                       </p>` 
                    : ''}
            </div>

            <div class="kds-card-footer">
                ${isPending 
                    ? `<button class="btn-primary w-100" onclick="updateOrderStatus('${order.orderId}', 'preparing')" style="padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; background: #2563EB; border: none; color: white; cursor: pointer;">
                         <i class="fa-solid fa-fire"></i> Accept & Prepare
                       </button>`
                    : `<button class="btn-success w-100" onclick="updateOrderStatus('${order.orderId}', 'completed')" style="padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; background: #16A34A; border: none; color: white; cursor: pointer;">
                         <i class="fa-solid fa-check-double"></i> Mark Ready
                       </button>`
                }
            </div>
        `;

        ordersGrid.appendChild(card);
    });
}

// ==========================================================================
// 4. DYNAMIC TIMER CALCULATION (Color Codes)
// ==========================================================================
function calculateTime(orderTimestamp) {
    const orderTime = new Date(orderTimestamp);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);

    let hexColor = '#16A34A'; // Green (Under 10 mins)
    let isRed = false;

    if (diffMins >= 10 && diffMins < 15) {
        hexColor = '#F59E0B'; // Yellow (10 to 15 mins)
    } else if (diffMins >= 15) {
        hexColor = '#DC2626'; // Red (Over 15 mins)
        isRed = true;
    }

    const displayMins = diffMins < 10 ? `0${diffMins}` : diffMins;
    
    return { mins: displayMins, hexColor, isRed };
}

// ==========================================================================
// 5. ACTION: UPDATE ORDER STATUS (Sync to Customer & Admin)
// ==========================================================================
window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus
        });
        // Success: Firestore Live Listener will automatically re-render the grid
    } catch (error) {
        console.error("Error updating status: ", error);
        alert("Failed to update status. Check your internet connection.");
    }
};
