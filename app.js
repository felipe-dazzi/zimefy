// ZimeFY - Core Logic
const SUPABASE_URL = "https://dclwipihgyevdmohsnsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_SZ1qn1uzYjfSffyHLnQTig_1JTg8j26";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let mainChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    await syncDashboard();
    
    // Auto-refresh every 5 minutes
    setInterval(syncDashboard, 5 * 60 * 1000);
});

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
            .select('valor_liquido, valor_bruto, created_at')
            .gte('created_at', today);

        // 2. Fetch Today's Spend
        const { data: spend, error: spendErr } = await _supabase
            .from('zimefy_gastos_ads')
            .select('valor_gasto, cliques, impressoes')
            .eq('data_referencia', today);

        if (salesErr || spendErr) throw new Error("Erro ao buscar dados");

        // 3. Process Metrics
        const totalSales = sales.reduce((acc, s) => acc + (s.valor_liquido || 0), 0);
        const totalSpend = spend.reduce((acc, s) => acc + (s.valor_gasto || 0), 0);
        const profit = totalSales - totalSpend;
        const roi = totalSpend > 0 ? (profit / totalSpend) * 100 : 0;

        // 4. Update Stats in DOM
        updateMetric('stat-receita', totalSales);
        updateMetric('stat-gasto', totalSpend);
        updateMetric('stat-lucro', profit);
        updateMetric('stat-roi', roi, true);

        // 5. Update Chart (Simplified for now: uses dummy hours until grouping logic expanded)
        initChart([], [], []); 

    } catch (err) {
        console.error("Sync Error:", err);
    }
}

function updateMetric(id, value, isPercentage = false) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const formattedValue = isPercentage 
        ? value.toFixed(1) + '%' 
        : 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    el.innerText = formattedValue;
}

// Initial sync
syncDashboard();
