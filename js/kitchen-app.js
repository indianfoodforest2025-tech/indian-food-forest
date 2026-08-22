// ==========================================================================
// KITCHEN KDS LOGIC (Live Orders, Timer, Audio Alarm & Security)
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

// Check if already authenticated in this session
if (sessionStorage.getItem('kitchenAuthenticated') === 'true') {
    if (loginScreen) loginScreen.classList.add('hidden');
}

if (btnKitchenLogin) {
    btnKitchenLogin.addEventListener('click', () => {
        // Kitchen Passcode is set to 7860
        if (inputKitchenPass.value === '7860') {
            sessionStorage.setItem('kitchenAuthenticated', 'true');
            loginScreen.classList.add('hidden');
        } else {
            loginError.classList.remove('hidden');
        }
    });
}


// ==========================================================================
// DOM Elements
// ==========================================================================
const ordersGrid = document.getElementById('kds-orders-grid');
const emptyState = document.getElementById('kds-empty-state');
const clockEl = document.getElementById('kds-live-clock');

// Audio Setup (Crucial for Kitchen Alerts)
const alarmSound = document.getElementById('kds-audio-bell');
const btnToggleSound = document.getElementById('btn-toggle-sound');
let isSoundEnabled = false;

// 1. Audio Permission Bypass (Must click once due to Browser Autoplay policy)
btnToggleSound.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    if (isSoundEnabled) {
        btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sound ON';
        btnToggleSound.className = 'btn-success';
        // Play and pause instantly to unlock audio context
        alarmSound.play().catch(e => console.log(e));
        setTimeout(() => alarmSound.pause(), 100);
    } else {
        btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Sound OFF (Click to Enable)';
        btnToggleSound.className = 'btn-outline-danger';
        alarmSound.pause();
    }
});

// Live Clock for Kitchen
setInterval(() => {
    clockEl.innerText = new Date().toLocaleTimeString();
}, 1000);

// ==========================================================================
// REAL-TIME FIRESTORE LISTENER (Zero Refresh)
// ==========================================================================
const q = query(collection(db, "orders"), where("status", "in", ["pending", "preparing"]));

onSnapshot(q, (snapshot) => {
    const orders = [];
    let hasNewPendingOrder = false;

    snapshot.forEach((doc) => {
        const data = doc.data();
        orders.push(data);
        if (data.status === 'pending') hasNewPendingOrder = true;
    });

    // Sort: Oldest first (FIFO)
    orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    renderKDS(orders);
    handleAlarm(hasNewPendingOrder);
});

// ==========================================================================
// AUDIO ALARM LOGIC
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
// RENDER KITCHEN GRID
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
                <li class="kds-item">
                    <label class="custom-checkbox">
                        <input type="checkbox" id="${checkboxId}" class="item-check">
                        <span class="checkmark"></span>
                        <span class="item-name">${item.qty}x ${item.name}</span>
                    </label>
                </li>
            `;
        });

        const card = document.createElement('div');
        card.className = `order-card ${timeInfo.colorClass}`;
        card.setAttribute('data-id', order.orderId);
        
        const isPending = order.status === 'pending';
        const badgeClass = isPending ? 'pending' : 'preparing';
        const badgeText = isPending ? 'NEW ORDER' : 'PREPARING';

        card.innerHTML = `
            <div class="kds-card-header d-flex-between">
                <h2>Table ${order.tableNo}</h2>
                <span class="timer-badge">${timeInfo.mins} MIN</span>
            </div>
            
            <div class="kds-card-meta d-flex-between">
                <span>#${order.orderId}</span>
                <span class="status-badge ${badgeClass}">${badgeText}</span>
            </div>

            <div class="kds-card-body">
                <ul class="kds-item-list">
                    ${itemsHtml}
                </ul>
                ${order.instructions ? `<p class="cooking-note"><i class="fa-solid fa-message"></i> ${order.instructions}</p>` : ''}
            </div>

            <div class="kds-card-footer">
                ${isPending 
                    ? `<button class="btn-kds-action btn-accept w-100" onclick="updateOrderStatus('${order.orderId}', 'preparing')">
                         <i class="fa-solid fa-fire"></i> Accept & Prepare
                       </button>`
                    : `<button class="btn-kds-action btn-ready w-100" onclick="updateOrderStatus('${order.orderId}', 'completed')">
                         <i class="fa-solid fa-check-double"></i> Mark Ready
                       </button>`
                }
            </div>
        `;

        ordersGrid.appendChild(card);
    });
}

// ==========================================================================
// TIMER CALCULATION LOGIC
// ==========================================================================
function calculateTime(orderTimestamp) {
    const orderTime = new Date(orderTimestamp);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);

    let colorClass = 'timer-green';
    if (diffMins >= 10 && diffMins < 15) colorClass = 'timer-yellow';
    if (diffMins >= 15) colorClass = 'timer-red';

    const displayMins = diffMins < 10 ? `0${diffMins}` : diffMins;
    
    return { mins: displayMins, colorClass };
}

// ==========================================================================
// ACTION: UPDATE ORDER STATUS
// ==========================================================================
window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus
        });
    } catch (error) {
        console.error("Error updating status: ", error);
        alert("Failed to update status. Check connection.");
    }
};
