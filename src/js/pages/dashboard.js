/**
 * CJOTA Analytics - Dashboard Page
 * Página principal com visão geral de métricas e análises
 */

import settingsService from '../services/settingsService.js';
import metaApiService from '../services/metaApiService.js';
import dataProcessor from '../services/dataProcessor.js';
import loadingManager from '../components/Loading.js';
import toastManager from '../components/Toast.js';
import { formatCurrency, formatNumber, getDefaultDates, getPerformanceColor } from '../utils/helpers.js';
import { CAMPAIGN_OBJECTIVES } from '../config/constants.js';

let rawData = [];
let structuredData = [];
let costConfig = {};
let settings = {};

// Função global para pausar adset (chamada via onclick)
window.pauseAdset = async function(adsetId, adsetName) {
    if (!confirm(`Deseja pausar o conjunto "${adsetName}"?`)) return;
    
    try {
        await metaApiService.updateAdsetStatus(adsetId, 'PAUSED');
        toastManager.success(`Conjunto "${adsetName}" pausado com sucesso!`);
        await loadDashboardData(true);
    } catch (error) {
        toastManager.error(`Erro ao pausar: ${error.message}`);
    }
};

export async function initDashboard() {
    const container = document.getElementById('app-content');
    container.innerHTML = getDashboardHTML();
    
    // Mostrar view do dashboard
    document.getElementById('dashboard-view')?.classList.remove('hidden');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Carregar dados
    await loadDashboardData();
}

function getDashboardHTML() {
    const { startDate, endDate } = getDefaultDates();
    
    return `
        <div id="dashboard-view" data-view="dashboard">
            <header class="text-left mb-10">
                <h2 class="text-3xl md:text-4xl font-bold text-slate-100">Dashboard Estratégico</h2>
                <p class="text-slate-400 mt-1">Análise de Performance para Tomada de Decisão</p>
            </header>

            <!-- Controles de Data e Metas -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10" id="controls-container">
                <div class="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
                    <label for="start-date" class="block text-sm font-medium text-slate-400">Data de Início</label>
                    <input type="date" id="start-date" value="${startDate}" class="mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                </div>
                <div class="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
                    <label for="end-date" class="block text-sm font-medium text-slate-400">Data de Fim</label>
                    <input type="date" id="end-date" value="${endDate}" class="mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                </div>
                <div class="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
                    <label for="roas-goal" class="block text-sm font-medium text-slate-400">Meta de ROAS Facebook</label>
                    <input type="number" id="roas-goal" value="6.0" step="0.1" class="mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                </div>
                <div class="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
                    <label for="cpa-goal" class="block text-sm font-medium text-slate-400">Teto de CPA Facebook</label>
                    <input type="number" id="cpa-goal" value="30.00" step="0.50" class="mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                </div>
            </div>

            <!-- Painel de Saúde Financeira -->
            <div id="financial-health-panel" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div class="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-center">
                    <p class="text-sm font-semibold text-red-400">🔴 PERDENDO</p>
                    <p class="text-2xl font-bold text-white" id="health-perda-valor">R$ 0</p>
                    <p class="text-xs text-slate-400" id="health-perda-count">(0 campanhas)</p>
                </div>
                <div class="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg text-center">
                    <p class="text-sm font-semibold text-yellow-400">🟡 EMPATE</p>
                    <p class="text-2xl font-bold text-white" id="health-empate-valor">R$ 0</p>
                    <p class="text-xs text-slate-400" id="health-empate-count">(0 campanhas)</p>
                </div>
                <div class="bg-green-500/10 border border-green-500/30 p-4 rounded-lg text-center">
                    <p class="text-sm font-semibold text-green-400">🟢 LUCRANDO</p>
                    <p class="text-2xl font-bold text-white" id="health-lucro-valor">R$ 0</p>
                    <p class="text-xs text-slate-400" id="health-lucro-count">(0 campanhas)</p>
                </div>
                <div class="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg text-center">
                    <p class="text-sm font-semibold text-blue-400">🚀 ESCALA</p>
                    <p class="text-2xl font-bold text-white" id="health-escala-valor">R$ 0</p>
                    <p class="text-xs text-slate-400" id="health-escala-count">(0 campanhas)</p>
                </div>
            </div>

            <!-- KPIs Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10" id="kpi-grid"></div>

            <!-- Configuração de Custos -->
            <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700 mb-10" id="cost-config-section">
                <h3 class="text-lg font-bold text-slate-100 mb-4">⚙️ Configuração de Custos do Negócio</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Preço Médio de Venda (R$)</label>
                        <input type="number" id="preco-medio-venda" value="35.00" step="0.50" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Custo Direto Unitário</label>
                        <input type="number" id="custo-direto-unitario" value="17.73" step="0.01" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Custo Variável Unitário</label>
                        <input type="number" id="custo-variavel-unitario" value="2.40" step="0.01" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Custos Fixos/Mês</label>
                        <input type="number" id="custos-fixos-mes" value="13330.00" step="100" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Meta Vendas/Mês (Pares)</label>
                        <input type="number" id="meta-vendas-mes" value="1500" step="10" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-400">Lucro por Par (Meta)</label>
                        <input type="number" id="lucro-liquido-par-meta" value="5.00" step="0.50" class="cost-input mt-1 block w-full rounded-md shadow-sm text-sm dark-input">
                    </div>
                </div>
                <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded-lg">
                    <div class="text-center">
                        <p class="text-sm text-slate-400">Custo Total Unit. (Meta)</p>
                        <p class="text-2xl font-bold text-red-400" id="custo-total-produto-meta">R$ 0.00</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-slate-400">ROAS Mínimo para Empatar</p>
                        <p class="text-2xl font-bold text-yellow-400" id="roas-minimo-empate">0.0</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-slate-400">ROAS Ideal (Meta Lucro)</p>
                        <p class="text-2xl font-bold text-green-400" id="roas-ideal">0.0</p>
                    </div>
                </div>
            </div>

            <!-- Painéis de Ação -->
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
                <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700">
                    <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">🚀 Ações para Escalar</h3>
                    <div id="escalar-content" class="space-y-4"></div>
                </div>
                <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700">
                    <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-400">⚠️ Ações de Otimização</h3>
                    <div id="atencao-content" class="space-y-4"></div>
                </div>
                <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700">
                    <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">🛑 Ações para Pausar</h3>
                    <div id="pausar-content" class="space-y-4"></div>
                </div>
            </div>

            <!-- Charts -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div class="chart-container">
                    <h3 class="text-lg font-bold mb-4 text-slate-100">Performance Temporal</h3>
                    <canvas id="performance-chart"></canvas>
                </div>
                <div class="chart-container">
                    <h3 class="text-lg font-bold mb-4 text-slate-100">Performance por Dispositivo</h3>
                    <canvas id="device-chart"></canvas>
                </div>
            </div>
        </div>
    `;
}

function setupEventListeners() {
    // Date changes
    document.getElementById('start-date')?.addEventListener('change', () => loadDashboardData(true));
    document.getElementById('end-date')?.addEventListener('change', () => loadDashboardData(true));
    
    // Goals changes
    document.getElementById('roas-goal')?.addEventListener('change', updateDisplay);
    document.getElementById('cpa-goal')?.addEventListener('change', updateDisplay);
    
    // Cost inputs changes
    document.querySelectorAll('.cost-input').forEach(input => {
        input.addEventListener('input', updateDisplay);
    });
}

async function loadDashboardData(forceRefresh = false) {
    const loaderId = loadingManager.show('Carregando dados do dashboard...');
    
    try {
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;
        
        if (!startDate || !endDate) {
            throw new Error('Selecione o período de análise');
        }
        
        // Carregar configurações do usuário
        settings = await settingsService.getSettings();
        
        // Carregar dados da Meta API
        const adsData = await metaApiService.getAdsData(startDate, endDate, forceRefresh);
        rawData = adsData.data || [];
        
        // Processar dados
        structuredData = dataProcessor.structureCampaignData(rawData);
        const overallMetrics = dataProcessor.calculateOverallMetrics(rawData);
        
        // Atualizar configurações com métricas reais
        costConfig = settingsService.calculateDerivedMetrics(settings, overallMetrics);
        
        // Atualizar displays
        updateDisplay();
        
        toastManager.success('Dashboard atualizado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        toastManager.error(`Erro: ${error.message}`);
    } finally {
        loadingManager.hide(loaderId);
    }
}

function updateDisplay() {
    updateKPIs();
    updateFinancialHealth();
    updateActionPanels();
    updateCostCalculations();
}

function updateKPIs() {
    const kpiGrid = document.getElementById('kpi-grid');
    if (!kpiGrid || !rawData.length) return;
    
    const metrics = dataProcessor.calculateOverallMetrics(rawData);
    const roasGoal = parseFloat(document.getElementById('roas-goal')?.value) || 6;
    const cpaGoal = parseFloat(document.getElementById('cpa-goal')?.value) || 30;
    
    const kpis = [
        { label: 'Investimento', value: formatCurrency(metrics.totalSpend), color: 'text-slate-100' },
        { label: 'Receita', value: formatCurrency(metrics.totalRevenue), color: metrics.totalRevenue > metrics.totalSpend ? 'text-green-400' : 'text-red-400' },
        { label: 'ROAS', value: formatNumber(metrics.overallROAS), color: getPerformanceColor(metrics.overallROAS, roasGoal, true) },
        { label: 'CPA', value: formatCurrency(metrics.overallCPA), color: getPerformanceColor(metrics.overallCPA, cpaGoal, false) },
        { label: 'Compras', value: formatNumber(metrics.totalPurchases, 0), color: 'text-slate-100' },
        { label: 'CTR', value: formatNumber(metrics.overallCTR) + '%', color: getPerformanceColor(metrics.overallCTR, 1, true) }
    ];
    
    kpiGrid.innerHTML = kpis.map(kpi => `
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p class="text-xs text-slate-400">${kpi.label}</p>
            <p class="text-xl font-bold ${kpi.color}">${kpi.value}</p>
        </div>
    `).join('');
}

function updateFinancialHealth() {
    if (!structuredData.length || !costConfig.roasMinimo) return;
    
    const categories = dataProcessor.categorizeAdsetsByHealth(structuredData, costConfig);
    
    // Calcular totais por categoria
    const lossTotal = categories.loss.reduce((sum, a) => sum + a.lucroReal, 0);
    const breakEvenTotal = categories.breakEven.reduce((sum, a) => sum + a.lucroReal, 0);
    const profitTotal = categories.profit.reduce((sum, a) => sum + a.lucroReal, 0);
    const scaleTotal = categories.scale.reduce((sum, a) => sum + a.lucroReal, 0);
    
    // Atualizar painel de saúde
    document.getElementById('health-perda-valor').textContent = formatCurrency(lossTotal);
    document.getElementById('health-perda-count').textContent = `(${categories.loss.length} conjuntos)`;
    
    document.getElementById('health-empate-valor').textContent = formatCurrency(breakEvenTotal);
    document.getElementById('health-empate-count').textContent = `(${categories.breakEven.length} conjuntos)`;
    
    document.getElementById('health-lucro-valor').textContent = formatCurrency(profitTotal);
    document.getElementById('health-lucro-count').textContent = `(${categories.profit.length} conjuntos)`;
    
    document.getElementById('health-escala-valor').textContent = formatCurrency(scaleTotal);
    document.getElementById('health-escala-count').textContent = `(${categories.scale.length} conjuntos)`;
}

function updateActionPanels() {
    if (!structuredData.length || !costConfig.roasMinimo) return;
    
    const categories = dataProcessor.categorizeAdsetsByHealth(structuredData, costConfig);
    
    // Painel Escalar
    const escalarContent = document.getElementById('escalar-content');
    if (categories.scale.length > 0) {
        escalarContent.innerHTML = categories.scale.slice(0, 5).map(adset => `
            <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p class="font-semibold text-slate-100 truncate">${adset.name}</p>
                <p class="text-xs text-slate-400">${adset.campaignName}</p>
                <div class="flex gap-4 mt-2 text-xs">
                    <span class="text-green-400">ROAS: ${formatNumber(adset.roas)}</span>
                    <span class="text-green-400">Lucro: ${formatCurrency(adset.lucroReal)}</span>
                </div>
            </div>
        `).join('');
    } else {
        escalarContent.innerHTML = '<p class="text-slate-500 text-sm">Nenhum conjunto pronto para escalar.</p>';
    }
    
    // Painel Otimizar (empate)
    const atencaoContent = document.getElementById('atencao-content');
    if (categories.breakEven.length > 0) {
        atencaoContent.innerHTML = categories.breakEven.slice(0, 5).map(adset => `
            <div class="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p class="font-semibold text-slate-100 truncate">${adset.name}</p>
                <p class="text-xs text-slate-400">${adset.campaignName}</p>
                <div class="flex gap-4 mt-2 text-xs">
                    <span class="text-yellow-400">ROAS: ${formatNumber(adset.roas)}</span>
                    <span class="text-yellow-400">Lucro: ${formatCurrency(adset.lucroReal)}</span>
                </div>
            </div>
        `).join('');
    } else {
        atencaoContent.innerHTML = '<p class="text-slate-500 text-sm">Nenhum conjunto precisa de otimização.</p>';
    }
    
    // Painel Pausar (prejuízo)
    const pausarContent = document.getElementById('pausar-content');
    if (categories.loss.length > 0) {
        pausarContent.innerHTML = categories.loss.slice(0, 5).map(adset => `
            <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p class="font-semibold text-slate-100 truncate">${adset.name}</p>
                <p class="text-xs text-slate-400">${adset.campaignName}</p>
                <div class="flex gap-4 mt-2 text-xs">
                    <span class="text-red-400">ROAS: ${formatNumber(adset.roas)}</span>
                    <span class="text-red-400">Prejuízo: ${formatCurrency(adset.lucroReal)}</span>
                </div>
                <button class="mt-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded hover:bg-red-500/30" 
                        onclick="pauseAdset('${adset.id}', '${adset.name.replace(/'/g, "\\'")}')">
                    ⏸️ Pausar
                </button>
            </div>
        `).join('');
    } else {
        pausarContent.innerHTML = '<p class="text-slate-500 text-sm">Nenhum conjunto com prejuízo!</p>';
    }
}

function updateCostCalculations() {
    const precoMedioVenda = parseFloat(document.getElementById('preco-medio-venda')?.value) || 35;
    const custoDireto = parseFloat(document.getElementById('custo-direto-unitario')?.value) || 17.73;
    const custoVariavel = parseFloat(document.getElementById('custo-variavel-unitario')?.value) || 2.40;
    const custosFixos = parseFloat(document.getElementById('custos-fixos-mes')?.value) || 13330;
    const metaVendas = parseInt(document.getElementById('meta-vendas-mes')?.value) || 1500;
    const lucroMeta = parseFloat(document.getElementById('lucro-liquido-par-meta')?.value) || 5;
    
    const custoFixoUnit = custosFixos / (metaVendas || 1);
    const custoTotal = custoDireto + custoVariavel + custoFixoUnit;
    
    const roasMinimo = precoMedioVenda > 0 ? precoMedioVenda / (precoMedioVenda - custoTotal) : 0;
    const roasIdeal = precoMedioVenda > 0 ? precoMedioVenda / (precoMedioVenda - custoTotal - lucroMeta) : 0;
    
    document.getElementById('custo-total-produto-meta').textContent = formatCurrency(custoTotal);
    document.getElementById('roas-minimo-empate').textContent = formatNumber(roasMinimo, 1);
    document.getElementById('roas-ideal').textContent = formatNumber(roasIdeal, 1);
}

export default { initDashboard };
