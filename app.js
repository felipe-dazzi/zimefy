// ZimeFY - Core Logic
const SUPABASE_URL = "https://dclwipihgyevdmohsnsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_SZ1qn1uzYjfSffyHLnQTig_1JTg8j26";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const FIXED_COSTS_MONTHLY = 333.89;
const FIXED_COSTS_DAILY = FIXED_COSTS_MONTHLY / 30;

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

    // Gradient for the line chart (Purple)
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(123, 44, 191, 0.4)');
    gradient.addColorStop(1, 'rgba(123, 44, 191, 0)');

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Receita Líquida (R$)',
                data: displaySales,
                borderColor: '#7B2CBF',
                backgroundColor: gradient,
                borderWidth: 4,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#7B2CBF',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }, {
                label: 'Gasto Ads (R$)',
                data: displaySpend,
                borderColor: '#7C7C7E',
                borderWidth: 1.5,
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
            .order('data_venda', { ascending: true });

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
        
        const profit = totalSalesLiquida - totalSpend - FIXED_COSTS_DAILY;
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

        const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
        updateMetric('ads-cpc', cpc);
        const clicksEl = document.getElementById('ads-clicks');
        if (clicksEl) clicksEl.innerText = totalClicks;

        // 6. Update Tables
        renderSalesTable([...sales].reverse(), 'vendas-tab-body');
        renderSalesTable([...sales].reverse().slice(0, 5), 'events-body');
        
        // 6b. Process Campaign Performance
        const campaigns = {};
        sales.forEach(s => {
            const tag = s.utm_campaign || 'Direto';
            if (!campaigns[tag]) campaigns[tag] = { revenue: 0, sales: 0 };
            campaigns[tag].revenue += parseFloat(s.valor_liquido) || 0;
            campaigns[tag].sales += 1;
        });
        renderCampaignTable(Object.entries(campaigns).sort((a,b) => b[1].revenue - a[1].revenue));

        // Update Sync Timestamp
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const syncEl = document.querySelector('.date-status');
        if (syncEl) syncEl.innerHTML = `<span class="status-dot"></span> Sincronizado: Hoje, ${timeStr}`;

        // 7. Process Hourly Data for Chart
        const hourlySales = Array(24).fill(0);
        const hourlySpend = Array(24).fill(0);
        const labels = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');

        sales.forEach(s => {
            const hour = new Date(s.data_venda).getHours();
            hourlySales[hour] += parseFloat(s.valor_liquido) || 0;
        });

        // Simplified Spend: Distributed evenly for demo if only 1 entry, 
        // but in production it's better to fetch timestamped logs.
        if (spend.length === 1) {
            const currentHour = now.getHours();
            for(let i=0; i <= currentHour; i++) hourlySpend[i] = totalSpend / (currentHour + 1);
        } else {
            spend.forEach(s => {
                const hour = new Date(s.last_sync || s.data_referencia).getHours();
                hourlySpend[hour] += parseFloat(s.valor_gasto) || 0;
            });
        }

        initChart(hourlySales, hourlySpend, labels); 

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

function renderCampaignTable(campaignData) {
    const container = document.getElementById('campaign-body');
    if (!container) return;

    if (campaignData.length === 0) {
        container.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color:var(--text-dim);">Nenhum dado por campanha.</td></tr>`;
        return;
    }

    container.innerHTML = campaignData.map(([name, data]) => `
        <tr>
            <td style="font-weight:600; font-size: 13px;">${name}</td>
            <td>${data.sales} vds</td>
            <td style="color:var(--accent-green); font-weight:700; text-align:right;">R$ ${data.revenue.toFixed(2)}</td>
        </tr>
    `).join('');
}

function updateMetric(id, value, isPercentage = false) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const formattedValue = isPercentage 
        ? value.toFixed(1) + '%' 
        : 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    el.innerText = formattedValue;
}


