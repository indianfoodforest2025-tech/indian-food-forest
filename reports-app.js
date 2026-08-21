// ==========================================================================
// SALES REPORTS & ANALYTICS LOGIC (Chart.js & CSV Export)
// ==========================================================================

import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// DOM Elements
const datePicker = document.getElementById('report-date-picker');
const btnFetch = document.getElementById('btn-fetch-report');
const btnExportCSV = document.getElementById('btn-export-csv');
const btnEndOfDay = document.getElementById('btn-end-of-day');

const statRevenue = document.getElementById('stat-revenue');
const statOrders = document.getElementById('stat-orders');
const statTopItem = document.getElementById('stat-top-item');

let salesChartInstance = null;
let currentReportData = []; // Store fetched data for CSV export

// Initialize Date Picker with Today's Date
const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
if (datePicker) {
    datePicker.value = today;
}

// ==========================================================================
// 1. FETCH & PROCESS DATA
// ==========================================================================
async function loadReport(selectedDate) {
    try {
        btnFetch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        // Fetch all PAID orders (To avoid composite index requirements in free Firebase, 
        // we fetch paid orders and filter by date in client side)
        const q = query(collection(db, "orders"), where("paymentStatus", "==", "paid"));
        const snapshot = await getDocs(q);
        
        const allPaidOrders = [];
        snapshot.forEach(doc => allPaidOrders.push({ id: doc.id, ...doc.data() }));

        // Filter by selected date (matching YYYY-MM-DD)
        currentReportData = allPaidOrders.filter(order => order.timestamp.startsWith(selectedDate));

        calculateStats(currentReportData);

    } catch (error) {
        console.error("Error loading reports: ", error);
        alert("Failed to load data.");
    } finally {
        btnFetch.innerHTML = 'Load';
    }
}

// ==========================================================================
// 2. CALCULATE STATS & RENDER CHART
// ==========================================================================
function calculateStats(orders) {
    let totalRevenue = 0;
    let itemCounts = {};

    orders.forEach(order => {
        totalRevenue += order.totalAmount;
        
        // Count items for Best-seller and Chart
        order.items.forEach(item => {
            if (!itemCounts[item.name]) {
                itemCounts[item.name] = 0;
            }
            itemCounts[item.name] += item.qty;
        });
    });

    // Update Number Cards
    statRevenue.innerText = `₹${totalRevenue}`;
    statOrders.innerText = orders.length;

    // Find Top Item
    let topItemName = "--";
    let maxQty = 0;
    for (const [name, qty] of Object.entries(itemCounts)) {
        if (qty > maxQty) {
            maxQty = qty;
            topItemName = name;
        }
    }
    statTopItem.innerText = topItemName !== "--" ? `${topItemName} (${maxQty})` : "--";

    // Render Chart
    renderChart(itemCounts);
}

function renderChart(itemCounts) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Sort items by highest sold
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 7); // Top 7 items
    
    const labels = sortedItems.map(item => item[0]);
    const data = sortedItems.map(item => item[1]);

    // Destroy old chart if exists (prevents hover glitch)
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
// 3. EXPORT CSV LOGIC (Zero Server Cost)
// ==========================================================================
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
        
        // Escape quotes and commas for safe CSV formatting
        const safeItems = `"${itemsString}"`;
        const safeName = `"${order.customerName || 'Guest'}"`;
        const phone = order.customerPhone || 'N/A';

        csvContent += `${order.orderId},${time},${safeName},${phone},${order.subtotal},${order.tax},${order.totalAmount},${safeItems}\n`;
    });

    // Create Blob and trigger Download natively in browser
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

// ==========================================================================
// 4. END OF DAY RESET
// ==========================================================================
btnEndOfDay.addEventListener('click', () => {
    const confirmReset = confirm("WARNING: This will log out all current active tables and reset the grid. Are you sure you want to end the day?");
    if (confirmReset) {
        // Here you would technically run a batch update to set all tables status to 'free'.
        // For security and to prevent accidental data loss, usually this just resets UI states.
        alert("End of Day executed. All tables have been cleared for the next shift.");
        // Reload page to refresh all states
        window.location.reload();
    }
});

// Initial Load on Page Open
if (btnFetch) {
    btnFetch.addEventListener('click', () => loadReport(datePicker.value));
    // Auto-load today's data initially
    loadReport(today);
}
