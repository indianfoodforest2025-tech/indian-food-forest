// ==========================================================================
// CUSTOMER APP LOGIC (Menu Rendering, Smart Cart, Order Push & Live Status)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getSession, getCustomerDetails } from "./auth.js";

// ==========================================================================
// 0. SECURITY & INITIALIZATION
// ==========================================================================
const session = getSession();
const isMenuPage = window.location.pathname.includes('menu.html');
const isStatusPage = window.location.pathname.includes('status.html');

// Agar session nahi hai aur user menu ya status page par hai, toh usko bahar feko
if (!session && (isMenuPage || isStatusPage)) {
    window.location.href = "index.html";
}

let cart = {}; 
let menuData = [];

// ==========================================================================
// 1. MENU PAGE LOGIC
// ==========================================================================
if (isMenuPage) {
    const skeletonLoader = document.getElementById('menu-skeleton-loader');
    const menuContainer = document.getElementById('menu-items-container');
    const cartBar = document.getElementById('floating-cart-bar');
    const cartModal = document.getElementById('cart-review-modal');
    const toast = document.getElementById('toast-notification');
    
    // Set Table Number in Header
    document.getElementById('nav-table-no').innerText = session.tableNo;

    // Fetch Menu from Firebase
    async function loadMenu() {
        try {
            const querySnapshot = await getDocs(collection(db, "menu"));
            menuData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Hide skeleton, show actual menu
            skeletonLoader.classList.add('hidden');
            menuContainer.classList.remove('hidden');
            renderMenu(menuData);
        } catch (error) {
            console.error("Error loading menu: ", error);
            showToast("Failed to load menu. Please refresh.");
        }
    }

    // Render Menu Cards
    function renderMenu(items) {
        menuContainer.innerHTML = '';
        
        items.forEach(item => {
            if(item.isAvailable === false) return; // Hide Out of Stock items
            
            const imgUrl = item.imageUrl ? item.imageUrl : 'https://placehold.co/120x120/e2e8f0/64748b?text=Food';
            const vegClass = item.type === 'veg' ? 'veg' : 'non-veg';
            const qtyInCart = cart[item.id] ? cart[item.id].qty : 0;

            const card = document.createElement('div');
            card.className = 'dish-card';
            card.style.cssText = "display: flex; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #E2E8F0; padding: 12px; gap: 15px;";
            
            card.innerHTML = `
                <div class="dish-img-box" style="width: 110px; height: 110px; position: relative; border-radius: 12px; overflow: hidden; flex-shrink: 0;">
                    <img src="${imgUrl}" alt="${item.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
                    <span class="veg-badge ${vegClass}" style="position: absolute; top: 8px; right: 8px; left: auto; background: white; padding: 2px; border-radius: 4px;"></span>
                </div>
                <div class="dish-info" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <h3 class="dish-title" style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px 0; line-height: 1.2;">${item.name}</h3>
                    <p class="dish-desc" style="font-size: 12px; color: #64748B; margin: 0 0 10px 0;">${item.category.toUpperCase()}</p>
                    
                    <div class="dish-action-row" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="dish-price" style="font-weight: 700; font-size: 16px; color: #0F172A;">₹${item.price}</span>
                        
                        ${qtyInCart > 0 
                            ? `<div class="qty-controller" style="display: flex; align-items: center; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
                                 <button class="btn-qty minus" data-id="${item.id}" style="padding: 6px 12px; color: #0F172A; font-weight: bold; background: white; border: none;">-</button>
                                 <span class="qty-val" style="width: 24px; text-align: center; font-size: 14px; font-weight: 600; color: #2563EB;">${qtyInCart}</span>
                                 <button class="btn-qty plus" data-id="${item.id}" style="padding: 6px 12px; color: #0F172A; font-weight: bold; background: white; border: none;">+</button>
                               </div>`
                            : `<button class="btn-add-initial" data-id="${item.id}" style="padding: 6px 18px; border: 1px solid #2563EB; color: #2563EB; border-radius: 8px; font-weight: 600; font-size: 13px; background: #EFF6FF;">ADD +</button>`
                        }
                    </div>
                </div>
            `;
            menuContainer.appendChild(card);
        });
        attachCartListeners();
    }

    // Attach Click Events for Add/Remove Buttons
    function attachCartListeners() {
        document.querySelectorAll('.btn-add-initial, .plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                updateCart(id, 1);
                showToast("Item added!");
            });
        });
        document.querySelectorAll('.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                updateCart(id, -1);
            });
        });
    }

    // Cart Logic & Math
    function updateCart(id, change) {
        const item = menuData.find(i => i.id === id);
        if (!cart[id]) {
            cart[id] = { ...item, qty: 0 };
        }
        cart[id].qty += change;
        if (cart[id].qty <= 0) delete cart[id];
        
        renderMenu(menuData); // Re-render to update buttons
        updateCartFloatingBar();
    }

    // Update Floating Pill Bar
    function updateCartFloatingBar() {
        let totalItems = 0;
        let totalPrice = 0;
        
        Object.values(cart).forEach(item => {
            totalItems += item.qty;
            totalPrice += item.qty * Number(item.price);
        });

        if (totalItems > 0) {
            cartBar.classList.remove('hidden');
            document.getElementById('cart-item-count').innerText = `${totalItems} ITEM${totalItems > 1 ? 'S' : ''}`;
            document.getElementById('cart-total-price').innerText = `₹${totalPrice}`;
        } else {
            cartBar.classList.add('hidden');
            cartModal.classList.add('hidden');
        }
    }

    // Open Cart Modal Event
    const viewCartBtn = document.getElementById('btn-view-cart');
    if (viewCartBtn) {
        viewCartBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            openCartModal();
        });
    }
    if (cartBar) {
        cartBar.addEventListener('click', () => {
            openCartModal();
        });
    }

    // Render Cart Modal Data
    function openCartModal() {
        if (!cart || Object.keys(cart).length === 0) return;

        const cartList = document.getElementById('cart-items-list');
        cartList.innerHTML = '';
        let subtotal = 0;

        Object.values(cart).forEach(item => {
            const itemTotal = item.qty * item.price;
            subtotal += itemTotal;
            cartList.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #E2E8F0;">
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: #0F172A;"><span style="color: #64748B; font-weight: 500;">${item.qty}x</span> ${item.name}</div>
                        <div style="font-size: 12px; color: #94A3B8; margin-top: 2px;">₹${item.price} each</div>
                    </div>
                    <strong style="font-size: 15px; color: #0F172A;">₹${itemTotal}</strong>
                </li>
            `;
        });

        document.getElementById('bill-grand-total').innerText = `₹${subtotal}`;
        cartModal.classList.remove('hidden');
    }

    // Close Cart Modal
    document.getElementById('btn-close-cart').addEventListener('click', (e) => {
        e.stopPropagation();
        cartModal.classList.add('hidden');
    });

    // Filter Logic (Veg / Non-Veg / Categories)
    document.getElementById('veg-only-toggle').addEventListener('change', (e) => {
        const isVegOnly = e.target.checked;
        if (isVegOnly) {
            renderMenu(menuData.filter(i => i.type === 'veg'));
        } else {
            renderMenu(menuData);
        }
    });

    document.querySelectorAll('.category-item').forEach(catBtn => {
        catBtn.addEventListener('click', (e) => {
            // Remove active class from all
            document.querySelectorAll('.category-item').forEach(b => {
                b.style.background = 'white';
                b.style.color = '#475569';
                b.style.borderColor = '#CBD5E1';
            });
            // Add active to clicked
            const btn = e.target;
            btn.style.background = '#0F172A';
            btn.style.color = 'white';
            btn.style.borderColor = '#0F172A';
            
            const category = btn.getAttribute('data-category');
            if(category === 'all') renderMenu(menuData);
            else renderMenu(menuData.filter(i => i.category === category));
        });
    });

    // ==========================================================================
    // PLACE ORDER TO FIREBASE (KDS & Admin Sync)
    // ==========================================================================
    document.getElementById('btn-place-order').addEventListener('click', async () => {
        if (!cart || Object.keys(cart).length === 0) {
            showToast("Cart is empty!");
            return;
        }

        const btn = document.getElementById('btn-place-order');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;

        const customer = getCustomerDetails();
        const instructions = document.getElementById('cooking-instructions').value;
        const orderId = 'ORD' + Date.now().toString().slice(-6);

        let subtotal = 0;
        const itemsArray = Object.values(cart).map(i => {
            subtotal += (i.qty * i.price);
            return { id: i.id, name: i.name, qty: i.qty, price: i.price };
        });

        // 🔥 CRITICAL FIX: Push order as 'pending' and 'unpaid' so Kitchen sees it instantly
        const orderData = {
            orderId: orderId,
            tableNo: session.tableNo,
            customerName: customer.name || 'Guest',
            customerPhone: customer.phone || 'N/A',
            items: itemsArray,
            instructions: instructions,
            subtotal: subtotal,
            tax: 0,
            totalAmount: subtotal,
            status: 'pending',       // Triggers KDS Audio & Grid
            paymentStatus: 'unpaid', // Triggers Admin Red Table
            timestamp: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "orders", orderId), orderData);
            await updateDoc(doc(db, "tables", session.tableNo.toString()), {
                activeOrderId: orderId,
                status: 'occupied'
            });
            
            // Redirect to live status page
            window.location.href = `status.html?order=${orderId}`;
        } catch (error) {
            console.error("Order Failed: ", error);
            btn.innerHTML = 'Place Order Failed';
            btn.disabled = false;
        }
    });

    // Premium Toast Notification Function
    function showToast(msg) {
        toast.querySelector('#toast-msg').innerText = msg;
        toast.classList.remove('hidden');
        toast.style.bottom = '100px'; 
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }

    // Fetch initial menu
    loadMenu();
}

// ==========================================================================
// 2. LIVE STATUS PAGE LOGIC (Real-time Timeline)
// ==========================================================================
if (isStatusPage) {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');

    if (!orderId) window.location.href = "menu.html";
    
    document.getElementById('status-table-no').innerText = session.tableNo;
    document.getElementById('display-order-id').innerText = `#${orderId}`;

    const orderRef = doc(db, "orders", orderId);

    // Live listener for Kitchen/Admin Updates
    onSnapshot(orderRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            updateTimeline(data.status);
            updateThermalReceipt(data);
            
            const paymentBadge = document.getElementById('payment-status-badge');
            const pdfBtn = document.getElementById('btn-download-pdf');
            const gmbSection = document.getElementById('gmb-review-section');

            if (data.paymentStatus === 'paid') {
                paymentBadge.style.background = '#DCFCE7';
                paymentBadge.style.color = '#15803D';
                paymentBadge.style.borderColor = '#15803D';
                paymentBadge.innerText = 'PAID IN FULL';
                
                pdfBtn.classList.remove('hidden');
                gmbSection.classList.remove('hidden');

                // Block back button so they can't go back to menu after paying
                history.pushState(null, null, location.href);
                window.onpopstate = function () {
                    history.go(1);
                };
            } else {
                paymentBadge.style.background = '#FEF3C7';
                paymentBadge.style.color = '#D97706';
                paymentBadge.style.borderColor = '#D97706';
                paymentBadge.innerText = 'PAYMENT PENDING';
                
                pdfBtn.classList.add('hidden');
                gmbSection.classList.add('hidden');
            }
        }
    });

    function updateTimeline(status) {
        document.querySelectorAll('.timeline-step').forEach(el => el.classList.remove('active'));
        document.getElementById('step-pending').classList.add('active');
        
        if (status === 'preparing' || status === 'completed') {
            document.getElementById('step-preparing').classList.add('active');
        }
        if (status === 'completed') {
            document.getElementById('step-completed').classList.add('active');
        }
    }

    function updateThermalReceipt(data) {
        document.getElementById('display-order-total').innerText = `₹${data.totalAmount}`;
        
        const dateObj = new Date(data.timestamp);
        document.getElementById('receipt-date').innerText = dateObj.toLocaleDateString();
        document.getElementById('receipt-time').innerText = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('receipt-table').innerText = data.tableNo;
        document.getElementById('receipt-order-id').innerText = data.orderId;

        const itemList = document.getElementById('receipt-items-list');
        itemList.innerHTML = '';
        data.items.forEach(item => {
            itemList.innerHTML += `
                <tr>
                    <td class="text-left" style="padding: 6px 0;">${item.name}</td>
                    <td class="text-center" style="padding: 6px 0;">${item.qty}</td>
                    <td class="text-right" style="padding: 6px 0;">${item.qty * item.price}</td>
                </tr>
            `;
        });

        document.getElementById('receipt-subtotal').innerText = `₹${data.subtotal}`;
        document.getElementById('receipt-grand-total').innerText = `₹${data.totalAmount}`;
    }

    // PDF Download for Customer (HTML2PDF)
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    if(btnDownloadPdf){
        btnDownloadPdf.addEventListener('click', () => {
            const element = document.getElementById('invoice-receipt');
            const opt = {
                margin: 0.2,
                filename: `${orderId}_Bill.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'in', format: [3.5, 6], orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }
}
