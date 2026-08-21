// ==========================================================================
// ADMIN DASHBOARD LOGIC (Grid, Cloudinary Menu, QR Gen, Payment)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { adminLogout } from "./auth.js";

// DOM Elements - Sidebar Navigation
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.admin-section');
const sectionTitle = document.getElementById('current-section-title');

// DOM Elements - Toast & Alerts
const waiterToast = document.getElementById('waiter-alert-toast');
const waiterMsg = document.getElementById('waiter-alert-msg');
const audioAlert = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Same KDS bell or softer ping

// ==========================================================================
// 1. SIDEBAR TAB NAVIGATION LOGIC
// ==========================================================================
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        sections.forEach(sec => sec.classList.add('hidden'));
        
        // Add active class to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        
        // Update Title
        sectionTitle.innerText = item.innerText;
    });
});

// Logout
document.getElementById('btn-logout').addEventListener('click', adminLogout);


// ==========================================================================
// 2. CLOUDINARY UPLOAD & MENU MANAGEMENT
// ==========================================================================
// IMPORTANT: Replace 'indian_food_preset' with your actual Unsigned Preset Name from Cloudinary Settings
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/z2hgv1bk/image/upload';
const UPLOAD_PRESET = 'indian_food_preset'; // <--- CHANGE THIS 

const modalAddDish = document.getElementById('add-dish-modal');
const btnSaveDish = document.getElementById('btn-save-dish');

document.getElementById('btn-open-add-modal').addEventListener('click', () => {
    document.getElementById('dish-upload-form').reset();
    modalAddDish.classList.remove('hidden');
});

document.getElementById('btn-close-dish-modal').addEventListener('click', () => {
    modalAddDish.classList.add('hidden');
});

document.getElementById('dish-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    btnSaveDish.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    btnSaveDish.disabled = true;

    const name = document.getElementById('input-dish-name').value;
    const category = document.getElementById('input-dish-category').value;
    const price = Number(document.getElementById('input-dish-price').value);
    const type = document.getElementById('input-dish-type').value;
    const imageFile = document.getElementById('input-dish-image').files[0];

    let imageUrl = null;

    try {
        // Step A: Upload image to Cloudinary if file is selected
        if (imageFile) {
            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('upload_preset', UPLOAD_PRESET);

            const cloudRes = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });
            const cloudData = await cloudRes.json();
            
            // Cloudinary returns a highly compressed secure webp url if configured
            imageUrl = cloudData.secure_url; 
        }

        // Step B: Save/Update in Firestore
        const dishId = name.toLowerCase().replace(/\s+/g, '-'); // e.g. "Paneer Tikka" -> "paneer-tikka"
        
        const dishData = {
            name, category, price, type,
            isAvailable: true,
            timestamp: new Date().toISOString()
        };
        
        // Only update image if a new one was uploaded
        if (imageUrl) dishData.imageUrl = imageUrl;

        await setDoc(doc(db, "menu", dishId), dishData, { merge: true });
        
        alert("Dish saved successfully!");
        modalAddDish.classList.add('hidden');
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Error saving dish. Check console.");
    } finally {
        btnSaveDish.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save & Publish';
        btnSaveDish.disabled = false;
    }
});

// Real-time render Admin Menu List
onSnapshot(collection(db, "menu"), (snapshot) => {
    const tbody = document.getElementById('admin-menu-list');
    tbody.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const item = docSnap.data();
        const tr = document.createElement('tr');
        const img = item.imageUrl ? `<img src="${item.imageUrl}" class="dish-thumb">` : '<i class="fa-solid fa-image text-muted"></i>';
        const stockBtn = item.isAvailable 
            ? `<button class="btn-sm btn-outline-danger" onclick="toggleStock('${docSnap.id}', false)">Mark Out of Stock</button>`
            : `<button class="btn-sm btn-outline-success" onclick="toggleStock('${docSnap.id}', true)">Mark In Stock</button>`;

        tr.innerHTML = `
            <td>${img}</td>
            <td><strong>${item.name}</strong><br><small class="${item.type==='veg'?'text-success':'text-danger'}">${item.type.toUpperCase()}</small></td>
            <td>${item.category.toUpperCase()}</td>
            <td>₹${item.price}</td>
            <td><span class="status-badge ${item.isAvailable ? 'paid' : 'occupied'}">${item.isAvailable ? 'IN STOCK' : 'OUT'}</span></td>
            <td>${stockBtn}</td>
        `;
        tbody.appendChild(tr);
    });
});

window.toggleStock = async function(id, status) {
    await updateDoc(doc(db, "menu", id), { isAvailable: status });
};


// ==========================================================================
// 3. LIVE FLOOR GRID & PAYMENT APPROVAL
// ==========================================================================
const tablesGrid = document.getElementById('tables-grid');

onSnapshot(collection(db, "tables"), async (snapshot) => {
    tablesGrid.innerHTML = '';
    
    // Convert to array and sort by table number numerically
    const tables = [];
    snapshot.forEach(d => tables.push({ id: d.id, ...d.data() }));
    tables.sort((a, b) => Number(a.id) - Number(b.id));

    for (let table of tables) {
        // Check Water Request Alert
        if (table.waterRequest) {
            waiterMsg.innerText = `Table ${table.id} requested Water!`;
            waiterToast.classList.remove('hidden');
            audioAlert.play().catch(e => {}); // Play soft ping
            
            // Auto reset flag in DB after ringing
            setTimeout(() => {
                updateDoc(doc(db, "tables", table.id), { waterRequest: false });
                waiterToast.classList.add('hidden');
            }, 8000);
        }

        // Build Table Card UI
        let cardClass = 'free';
        let actionHtml = `<p class="text-muted text-sm text-center">Scan QR to start</p>`;
        let detailsHtml = `<p class="text-center text-muted mt-3">Empty</p>`;
        
        if (table.status === 'occupied') {
            cardClass = 'occupied';
            detailsHtml = `<p class="cust-name">Guests Seated</p><p class="text-sm text-muted">Browsing menu...</p>`;
            
            // If they placed an order, fetch order details
            if (table.activeOrderId) {
                const orderRef = doc(db, "orders", table.activeOrderId);
                const orderSnap = await getDoc(orderRef);
                
                if (orderSnap.exists()) {
                    const ordData = orderSnap.data();
                    
                    if (ordData.paymentStatus === 'unpaid') {
                        cardClass = 'pending'; // Yellow border
                        detailsHtml = `
                            <p class="cust-name">${ordData.customerName || 'Guest'} <span class="text-sm text-muted">(#${ordData.orderId})</span></p>
                            <p class="bill-amt">₹${ordData.totalAmount}</p>
                            <span class="status-badge ${ordData.status === 'completed' ? 'paid' : 'preparing'}">${ordData.status.toUpperCase()}</span>
                        `;
                        actionHtml = `<button class="btn-success btn-sm w-100 mt-2" onclick="approvePayment('${ordData.orderId}', '${table.id}')">Mark Paid & Clear Table</button>`;
                    }
                }
            }
        }

        const card = document.createElement('div');
        card.className = `table-card ${cardClass}`;
        card.innerHTML = `
            <div class="card-head d-flex-between">
                <h3>Table ${table.id}</h3>
                <span class="status-icon"><i class="fa-solid fa-utensils"></i></span>
            </div>
            <div class="card-body">
                ${detailsHtml}
            </div>
            <div class="card-foot">
                ${actionHtml}
            </div>
        `;
        tablesGrid.appendChild(card);
    }
});

// Handle Payment
window.approvePayment = async function(orderId, tableId) {
    if (confirm(`Approve payment for Order #${orderId} and free Table ${tableId}?`)) {
        // 1. Mark order as paid (triggers PDF download for customer)
        await updateDoc(doc(db, "orders", orderId), { paymentStatus: 'paid' });
        
        // 2. Reset Table Status & Generate new secure token for next customer
        const newToken = Math.random().toString(36).substring(2, 10);
        await updateDoc(doc(db, "tables", tableId), { 
            status: 'free',
            activeOrderId: null,
            secret: newToken // Prevents old customers from ordering again from home
        });
    }
};


// ==========================================================================
// 4. BULK SECURE QR GENERATOR
// ==========================================================================
document.getElementById('btn-generate-qrs').addEventListener('click', async () => {
    const count = Number(document.getElementById('qr-table-count').value);
    const qrGrid = document.getElementById('qr-display-grid');
    const actionsBox = document.getElementById('qr-actions-box');
    
    qrGrid.innerHTML = ''; // clear old
    // Use current hosting domain (fallback to localhost for dev)
    const baseUrl = window.location.origin.includes('github.io') ? window.location.origin + window.location.pathname.replace('admin.html','') : 'http://localhost:5500/';

    for (let i = 1; i <= count; i++) {
        // 1. Generate random 8-char secure token
        const secretToken = Math.random().toString(36).substring(2, 10);
        const tableId = i.toString();

        // 2. Save/Init Table in Firestore
        await setDoc(doc(db, "tables", tableId), {
            status: 'free',
            secret: secretToken,
            activeOrderId: null,
            waterRequest: false
        }, { merge: true });

        // 3. Create QR URL
        const scanUrl = `${baseUrl}index.html?table=${tableId}&secret=${secretToken}`;

        // 4. Build UI Card
        const card = document.createElement('div');
        card.className = 'qr-card';
        card.innerHTML = `<h4>Table ${tableId}</h4><div id="qr-box-${tableId}" class="mt-2 mx-auto" style="width: 128px;"></div><p class="text-sm text-muted mt-2">Indian Food Forest</p>`;
        qrGrid.appendChild(card);

        // 5. Generate QR Image using library
        new QRCode(document.getElementById(`qr-box-${tableId}`), {
            text: scanUrl,
            width: 128,
            height: 128,
            colorDark : "#0F172A",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }

    actionsBox.classList.remove('hidden');
    alert(`${count} Secure QR Codes generated and saved to database!`);
});

// Print QRs natively via browser
document.getElementById('btn-print-qrs').addEventListener('click', () => {
    window.print();
});
