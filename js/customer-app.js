// ==========================================================================
// CUSTOMER APP LOGIC (Menu, Cart, Order Push & Live Status)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getSession, getCustomerDetails } from "./auth.js";

const session = getSession();
if (!session && !window.location.pathname.includes('index.html')) {
    window.location.href = "index.html";
}

let cart = {}; 
let menuData = [];

const isMenuPage = window.location.pathname.includes('menu.html');
const isStatusPage = window.location.pathname.includes('status.html');

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
        }
    }

    function renderMenu(items) {
        menuContainer.innerHTML = '';
        items.forEach(item => {
            if(item.isAvailable === false) return; 
            const imgUrl = item.imageUrl ? item.imageUrl : 'https://placehold.co/120x120/e2e8f0/64748b?text=Food';
            const vegClass = item.type === 'veg' ? 'veg' : 'non-veg';
            const qtyInCart = cart[item.id] ? cart[item.id].qty : 0;

            const card = document.createElement('div');
            card.className = 'dish-card';
            card.innerHTML = `
                <div class="dish-img-box">
                    <img src="${imgUrl}" alt="${item.name}" loading="lazy">
                    <span class="veg-badge ${vegClass}"></span>
                </div>
                <div class="dish-info">
                    <h3 class="dish-title">${item.name}</h3>
                    <p class="dish-desc">${item.category.toUpperCase()}</p>
                    <div class="dish-action-row">
                        <span class="dish-price">₹${item.price}</span>
                        ${qtyInCart > 0 
                            ? `<div class="qty-controller">
                                 <button class="btn-qty minus" data-id="${item.id}">-</button>
                                 <span class="qty-val">${qtyInCart}</span>
                                 <button class="btn-qty plus" data-id="${item.id}">+</button>
                               </div>`
                            : `<button class="btn-add-initial" data-id="${item.id}">ADD +</button>`
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
                showToast("Item added to cart!");
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
        renderMenu(menuData);
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

    document.getElementById('btn-view-cart').addEventListener('click', () => {
        const cartList = document.getElementById('cart-items-list');
        cartList.innerHTML = '';
        let subtotal = 0;

        Object.values(cart).forEach(item => {
            const itemTotal = item.qty * item.price;
            subtotal += itemTotal;
            cartList.innerHTML += `
                <div class="cart-item-row">
                    <div>
                        <div class="ci-name">${item.name} x ${item.qty}</div>
                        <div class="ci-price">₹${item.price} each</div>
                    </div>
                    <strong>₹${itemTotal}</strong>
                </div>
            `;
        });

        const tax = 0;
        const grandTotal = subtotal + tax;

        document.getElementById('bill-subtotal').innerText = `₹${subtotal}`;
        document.getElementById('bill-grand-total').innerText = `₹${grandTotal}`;
        cartModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-cart').addEventListener('click', () => {
        cartModal.classList.add('hidden');
    });

    document.getElementById('veg-only-toggle').addEventListener('change', (e) => {
        const isVegOnly = e.target.checked;
        if (isVegOnly) {
            renderMenu(menuData.filter(i => i.type === 'veg'));
        } else {
            renderMenu(menuData);
        }
    });

    document.getElementById('btn-place-order').addEventListener('click', async () => {
        const btn = document.getElementById('btn-place-order');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending to Kitchen...';
        btn.disabled = true;

        const customer = getCustomerDetails();
        const instructions = document.getElementById('cooking-instructions').value;
        const orderId = 'ORD' + Date.now().toString().slice(-6);

        let subtotal = 0;
        const itemsArray = Object.values(cart).map(i => {
            subtotal += (i.qty * i.price);
            return { id: i.id, name: i.name, qty: i.qty, price: i.price };
        });
        const tax = 0;
        const grandTotal = subtotal + tax;

        const orderData = {
            orderId: orderId,
            tableNo: session.tableNo,
            customerName: customer.name || 'Guest',
            customerPhone: customer.phone || 'N/A',
            items: itemsArray,
            instructions: instructions,
            subtotal: subtotal,
            tax: tax,
            totalAmount: grandTotal,
            status: 'pending',
            paymentStatus: 'unpaid',
            timestamp: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "orders", orderId), orderData);
            await updateDoc(doc(db, "tables", session.tableNo.toString()), {
                activeOrderId: orderId
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
                paymentBadge.className = 'status-badge paid';
                paymentBadge.innerText = 'PAID IN FULL';
                pdfBtn.classList.remove('hidden');
                gmbSection.classList.remove('hidden');

                // FIX: Prevent going back to menu loop once paid
                history.pushState(null, null, location.href);
                window.onpopstate = function () {
                    history.go(1);
                };
            } else {
                paymentBadge.className = 'status-badge pending';
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
                    <td class="text-left">${item.name}</td>
                    <td class="text-center">${item.qty}</td>
                    <td class="text-right">${item.qty * item.price}</td>
                </tr>
            `;
        });

        document.getElementById('receipt-subtotal').innerText = `₹${data.subtotal}`;
        document.getElementById('receipt-grand-total').innerText = `₹${data.totalAmount}`;
    }

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        const element = document.getElementById('invoice-receipt');
        
        // FIX: Added useCORS and scrollY: 0 to prevent blank white PDF rendering
        const opt = {
            margin: 0,
            filename: `${orderId}_Bill.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, 
            jsPDF: { unit: 'in', format: [3.15, 6], orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save();
    });
}
