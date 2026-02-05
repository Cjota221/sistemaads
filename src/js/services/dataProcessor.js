/**
 * CJOTA Analytics - Data Processor Service
 * Processa e estrutura dados da API do Meta
 */

class DataProcessor {
    /**
     * Estrutura dados de campanhas, conjuntos e anúncios
     */
    structureCampaignData(rawData) {
        const campaigns = {};

        rawData.forEach(ad => {
            if (!ad.campaign || !ad.insights?.data?.[0]) return;

            const insights = ad.insights.data[0];
            const campaignName = ad.campaign.name;

            // Inicializar campanha se não existir
            if (!campaigns[campaignName]) {
                campaigns[campaignName] = {
                    name: campaignName,
                    id: ad.campaign.id,
                    objective: ad.campaign.objective,
                    status: ad.campaign.status,
                    effectiveStatus: ad.campaign.effective_status,
                    spend: 0,
                    purchases: 0,
                    revenue: 0,
                    conversations: 0,
                    clicks: 0,
                    reach: 0,
                    frequency: 0,
                    impressions: 0,
                    adsets: {}
                };
            }

            const adsetName = ad.adset.name;

            // Inicializar adset se não existir
            if (!campaigns[campaignName].adsets[adsetName]) {
                campaigns[campaignName].adsets[adsetName] = {
                    name: adsetName,
                    id: ad.adset.id,
                    status: ad.adset.status,
                    effectiveStatus: ad.adset.effective_status,
                    dailyBudget: ad.adset.daily_budget ? parseFloat(ad.adset.daily_budget) / 100 : 0,
                    optimizationGoal: ad.adset.optimization_goal,
                    spend: 0,
                    purchases: 0,
                    revenue: 0,
                    conversations: 0,
                    clicks: 0,
                    reach: 0,
                    frequency: 0,
                    impressions: 0,
                    ctr: 0,
                    ads: []
                };
            }

            // Extrair métricas
            const spend = parseFloat(insights.spend || 0);
            
            // CORREÇÃO: Capturar TODOS os tipos de conversão de compra
            const purchaseTypes = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase'];
            const purchases = purchaseTypes.reduce((total, type) => {
                const action = insights.actions?.find(a => a.action_type === type);
                return total + parseInt(action?.value || 0);
            }, 0);
            
            const revenue = purchaseTypes.reduce((total, type) => {
                const action = insights.action_values?.find(a => a.action_type === type);
                return total + parseFloat(action?.value || 0);
            }, 0);
            
            // CORREÇÃO: Capturar todos os tipos de conversa
            const conversationTypes = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'messaging_conversation_started_7d'];
            const conversations = conversationTypes.reduce((total, type) => {
                const action = insights.actions?.find(a => a.action_type === type || a.action_type.includes(type));
                return total + parseInt(action?.value || 0);
            }, 0);
            
            const clicks = parseInt(insights.clicks || 0);
            const reach = parseInt(insights.reach || 0);
            const frequency = parseFloat(insights.frequency || 0);
            const impressions = parseInt(insights.impressions || 0);
            const ctr = parseFloat(insights.ctr || 0);
            const cpm = parseFloat(insights.cpm || 0);
            const cpc = parseFloat(insights.cpc || 0);

            const cpa = purchases > 0 ? (spend / purchases) : 0;
            const roas = spend > 0 ? (revenue / spend) : 0;
            const costPerConv = conversations > 0 ? (spend / conversations) : 0;

            // Dados do anúncio
            const adData = {
                name: ad.name,
                id: ad.id,
                status: ad.status,
                effectiveStatus: ad.effective_status,
                spend,
                purchases,
                revenue,
                conversations,
                clicks,
                reach,
                frequency,
                impressions,
                ctr,
                cpm,
                cpc,
                roas,
                cpa,
                costPerConv,
                thumbnailUrl: ad.ad_creative?.thumbnail_url || ad.ad_creative?.image_url,
                permalinkUrl: ad.ad_creative?.permalink_url,
                campaignName,
                adsetName,
                adsetId: ad.adset.id
            };

            campaigns[campaignName].adsets[adsetName].ads.push(adData);
        });

        // Agregar métricas nos níveis de adset e campanha
        Object.values(campaigns).forEach(campaign => {
            let campaignTotalImpressions = 0;
            let campaignTotalClicks = 0;
            // NOTA: Reach não pode ser somado corretamente - usamos o maior valor como estimativa

            Object.values(campaign.adsets).forEach(adset => {
                let adsetTotalImpressions = 0;
                let adsetTotalClicks = 0;
                let adsetMaxReach = 0; // Reach não pode ser somado

                adset.ads.forEach(ad => {
                    adset.spend += ad.spend;
                    adset.purchases += ad.purchases;
                    adset.revenue += ad.revenue;
                    adset.conversations += ad.conversations;
                    adsetTotalClicks += ad.clicks;
                    adsetTotalImpressions += ad.impressions;
                    // CORREÇÃO: Usar o maior reach como estimativa (não somar)
                    adsetMaxReach = Math.max(adsetMaxReach, ad.reach);
                });

                // CORREÇÃO: Usar valores agregados ao invés de médias
                adset.clicks = adsetTotalClicks;
                adset.impressions = adsetTotalImpressions;
                adset.reach = adsetMaxReach;
                
                // CORREÇÃO: CTR calculado corretamente como (cliques/impressões)*100
                adset.ctr = adsetTotalImpressions > 0 
                    ? (adsetTotalClicks / adsetTotalImpressions) * 100 
                    : 0;
                
                // Frequency: impressões / alcance
                adset.frequency = adset.reach > 0 
                    ? adsetTotalImpressions / adset.reach 
                    : 0;

                // Calcular ROAS e CPA do adset
                adset.roas = adset.spend > 0 ? adset.revenue / adset.spend : 0;
                adset.cpa = adset.purchases > 0 ? adset.spend / adset.purchases : 0;
                adset.costPerConv = adset.conversations > 0 ? adset.spend / adset.conversations : 0;
                adset.cpc = adsetTotalClicks > 0 ? adset.spend / adsetTotalClicks : 0;
                adset.cpm = adsetTotalImpressions > 0 ? (adset.spend / adsetTotalImpressions) * 1000 : 0;

                // Agregar para a campanha
                campaign.spend += adset.spend;
                campaign.purchases += adset.purchases;
                campaign.revenue += adset.revenue;
                campaign.conversations += adset.conversations;
                campaignTotalClicks += adsetTotalClicks;
                campaignTotalImpressions += adsetTotalImpressions;
            });

            campaign.clicks = campaignTotalClicks;
            campaign.impressions = campaignTotalImpressions;
            // CORREÇÃO: Para campanhas, somamos reach dos adsets (estimativa)
            campaign.reach = Object.values(campaign.adsets).reduce((max, adset) => Math.max(max, adset.reach), 0);
            
            // CORREÇÃO: CTR da campanha calculado corretamente
            campaign.ctr = campaignTotalImpressions > 0 
                ? (campaignTotalClicks / campaignTotalImpressions) * 100 
                : 0;
            
            campaign.frequency = campaign.reach > 0 
                ? campaignTotalImpressions / campaign.reach 
                : 0;

            // Calcular ROAS e CPA da campanha
            campaign.roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
            campaign.cpa = campaign.purchases > 0 ? campaign.spend / campaign.purchases : 0;
            campaign.cpc = campaignTotalClicks > 0 ? campaign.spend / campaignTotalClicks : 0;
            campaign.cpm = campaignTotalImpressions > 0 ? (campaign.spend / campaignTotalImpressions) * 1000 : 0;
        });

        return Object.values(campaigns);
    }

    /**
     * Calcula métricas gerais
     */
    calculateOverallMetrics(rawData) {
        const metrics = {
            totalSpend: 0,
            totalRevenue: 0,
            totalPurchases: 0,
            totalConversations: 0,
            totalClicks: 0,
            totalImpressions: 0,
            totalReach: 0
        };

        rawData.forEach(ad => {
            if (!ad.insights?.data?.[0]) return;
            
            const insights = ad.insights.data[0];
            metrics.totalSpend += parseFloat(insights.spend || 0);
            metrics.totalRevenue += parseFloat(insights.action_values?.find(a => a.action_type === 'purchase')?.value || 0);
            metrics.totalPurchases += parseInt(insights.actions?.find(a => a.action_type === 'purchase')?.value || 0);
            metrics.totalConversations += parseInt(insights.actions?.find(a => a.action_type.includes('messaging_conversation'))?.value || 0);
            metrics.totalClicks += parseInt(insights.clicks || 0);
            metrics.totalImpressions += parseInt(insights.impressions || 0);
            metrics.totalReach += parseInt(insights.reach || 0);
        });

        // Calcular médias
        metrics.overallROAS = metrics.totalSpend > 0 ? metrics.totalRevenue / metrics.totalSpend : 0;
        metrics.overallCPA = metrics.totalPurchases > 0 ? metrics.totalSpend / metrics.totalPurchases : 0;
        metrics.overallCPC = metrics.totalClicks > 0 ? metrics.totalSpend / metrics.totalClicks : 0;
        metrics.overallCTR = metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;

        return metrics;
    }

    /**
     * Categoriza adsets por saúde financeira
     */
    categorizeAdsetsByHealth(structuredData, costConfig) {
        const categories = {
            scale: [],      // ROAS >= roasIdeal * 1.5
            profit: [],     // roasIdeal <= ROAS < roasIdeal * 1.5
            breakEven: [],  // roasMinimo <= ROAS < roasIdeal
            loss: []        // ROAS < roasMinimo
        };

        structuredData.forEach(campaign => {
            if (campaign.objective !== 'OUTCOME_SALES' && campaign.objective !== 'OUTCOME_LEADS') {
                return;
            }

            Object.values(campaign.adsets).forEach(adset => {
                if (adset.spend === 0) return;

                const qtdVendida = adset.purchases > 0 
                    ? adset.purchases 
                    : (costConfig.precoMedioVenda > 0 ? adset.revenue / costConfig.precoMedioVenda : 0);

                const ticketMedio = qtdVendida > 0 ? adset.revenue / qtdVendida : costConfig.precoMedioVenda;
                const lucroUnitario = ticketMedio - costConfig.custoTotalProdutoMeta;
                const lucroReal = lucroUnitario * qtdVendida;
                const roasReal = adset.spend > 0 ? lucroReal / adset.spend : 0;

                const adsetWithMetrics = {
                    ...adset,
                    campaignName: campaign.name,
                    campaignObjective: campaign.objective,
                    lucroReal,
                    roasReal,
                    qtdVendida
                };

                if (roasReal >= costConfig.roasIdeal * 1.5) {
                    categories.scale.push(adsetWithMetrics);
                } else if (roasReal >= costConfig.roasIdeal) {
                    categories.profit.push(adsetWithMetrics);
                } else if (roasReal >= costConfig.roasMinimo) {
                    categories.breakEven.push(adsetWithMetrics);
                } else {
                    categories.loss.push(adsetWithMetrics);
                }
            });
        });

        return categories;
    }

    /**
     * Extrai todos os criativos (ads) com métricas calculadas
     */
    extractCreativesWithMetrics(structuredData, costConfig) {
        const creatives = [];

        structuredData.forEach(campaign => {
            if (campaign.objective !== 'OUTCOME_SALES' && campaign.objective !== 'OUTCOME_LEADS') {
                return;
            }

            Object.values(campaign.adsets).forEach(adset => {
                adset.ads.forEach(ad => {
                    const qtdVendida = ad.purchases > 0 
                        ? ad.purchases 
                        : (costConfig.precoMedioVenda > 0 ? ad.revenue / costConfig.precoMedioVenda : 0);

                    const ticketMedio = qtdVendida > 0 ? ad.revenue / qtdVendida : costConfig.precoMedioVenda;
                    const lucroUnitario = ticketMedio - costConfig.custoTotalProdutoMeta;
                    const lucroReal = lucroUnitario * qtdVendida;
                    const roasReal = ad.spend > 0 ? lucroReal / ad.spend : 0;

                    creatives.push({
                        ...ad,
                        campaignName: campaign.name,
                        lucroReal,
                        roasReal,
                        qtdVendida
                    });
                });
            });
        });

        return creatives;
    }
}

export default new DataProcessor();
