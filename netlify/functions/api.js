const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
app.use(express.json()); 
const router = express.Router();

// --- Configurações ---
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID;

const getBaseUrl = (event) => {
  const headers = event.headers;
  const protocol = headers['x-forwarded-proto'] || 'http';
  const host = headers.host;
  return `${protocol}://${host}`;
};

// --- Rotas de Autenticação ---
router.get('/login', (req, res) => {
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;
  const scope = 'ads_read,read_insights,ads_management';
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&auth_type=rerequest`;
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;
  try {
    const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: { client_id: META_APP_ID, redirect_uri: redirectUri, client_secret: META_APP_SECRET, code },
    });
    res.redirect(`/?access_token=${tokenResponse.data.access_token}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

// --- Função para buscar com paginação ---
const fetchAllPages = async (url, allData = []) => {
  try {
    const response = await axios.get(url);
    const data = response.data.data;
    allData.push(...data);
    if (response.data.paging && response.data.paging.next) {
      return await fetchAllPages(response.data.paging.next, allData);
    }
    return allData;
  } catch (error) {
    console.error('Erro durante a busca paginada:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// --- Rota de Dados EXPANDIDA ---
router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });
  
  const time_range = JSON.stringify({ since: startDate, until: endDate });
  
  try {
    // CAMPOS EXPANDIDOS com muito mais métricas
    const fields = `
      name,
      status,
      effective_status,
      created_time,
      updated_time,
      campaign{
        name,
        effective_status,
        objective,
        status,
        created_time,
        daily_budget,
        lifetime_budget
      },
      adset{
        name,
        effective_status,
        status,
        daily_budget,
        lifetime_budget,
        targeting,
        optimization_goal,
        billing_event,
        bid_amount,
        created_time
      },
      ad_creative{
        thumbnail_url,
        title,
        body,
        call_to_action_type,
        image_url,
        video_id
      },
      insights.time_range(${time_range}){
        spend,
        impressions,
        clicks,
        ctr,
        cpm,
        cpc,
        reach,
        frequency,
        actions,
        action_values,
        cost_per_action_type,
        video_play_actions,
        video_avg_time_watched_actions,
        video_p25_watched_actions,
        video_p50_watched_actions,
        video_p75_watched_actions,
        video_p100_watched_actions,
        inline_link_clicks,
        outbound_clicks,
        website_ctr,
        conversion_values,
        conversions
      }
    `.replace(/\s+/g, '');

    const initialUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields}&limit=500`;
    const allAdData = await fetchAllPages(initialUrl);

    // Processar dados para adicionar métricas calculadas
    const processedData = allAdData.map(ad => {
      if (ad.insights?.data?.[0]) {
        const insights = ad.insights.data[0];
        
        // Calcular métricas adicionais
        const spend = parseFloat(insights.spend || 0);
        const revenue = parseFloat(insights.action_values?.find(a => a.action_type === 'purchase')?.value || 0);
        const purchases = parseInt(insights.actions?.find(a => a.action_type === 'purchase')?.value || 0);
        const leads = parseInt(insights.actions?.find(a => a.action_type === 'lead')?.value || 0);
        const conversations = parseInt(insights.actions?.find(a => a.action_type.includes('messaging_conversation'))?.value || 0);
        
        // Adicionar métricas calculadas ao insights
        insights.calculated = {
          roas: spend > 0 ? revenue / spend : 0,
          cpa: purchases > 0 ? spend / purchases : 0,
          cost_per_lead: leads > 0 ? spend / leads : 0,
          cost_per_conversation: conversations > 0 ? spend / conversations : 0,
          profit: revenue - spend,
          profit_margin: revenue > 0 ? ((revenue - spend) / revenue) * 100 : 0,
          video_engagement_rate: insights.video_play_actions?.find(a => a.action_type === 'video_view')?.value || 0,
          link_ctr: insights.inline_link_clicks && insights.impressions ? (insights.inline_link_clicks / insights.impressions * 100) : 0
        };
      }
      return ad;
    });

    res.json({ data: processedData });
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// --- Rota para dados demográficos ---
router.get('/demographics', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });
  
  const time_range = JSON.stringify({ since: startDate, until: endDate });
  
  try {
    const breakdowns = ['age,gender', 'country', 'placement', 'device_platform', 'hourly_stats_aggregated_by_advertiser_time_zone'];
    const demographicData = {};
    
    for (const breakdown of breakdowns) {
      const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?access_token=${token}&time_range=${time_range}&breakdowns=${breakdown}&fields=spend,impressions,clicks,ctr,cpm,actions,action_values&limit=1000`;
      
      try {
        const response = await axios.get(url);
        demographicData[breakdown.replace(',', '_')] = response.data.data;
      } catch (err) {
        console.warn(`Erro ao buscar breakdown ${breakdown}:`, err.message);
        demographicData[breakdown.replace(',', '_')] = [];
      }
    }
    
    res.json(demographicData);
  } catch (error) {
    console.error('Erro ao buscar dados demográficos:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados demográficos.', details: error.response ? error.response.data : {} });
  }
});

// --- Rota para dados históricos (últimos 30 dias por dia) ---
router.get('/historical', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });
  
  try {
    // Buscar dados dos últimos 30 dias
    const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?access_token=${token}&time_increment=1&date_preset=last_30d&fields=spend,impressions,clicks,ctr,cpm,actions,action_values,reach,frequency&limit=1000`;
    
    const response = await axios.get(url);
    const historicalData = response.data.data.map(day => {
      const revenue = parseFloat(day.action_values?.find(a => a.action_type === 'purchase')?.value || 0);
      const spend = parseFloat(day.spend || 0);
      const purchases = parseInt(day.actions?.find(a => a.action_type === 'purchase')?.value || 0);
      
      return {
        ...day,
        date: day.date_start,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: purchases > 0 ? spend / purchases : 0,
        profit: revenue - spend
      };
    });
    
    res.json({ data: historicalData });
  } catch (error) {
    console.error('Erro ao buscar dados históricos:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados históricos.', details: error.response ? error.response.data : {} });
  }
});

// --- Motor de Análise APRIMORADO ---
function runAdvancedAnalysis(userGoals, adsetsData, historicalData = []) {
    const insights = [];
    const roasGoal = parseFloat(userGoals.roasGoal);
    const cpaGoal = parseFloat(userGoals.cpaGoal);

    // Análise de tendência histórica
    const avgHistoricalROAS = historicalData.length > 0 ? 
        historicalData.reduce((sum, day) => sum + day.roas, 0) / historicalData.length : 0;
    
    for (const adset of adsetsData) {
        if (adset.spend < 5) continue;

        // === ANÁLISES EXPANDIDAS ===
        
        // Análise de Fadiga de Criativo
        if (adset.frequency > 3 && adset.ctr < 1.5) {
            insights.push({
                priority: "Alta",
                title: `Fadiga de Criativo Detectada em "${adset.name}"`,
                diagnosis: `Alta frequência (${adset.frequency.toFixed(2)}) e baixo CTR (${adset.ctr.toFixed(2)}%) indicam fadiga de público.`,
                action_plan: [
                    "Substitua os criativos por versões novas e frescas",
                    "Teste novos formatos (vídeo se usando imagem, ou vice-versa)",
                    "Considere expandir o público-alvo para reduzir a frequência"
                ],
                metrics: {
                    frequency: adset.frequency,
                    ctr: adset.ctr,
                    spend: adset.spend
                }
            });
        }

        // Análise de Vídeo Performance
        if (adset.video_p75_watched > 0) {
            const completion_rate = adset.video_p100_watched / adset.video_play_actions * 100;
            if (completion_rate < 25) {
                insights.push({
                    priority: "Média",
                    title: `Baixa Taxa de Conclusão de Vídeo em "${adset.name}"`,
                    diagnosis: `Apenas ${completion_rate.toFixed(1)}% dos usuários assistem o vídeo completo.`,
                    action_plan: [
                        "Reduza a duração do vídeo para aumentar a taxa de conclusão",
                        "Melhore o hook dos primeiros 3 segundos",
                        "Teste diferentes CTAs no final do vídeo"
                    ],
                    metrics: {
                        completion_rate: completion_rate,
                        video_plays: adset.video_play_actions
                    }
                });
            }
        }

        // Análise de Performance vs. Histórico
        if (avgHistoricalROAS > 0 && adset.roas < avgHistoricalROAS * 0.8) {
            insights.push({
                priority: "Alta",
                title: `Performance Abaixo da Média Histórica em "${adset.name}"`,
                diagnosis: `ROAS atual (${adset.roas.toFixed(2)}) está 20% abaixo da média histórica (${avgHistoricalROAS.toFixed(2)}).`,
                action_plan: [
                    "Analise mudanças recentes em criativos ou públicos",
                    "Verifique se houve alterações na landing page",
                    "Considere voltar para configurações que funcionavam antes"
                ],
                metrics: {
                    current_roas: adset.roas,
                    historical_avg: avgHistoricalROAS,
                    variance: ((adset.roas - avgHistoricalROAS) / avgHistoricalROAS * 100)
                }
            });
        }

        // Análise de Oportunidade de Link Clicks
        if (adset.link_ctr > 2.0 && adset.roas < roasGoal * 0.9) {
            insights.push({
                priority: "Média",
                title: `Alto Engajamento, Baixa Conversão em "${adset.name}"`,
                diagnosis: `Bom Link CTR (${adset.link_ctr.toFixed(2)}%) mas ROAS abaixo da meta. Problema pode estar na landing page.`,
                action_plan: [
                    "Otimize a landing page para melhorar conversões",
                    "Teste diferentes ofertas ou CTAs na página",
                    "Verifique a velocidade de carregamento da página"
                ],
                metrics: {
                    link_ctr: adset.link_ctr,
                    roas: adset.roas,
                    roas_goal: roasGoal
                }
            });
        }

        // Regras originais aprimoradas
        if (adset.objective === 'OUTCOME_SALES' || adset.objective === 'OUTCOME_LEADS') {
            if (adset.roas >= roasGoal && adset.cpa <= cpaGoal && adset.frequency < 2.5) {
                insights.push({
                    priority: "Alta",
                    title: `Oportunidade Premium de Escala em "${adset.name}"`,
                    diagnosis: `Performance excepcional: ROAS ${adset.roas.toFixed(2)} (meta: ${roasGoal}), CPA R$ ${adset.cpa.toFixed(2)} (teto: R$ ${cpaGoal}), baixa frequência (${adset.frequency.toFixed(2)}).`,
                    action_plan: [
                        "Aumente o orçamento em 30-50% imediatamente",
                        "Duplique este conjunto com público similar",
                        "Monitore de perto por 48h para manter a performance"
                    ],
                    metrics: {
                        roas: adset.roas,
                        cpa: adset.cpa,
                        frequency: adset.frequency,
                        daily_spend: adset.spend
                    }
                });
            }
        }
    }

    // Análise Global de Conta
    const totalSpend = adsetsData.reduce((sum, adset) => sum + adset.spend, 0);
    const totalRevenue = adsetsData.reduce((sum, adset) => sum + adset.revenue, 0);
    const accountROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    if (accountROAS < roasGoal * 0.8) {
        insights.push({
            priority: "Crítica",
            title: "Performance Geral da Conta Abaixo do Esperado",
            diagnosis: `ROAS geral da conta (${accountROAS.toFixed(2)}) está significativamente abaixo da meta (${roasGoal}).`,
            action_plan: [
                "Pause imediatamente os conjuntos com ROAS < 2.0",
                "Concentre orçamento nos top performers",
                "Faça auditoria completa de criativos e públicos"
            ],
            metrics: {
                account_roas: accountROAS,
                target_roas: roasGoal,
                total_spend: totalSpend,
                total_revenue: totalRevenue
            }
        });
    }

    if (insights.length === 0) {
        insights.push({
            priority: "Baixa",
            title: "Performance Estável - Monitoramento Ativo",
            diagnosis: "Campanhas dentro dos parâmetros normais. Continue monitorando oportunidades.",
            action_plan: [
                "Teste novos criativos para evitar fadiga",
                "Analise novos públicos para expansão",
                "Monitore mudanças na concorrência"
            ],
            metrics: {
                account_status: "stable"
            }
        });
    }

    return insights.sort((a, b) => {
        const priorityOrder = { "Crítica": 4, "Alta": 3, "Média": 2, "Baixa": 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}

// Rota de Análise Aprimorada
router.post('/analyze', async (req, res) => {
    const { userGoals, adsetsData, historicalData } = req.body;

    if (!userGoals || !adsetsData) {
        return res.status(400).json({ error: 'Metas do usuário e dados dos conjuntos são necessários.' });
    }

    try {
        const analysisResults = runAdvancedAnalysis(userGoals, adsetsData, historicalData || []);
        res.json(analysisResults);
    } catch (error) {
        console.error('Erro durante análise avançada:', error.message);
        res.status(500).json({ error: 'Falha ao processar análise.', details: error.message });
    }
});

// --- Rotas de Gestão (mantidas) ---
router.post('/update-adset-status', async (req, res) => {
    const { token, adset_id, status } = req.body;
    if (!token || !adset_id || !status) return res.status(400).json({ error: 'Token, adset_id e status são necessários.' });
    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, { params: { access_token: token, status } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao atualizar o status.', details: error.response ? error.response.data : {} });
    }
});

router.post('/update-adset-budget', async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    if (!token || !adset_id || !daily_budget) return res.status(400).json({ error: 'Token, adset_id e daily_budget são necessários.' });
    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, { params: { access_token: token, daily_budget: parseFloat(daily_budget) * 100 } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao atualizar o orçamento.', details: error.response ? error.response.data : {} });
    }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
