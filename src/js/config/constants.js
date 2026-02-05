/**
 * CJOTA Analytics - Application Constants
 * Constantes e configurações globais da aplicação
 */

// Versão da API do Meta/Facebook
export const META_API_VERSION = 'v19.0';

// URLs da API
export const API_ENDPOINTS = {
    // Auth
    LOGIN: '/.netlify/functions/auth/login',
    CALLBACK: '/.netlify/functions/auth/callback',
    LOGOUT: '/.netlify/functions/auth/logout',
    
    // Data
    GET_DATA: '/.netlify/functions/meta-data/ads',
    GET_HISTORICAL: '/.netlify/functions/meta-data/historical',
    GET_DEMOGRAPHICS: '/.netlify/functions/meta-data/demographics',
    
    // Actions
    UPDATE_STATUS: '/.netlify/functions/meta-actions/status',
    UPDATE_BUDGET: '/.netlify/functions/meta-actions/budget',
    
    // Analysis
    ANALYZE: '/.netlify/functions/analyze'
};

// Configurações padrão de custos
export const DEFAULT_COST_CONFIG = {
    precoMedioVenda: 35.00,
    custoDiretoUnitario: 17.73,
    custoVariavelUnitario: 2.40,
    custosFixosMes: 13330.00,
    metaVendasMes: 1500,
    lucroLiquidoParMeta: 5.00
};

// Metas padrão de performance
export const DEFAULT_GOALS = {
    roasGoal: 6.0,
    cpaGoal: 30.0
};

// Mapeamento de objetivos de campanha
export const CAMPAIGN_OBJECTIVES = {
    'OUTCOME_SALES': { label: 'VENDAS', color: 'bg-green-500/20 text-green-300', icon: '💰' },
    'OUTCOME_LEADS': { label: 'LEADS', color: 'bg-blue-500/20 text-blue-300', icon: '📋' },
    'OUTCOME_MESSAGES': { label: 'MENSAGENS', color: 'bg-cyan-500/20 text-cyan-300', icon: '💬' },
    'OUTCOME_TRAFFIC': { label: 'TRÁFEGO', color: 'bg-purple-500/20 text-purple-300', icon: '🔗' },
    'OUTCOME_AWARENESS': { label: 'ALCANCE', color: 'bg-yellow-500/20 text-yellow-300', icon: '👁️' },
    'OUTCOME_ENGAGEMENT': { label: 'ENGAJAMENTO', color: 'bg-pink-500/20 text-pink-300', icon: '❤️' }
};

// Status de saúde financeira
export const HEALTH_STATUS = {
    LOSS: { key: 'perda', label: 'PERDENDO', color: 'red', emoji: '🔴' },
    BREAK_EVEN: { key: 'empate', label: 'EMPATE', color: 'yellow', emoji: '🟡' },
    PROFIT: { key: 'lucro', label: 'LUCRANDO', color: 'green', emoji: '🟢' },
    SCALE: { key: 'escala', label: 'ESCALA', color: 'blue', emoji: '🚀' }
};

// Prioridades de análise
export const ANALYSIS_PRIORITIES = {
    CRITICAL: { label: 'Crítica', color: 'border-red-500' },
    HIGH: { label: 'Alta', color: 'border-amber-500' },
    MEDIUM: { label: 'Média', color: 'border-blue-500' },
    INFO: { label: 'Informativo', color: 'border-slate-600' }
};

// Cores dos gráficos
export const CHART_COLORS = {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    gradient: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e']
};

// Configurações de cache
export const CACHE_CONFIG = {
    TTL_MINUTES: 15, // Tempo de vida do cache em minutos
    MAX_ENTRIES: 100
};

// Rotas da aplicação
export const ROUTES = {
    DASHBOARD: 'dashboard',
    CAMPAIGNS: 'campaigns',
    CREATIVES: 'creatives',
    ANALYSIS: 'analysis',
    SETTINGS: 'settings'
};

export default {
    META_API_VERSION,
    API_ENDPOINTS,
    DEFAULT_COST_CONFIG,
    DEFAULT_GOALS,
    CAMPAIGN_OBJECTIVES,
    HEALTH_STATUS,
    ANALYSIS_PRIORITIES,
    CHART_COLORS,
    CACHE_CONFIG,
    ROUTES
};
