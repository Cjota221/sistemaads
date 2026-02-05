/**
 * CJOTA Analytics - Analysis Page
 * Página de análise inteligente e recomendações
 */

import metaApiService from '../services/metaApiService.js';
import dataProcessor from '../services/dataProcessor.js';
import settingsService from '../services/settingsService.js';
import loadingManager from '../components/Loading.js';
import toastManager from '../components/Toast.js';
import { getDefaultDates } from '../utils/helpers.js';
import { ANALYSIS_PRIORITIES } from '../config/constants.js';

export async function initAnalysis() {
    const container = document.getElementById('app-content');
    container.innerHTML = getAnalysisHTML();
    
    document.getElementById('analysis-view')?.classList.remove('hidden');
    
    setupAnalysisListeners();
}

function getAnalysisHTML() {
    return `
        <div id="analysis-view" data-view="analysis">
            <header class="text-left mb-10">
                <h2 class="text-3xl md:text-4xl font-bold text-slate-100">Análise e Recomendações</h2>
                <p class="text-slate-400 mt-1">Ações sugeridas pelo sistema para otimizar os seus resultados.</p>
            </header>
            
            <div class="text-center mb-8">
                <button id="generate-analysis-btn" class="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition duration-300 shadow-lg hover:shadow-xl">
                    Gerar Novo Plano de Ação
                </button>
            </div>
            
            <div id="analysis-content" class="space-y-5"></div>
        </div>
    `;
}

function setupAnalysisListeners() {
    document.getElementById('generate-analysis-btn')?.addEventListener('click', generateAnalysis);
}

async function generateAnalysis() {
    const btn = document.getElementById('generate-analysis-btn');
    const content = document.getElementById('analysis-content');
    
    btn.disabled = true;
    const loaderId = loadingManager.showInElement('analysis-content', 'Analisando seus dados...');
    
    try {
        const { startDate, endDate } = getDefaultDates();
        const settings = await settingsService.getSettings();
        const adsData = await metaApiService.getAdsData(startDate, endDate);
        const structuredData = dataProcessor.structureCampaignData(adsData.data || []);
        
        // Preparar dados para análise
        const adsetsData = [];
        structuredData.forEach(campaign => {
            Object.values(campaign.adsets).forEach(adset => {
                adsetsData.push({
                    name: adset.name,
                    campaign_name: campaign.name,
                    objective: campaign.objective,
                    spend: adset.spend,
                    purchases: adset.purchases,
                    revenue: adset.revenue,
                    conversations: adset.conversations,
                    clicks: adset.clicks,
                    roas: adset.roas,
                    cpa: adset.cpa,
                    costPerConv: adset.costPerConv,
                    frequency: adset.frequency,
                    ctr: adset.ctr
                });
            });
        });
        
        const analysis = await metaApiService.requestAnalysis({
            roasGoal: settings.roasGoal,
            cpaGoal: settings.cpaGoal
        }, adsetsData);
        
        renderAnalysis(analysis);
        toastManager.success('Análise gerada com sucesso!');
        
    } catch (error) {
        toastManager.error(`Erro ao gerar análise: ${error.message}`);
        content.innerHTML = '<p class="text-red-400 text-center">Erro ao gerar análise.</p>';
    } finally {
        loadingManager.hide(loaderId);
        btn.disabled = false;
    }
}

function renderAnalysis(insights) {
    const content = document.getElementById('analysis-content');
    
    if (!insights || insights.length === 0) {
        content.innerHTML = '<p class="text-slate-500 text-center py-10">Nenhuma recomendação disponível.</p>';
        return;
    }
    
    content.innerHTML = insights.map(insight => `
        <div class="bg-slate-800 rounded-lg p-5 border-l-4 ${ANALYSIS_PRIORITIES[insight.priority]?.color || 'border-slate-500'}">
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-lg font-bold text-slate-100">${insight.title}</h4>
                <span class="text-xs font-semibold px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                    ${insight.priority}
                </span>
            </div>
            <p class="text-slate-400 mb-4 text-sm">${insight.diagnosis}</p>
            <div>
                <h5 class="font-bold text-slate-300 mb-2 text-sm">Plano de Ação:</h5>
                <ul class="list-disc list-inside space-y-1 text-slate-400 text-sm">
                    ${insight.action_plan.map(step => `<li>${step}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

export default { initAnalysis };
