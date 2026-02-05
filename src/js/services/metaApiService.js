/**
 * CJOTA Analytics - Meta API Service
 * Gerencia comunicação com a API do Meta/Facebook
 */

import { API_ENDPOINTS } from '../config/constants.js';
import authService from './authService.js';

class MetaApiService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutos
    }

    /**
     * Busca dados dos anúncios
     */
    async getAdsData(startDate, endDate, forceRefresh = false) {
        const cacheKey = `ads-${startDate}-${endDate}`;
        
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        const token = await authService.getMetaAccessToken();
        if (!token) {
            throw new Error('Token de acesso do Meta não disponível. Faça login novamente.');
        }

        const response = await fetch(
            `${API_ENDPOINTS.GET_DATA}?token=${token}&startDate=${startDate}&endDate=${endDate}`
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar dados: ${errorText}`);
        }

        const data = await response.json();
        
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    /**
     * Busca dados históricos
     */
    async getHistoricalData(startDate, endDate, forceRefresh = false) {
        const cacheKey = `historical-${startDate}-${endDate}`;
        
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        const token = await authService.getMetaAccessToken();
        if (!token) {
            throw new Error('Token de acesso do Meta não disponível.');
        }

        const response = await fetch(
            `${API_ENDPOINTS.GET_HISTORICAL}?token=${token}&startDate=${startDate}&endDate=${endDate}`
        );

        if (!response.ok) {
            throw new Error('Erro ao buscar dados históricos');
        }

        const data = await response.json();
        
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    /**
     * Busca dados demográficos
     */
    async getDemographicsData(startDate, endDate, forceRefresh = false) {
        const cacheKey = `demographics-${startDate}-${endDate}`;
        
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        const token = await authService.getMetaAccessToken();
        if (!token) {
            throw new Error('Token de acesso do Meta não disponível.');
        }

        const response = await fetch(
            `${API_ENDPOINTS.GET_DEMOGRAPHICS}?token=${token}&startDate=${startDate}&endDate=${endDate}`
        );

        if (!response.ok) {
            throw new Error('Erro ao buscar dados demográficos');
        }

        const data = await response.json();
        
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    /**
     * Atualiza o status de um conjunto de anúncios
     */
    async updateAdsetStatus(adsetId, status) {
        const token = await authService.getMetaAccessToken();
        if (!token) {
            throw new Error('Token de acesso do Meta não disponível.');
        }

        const response = await fetch(API_ENDPOINTS.UPDATE_STATUS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, adset_id: adsetId, status })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar status');
        }

        // Limpar cache após atualização
        this.clearCache();

        return await response.json();
    }

    /**
     * Atualiza o orçamento de um conjunto de anúncios
     */
    async updateAdsetBudget(adsetId, dailyBudget) {
        const token = await authService.getMetaAccessToken();
        if (!token) {
            throw new Error('Token de acesso do Meta não disponível.');
        }

        const response = await fetch(API_ENDPOINTS.UPDATE_BUDGET, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, adset_id: adsetId, daily_budget: dailyBudget })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar orçamento');
        }

        // Limpar cache após atualização
        this.clearCache();

        return await response.json();
    }

    /**
     * Solicita análise inteligente
     */
    async requestAnalysis(userGoals, adsetsData) {
        const response = await fetch(API_ENDPOINTS.ANALYZE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userGoals, adsetsData })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao gerar análise: ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Remove entradas antigas do cache
     */
    cleanOldCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }
}

export default new MetaApiService();
