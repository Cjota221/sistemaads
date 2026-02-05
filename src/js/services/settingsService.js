/**
 * CJOTA Analytics - Settings Service
 * Gerencia configurações do usuário
 */

import { getSupabase } from '../config/supabase.js';
import { DEFAULT_COST_CONFIG, DEFAULT_GOALS } from '../config/constants.js';

class SettingsService {
    constructor() {
        this.supabase = getSupabase();
        this.cachedSettings = null;
    }

    /**
     * Obtém as configurações do usuário
     */
    async getSettings() {
        if (this.cachedSettings) {
            return this.cachedSettings;
        }

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            return { ...DEFAULT_COST_CONFIG, ...DEFAULT_GOALS };
        }

        const { data, error } = await this.supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            console.error('Erro ao obter configurações:', error);
            return { ...DEFAULT_COST_CONFIG, ...DEFAULT_GOALS };
        }

        this.cachedSettings = {
            roasGoal: parseFloat(data.roas_goal) || DEFAULT_GOALS.roasGoal,
            cpaGoal: parseFloat(data.cpa_goal) || DEFAULT_GOALS.cpaGoal,
            precoMedioVenda: parseFloat(data.preco_medio_venda) || DEFAULT_COST_CONFIG.precoMedioVenda,
            custoDiretoUnitario: parseFloat(data.custo_direto_unitario) || DEFAULT_COST_CONFIG.custoDiretoUnitario,
            custoVariavelUnitario: parseFloat(data.custo_variavel_unitario) || DEFAULT_COST_CONFIG.custoVariavelUnitario,
            custosFixosMes: parseFloat(data.custos_fixos_mes) || DEFAULT_COST_CONFIG.custosFixosMes,
            metaVendasMes: parseInt(data.meta_vendas_mes) || DEFAULT_COST_CONFIG.metaVendasMes,
            lucroLiquidoParMeta: parseFloat(data.lucro_liquido_par_meta) || DEFAULT_COST_CONFIG.lucroLiquidoParMeta
        };

        return this.cachedSettings;
    }

    /**
     * Atualiza as configurações do usuário
     */
    async updateSettings(settings) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        const updateData = {
            roas_goal: settings.roasGoal,
            cpa_goal: settings.cpaGoal,
            preco_medio_venda: settings.precoMedioVenda,
            custo_direto_unitario: settings.custoDiretoUnitario,
            custo_variavel_unitario: settings.custoVariavelUnitario,
            custos_fixos_mes: settings.custosFixosMes,
            meta_vendas_mes: settings.metaVendasMes,
            lucro_liquido_par_meta: settings.lucroLiquidoParMeta
        };

        const { data, error } = await this.supabase
            .from('user_settings')
            .upsert({
                user_id: user.id,
                ...updateData
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar configurações:', error);
            throw error;
        }

        // Limpar cache
        this.cachedSettings = null;

        return data;
    }

    /**
     * Reseta as configurações para os valores padrão
     */
    async resetSettings() {
        const defaultSettings = { ...DEFAULT_COST_CONFIG, ...DEFAULT_GOALS };
        return await this.updateSettings(defaultSettings);
    }

    /**
     * Calcula métricas derivadas das configurações
     */
    calculateDerivedMetrics(settings, overallMetrics = {}) {
        const {
            precoMedioVenda,
            custoDiretoUnitario,
            custoVariavelUnitario,
            custosFixosMes,
            metaVendasMes,
            lucroLiquidoParMeta
        } = settings;

        const custoFixoUnitMeta = custosFixosMes / (metaVendasMes || 1);
        const custoTotalProdutoMeta = custoDiretoUnitario + custoVariavelUnitario + custoFixoUnitMeta;

        // Calcular com base nos dados reais se disponíveis
        const totalRevenue = overallMetrics.totalRevenue || 0;
        const totalPurchases = overallMetrics.totalPurchases || 0;
        const totalSpend = overallMetrics.totalSpend || 0;

        const qtdVendida = totalPurchases > 0 
            ? totalPurchases 
            : (precoMedioVenda > 0 ? totalRevenue / precoMedioVenda : 0);

        const ticketMedio = qtdVendida > 0 
            ? totalRevenue / qtdVendida 
            : precoMedioVenda;

        // ROAS Mínimo para empatar (sem lucro)
        let roasMinimo = 0;
        if (ticketMedio > 0) {
            const cpaBreakeven = ticketMedio - custoTotalProdutoMeta;
            if (cpaBreakeven > 0) {
                roasMinimo = ticketMedio / cpaBreakeven;
            }
        }

        // ROAS Ideal (com lucro desejado)
        let roasIdeal = 0;
        if (ticketMedio > 0) {
            const cpaIdealParaLucro = ticketMedio - custoTotalProdutoMeta - lucroLiquidoParMeta;
            if (cpaIdealParaLucro > 0) {
                roasIdeal = ticketMedio / cpaIdealParaLucro;
            }
        }

        // Lucro Real
        const lucroUnitarioReal = ticketMedio - custoTotalProdutoMeta;
        const lucroLiquido = lucroUnitarioReal * qtdVendida;
        const roasReal = totalSpend > 0 ? lucroLiquido / totalSpend : 0;
        const margemLiquida = totalRevenue > 0 ? (lucroLiquido / totalRevenue) * 100 : 0;
        const roiReal = totalSpend > 0 ? (lucroLiquido / totalSpend) * 100 : 0;

        return {
            custoFixoUnitMeta,
            custoTotalProdutoMeta,
            roasMinimo,
            roasIdeal,
            qtdVendida,
            ticketMedio,
            lucroUnitarioReal,
            lucroLiquido,
            roasReal,
            margemLiquida,
            roiReal
        };
    }

    /**
     * Limpa o cache de configurações
     */
    clearCache() {
        this.cachedSettings = null;
    }
}

export default new SettingsService();
