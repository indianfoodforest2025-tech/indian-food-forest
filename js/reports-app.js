// ==========================================================================
// SALES REPORTS, ANALYTICS & EXPENSE TRACKER (Safe Version)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const datePicker = document.getElementById('report-date-picker');
const btnFetch = document.getElementById('btn-fetch-report');
const btnExportCSV = document.getElementById('btn-export-csv');

const statRevenue = document.getElementById('stat-revenue');
const statExpense = document.getElementById('stat-expense');
const statProfit = document.getElementById('stat-profit');
const statOrders = document.getElementById('stat-orders');
const statTopItem = document.getElementById('stat-top-item');

const expenseDesc = document.getElementById('expense-desc');
const expenseAmount = document.getElementById('expense-amount');
const btnAddExpense = document.getElementById('btn-add-expense');
const expenseListContainer = document.getElementById('expense-list-container');

let salesChartInstance = null;
let currentReportData = []; 

// Set Today's Date by Default
const today = new Date().toISOString().split('T')[0]; 
if (datePicker) {
    datePicker.value = today;
}

// ==========================================================================
// 1. FETCH & PROCESS DATA (Revenue + Expenses)
// ==========================================================================
window.loadReport = async function() {
    const targetDate = datePicker ? datePicker.value : today;
    if (!targetDate) return;

    try {
        if (btnFetch) {
            btnFetch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            btnFetch.disabled = true;
        }
        
        // --- A. FETCH ORDERS (SAFE METHOD) ---
        const orderSnapshot = await getDocs(collection(db, "orders"));
        const allPaidOrders = [];
        
        orderSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Sirf wahi orders jinka paisa aa chuka hai (paid)
            if (data.paymentStatus === 'paid') {
                allPaidOrders.push({ id: docSnap.id, ...data });
            }
        });

        // Filter by Date (Checking timestamp safely)
        currentReportData = allPaidOrders.filter(order => {
            return order.timestamp && typeof order.timestamp === 'string' && order.timestamp.startsWith(targetDate);
        });

        // --- B. FETCH EXPENSES (SAFE METHOD) ---
        const expSnapshot = await getDocs(collection(db, "expenses"));
        let totalExpense = 0;
        let expenseHtml = '';
        
        expSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.date === targetDate) {
                totalExpense += Number(data.amount || 0);
                expenseHtml += `
                    <div style="display:flex; justify-content:space-between; padding: 10px; border-bottom: 1px dashed #CBD5E1; align-items: center;">
                        <span style="font-size: 14px; color: #0F172A; font-weight: 500;">${data.desc}</span>
                        <strong style="color: #DC2626; font-size: 15px;">₹${data.amount}</strong>
                    </div>`;
            }
        });

        // --- C. CALCULATE STATS ---
        calculateStats(currentReportData, totalExpense, expenseHtml);

    } catch (error) {
        console.error("Error loading reports: ", error);
        alert("Report Error: " + error.message); 
    } finally {
        if (btnFetch) {
            btnFetch.innerHTML = 'Load Data';
            btnFetch.disabled = false;
        }
    }
};

// ==========================================================================
// 2. CALCULATE STATS & RENDER UI
// ==========================================================================
function calculateStats(orders, totalExpense, expenseHtml) {
    let totalRevenue = 0;
    let itemCounts = {};

    // Process Orders
    orders.forEach(order => {
        totalRevenue += Number(order.totalAmount || 0);
        
        // Count Items
        if (order.items) {
            order.items.forEach(item => {
                if (!itemCounts[item.name]) itemCounts[item.name] = 0;
                itemCounts[item.name] += item.qty;
            });
        }
    });

    const netProfit = totalRevenue - totalExpense;

    // Update Top Stat Cards
    if (statRevenue) statRevenue.innerText = `₹${totalRevenue}`;
    if (statExpense) statExpense.innerText = `₹${totalExpense}`;
    if (statProfit) statProfit.innerText = `₹${netProfit}`;
    if (statOrders) statOrders.innerText = orders.length;

    // Update Expense List UI
    if (expenseListContainer) {
        expenseListContainer.innerHTML = expenseHtml || '<p class="text-center mt-3 text-muted" style="font-size: 13px;">No expenses recorded for this date.</p>';
    }

    // Find Top Item
    let topItemName = "--";
    let maxQty = 0;
    for (const [name, qty] of Object.entries(itemCounts)) {
        if (qty > maxQty) {
            maxQty = qty;
            topItemName = name;
        }
    }
    if (statTopItem) statTopItem.innerText = topItemName !== "--" ? `${topItemName} (${maxQty} sold)` : "--";

    // Draw Chart
    try {
        renderChart(itemCounts);
    } catch(chartErr) {
        console.error("Chart Error: ", chartErr);
    }
}

// ==========================================================================
// 3. CHART.JS INTEGRATION
// ==========================================================================
function renderChart(itemCounts) {
    const chartEl = document.getElementById('salesChart');
    if (!chartEl) return;
    
    const ctx = chartEl.getContext('2d');
    
    // Sort and get Top 7 items
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 7); 
    
    const labels = sortedItems.map(item => item[0]);
    const data = sortedItems.map(item => item[1]);

    // Destroy old instance to prevent hover bugs
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantity Sold',
                data: data,
                backgroundColor: '#2563EB', // Premium Blue
                borderRadius: 6,
                borderWidth: 0,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0F172A',
                    padding: 10,
                    titleFont: { family: 'Poppins', size: 13 },
                    bodyFont: { family: 'Poppins', size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0, color: '#64748B' },
                    grid: { color: '#F1F5F9', borderDash: [5, 5] }
                },
                x: {
                    ticks: { color: '#64748B', font: { family: 'Poppins', size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================================================
// 4. ADD EXPENSE LOGIC
// ==========================================================================
if (btnAddExpense) {
    btnAddExpense.addEventListener('click', async () => {
        const desc = expenseDesc ? expenseDesc.value.trim() : '';
        const amount = expenseAmount ? expenseAmount.value.trim() : '';
        const selectedDate = datePicker ? datePicker.value : today;

        if (!desc || !amount) {
            alert("Please enter both Expense Details and Amount!");
            return;
        }

        btnAddExpense.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnAddExpense.disabled = true;

        try {
            await addDoc(collection(db, "expenses"), {
                date: selectedDate,
                desc: desc,
                amount: Number(amount),
                timestamp: new Date().toISOString()
            });
            
            // Clear inputs
            if (expenseDesc) expenseDesc.value = '';
            if (expenseAmount) expenseAmount.value = '';
            
            // Auto reload report
            window.loadReport();
        } catch (error) {
            console.error("Error adding expense: ", error);
            alert("Failed to add expense: " + error.message);
        } finally {
            btnAddExpense.innerText = "Add";
            btnAddExpense.disabled = false;
        }
    });
}

// ==========================================================================
// 5. EXPORT CSV (Browser-Side Zero Cost)
// ==========================================================================
if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
        if (currentReportData.length === 0) {
            alert("No data available to export for this date.");
            return;
        }
        
        let csvContent = "Order ID,Time,Customer Name,Phone,Subtotal,Tax,Total Amount,Items Ordered\n";
        
        currentReportData.forEach(order => {
            const time = order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : 'N/A';
            const itemsString = order.items ? order.items.map(i => `${i.qty}x ${i.name}`).join(" | ") : '';
            
            // Escape quotes and commas for safe CSV
            const safeItems = `"${itemsString}"`;
            const safeName = `"${order.customerName || 'Guest'}"`;
            const phone = order.customerPhone || 'N/A';

            csvContent += `${order.orderId},${time},${safeName},${phone},${order.subtotal},${order.tax},${order.totalAmount},${safeItems}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `IFF_Sales_Report_${datePicker ? datePicker.value : today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// ==========================================================================
// 6. INITIALIZATION TRIGGERS
// ==========================================================================
const btnFetchLocal = document.getElementById('btn-fetch-report');
if (btnFetchLocal) {
    btnFetchLocal.addEventListener('click', () => window.loadReport());
}

// Auto-load data for today when script runs
setTimeout(() => {
    window.loadReport();
}, 600);
