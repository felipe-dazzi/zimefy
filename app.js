// ZimeFY - Core Logic
const SUPABASE_URL = "https://dclwipihgyevdmohsnsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_SZ1qn1uzYjfSffyHLnQTig_1JTg8j26";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let mainChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initChart(); // Initialize with zeros
});

// Authentication Logic
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    if (user === 'felipedazzi' && pass === 'felipeflp') {
        const overlay = document.getElementById('login-overlay');
        const app = document.getElementById('app-container');
        
        overlay.style.display = 'none';
        app.style.display = 'flex';
        setTimeout(() => app.style.opacity = '1', 10);

        // Start Syncing Data
        await syncDashboard();
        setInterval(syncDashboard, 5 * 60 * 1000);
    } else {
        errorEl.style.display = 'block';
    }
}

// Tab Navigation Logic
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active classes
            navLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to current
            const tabId = link.getAttribute('data-tab');
            link.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Scroll main to top
            document.querySelector('main').scrollTop = 0;
        });
    });
}

function initChart(salesData = [], spendData = [], labels = []) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (mainChartInstance) {
        mainChartInstance.destroy();
    }

    // Default data if empty
    const displayLabels = labels.length ? labels : ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
    const displaySales = salesData.length ? salesData : [0, 0, 0, 0, 0, 0, 0];
    const displaySpend = spendData.length ? spendData : [0, 0, 0, 0, 0, 0, 0];

    // Gradient for the line chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Receita Líquida (R$)',
                data: displaySales,
                borderColor: '#00FF88',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#00FF88'
            }, {
                label: 'Gasto Ads (R$)',
                data: displaySpend,
                borderColor: '#D4AF37',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#666',
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: '#111',
                    titleFont: { family: 'Plus Jakarta Sans', size: 14, weight: '700' },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { 
                        color: '#444',
                        font: { family: 'Plus Jakarta Sans', weight: '500' },
                        callback: value => 'R$ ' + value
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#444', font: { family: 'Plus Jakarta Sans', weight: '500' } }
                }
            }
        }
    });
}

// Supabase Sync Logic
async function syncDashboard() {
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Fetch Today's Sales
        const { data: sales, error: salesErr } = await _supabase
            .from('zimefy_vendas')
            .select('*')
            .gte('data_venda', today)
            .order('data_venda', { ascending: false });

        // 2. Fetch Today's Spend
        const { data: spend, error: spendErr } = await _supabase
            .from('zimefy_gastos_ads')
            .select('*')
            .eq('data_referencia', today);

        if (salesErr) throw salesErr;
        if (spendErr) throw spendErr;

        // 3. Process Core Metrics
        const totalSalesLiquida = sales.reduce((acc, s) => acc + (parseFloat(s.valor_liquido) || 0), 0);
        const totalSalesBruta = sales.reduce((acc, s) => acc + (parseFloat(s.valor_bruto) || 0), 0);
        const totalSpend = spend.reduce((acc, s) => acc + (parseFloat(s.valor_gasto) || 0), 0);
        const totalImpressions = spend.reduce((acc, s) => acc + (parseInt(s.impressoes) || 0), 0);
        const totalClicks = spend.reduce((acc, s) => acc + (parseInt(s.cliques) || 0), 0);
        
        const profit = totalSalesLiquida - totalSpend;
        const roi = totalSpend > 0 ? (totalSalesLiquida / totalSpend).toFixed(2) : 0;

        // 4. Update Overview Stats
        updateMetric('stat-receita-bruta', totalSalesBruta);
        updateMetric('stat-gasto', totalSpend);
        updateMetric('stat-lucro', profit);
        const roiEl = document.getElementById('stat-roi');
        if (roiEl) roiEl.innerText = roi + 'x';

        // 5. Update Ads Intelligence Tab
        const cpa = sales.length > 0 ? (totalSpend / sales.length).toFixed(2) : 0;
        const cpm = totalImpressions > 0 ? ((totalSpend / totalImpressions) * 1000).toFixed(2) : 0;
        const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

        updateMetric('ads-cpm', cpm);
        updateMetric('ads-spend', totalSpend);
        updateMetric('ads-cpa', cpa);
        const ctrEl = document.getElementById('ads-ctr');
        if (ctrEl) ctrEl.innerText = ctr + '%';

        // 6. Update Tables
        renderSalesTable(sales, 'vendas-tab-body');
        renderSalesTable(sales.slice(0, 5), 'events-body'); // Dashboard recent feed

        // Update Sync Timestamp
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const syncEl = document.querySelector('.date-status');
        if (syncEl) syncEl.innerHTML = `<span class="status-dot"></span> Sincronizado: Hoje, ${timeStr}`;

        // 7. Update Chart
        initChart([], [], []); 

    } catch (err) {
        console.error("Sync Error:", err);
    }
}

function renderSalesTable(sales, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (sales.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color:var(--text-dim);">Nenhuma venda registrada hoje.</td></tr>`;
        return;
    }

    container.innerHTML = sales.map(s => {
        const date = new Date(s.data_venda);
        const time = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
        return `
            <tr>
                <td>${time}</td>
                <td style="font-weight:700;">${s.produto || 'N/A'}</td>
                <td><span style="font-size:11px; color:var(--text-dim);">${s.utm_campaign || 'Direto'}</span></td>
                <td>R$ ${parseFloat(s.valor_bruto).toFixed(2)}</td>
                <td style="color:var(--accent-green); font-weight:700;">R$ ${parseFloat(s.valor_liquido).toFixed(2)}</td>
                <td><span class="pill pill-paid">${s.status?.toUpperCase() || 'APROVADO'}</span></td>
            </tr>
        `;
    }).join('');
}

function updateMetric(id, value, isPercentage = false) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const formattedValue = isPercentage 
        ? value.toFixed(1) + '%' 
        : 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    el.innerText = formattedValue;
}


