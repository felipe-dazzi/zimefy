// ZimeFY - Core Logic
const SUPABASE_URL = "https://dclwipihgyevdmohsnsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_SZ1qn1uzYjfSffyHLnQTig_1JTg8j26";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const META_FB_APP_ID = "1311246474406702";
const META_GRAPH = "https://graph.facebook.com/v19.0";
let META_TOKEN = "";

// ─── Facebook SDK Init ─────────────────────────────────────────────────────────
window.fbAsyncInit = function () {
    FB.init({ appId: META_FB_APP_ID, version: 'v19.0', xfbml: false, cookie: true });
    FB.getLoginStatus(response => {
        if (response.status === 'connected') {
            META_TOKEN = response.authResponse.accessToken;
            onFBConnected();
        }
    });
};

async function fbLogin() {
    if (typeof FB === 'undefined') {
        alert('SDK do Facebook ainda não carregou. Aguarde 2 segundos e tente novamente.');
        return;
    }
    FB.login(response => {
        if (response.status === 'connected') {
            META_TOKEN = response.authResponse.accessToken;
            onFBConnected();
        } else {
            alert('Login cancelado ou sem permissão. Certifique-se de aprovar todas as permissões solicitadas.');
        }
    }, { scope: 'ads_read,business_management,ads_management', auth_type: 'rerequest' });
}

function fbLogout() {
    FB.logout(() => {
        META_TOKEN = "";
        document.getElementById('fb-connected-area').style.display = 'none';
        document.getElementById('fb-connect-area').style.display = 'block';
        document.getElementById('bm-selector').innerHTML = '';
        document.getElementById('account-selector').innerHTML = '';
    });
}

async function applyManualToken() {
    const input = document.getElementById('manual-token-input');
    const token = input?.value.trim();
    if (!token) return;
    META_TOKEN = token;
    await showConnectedUI({ name: 'Token Manual', picture: null });
}

function onFBConnected() {
    FB.api('/me', { fields: 'name,picture.type(small)' }, async user => {
        await showConnectedUI(user);
    });
}

async function showConnectedUI(user) {
    const area = document.getElementById('fb-connected-area');
    const connectArea = document.getElementById('fb-connect-area');
    const infoEl = document.getElementById('fb-user-info');
    if (infoEl) {
        const pic = user?.picture?.data?.url ? `<img src="${user.picture.data.url}">` : '';
        infoEl.innerHTML = `${pic}<span>${user?.name || 'Conectado'}</span>`;
    }
    connectArea.style.display = 'none';
    area.style.display = 'block';
    lucide.createIcons();
    await loadBMAccounts();
}

const FIXED_COSTS_MONTHLY = 333.89;
const FIXED_COSTS_DAILY = FIXED_COSTS_MONTHLY / 30;

let mainChartInstance = null;
let selectedAdAccountId = "act_4510730299153332";
let bmData = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initChart();
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
        setInterval(syncMetaInsights, 5 * 60 * 1000);
    } else {
        errorEl.style.display = 'block';
    }
}

// ─── Meta BM / Account Selector ───────────────────────────────────────────────

async function loadBMAccounts() {
    const bmSel = document.getElementById('bm-selector');
    const accSel = document.getElementById('account-selector');
    const section = document.getElementById('bm-selector-section');

    bmSel.innerHTML = '<option>Carregando BMs...</option>';

    try {
        const bmsRes = await fetch(`${META_GRAPH}/me/businesses?fields=id,name&limit=50&access_token=${META_TOKEN}`);
        const bmsJson = await bmsRes.json();

        if (bmsJson.error) throw new Error(bmsJson.error.message);

        bmData = [];

        for (const bm of (bmsJson.data || [])) {
            const [ownedRes, clientRes] = await Promise.all([
                fetch(`${META_GRAPH}/${bm.id}/owned_ad_accounts?fields=name,account_id,account_status&limit=100&access_token=${META_TOKEN}`),
                fetch(`${META_GRAPH}/${bm.id}/client_ad_accounts?fields=name,account_id,account_status&limit=100&access_token=${META_TOKEN}`)
            ]);
            const owned = await ownedRes.json();
            const client = await clientRes.json();

            const allAccounts = [...(owned.data || []), ...(client.data || [])];
            const unique = allAccounts.filter((a, i, self) => self.findIndex(b => b.id === a.id) === i);

            bmData.push({ id: bm.id, name: bm.name, accounts: unique });
        }

        if (bmData.length === 0) {
            bmSel.innerHTML = '<option>Nenhuma BM encontrada</option>';
            return;
        }

        bmSel.innerHTML = bmData.map(bm =>
            `<option value="${bm.id}">${bm.name} (${bm.accounts.length} conta${bm.accounts.length !== 1 ? 's' : ''})</option>`
        ).join('');

        populateAccountSelector(bmData[0]?.id);

        // Remove listeners antigos antes de adicionar novos
        const newBmSel = bmSel.cloneNode(true);
        bmSel.parentNode.replaceChild(newBmSel, bmSel);
        const newAccSel = accSel.cloneNode(true);
        accSel.parentNode.replaceChild(newAccSel, accSel);

        document.getElementById('bm-selector').addEventListener('change', e => {
            populateAccountSelector(e.target.value);
        });
        document.getElementById('account-selector').addEventListener('change', e => {
            selectedAdAccountId = e.target.value;
            updateAccountBadge(e.target.selectedOptions[0]);
            syncMetaInsights();
        });

    } catch (err) {
        console.error('BM load error:', err);
        bmSel.innerHTML = '<option>Erro ao carregar</option>';
        section.style.display = 'block';
    }
}

function populateAccountSelector(bmId) {
    const bm = bmData.find(b => b.id === bmId);
    const accSel = document.getElementById('account-selector');
    if (!bm || !accSel) return;

    accSel.innerHTML = bm.accounts.length
        ? bm.accounts.map(a => {
            const isActive = a.account_status === 1;
            const label = (a.name || a.account_id) + (isActive ? '' : ' ⚠ inativa');
            return `<option value="${a.id}" data-status="${a.account_status}">${label}</option>`;
          }).join('')
        : '<option value="">Nenhuma conta nesta BM</option>';

    const match = bm.accounts.find(a => a.id === selectedAdAccountId);
    if (match) accSel.value = selectedAdAccountId;
    else selectedAdAccountId = accSel.value;

    updateAccountBadge(accSel.selectedOptions[0]);
    syncMetaInsights();
}

function updateAccountBadge(option) {
    const badge = document.getElementById('account-status-badge');
    if (!badge || !option) return;
    const status = option.dataset.status;
    if (status === '1') {
        badge.className = 'account-status-badge active';
        badge.innerHTML = '<span class="status-dot"></span> Conta ativa';
    } else if (status) {
        badge.className = 'account-status-badge inactive';
        badge.innerHTML = '● Conta inativa';
    } else {
        badge.className = 'account-status-badge';
        badge.innerHTML = '';
    }
}

// ─── Live Meta Insights ────────────────────────────────────────────────────────

async function syncMetaInsights() {
    if (!selectedAdAccountId) return;
    try {
        const fields = 'spend,impressions,clicks,cpm,ctr,cpc,actions,reach';
        const res = await fetch(
            `${META_GRAPH}/${selectedAdAccountId}/insights?fields=${fields}&date_preset=today&access_token=${META_TOKEN}`
        );
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);

        const d = json.data?.[0] || {};
        const spend       = parseFloat(d.spend) || 0;
        const impressions = parseInt(d.impressions) || 0;
        const clicks      = parseInt(d.clicks) || 0;
        const cpm         = parseFloat(d.cpm) || 0;
        const ctr         = parseFloat(d.ctr) || 0;
        const cpc         = parseFloat(d.cpc) || 0;
        const purchases   = (d.actions || []).find(a => a.action_type === 'purchase');
        const numSales    = parseInt(purchases?.value) || 0;
        const cpa         = numSales > 0 ? spend / numSales : 0;

        // Anúncios tab
        updateMetric('ads-cpm', cpm);
        updateMetric('ads-spend', spend);
        updateMetric('ads-cpa', cpa);
        updateMetric('ads-cpc', cpc);
        const ctrEl = document.getElementById('ads-ctr');
        if (ctrEl) ctrEl.innerText = ctr.toFixed(2) + '%';
        const clicksEl = document.getElementById('ads-clicks');
        if (clicksEl) clicksEl.innerText = clicks.toLocaleString('pt-BR');

        // Dashboard tab — atualiza gasto ads com conta selecionada
        updateMetric('stat-gasto', spend);

    } catch (err) {
        console.error('Meta Insights error:', err);
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

        if (salesErr) throw salesErr;

        // 2. Process Core Metrics (spend comes from syncMetaInsights)
        const totalSalesLiquida = sales.reduce((acc, s) => acc + (parseFloat(s.valor_liquido) || 0), 0);
        const totalSalesBruta   = sales.reduce((acc, s) => acc + (parseFloat(s.valor_bruto) || 0), 0);

        // Read current spend from the ads metric element (populated by syncMetaInsights)
        const spendEl = document.getElementById('stat-gasto');
        const totalSpend = spendEl ? parseFloat(spendEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0 : 0;

        const profit = totalSalesLiquida - totalSpend - FIXED_COSTS_DAILY;
        const roi = totalSpend > 0 ? (totalSalesLiquida / totalSpend).toFixed(2) : 0;

        // 3. Update Overview Stats
        updateMetric('stat-receita-bruta', totalSalesBruta);
        updateMetric('stat-lucro', profit);
        const roiEl = document.getElementById('stat-roi');
        if (roiEl) roiEl.innerText = roi + 'x';

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

        // Distribute today's spend evenly across elapsed hours
        const currentHour = now.getHours();
        if (totalSpend > 0 && currentHour >= 0) {
            for (let i = 0; i <= currentHour; i++) hourlySpend[i] = totalSpend / (currentHour + 1);
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


