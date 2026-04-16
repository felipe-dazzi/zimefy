// ZimeFY - Core Logic
const SUPABASE_URL = "https://dclwipihgyevdmohsnsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_SZ1qn1uzYjfSffyHLnQTig_1JTg8j26";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const META_FB_APP_ID = "1311246474406702";
const META_GRAPH = "https://graph.facebook.com/v19.0";
let META_TOKEN = "";

// ─── Facebook OAuth (redirect flow — sem popup) ────────────────────────────────
function fbLogin() {
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = 'ads_read,business_management,ads_management';
    window.location.href = `https://www.facebook.com/dialog/oauth?client_id=${META_FB_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
}

function fbLogout() {
    META_TOKEN = "";
    sessionStorage.removeItem('zimefy_meta_token');
    document.getElementById('fb-connected-area').style.display = 'none';
    document.getElementById('fb-connect-area').style.display = 'block';
}

// Lê o token do hash da URL após redirect do Facebook
function checkFBRedirectToken() {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace('#', '?').slice(1));
    const token = params.get('access_token');
    if (token) {
        META_TOKEN = token;
        sessionStorage.setItem('zimefy_meta_token', token);
        // Limpa o hash da URL sem recarregar
        history.replaceState(null, '', window.location.pathname);
    }
}

// Recupera sessão salva
function restoreFBSession() {
    const saved = sessionStorage.getItem('zimefy_meta_token');
    if (saved) META_TOKEN = saved;
}

async function applyManualToken() {
    const input = document.getElementById('manual-token-input');
    const token = input?.value.trim();
    if (!token) return;
    META_TOKEN = token;
    await showConnectedUI({ name: 'Token Manual', picture: null });
}

async function onFBConnected() {
    try {
        const res = await fetch(`${META_GRAPH}/me?fields=name,picture.type(small)&access_token=${META_TOKEN}`);
        const user = await res.json();
        await showConnectedUI(user.error ? { name: 'Facebook', picture: null } : user);
    } catch {
        await showConnectedUI({ name: 'Facebook', picture: null });
    }
}

async function showConnectedUI(user) {
    const area = document.getElementById('fb-connected-area');
    const connectArea = document.getElementById('fb-connect-area');
    const infoEl = document.getElementById('fb-user-info');
    if (infoEl) {
        const pic = user?.picture?.data?.url
            ? `<img src="${user.picture.data.url}">`
            : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">${(user?.name || 'F')[0]}</div>`;
        infoEl.innerHTML = `${pic}<span class="fb-user-name">${user?.name || 'Conectado'}</span><span class="fb-connected-dot"></span>`;
    }
    connectArea.style.display = 'none';
    area.style.display = 'flex';
    lucide.createIcons();
    await loadBMAccounts();
}

let FIXED_COSTS_MONTHLY = 333.89;
let FIXED_COSTS_DAILY   = FIXED_COSTS_MONTHLY / 30;
let KIWIFY_FEE_PCT      = 8.99;
let SAFETY_MARGIN_PCT   = 3;
let TAX_PCT             = 6;

// ─── Config Tab ────────────────────────────────────────────────────────────────
function loadConfig() {
    const saved = JSON.parse(localStorage.getItem('zimefy_config') || '{}');

    const ferramentas = saved.ferramentas || 0;
    const trafego     = saved.trafego     || 0;
    const outros      = saved.outros      || 0;

    setValue('cfg-ferramentas',  ferramentas);
    setValue('cfg-trafego',      trafego);
    setValue('cfg-outros',       outros);
    setValue('cfg-taxa-kiwify',  saved.taxaKiwify  ?? 8.99);
    setValue('cfg-margem',       saved.margem      ?? 3);
    setValue('cfg-imposto',      saved.imposto     ?? 6);

    applyConfig({ ferramentas, trafego, outros,
        taxaKiwify: saved.taxaKiwify ?? 8.99,
        margem:     saved.margem     ?? 3,
        imposto:    saved.imposto    ?? 6 });

    // live recalc on input
    ['cfg-ferramentas','cfg-trafego','cfg-outros'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcConfigTotals);
    });
    ['cfg-taxa-kiwify','cfg-margem','cfg-imposto'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcConfigTotals);
    });
    recalcConfigTotals();
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function recalcConfigTotals() {
    const ferramentas = parseFloat(document.getElementById('cfg-ferramentas')?.value) || 0;
    const trafego     = parseFloat(document.getElementById('cfg-trafego')?.value)     || 0;
    const outros      = parseFloat(document.getElementById('cfg-outros')?.value)       || 0;
    const total = ferramentas + trafego + outros;
    const totalEl = document.getElementById('cfg-total');
    if (totalEl) totalEl.innerText = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const taxa    = parseFloat(document.getElementById('cfg-taxa-kiwify')?.value) || 0;
    const margem  = parseFloat(document.getElementById('cfg-margem')?.value)      || 0;
    const imposto = parseFloat(document.getElementById('cfg-imposto')?.value)     || 0;
    const retencao = 100 - taxa - margem - imposto;
    const retEl = document.getElementById('cfg-retencao');
    if (retEl) retEl.innerText = retencao.toFixed(2) + '%';
}

function applyConfig(cfg) {
    FIXED_COSTS_MONTHLY = (cfg.ferramentas || 0) + (cfg.trafego || 0) + (cfg.outros || 0);
    FIXED_COSTS_DAILY   = FIXED_COSTS_MONTHLY / 30;
    KIWIFY_FEE_PCT      = cfg.taxaKiwify  ?? 8.99;
    SAFETY_MARGIN_PCT   = cfg.margem      ?? 3;
    TAX_PCT             = cfg.imposto     ?? 6;
}

function saveConfig() {
    const cfg = {
        ferramentas: parseFloat(document.getElementById('cfg-ferramentas')?.value) || 0,
        trafego:     parseFloat(document.getElementById('cfg-trafego')?.value)     || 0,
        outros:      parseFloat(document.getElementById('cfg-outros')?.value)       || 0,
        taxaKiwify:  parseFloat(document.getElementById('cfg-taxa-kiwify')?.value) || 8.99,
        margem:      parseFloat(document.getElementById('cfg-margem')?.value)      || 3,
        imposto:     parseFloat(document.getElementById('cfg-imposto')?.value)     || 6,
    };
    localStorage.setItem('zimefy_config', JSON.stringify(cfg));
    applyConfig(cfg);

    const msg = document.getElementById('config-saved-msg');
    if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
    lucide.createIcons();
}

let mainChartInstance = null;
let selectedAdAccountId = "act_4510730299153332";
let bmData = [];
let activePeriod = { start: null, end: null, preset: 'today' };

document.addEventListener('DOMContentLoaded', () => {
    checkFBRedirectToken();
    initNavigation();
    initChart();
    initPeriodSelector();
});

// ─── Period Selector ───────────────────────────────────────────────────────────
function initPeriodSelector() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.dataset.period;

            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const customRange = document.getElementById('custom-range');

            if (period === 'custom') {
                customRange.style.display = 'flex';
                // Preenche datas padrão: últimos 7 dias
                const today = new Date();
                const week = new Date(); week.setDate(today.getDate() - 6);
                document.getElementById('date-end').value = today.toISOString().split('T')[0];
                document.getElementById('date-start').value = week.toISOString().split('T')[0];
                return;
            }

            customRange.style.display = 'none';
            const { start, end } = getPeriodDates(period);
            activePeriod = { start, end, preset: period };
            syncDashboard();
        });
    });

    // Inicia com "hoje"
    const { start, end } = getPeriodDates('today');
    activePeriod = { start, end, preset: 'today' };
}

function getPeriodDates(preset) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const end = today.toISOString();

    let start;
    if (preset === 'today') {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        start = s.toISOString();
    } else if (preset === 'week') {
        const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
        start = s.toISOString();
    } else if (preset === 'month') {
        const s = new Date(); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
        start = s.toISOString();
    }
    return { start, end };
}

function applyCustomRange() {
    const startVal = document.getElementById('date-start').value;
    const endVal   = document.getElementById('date-end').value;
    if (!startVal || !endVal) return;
    activePeriod = {
        start: new Date(startVal + 'T00:00:00').toISOString(),
        end:   new Date(endVal   + 'T23:59:59').toISOString(),
        preset: 'custom'
    };
    syncDashboard();
}

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

        // Carrega configurações salvas
        loadConfig();

        // Start Syncing Data
        await syncDashboard();
        setInterval(syncDashboard, 5 * 60 * 1000);
        setInterval(syncMetaInsights, 5 * 60 * 1000);

        // Restaura sessão Meta se existir
        restoreFBSession();
        if (META_TOKEN) await showConnectedUI({ name: 'Sessão Restaurada', picture: null });
    } else {
        errorEl.style.display = 'block';
    }
}

// ─── Meta BM / Account Selector ───────────────────────────────────────────────

async function loadBMAccounts() {
    const bmSel = document.getElementById('bm-selector');
    const section = document.getElementById('bm-selector-section');

    bmSel.innerHTML = '<option>Carregando...</option>';

    try {
        // Busca todas as contas de anúncio que o usuário tem acesso (independente de ser admin da BM)
        let allAccounts = [];
        let url = `${META_GRAPH}/me/adaccounts?fields=name,account_id,account_status,business{id,name}&limit=100&access_token=${META_TOKEN}`;

        // Percorre paginação
        while (url) {
            const res = await fetch(url);
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            allAccounts = allAccounts.concat(json.data || []);
            url = json.paging?.next || null;
        }

        // Agrupa por BM
        const bmMap = {};
        for (const acc of allAccounts) {
            const bmId   = acc.business?.id   || '__pessoal__';
            const bmName = acc.business?.name || 'Contas Pessoais';
            if (!bmMap[bmId]) bmMap[bmId] = { id: bmId, name: bmName, accounts: [] };
            bmMap[bmId].accounts.push(acc);
        }

        bmData = Object.values(bmMap);

        if (bmData.length === 0) {
            bmSel.innerHTML = '<option>Nenhuma conta encontrada</option>';
            return;
        }

        // Popula seletor de BM
        bmSel.innerHTML = bmData.map(bm =>
            `<option value="${bm.id}">${bm.name} (${bm.accounts.length} conta${bm.accounts.length !== 1 ? 's' : ''})</option>`
        ).join('');

        // Listener de troca de BM → atualiza contas
        bmSel.onchange = e => populateAccountSelector(e.target.value);

        // Listener de troca de conta → atualiza métricas
        document.getElementById('account-selector').onchange = e => {
            selectedAdAccountId = e.target.value;
            updateAccountBadge(e.target.selectedOptions[0]);
            syncMetaInsights();
        };

        // Popula contas da primeira BM
        populateAccountSelector(bmData[0]?.id);

    } catch (err) {
        console.error('BM load error:', err);
        bmSel.innerHTML = `<option>Erro: ${err.message}</option>`;
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

            // Scroll da página ao topo
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const { start, end, preset } = activePeriod;
    const periodStart = start || new Date().toISOString().split('T')[0];
    const periodEnd   = end   || new Date().toISOString();

    try {
        // 1. Fetch Sales no período selecionado
        const { data: sales, error: salesErr } = await _supabase
            .from('zimefy_vendas')
            .select('*')
            .gte('data_venda', periodStart)
            .lte('data_venda', periodEnd)
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
        const syncLabel = document.getElementById('sync-label');
        const periodLabel = preset === 'today' ? `Hoje, ${timeStr}` : preset === 'week' ? 'Últimos 7 dias' : preset === 'month' ? 'Últimos 30 dias' : 'Período personalizado';
        if (syncLabel) syncLabel.innerText = `Sincronizado: ${periodLabel}`;

        // 7. Gráfico — horário se "hoje", diário se período maior
        if (preset === 'today') {
            const hourlySales = Array(24).fill(0);
            const hourlySpend = Array(24).fill(0);
            const labels = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');
            sales.forEach(s => {
                const hour = new Date(s.data_venda).getHours();
                hourlySales[hour] += parseFloat(s.valor_liquido) || 0;
            });
            const currentHour = now.getHours();
            if (totalSpend > 0) {
                for (let i = 0; i <= currentHour; i++) hourlySpend[i] = totalSpend / (currentHour + 1);
            }
            initChart(hourlySales, hourlySpend, labels);
        } else {
            // Agrupa por dia
            const dayMap = {};
            const cursor = new Date(periodStart);
            const endDate = new Date(periodEnd);
            while (cursor <= endDate) {
                const key = cursor.toISOString().split('T')[0];
                dayMap[key] = 0;
                cursor.setDate(cursor.getDate() + 1);
            }
            sales.forEach(s => {
                const key = s.data_venda.split('T')[0];
                if (dayMap[key] !== undefined) dayMap[key] += parseFloat(s.valor_liquido) || 0;
            });
            const labels    = Object.keys(dayMap).map(d => d.slice(5)); // MM-DD
            const daySales  = Object.values(dayMap);
            const daySpend  = Array(labels.length).fill(0);
            initChart(daySales, daySpend, labels);
        } 

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


