/**
 * CJOTA Analytics - Creatives Page
 * Análise de criativos/anúncios
 */

import metaApiService from '../services/metaApiService.js';
import dataProcessor from '../services/dataProcessor.js';
import settingsService from '../services/settingsService.js';
import loadingManager from '../components/Loading.js';
import toastManager from '../components/Toast.js';
import { formatCurrency, formatNumber, getDefaultDates } from '../utils/helpers.js';

let creatives = [];

export async function initCreatives() {
    const container = document.getElementById('app-content');
    container.innerHTML = getCreativesHTML();
    
    document.getElementById('creatives-view')?.classList.remove('hidden');
    
    await loadCreativesData();
}

function getCreativesHTML() {
    return `
        <div id="creatives-view" data-view="creatives">
            <header class="text-left mb-10">
                <h2 class="text-3xl md:text-4xl font-bold text-slate-100">Análise de Criativos</h2>
                <p class="text-slate-400 mt-1">Identifique os criativos vencedores e perdedores.</p>
            </header>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700">
                    <h3 class="text-xl font-bold mb-4 text-green-400">🏆 Top Criativos</h3>
                    <div id="top-creatives-content" class="space-y-4"></div>
                </div>
                
                <div class="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700">
                    <h3 class="text-xl font-bold mb-4 text-red-400">💀 Piores Criativos</h3>
                    <div id="worst-creatives-content" class="space-y-4"></div>
                </div>
            </div>
        </div>
    `;
}

async function loadCreativesData() {
    const loaderId = loadingManager.show('Analisando criativos...');
    
    try {
        const { startDate, endDate } = getDefaultDates();
        const settings = await settingsService.getSettings();
        const adsData = await metaApiService.getAdsData(startDate, endDate);
        const structuredData = dataProcessor.structureCampaignData(adsData.data || []);
        
        const overallMetrics = dataProcessor.calculateOverallMetrics(adsData.data || []);
        const costConfig = settingsService.calculateDerivedMetrics(settings, overallMetrics);
        
        creatives = dataProcessor.extractCreativesWithMetrics(structuredData, costConfig);
        renderCreatives();
        
    } catch (error) {
        toastManager.error(`Erro ao carregar criativos: ${error.message}`);
    } finally {
        loadingManager.hide(loaderId);
    }
}

function renderCreatives() {
    const topCreatives = creatives.filter(c => c.lucroReal > 0).sort((a, b) => b.lucroReal - a.lucroReal).slice(0, 10);
    const worstCreatives = creatives.filter(c => c.lucroReal <= 0).sort((a, b) => a.lucroReal - b.lucroReal).slice(0, 10);
    
    document.getElementById('top-creatives-content').innerHTML = topCreatives.length > 0
        ? topCreatives.map(c => createCreativeCard(c)).join('')
        : '<p class="text-slate-500 text-center py-4">Nenhum criativo lucrativo encontrado.</p>';
    
    document.getElementById('worst-creatives-content').innerHTML = worstCreatives.length > 0
        ? worstCreatives.map(c => createCreativeCard(c)).join('')
        : '<p class="text-slate-500 text-center py-4">Nenhum criativo com prejuízo encontrado.</p>';
}

function createCreativeCard(ad) {
    return `
        <div class="flex gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            ${ad.thumbnailUrl 
                ? `<img src="${ad.thumbnailUrl}" class="w-20 h-20 object-cover rounded-lg flex-shrink-0">`
                : `<div class="thumbnail-placeholder w-20 h-20"></div>`
            }
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-slate-200 truncate">${ad.name}</p>
                <p class="text-xs text-slate-500 truncate">${ad.campaignName}</p>
                <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <span class="text-slate-400">Lucro: <span class="font-bold ${ad.lucroReal > 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(ad.lucroReal)}</span></span>
                    <span class="text-slate-400">ROAS Real: <span class="font-bold">${formatNumber(ad.roasReal)}</span></span>
                </div>
            </div>
        </div>
    `;
}

export default { initCreatives };
