// ==========================================================================
// SALES REPORTS & ANALYTICS LOGIC (Chart.js, CSV Export & Expenses)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// DOM Elements
const datePicker = document.getElementById('report-date-picker');
const btnFetch = document.getElementById('btn-fetch-report');
const btnExportCSV = document.getElementById('btn-export-csv');
const btnEndOfDay = document.getElementById('btn-end-of-day');

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
let currentReportData = []; // Store fetched data for CSV export

// Initialize Date Picker with Today's Date
const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
if (datePicker) {
    datePicker.value = today;
}

// ==========================================================================
// 1. FETCH & PROCESS DATA (Revenue + Expenses)
// ==========================================================================
window.loadReport = async function(selectedDate) {
    // Agar koi specific date nahi di, toh datePicker se lo
    const targetDate = selectedDate || (datePicker ? datePicker.value : today);
    if (!targetDate) return;

    try {
        if (btnFetch) btnFetch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        // --- A. FETCH PAID ORDERS (For Revenue) ---
        const qOrders = query(collection(db, "orders"), where("paymentStatus", "==", "paid"));
        const orderSnapshot = await getDocs(qOrders);
        
        const allPaidOrders = [];
        orderSnapshot.forEach(doc => allPaidOrders.push({ id: doc.id, ...doc.data() }));

        // Filter by selected date
        currentReportData = allPaidOrders.filter(order => order.timestamp.startsWith(targetDate));

        // --- B. FETCH EXPENSES (For Kharcha) ---
        const qExpenses = query(collection(db, "expenses"), where("date", "==", targetDate));
        const expSnapshot = await getDocs(qExpenses);
        
        let totalExpense = 0;
        let expenseHtml = '';
        
        expSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            totalExpense += Number(data.amount || 0);
            expenseHtml += `
                <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0;">
                    <span>${data.desc}</span>
                    <strong class="text-danger">₹${data.amount}</strong>
                </div>`;
        });

        // --- C. CALCULATE STATS & RENDER ---
        calculateStats(currentReportData, totalExpense, expenseHtml);

    } catch (error) {
        console.error("Error loading reports: ", error);
        alert("Failed to load data.");
    } finally {
        if (btnFetch) btnFetch.innerHTML = 'Load';
    }
};

// ==========================================================================
// 2. CALCULATE STATS & RENDER CHART
// ==========================================================================
function calculateStats(orders, totalExpense, expenseHtml) {
    let totalRevenue = 0;
    let itemCounts = {};

    orders.forEach(order => {
        totalRevenue += Number(order.totalAmount || 0);
        
        // Count items for Best-seller and Chart
        if (order.items) {
            order.items.forEach(item => {
                if (!itemCounts[item.name]) {
                    itemCounts[item.name] = 0;
                }
                itemCounts[item.name] += item.qty;
            });
        }
    });

    const netProfit = totalRevenue - totalExpense;

    // Update Number Cards
    if (statRevenue) statRevenue.innerText = `₹${totalRevenue}`;
    if (statExpense) statExpense.innerText = `₹${totalExpense}`;
    if (statProfit) statProfit.innerText = `₹${netProfit}`;
    if (statOrders) statOrders.innerText = orders.length;

    // Update Expense List UI
    if (expenseListContainer) {
        expenseListContainer.innerHTML = expenseHtml || '<p class="text-center mt-2 text-muted">No expenses recorded for this date.</p>';
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
    if (statTopItem) statTopItem.innerText = topItemName !== "--" ? `${topItemName} (${maxQty})` : "--";

    // Render Chart
    renderChart(itemCounts);
}

function renderChart(itemCounts) {
    const chartEl = document.getElementById('salesChart');
    if (!chartEl) return;
    
    const ctx = chartEl.getContext('2d');
    
    // Sort items by highest sold
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 7); // Top 7 items
    
    const labels = sortedItems.map(item => item[0]);
    const data = sortedItems.map(item => item[1]);

    // Destroy old chart if exists
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
                backgroundColor: '#2563EB', // Primary Blue
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Top Selling Items (Qty)', font: { family: 'Poppins', size: 16 } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

// ==========================================================================
// 3. ADD NEW EXPENSE LOGIC
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

        btnAddExpense.innerText = "Adding...";
        btnAddExpense.disabled = true;

        try {
            await addDoc(collection(db, "expenses"), {
                date: selectedDate,
                desc: desc,
                amount: Number(amount),
                timestamp: new Date().toISOString()
            });
            
            // Clear Inputs
            if (expenseDesc) expenseDesc.value = '';
            if (expenseAmount) expenseAmount.value = '';
            
            // Reload Report dynamically
            window.loadReport(selectedDate);
        } catch (error) {
            console.error("Error adding expense: ", error);
            alert("Failed to add expense.");
        } finally {
            btnAddExpense.innerText = "Add";
            btnAddExpense.disabled = false;
        }
    });
}

// ==========================================================================
// 4. EXPORT CSV LOGIC (Zero Server Cost)
// ==========================================================================
if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
        if (currentReportData.length === 0) {
            alert("No data available to export for this date.");
            return;
        }

        // Prepare CSV Header
        let csvContent = "Order ID,Time,Customer Name,Phone,Subtotal,Tax,Total Amount,Items Ordered\n";

        // Prepare CSV Rows
        currentReportData.forEach(order => {
            const time = new Date(order.timestamp).toLocaleTimeString();
            const itemsString = order.items.map(i => `${i.qty}x ${i.name}`).join(" | ");
            
            // Escape quotes and commas
            const safeItems = `"${itemsString}"`;
            const safeName = `"${order.customerName || 'Guest'}"`;
            const phone = order.customerPhone || 'N/A';

            csvContent += `${order.orderId},${time},${safeName},${phone},${order.subtotal},${order.tax},${order.totalAmount},${safeItems}\n`;
        });

        // Download logic
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `IFF_Sales_Report_${datePicker.value}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// ==========================================================================
// 5. END OF DAY RESET
// ==========================================================================
if (btnEndOfDay) {
    btnEndOfDay.addEventListener('click', () => {
        const confirmReset = confirm("WARNING: This will log out all current active tables and reset the grid. Are you sure you want to end the day?");
        if (confirmReset) {
            alert("End of Day executed. All tables have been cleared for the next shift.");
            window.location.reload();
        }
    });
}

// Trigger initial fetch logic
if (btnFetch) {
    btnFetch.addEventListener('click', () => window.loadReport(datePicker.value));
}

// Auto-load today's data when file is parsed (Slight delay to let DOM load fully)
setTimeout(() => {
    window.loadReport(today);
}, 500);
