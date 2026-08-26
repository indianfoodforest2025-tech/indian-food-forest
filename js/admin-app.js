// ==========================================================================
// ADMIN DASHBOARD LOGIC (Grid, POS, Menu, KDS Sync, QR Gen, 80mm Print)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

console.log("✅ Admin JS File Loaded Successfully!");

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.admin-section');
const sectionTitle = document.getElementById('current-section-title');
const waiterToast = document.getElementById('waiter-alert-toast');
const waiterMsg = document.getElementById('waiter-alert-msg');
const audioAlert = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// ==========================================================================
// 1. SIDEBAR TAB NAVIGATION
// ==========================================================================
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        sections.forEach(sec => sec.classList.add('hidden'));
        
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) targetSection.classList.remove('hidden');
        if (sectionTitle) sectionTitle.innerText = item.innerText;

        // Auto-load reports if Reports tab is clicked
        if (targetId === 'section-reports' && typeof window.loadReport === 'function') {
            window.loadReport();
        }
    });
});

// ==========================================================================
// 2. CLOUDINARY UPLOAD & MENU MANAGEMENT
// ==========================================================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/z2hgv1bk/image/upload';
const UPLOAD_PRESET = 'indian_food_preset'; 

const modalAddDish = document.getElementById('add-dish-modal');
const btnSaveDish = document.getElementById('btn-save-dish');
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const btnCloseDishModal = document.getElementById('btn-close-dish-modal');
const dishUploadForm = document.getElementById('dish-upload-form');

if (btnOpenAddModal) {
    btnOpenAddModal.addEventListener('click', () => {
        if (dishUploadForm) dishUploadForm.reset();
        if (modalAddDish) modalAddDish.classList.remove('hidden');
    });
}

if (btnCloseDishModal) {
    btnCloseDishModal.addEventListener('click', () => {
        if (modalAddDish) modalAddDish.classList.add('hidden');
    });
}

if (dishUploadForm) {
    dishUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (btnSaveDish) {
            btnSaveDish.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            btnSaveDish.disabled = true;
        }

        const name = document.getElementById('input-dish-name').value;
        const category = document.getElementById('input-dish-category').value;
        const price = Number(document.getElementById('input-dish-price').value);
        const type = document.getElementById('input-dish-type').value;
        const imageFileInput = document.getElementById('input-dish-image');
        const imageFile = imageFileInput ? imageFileInput.files[0] : null;

        let imageUrl = null;

        try {
            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('upload_preset', UPLOAD_PRESET);

                const cloudRes = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
                const cloudData = await cloudRes.json();
                imageUrl = cloudData.secure_url; 
            }

            const dishId = name.toLowerCase().replace(/\s+/g, '-'); 
            
            const dishData = {
                name, category, price, type,
                isAvailable: true,
                timestamp: new Date().toISOString()
            };
            
            if (imageUrl) dishData.imageUrl = imageUrl;

            await setDoc(doc(db, "menu", dishId), dishData, { merge: true });
            
            alert("Dish saved successfully!");
            if (modalAddDish) modalAddDish.classList.add('hidden');
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error saving dish.");
        } finally {
            if (btnSaveDish) {
                btnSaveDish.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save & Publish';
                btnSaveDish.disabled = false;
            }
        }
    });
}

let globalMenuData = [];
onSnapshot(collection(db, "menu"), (snapshot) => {
    const tbody = document.getElementById('admin-menu-list');
    const posGrid = document.getElementById('pos-menu-grid');
    
    if (tbody) tbody.innerHTML = '';
    if (posGrid) posGrid.innerHTML = '';
    globalMenuData = [];
    
    snapshot.forEach(docSnap => {
        const item = docSnap.data();
        item.id = docSnap.id;
        globalMenuData.push(item);

        if (tbody) {
            const tr = document.createElement('tr');
            const img = item.imageUrl ? `<img src="${item.imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">` : '<i class="fa-solid fa-image text-muted fa-2x"></i>';
            const stockBtn = item.isAvailable 
                ? `<button class="btn-sm btn-outline-danger" onclick="toggleStock('${item.id}', false)">Mark Out of Stock</button>`
                : `<button class="btn-sm btn-outline-success" onclick="toggleStock('${item.id}', true)">Mark In Stock</button>`;

            tr.innerHTML = `
                <td>${img}</td>
                <td><strong style="color: #0F172A;">${item.name}</strong><br><small class="${item.type==='veg'?'text-success':'text-danger'}"><i class="fa-solid fa-circle"></i> ${item.type.toUpperCase()}</small></td>
                <td>${item.category.toUpperCase()}</td>
                <td style="font-weight: 600;">₹${item.price}</td>
                <td><span class="status-badge ${item.isAvailable ? 'paid' : 'occupied'}">${item.isAvailable ? 'IN STOCK' : 'OUT'}</span></td>
                <td>${stockBtn}</td>
            `;
            tbody.appendChild(tr);
        }

        if(item.isAvailable && posGrid) {
            const posCard = document.createElement('div');
            posCard.className = 'table-card d-flex-between';
            posCard.style.padding = '12px 15px';
            posCard.style.border = '1px solid #E2E8F0';
            posCard.style.boxShadow = 'none';
            posCard.innerHTML = `
                <div>
                    <strong style="font-size: 14px; color: #0F172A;">${item.name}</strong>
                    <div class="text-muted" style="font-size: 13px; font-weight: 600;">₹${item.price}</div>
                </div>
                <button class="btn-primary btn-sm" onclick="addToPosCart('${item.id}')" style="border-radius: 6px;">Add +</button>
            `;
            posGrid.appendChild(posCard);
        }
    });
});

window.toggleStock = async function(id, status) {
    await updateDoc(doc(db, "menu", id), { isAvailable: status });
};

// ==========================================================================
// 3. POS / MANUAL ENTRY SYSTEM
// ==========================================================================
let posCart = {};
let lastPosOrderData = null; 

window.addToPosCart = function(id) {
    const item = globalMenuData.find(i => i.id === id);
    if (!posCart[id]) posCart[id] = { ...item, qty: 0 };
    posCart[id].qty += 1;
    renderPosCart();
};

window.updatePosCart = function(id, change) {
    if(posCart[id]) {
        posCart[id].qty += change;
        if(posCart[id].qty <= 0) delete posCart[id];
        renderPosCart();
    }
};

function renderPosCart() {
    const list = document.getElementById('pos-cart-list');
    const grandTotalEl = document.getElementById('pos-grand-total');
    if(!list) return;

    list.innerHTML = '';
    let total = 0;
    const cartKeys = Object.keys(posCart);

    if(cartKeys.length === 0) {
        list.innerHTML = '<p class="text-muted text-center mt-4"><i class="fa-solid fa-basket-shopping fa-2x mb-2" style="opacity: 0.5;"></i><br>Cart is empty</p>';
        if (grandTotalEl) grandTotalEl.innerText = '₹0';
        return;
    }

    cartKeys.forEach(id => {
        const item = posCart[id];
        total += item.price * item.qty;
        list.innerHTML += `
            <div class="d-flex-between" style="border-bottom:1px solid #F1F5F9; padding:12px 0;">
                <div>
                    <div style="font-size:14px; font-weight:600; color: #0F172A;">${item.name}</div>
                    <div style="font-size:13px; color:#64748B;">₹${item.price}</div>
                </div>
                <div class="input-group-inline" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 2px;">
                    <button style="border:none; background:transparent; padding: 4px 10px; font-weight:bold; color: #0F172A;" onclick="updatePosCart('${id}', -1)">-</button>
                    <span style="width:20px; text-align:center; font-size: 14px; font-weight:600;">${item.qty}</span>
                    <button style="border:none; background:transparent; padding: 4px 10px; font-weight:bold; color: #0F172A;" onclick="updatePosCart('${id}', 1)">+</button>
                </div>
            </div>
        `;
    });
    if (grandTotalEl) grandTotalEl.innerText = `₹${total}`;
}

const btnPosCheckout = document.getElementById('btn-pos-checkout');
const btnPosPrint = document.getElementById('btn-pos-print'); 

if(btnPosCheckout) {
    btnPosCheckout.addEventListener('click', async () => {
        if(Object.keys(posCart).length === 0) return alert("Cart is empty!");
        
        btnPosCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btnPosCheckout.disabled = true;

        const tableSelect = document.getElementById('pos-table-select');
        const tableNo = tableSelect ? tableSelect.value : 'Parcel';
        const orderId = 'POS' + Date.now().toString().slice(-6);

        let subtotal = 0;
        const itemsArray = Object.values(posCart).map(i => {
            subtotal += (i.qty * i.price);
            return { id: i.id, name: i.name, qty: i.qty, price: i.price };
        });

        // 🔥 FIX: paymentStatus 'paid' but status 'pending' ensures KDS gets it and Report counts it.
        const orderData = {
            orderId: orderId,
            tableNo: tableNo,
            customerName: "Counter / Parcel",
            customerPhone: "N/A",
            items: itemsArray,
            instructions: "Manual POS Order",
            subtotal: subtotal,
            tax: 0,
            totalAmount: subtotal,
            status: 'pending',
            paymentStatus: 'paid', 
            timestamp: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "orders", orderId), orderData);
            
            // 🔥 KITCHEN SYNC FIX: If table is selected, occupy it so it shows on Live Grid!
            if (tableNo !== 'Parcel') {
                await updateDoc(doc(db, "tables", tableNo.toString()), {
                    status: 'occupied',
                    activeOrderId: orderId
                });
            }

            alert("Order sent to Kitchen!");
            
            lastPosOrderData = orderData;
            if (btnPosPrint) btnPosPrint.classList.remove('hidden');

            posCart = {};
            renderPosCart();
        } catch (error) {
            console.error("Order Failed: ", error);
            alert("Order failed! Check connection.");
        } finally {
            btnPosCheckout.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send to Kitchen';
            btnPosCheckout.disabled = false;
        }
    });
}

// ==========================================================================
// 4. LIVE FLOOR GRID (Shows all active orders properly)
// ==========================================================================
const tablesGrid = document.getElementById('tables-grid');
if (tablesGrid) {
    onSnapshot(collection(db, "tables"), async (snapshot) => {
        tablesGrid.innerHTML = '';
        const tables = [];
        snapshot.forEach(d => tables.push({ id: d.id, ...d.data() }));
        tables.sort((a, b) => Number(a.id) - Number(b.id));

        for (let table of tables) {
            if (table.waterRequest) {
                if (waiterMsg) waiterMsg.innerText = `Table ${table.id} requested Water!`;
                if (waiterToast) waiterToast.classList.remove('hidden');
                audioAlert.play().catch(e => {}); 
                
                setTimeout(() => {
                    updateDoc(doc(db, "tables", table.id), { waterRequest: false });
                    if (waiterToast) waiterToast.classList.add('hidden');
                }, 8000);
            }

            let cardClass = 'free';
            let actionHtml = `<p class="text-muted text-sm text-center">Scan QR to start</p>`;
            let detailsHtml = `<p class="text-center text-muted mt-3">Empty</p>`;
            
            if (table.status === 'occupied') {
                cardClass = 'occupied';
                detailsHtml = `<p class="cust-name">Guests Seated</p><p class="text-sm text-muted">Browsing menu...</p>`;
                
                if (table.activeOrderId) {
                    const orderRef = doc(db, "orders", table.activeOrderId);
                    const orderSnap = await getDoc(orderRef);
                    
                    if (orderSnap.exists()) {
                        const ordData = orderSnap.data();
                        
                        // FIX: Show card logic based on both Unpaid and Paid (POS)
                        cardClass = ordData.paymentStatus === 'unpaid' ? 'pending' : 'occupied'; 
                        
                        detailsHtml = `
                            <p class="cust-name" style="color: #0F172A;">${ordData.customerName || 'Guest'} <span class="text-sm text-muted">(#${ordData.orderId})</span></p>
                            <p class="bill-amt" style="font-size: 22px; color: #2563EB;">₹${ordData.totalAmount}</p>
                            
                            <div style="display:flex; gap:5px; margin-top:10px;">
                                <span class="status-badge ${ordData.status === 'completed' ? 'paid' : 'preparing'}">${ordData.status.toUpperCase()}</span>
                                <span class="status-badge ${ordData.paymentStatus === 'paid' ? 'paid' : 'pending'}">${ordData.paymentStatus.toUpperCase()}</span>
                            </div>
                        `;

                        // Action Buttons based on Payment Status
                        let actionButtons = `
                            <button class="btn-outline-primary btn-sm w-100 mb-2" onclick="printOrderBill('${ordData.orderId}')" style="border-radius: 6px;">
                                <i class="fa-solid fa-print"></i> Print Bill
                            </button>
                        `;

                        if (ordData.paymentStatus === 'unpaid') {
                            actionButtons += `
                                <button class="btn-success btn-sm w-100" onclick="approvePayment('${ordData.orderId}', '${table.id}')" style="border-radius: 6px;">
                                    <i class="fa-solid fa-check"></i> Mark Paid & Clear
                                </button>
                            `;
                        } else {
                            // Paid via POS, just needs clearing
                            actionButtons += `
                                <button class="btn-secondary btn-sm w-100" onclick="clearTable('${table.id}')" style="border-radius: 6px;">
                                    <i class="fa-solid fa-broom"></i> Clear Table
                                </button>
                            `;
                        }
                        actionHtml = actionButtons;
                    }
                }
            }

            const card = document.createElement('div');
            card.className = `table-card ${cardClass}`;
            card.innerHTML = `
                <div class="card-head d-flex-between">
                    <h3 style="color: #0F172A;">Table ${table.id}</h3>
                    <span class="status-icon"><i class="fa-solid fa-utensils"></i></span>
                </div>
                <div class="card-body">
                    ${detailsHtml}
                </div>
                <div class="card-foot" style="border-top: 1px dashed #E2E8F0; padding-top: 15px; margin-top: 10px;">
                    ${actionHtml}
                </div>
            `;
            tablesGrid.appendChild(card);
        }
    });
}

// Payment Approval
window.approvePayment = async function(orderId, tableId) {
    if (confirm(`Approve payment for Order #${orderId} and clear Table ${tableId}?`)) {
        await updateDoc(doc(db, "orders", orderId), { paymentStatus: 'paid' });
        await updateDoc(doc(db, "tables", tableId), { status: 'free', activeOrderId: null });
    }
};

// Clear Table (If already paid via POS)
window.clearTable = async function(tableId) {
    if (confirm(`Clear Table ${tableId}?`)) {
        await updateDoc(doc(db, "tables", tableId), { status: 'free', activeOrderId: null });
    }
};

// ==========================================================================
// 5. THE 80MM THERMAL PRINT ENGINE (For Both POS & Live Grid)
// ==========================================================================
function generate80mmPrintWindow(data) {
    let itemsHtml = '';
    data.items.forEach(i => {
        itemsHtml += `
            <tr>
                <td style="padding: 4px 0; border-bottom: 1px solid #eee;">${i.name}</td>
                <td style="text-align: center; border-bottom: 1px solid #eee;">${i.qty}</td>
                <td style="text-align: right; border-bottom: 1px solid #eee;">${i.qty * i.price}</td>
            </tr>`;
    });

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if(!printWindow) {
        alert("⚠️ Pop-up blocked! Please allow pop-ups for this site to print.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bill - ${data.orderId}</title>
            <style>
                @page { margin: 0; size: 80mm auto; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 76mm; /* Keeps margin safe */
                    margin: 0 auto; 
                    padding: 5mm 2mm; 
                    color: black; 
                    background: white; 
                    font-size: 12px;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .dashed-line { border-bottom: 1px dashed black; margin: 8px 0; }
                table { width: 100%; border-collapse: collapse; }
                th { text-align: left; padding-bottom: 5px; border-bottom: 1px dashed black; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <h2 style="margin: 0; font-size: 18px;">INDIAN FOOD FOREST</h2>
                <p style="margin: 3px 0;">Shop 50, Digha, Thane</p>
                <p style="margin: 0;">Mob: 8286468504</p>
                <p style="margin: 3px 0;">FSSAI: 21526068003444</p>
            </div>
            
            <div class="dashed-line"></div>
            
            <div style="display:flex; justify-content:space-between;">
                <div>Dt: ${new Date(data.timestamp).toLocaleDateString()}</div>
                <div>Tm: ${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:3px;">
                <div>Tbl: <span class="bold">${data.tableNo}</span></div>
                <div>Ord: ${data.orderId.slice(-5)}</div>
            </div>

            <div class="dashed-line"></div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="dashed-line"></div>

            <div style="display:flex; justify-content:space-between; font-size: 14px;" class="bold">
                <span>TOTAL</span>
                <span>Rs. ${data.totalAmount}</span>
            </div>

            <div class="dashed-line"></div>
            
            <div class="text-center" style="margin-top: 15px; font-size: 11px;">
                <p style="margin: 0;">Thank You! Visit Again.</p>
                <p style="margin: 4px 0;">Powered by IFF Tech</p>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Slight delay to ensure content renders before print dialog
    setTimeout(() => { 
        printWindow.print(); 
        printWindow.close(); 
    }, 800);
}

// Print trigger for POS Checkout
if(btnPosPrint) {
    btnPosPrint.addEventListener('click', () => {
        if(!lastPosOrderData) return;
        generate80mmPrintWindow(lastPosOrderData);
        btnPosPrint.classList.add('hidden');
    });
}

// Print trigger for Live Grid Cards
window.printOrderBill = async function(orderId) {
    try {
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) return alert("Order not found!");
        generate80mmPrintWindow(orderSnap.data());
    } catch (error) {
        console.error("Print fetch error: ", error);
        alert("Failed to load bill.");
    }
};

// ==========================================================================
// 6. PERMANENT & SINGLE QR GENERATOR 
// ==========================================================================
const btnGenerateQrs = document.getElementById('btn-generate-qrs');
const btnGenerateSingle = document.getElementById('btn-generate-single');
const btnPrintQrs = document.getElementById('btn-print-qrs');

async function generateQRCodes(tableList) {
    const qrGrid = document.getElementById('qr-display-grid');
    const actionsBox = document.getElementById('qr-actions-box');
    if (qrGrid) qrGrid.innerHTML = ''; 
    const baseUrl = "https://order.indianfoodforest.com/";

    for (let tableId of tableList) {
        const tableRef = doc(db, "tables", tableId);
        const tableSnap = await getDoc(tableRef);
        let secretToken;

        // Ensure token is permanent
        if (tableSnap.exists() && tableSnap.data().secret) {
            secretToken = tableSnap.data().secret;
        } else {
            secretToken = Math.random().toString(36).substring(2, 10);
            await setDoc(tableRef, {
                status: 'free', secret: secretToken, activeOrderId: null, waterRequest: false
            }, { merge: true });
        }

        const scanUrl = `${baseUrl}index.html?table=${tableId}&secret=${secretToken}`;

        if (qrGrid) {
            const card = document.createElement('div');
            card.style = "border: 1px solid #CBD5E1; border-radius: 12px; padding: 20px; text-align: center;";
            card.innerHTML = `<h4 style="color: #0F172A; margin-bottom: 15px;">Table ${tableId}</h4><div id="qr-box-${tableId}" class="mx-auto" style="width: 128px;"></div><p class="text-sm text-muted mt-3" style="font-weight: 500;">Indian Food Forest</p>`;
            qrGrid.appendChild(card);

            new QRCode(document.getElementById(`qr-box-${tableId}`), {
                text: scanUrl, width: 128, height: 128, colorDark : "#0F172A", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
            });
        }
    }
    if (actionsBox) actionsBox.classList.remove('hidden');
}

if (btnGenerateQrs) {
    btnGenerateQrs.addEventListener('click', () => {
        const countInput = document.getElementById('qr-table-count');
        const count = countInput ? Number(countInput.value) : 15;
        const tableList = Array.from({length: count}, (_, i) => (i + 1).toString());
        generateQRCodes(tableList);
    });
}

if (btnGenerateSingle) {
    btnGenerateSingle.addEventListener('click', () => {
        const singleInput = document.getElementById('qr-single-table');
        const tableId = singleInput ? singleInput.value.trim() : '';
        if (!tableId) return alert("Enter table number!");
        generateQRCodes([tableId]);
    });
}

if (btnPrintQrs) {
    btnPrintQrs.addEventListener('click', () => window.print());
}
