// ==========================================================================
// ADMIN DASHBOARD LOGIC (Grid, POS, Menu, QR Gen)
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
// 1. SIDEBAR TAB NAVIGATION & LOGOUT
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

        // Agar report tab click ho, toh reports-app.js ka function call karo
        if (targetId === 'section-reports' && typeof window.loadReport === 'function') {
            window.loadReport();
        }
    });
});

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('adminAuthenticated');
        window.location.reload(); 
    });
}

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
            const img = item.imageUrl ? `<img src="${item.imageUrl}" class="dish-thumb">` : '<i class="fa-solid fa-image text-muted"></i>';
            const stockBtn = item.isAvailable 
                ? `<button class="btn-sm btn-outline-danger" onclick="toggleStock('${item.id}', false)">Mark Out of Stock</button>`
                : `<button class="btn-sm btn-outline-success" onclick="toggleStock('${item.id}', true)">Mark In Stock</button>`;

            tr.innerHTML = `
                <td>${img}</td>
                <td><strong>${item.name}</strong><br><small class="${item.type==='veg'?'text-success':'text-danger'}">${item.type.toUpperCase()}</small></td>
                <td>${item.category.toUpperCase()}</td>
                <td>₹${item.price}</td>
                <td><span class="status-badge ${item.isAvailable ? 'paid' : 'occupied'}">${item.isAvailable ? 'IN STOCK' : 'OUT'}</span></td>
                <td>${stockBtn}</td>
            `;
            tbody.appendChild(tr);
        }

        if(item.isAvailable && posGrid) {
            const posCard = document.createElement('div');
            posCard.className = 'table-card d-flex-between';
            posCard.style.padding = '10px 15px';
            posCard.innerHTML = `
                <div>
                    <strong>${item.name}</strong>
                    <div class="text-muted text-sm">₹${item.price}</div>
                </div>
                <button class="btn-primary btn-sm" onclick="addToPosCart('${item.id}')">Add +</button>
            `;
            posGrid.appendChild(posCard);
        }
    });
});

window.toggleStock = async function(id, status) {
    await updateDoc(doc(db, "menu", id), { isAvailable: status });
};

// ==========================================================================
// 3. POS / MANUAL ENTRY SYSTEM & PRINT
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
        list.innerHTML = '<p class="text-muted text-center mt-4">Cart is empty</p>';
        if (grandTotalEl) grandTotalEl.innerText = '₹0';
        return;
    }

    cartKeys.forEach(id => {
        const item = posCart[id];
        total += item.price * item.qty;
        list.innerHTML += `
            <div class="d-flex-between" style="border-bottom:1px solid #E2E8F0; padding:10px 0;">
                <div>
                    <div style="font-size:14px; font-weight:500;">${item.name}</div>
                    <div style="font-size:13px; color:#64748B;">₹${item.price}</div>
                </div>
                <div class="input-group-inline">
                    <button class="btn-secondary btn-sm" onclick="updatePosCart('${id}', -1)">-</button>
                    <span style="width:20px; text-align:center;">${item.qty}</span>
                    <button class="btn-secondary btn-sm" onclick="updatePosCart('${id}', 1)">+</button>
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

        const orderData = {
            orderId: orderId,
            tableNo: tableNo,
            customerName: "Counter / Parcel",
            customerPhone: "N/A",
            items: itemsArray,
            instructions: "Manual Admin Entry",
            subtotal: subtotal,
            tax: 0,
            totalAmount: subtotal,
            status: 'pending',
            paymentStatus: 'paid', // POS is paid instantly, will show in Report
            timestamp: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "orders", orderId), orderData);
            alert("Order sent to Kitchen!");
            
            lastPosOrderData = orderData;
            if (btnPosPrint) btnPosPrint.classList.remove('hidden');

            posCart = {};
            renderPosCart();
        } catch (error) {
            console.error("Order Failed: ", error);
            alert("Order failed!");
        } finally {
            btnPosCheckout.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kitchen';
            btnPosCheckout.disabled = false;
        }
    });
}

// 🔥 FIX 1: POS PRINT SYSTEM UPDATE
if(btnPosPrint) {
    btnPosPrint.addEventListener('click', () => {
        if(!lastPosOrderData) return alert("No recent order to print!");

        let itemsHtml = '';
        lastPosOrderData.items.forEach(i => {
            itemsHtml += `<tr><td style="padding:4px 0;">${i.name}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">₹${i.qty * i.price}</td></tr>`;
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        
        if(!printWindow) {
            alert("⚠️ Pop-up blocked! Please allow pop-ups for this site in your browser settings to print bills.");
            return;
        }

        printWindow.document.write(`
            <html>
            <head><title>POS Bill - ${lastPosOrderData.orderId}</title></head>
            <body style="font-family: monospace; padding: 20px; width: 80mm; margin: 0 auto; color: black; background: white;">
                <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <h2 style="margin: 0; font-size: 18px;">Indian Food Forest</h2>
                    <p style="margin: 5px 0; font-size: 12px; line-height:1.2;">Shop no 50, Digha, Thane<br>Phone: 8286468504<br>FSSAI: 21526068003444</p>
                </div>
                <div style="display:flex; justify-content:space-between; font-size: 12px; margin-bottom:10px;">
                    <div>Date: ${new Date(lastPosOrderData.timestamp).toLocaleDateString()}<br>Table: ${lastPosOrderData.tableNo}</div>
                    <div style="text-align:right;">Time: ${new Date(lastPosOrderData.timestamp).toLocaleTimeString()}<br>Order: ${lastPosOrderData.orderId}</div>
                </div>
                <div style="border-bottom: 1px dashed #000;"></div>
                <table style="width: 100%; font-size: 13px; margin: 10px 0; border-collapse: collapse;">
                    <tr><th style="text-align:left; padding-bottom:5px;">Item</th><th>Qty</th><th style="text-align:right;">Amt</th></tr>
                    ${itemsHtml}
                </table>
                <div style="border-bottom: 1px dashed #000;"></div>
                <div style="display:flex; justify-content:space-between; font-size: 16px; font-weight:bold; margin-top:10px;">
                    <span>GRAND TOTAL</span>
                    <span>₹${lastPosOrderData.totalAmount}</span>
                </div>
                <p style="text-align:center; font-size:11px; margin-top:20px;">Thank You! Visit Again.</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => { 
            printWindow.print(); 
        }, 500);

        printWindow.onafterprint = function() {
            printWindow.close();
        };
        
        btnPosPrint.classList.add('hidden');
    });
}

// ==========================================================================
// 4. LIVE FLOOR GRID
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
                        
                        if (ordData.paymentStatus === 'unpaid') {
                            cardClass = 'pending'; 
                            detailsHtml = `
                                <p class="cust-name">${ordData.customerName || 'Guest'} <span class="text-sm text-muted">(#${ordData.orderId})</span></p>
                                <p class="bill-amt">₹${ordData.totalAmount}</p>
                                <span class="status-badge ${ordData.status === 'completed' ? 'paid' : 'preparing'}">${ordData.status.toUpperCase()}</span>
                            `;
                            actionHtml = `
                                <button class="btn-outline-primary btn-sm w-100 mb-2" onclick="printOrderBill('${ordData.orderId}')">
                                    <i class="fa-solid fa-print"></i> Print Bill
                                </button>
                                <button class="btn-success btn-sm w-100" onclick="approvePayment('${ordData.orderId}', '${table.id}')">
                                    <i class="fa-solid fa-check"></i> Mark Paid & Clear
                                </button>
                            `;
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
}

window.approvePayment = async function(orderId, tableId) {
    if (confirm(`Approve payment for Order #${orderId} and free Table ${tableId}?`)) {
        await updateDoc(doc(db, "orders", orderId), { paymentStatus: 'paid' });
        const newToken = Math.random().toString(36).substring(2, 10);
        await updateDoc(doc(db, "tables", tableId), { status: 'free', activeOrderId: null, secret: newToken });
    }
};

// 🔥 FIX 2: TABLE GRID PRINT SYSTEM UPDATE
window.printOrderBill = async function(orderId) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if(!printWindow) {
        alert("⚠️ Pop-up blocked! Please allow pop-ups for this site.");
        return;
    }
    
    printWindow.document.write('<h3 style="font-family:sans-serif; text-align:center; margin-top:50px;">Fetching Bill Data... Please Wait.</h3>');

    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            printWindow.close();
            return alert("Order not found!");
        }
        const data = orderSnap.data();

        let itemsHtml = '';
        data.items.forEach(i => {
            itemsHtml += `<tr><td style="padding:4px 0;">${i.name}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">₹${i.qty * i.price}</td></tr>`;
        });

        printWindow.document.open();
        printWindow.document.write(`
            <html>
            <head><title>Bill - ${data.orderId}</title></head>
            <body style="font-family: monospace; padding: 20px; width: 80mm; margin: 0 auto; color: black; background: white;">
                <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <h2 style="margin: 0; font-size: 18px;">Indian Food Forest</h2>
                    <p style="margin: 5px 0; font-size: 12px; line-height:1.2;">Shop no 50, Digha, Thane<br>Phone: 8286468504<br>FSSAI: 21526068003444</p>
                </div>
                <div style="display:flex; justify-content:space-between; font-size: 12px; margin-bottom:10px;">
                    <div>Date: ${new Date(data.timestamp).toLocaleDateString()}<br>Table: ${data.tableNo}</div>
                    <div style="text-align:right;">Time: ${new Date(data.timestamp).toLocaleTimeString()}<br>Order: ${data.orderId}</div>
                </div>
                <div style="border-bottom: 1px dashed #000;"></div>
                <table style="width: 100%; font-size: 13px; margin: 10px 0; border-collapse: collapse;">
                    <tr><th style="text-align:left; padding-bottom:5px;">Item</th><th>Qty</th><th style="text-align:right;">Amt</th></tr>
                    ${itemsHtml}
                </table>
                <div style="border-bottom: 1px dashed #000;"></div>
                <div style="display:flex; justify-content:space-between; font-size: 16px; font-weight:bold; margin-top:10px;">
                    <span>GRAND TOTAL</span>
                    <span>₹${data.totalAmount}</span>
                </div>
                <p style="text-align:center; font-size:11px; margin-top:20px;">Thank You! Visit Again.</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => { 
            printWindow.print(); 
        }, 500);

        printWindow.onafterprint = function() {
            printWindow.close();
        };

    } catch (error) {
        console.error("Print Error: ", error);
        printWindow.close();
        alert("Failed to load bill for printing.");
    }
};

// ==========================================================================
// 5. BULK SECURE QR GENERATOR
// ==========================================================================
const btnGenerateQrs = document.getElementById('btn-generate-qrs');
const btnPrintQrs = document.getElementById('btn-print-qrs');

if (btnGenerateQrs) {
    btnGenerateQrs.addEventListener('click', async () => {
        const countInput = document.getElementById('qr-table-count');
        const count = countInput ? Number(countInput.value) : 15;
        const qrGrid = document.getElementById('qr-display-grid');
        const actionsBox = document.getElementById('qr-actions-box');
        
        if (qrGrid) qrGrid.innerHTML = ''; 
        const baseUrl = "https://order.indianfoodforest.com/";

        for (let i = 1; i <= count; i++) {
            const secretToken = Math.random().toString(36).substring(2, 10);
            const tableId = i.toString();

            await setDoc(doc(db, "tables", tableId), {
                status: 'free', secret: secretToken, activeOrderId: null, waterRequest: false
            }, { merge: true });

            const scanUrl = `${baseUrl}index.html?table=${tableId}&secret=${secretToken}`;

            if (qrGrid) {
                const card = document.createElement('div');
                card.className = 'qr-card';
                card.innerHTML = `<h4>Table ${tableId}</h4><div id="qr-box-${tableId}" class="mt-2 mx-auto" style="width: 128px;"></div><p class="text-sm text-muted mt-2">Indian Food Forest</p>`;
                qrGrid.appendChild(card);

                new QRCode(document.getElementById(`qr-box-${tableId}`), {
                    text: scanUrl, width: 128, height: 128, colorDark : "#0F172A", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
                });
            }
        }
        if (actionsBox) actionsBox.classList.remove('hidden');
        alert(`${count} Secure QR Codes generated with custom domain and saved!`);
    });
}

if (btnPrintQrs) {
    btnPrintQrs.addEventListener('click', () => window.print());
}
