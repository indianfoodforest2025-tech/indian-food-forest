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
    
    document.getElementById('nav-table-no').innerText = session.tableNo;

    async function loadMenu() {
        try {
            const querySnapshot = await getDocs(collection(db, "menu"));
            menuData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            skeletonLoader.classList.add('hidden');
            menuContainer.classList.remove('hidden');
            renderMenu(menuData);
        } catch (error) {
            console.error("Error loading menu: ", error);
            showToast("Failed to load menu. Please refresh.");
        }
    }

    // Render Menu Cards with Flexible Category & Veg Filtering Support
    function renderMenu(items) {
        menuContainer.innerHTML = '';
        
        if (items.length === 0) {
            menuContainer.innerHTML = '<p class="text-center text-muted mt-4" style="font-size:13px;">No items found in this category.</p>';
            return;
        }

        items.forEach(item => {
            if(item.isAvailable === false) return; 
            
            const imgHtml = (item.imageUrl && item.imageUrl.trim() !== "") 
                ? `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">` 
                : `<div style="width: 100%; height: 100%; background: #F1F5F9; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748B; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-utensils mb-1" style="font-size: 16px;"></i> Food</div>`;

            const vegClass = item.type === 'veg' ? 'veg' : 'non-veg';
            const qtyInCart = cart[item.id] ? cart[item.id].qty : 0;

            const card = document.createElement('div');
            card.className = 'dish-card';
            card.style.cssText = "display: flex; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid #E2E8F0; padding: 10px; gap: 12px;";
            
            card.innerHTML = `
                <div class="dish-img-box" style="width: 90px; height: 90px; position: relative; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                    ${imgHtml}
                    <span class="veg-badge ${vegClass}" style="position: absolute; top: 6px; right: 6px; left: auto; background: white; padding: 2px; border-radius: 3px;"></span>
                </div>
                <div class="dish-info" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <h3 class="dish-title" style="font-size: 14px; font-weight: 600; color: #0F172A; margin: 0 0 2px 0;">${item.name}</h3>
                    <p class="dish-desc" style="font-size: 11px; color: #64748B; margin: 0 0 8px 0; text-transform: uppercase;">${item.category}</p>
                    
                    <div class="dish-action-row" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="dish-price" style="font-weight: 700; font-size: 15px; color: #0F172A;">₹${item.price}</span>
                        
                        ${qtyInCart > 0 
                            ? `<div class="qty-controller" style="display: flex; align-items: center; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden;">
                                 <button class="btn-qty minus" data-id="${item.id}" style="padding: 4px 10px; color: #0F172A; font-weight: bold; background: white; border: none;">-</button>
                                 <span class="qty-val" style="width: 20px; text-align: center; font-size: 13px; font-weight: 600; color: #2563EB;">${qtyInCart}</span>
                                 <button class="btn-qty plus" data-id="${item.id}" style="padding: 4px 10px; color: #0F172A; font-weight: bold; background: white; border: none;">+</button>
                               </div>`
                            : `<button class="btn-add-initial" data-id="${item.id}" style="padding: 4px 14px; border: 1px solid #2563EB; color: #2563EB; border-radius: 6px; font-weight: 600; font-size: 12px; background: #EFF6FF;">ADD +</button>`
                        }
                    </div>
                </div>
            `;
            menuContainer.appendChild(card);
        });
        attachCartListeners();
    }

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

    function updateCart(id, change) {
        const item = menuData.find(i => i.id === id);
        if (!cart[id]) {
            cart[id] = { ...item, qty: 0 };
        }
        cart[id].qty += change;
        if (cart[id].qty <= 0) delete cart[id];
        
        applyFiltersAndRender();
        updateCartFloatingBar();
    }

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

    function openCartModal() {
        if (!cart || Object.keys(cart).length === 0) return;

        const cartList = document.getElementById('cart-items-list');
        cartList.innerHTML = '';
        let subtotal = 0;

        Object.values(cart).forEach(item => {
            const itemTotal = item.qty * item.price;
            subtotal += itemTotal;
            cartList.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #E2E8F0;">
                    <div>
                        <div style="font-size: 13px; font-weight: 600; color: #0F172A;"><span style="color: #64748B; font-weight: 500;">${item.qty}x</span> ${item.name}</div>
                        <div style="font-size: 11px; color: #94A3B8;">₹${item.price} each</div>
                    </div>
                    <strong style="font-size: 14px; color: #0F172A;">₹${itemTotal}</strong>
                </li>
            `;
        });

        document.getElementById('bill-grand-total').innerText = `₹${subtotal}`;
        cartModal.classList.remove('hidden');
    }

    document.getElementById('btn-close-cart').addEventListener('click', (e) => {
        e.stopPropagation();
        cartModal.classList.add('hidden');
    });

    // Robust Category Matching Logic for Customer Menu Tabs
    function applyFiltersAndRender() {
        let filtered = [...menuData];
        
        const activeCatBtn = document.querySelector('.category-item.active') || document.querySelector('.category-item[style*="background: rgb(15, 23, 42)"]');
        const currentCategory = activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'all';

        if (currentCategory && currentCategory !== 'all') {
            filtered = filtered.filter(i => {
                const itemCat = (i.category || '').toLowerCase().trim();
                const targetCat = currentCategory.toLowerCase().trim();
                
                if (targetCat === 'soups') return itemCat.includes('soup');
                if (targetCat === 'starters') return itemCat.includes('starter') || itemCat.includes('kabab') || itemCat.includes('tandoori');
                if (targetCat === 'main-course') return itemCat.includes('main') || itemCat.includes('gravy') || itemCat.includes('dal') || itemCat.includes('paneer') || (itemCat.includes('chicken') && !itemCat.includes('rice') && !itemCat.includes('noodles'));
                if (targetCat === 'beverages') return itemCat.includes('beverage') || itemCat.includes('rice') || itemCat.includes('noodle');
                if (targetCat === 'desserts') return itemCat.includes('dessert') || itemCat.includes('thali');
                
                return itemCat === targetCat;
            });
        }

        const isVegOnly = document.getElementById('veg-only-toggle').checked;
        if (isVegOnly) {
            filtered = filtered.filter(i => i.type === 'veg');
        }

        renderMenu(filtered);
    }

    document.getElementById('veg-only-toggle').addEventListener('change', () => {
        applyFiltersAndRender();
    });

    document.querySelectorAll('.category-item').forEach(catBtn => {
        catBtn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-item').forEach(b => {
                b.style.background = 'white';
                b.style.color = '#475569';
                b.style.borderColor = '#CBD5E1';
                b.classList.remove('active');
            });
            const btn = e.target;
            btn.style.background = '#0F172A';
            btn.style.color = 'white';
            btn.style.borderColor = '#0F172A';
            btn.classList.add('active');
            
            applyFiltersAndRender();
        });
    });

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
            status: 'pending',
            paymentStatus: 'unpaid',
            timestamp: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "orders", orderId), orderData);
            await updateDoc(doc(db, "tables", session.tableNo.toString()), {
                activeOrderId: orderId,
                status: 'occupied'
            });
            
            window.location.href = `status.html?order=${orderId}`;
        } catch (error) {
            console.error("Order Failed: ", error);
            btn.innerHTML = 'Place Order Failed';
            btn.disabled = false;
        }
    });

    function showToast(msg) {
        toast.querySelector('#toast-msg').innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }

    loadMenu();
}

// ==========================================================================
// 2. LIVE STATUS PAGE LOGIC (PDF Download Fix)
// ==========================================================================
if (isStatusPage) {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');

    if (!orderId) window.location.href = "menu.html";
    
    document.getElementById('status-table-no').innerText = session.tableNo;
    document.getElementById('display-order-id').innerText = `#${orderId}`;

    const orderRef = doc(db, "orders", orderId);

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

                history.pushState(null, null, location.href);
                window.onpopstate = function () { history.go(1); };
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
        if (status === 'preparing' || status === 'completed') document.getElementById('step-preparing').classList.add('active');
        if (status === 'completed') document.getElementById('step-completed').classList.add('active');
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
                    <td class="text-left" style="padding: 4px 0;">${item.name}</td>
                    <td class="text-center" style="padding: 4px 0;">${item.qty}</td>
                    <td class="text-right" style="padding: 4px 0;">${item.qty * item.price}</td>
                </tr>
            `;
        });

        document.getElementById('receipt-subtotal').innerText = `₹${data.subtotal}`;
        document.getElementById('receipt-grand-total').innerText = `₹${data.totalAmount}`;
    }

    // Completely Fixed PDF Download (No Blank Page Issue)
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    if(btnDownloadPdf){
        btnDownloadPdf.addEventListener('click', () => {
            const element = document.getElementById('invoice-receipt');
            if (!element) return alert("Receipt not found!");

            const opt = {
                margin: 0.2,
                filename: `${orderId}_Bill.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true }, 
                jsPDF: { unit: 'in', format: [3.5, 6], orientation: 'portrait' }
            };

            setTimeout(() => {
                html2pdf().from(element).set(opt).save().catch(err => {
                    console.error("PDF generation failed:", err);
                    window.print();
                });
            }, 500);
        });
    }
}
