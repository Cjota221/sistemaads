/**
 * CJOTA Analytics - Campaigns Page
 * Página de gerenciamento de campanhas
 */

import metaApiService from '../services/metaApiService.js';
import dataProcessor from '../services/dataProcessor.js';
import loadingManager from '../components/Loading.js';
import toastManager from '../components/Toast.js';
import modalManager from '../components/Modal.js';
import { formatCurrency, formatNumber, getDefaultDates } from '../utils/helpers.js';
import { CAMPAIGN_OBJECTIVES } from '../config/constants.js';

let structuredData = [];

export async function initCampaigns() {
    const container = document.getElementById('app-content');
    container.innerHTML = getCampaignsHTML();
    
    document.getElementById('campaigns-view')?.classList.remove('hidden');
    
    await loadCampaignsData();
}

function getCampaignsHTML() {
    return `
        <div id="campaigns-view" data-view="campaigns">
            <header class="text-left mb-10">
                <h2 class="text-3xl md:text-4xl font-bold text-slate-100">Gestão de Campanhas</h2>
                <p class="text-slate-400 mt-1">Visão detalhada e gestão de campanhas, conjuntos e anúncios.</p>
            </header>
            <div id="campaigns-content" class="space-y-6"></div>
        </div>
    `;
}

async function loadCampaignsData() {
    const loaderId = loadingManager.showInElement('campaigns-content', 'Carregando campanhas...');
    
    try {
        const { startDate, endDate } = getDefaultDates();
        const adsData = await metaApiService.getAdsData(startDate, endDate);
        structuredData = dataProcessor.structureCampaignData(adsData.data || []);
        renderCampaigns();
    } catch (error) {
        toastManager.error(`Erro ao carregar campanhas: ${error.message}`);
    } finally {
        loadingManager.hide(loaderId);
    }
}

function renderCampaigns() {
    const container = document.getElementById('campaigns-content');
    
    if (!structuredData || structuredData.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Nenhuma campanha encontrada.</p>';
        return;
    }
    
    container.innerHTML = structuredData.map(campaign => `
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <span class="text-xs font-bold px-3 py-1 rounded-full ${CAMPAIGN_OBJECTIVES[campaign.objective]?.color || 'bg-slate-600 text-slate-300'}">
                            ${CAMPAIGN_OBJECTIVES[campaign.objective]?.label || campaign.objective}
                        </span>
                        <h3 class="text-xl font-bold text-slate-100 mt-2">${campaign.name}</h3>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-slate-700/50 p-3 rounded-lg">
                        <p class="text-xs text-slate-400">Investimento</p>
                        <p class="text-lg font-bold text-slate-100">${formatCurrency(campaign.spend)}</p>
                    </div>
                    <div class="bg-slate-700/50 p-3 rounded-lg">
                        <p class="text-xs text-slate-400">Receita</p>
                        <p class="text-lg font-bold text-slate-100">${formatCurrency(campaign.revenue)}</p>
                    </div>
                    <div class="bg-slate-700/50 p-3 rounded-lg">
                        <p class="text-xs text-slate-400">ROAS</p>
                        <p class="text-lg font-bold text-slate-100">${formatNumber(campaign.roas)}</p>
                    </div>
                    <div class="bg-slate-700/50 p-3 rounded-lg">
                        <p class="text-xs text-slate-400">Compras</p>
                        <p class="text-lg font-bold text-slate-100">${campaign.purchases}</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

export default { initCampaigns };
