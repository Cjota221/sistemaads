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

// --- Rota de Dados do Facebook (ATUALIZADA) ---
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

router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });
  const time_range = JSON.stringify({ since: startDate, until: endDate });
  
  try {
    // CAMPOS EXPANDIDOS CONFORME A ESPECIFICAÇÃO
    const fields = `name,status,effective_status,created_time,updated_time,campaign{name,effective_status,objective,status,created_time,daily_budget,lifetime_budget},adset{name,effective_status,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,created_time},ad_creative{thumbnail_url,title,body,call_to_action_type,image_url,video_id},insights.time_range(${time_range}){spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values,cost_per_action_type,video_play_actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,inline_link_clicks,outbound_clicks,website_ctr,conversion_values,conversions}`;
    
    const initialUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields.replace(/\s+/g, '')}&limit=500`;
    const allAdData = await fetchAllPages(initialUrl);
    res.json({ data: allAdData });
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// --- Motor de Análise Baseado em Regras ---
function runRuleBasedAnalysis(userGoals, adsetsData) {
    const insights = [];
    const roasGoal = parseFloat(userGoals.roasGoal);
    const cpaGoal = parseFloat(userGoals.cpaGoal);

    for (const adset of adsetsData) {
        if (adset.spend < 5) continue; 
        if (adset.objective === 'OUTCOME_SALES' || adset.objective === 'OUTCOME_LEADS') {
            if (adset.roas >= roasGoal && adset.cpa <= cpaGoal) insights.push({ priority: "Alta", title: `Oportunidade de Escala em "${adset.name}"`, diagnosis: `Este conjunto de Vendas está com excelente performance: ROAS de ${adset.roas.toFixed(2)} e CPA de R$ ${adset.cpa.toFixed(2)}.`, action_plan: ["Aumente o orçamento diário em 20%.", "Continue a monitorizar o ROAS e o CPA."] });
            if (adset.roas < 1.0 && adset.spend > cpaGoal * 1.5) insights.push({ priority: "Alta", title: `Alerta de Prejuízo em "${adset.name}"`, diagnosis: `Gastou R$ ${adset.spend.toFixed(2)} e gerou apenas R$ ${adset.revenue.toFixed(2)} (ROAS de ${adset.roas.toFixed(2)}).`, action_plan: ["Pause este conjunto imediatamente.", "Analise os criativos e o público antes de reativar."] });
        }
        if (adset.objective === 'OUTCOME_MESSAGES') {
            const costPerConv = adset.costPerConv;
            if (costPerConv > 10) insights.push({ priority: "Média", title: `Otimizar Custo por Conversa em "${adset.name}"`, diagnosis: `Custo por Conversa está em R$ ${costPerConv.toFixed(2)}, o que pode ser alto.`, action_plan: ["Revise o CTA do anúncio.", "Teste novos criativos ou públicos."] });
            if (costPerConv > 0 && costPerConv <= 5) insights.push({ priority: "Alta", title: `Excelente Performance em "${adset.name}"`, diagnosis: `Este conjunto está a gerar conversas a um custo muito baixo (R$ ${costPerConv.toFixed(2)}).`, action_plan: ["Considere aumentar o orçamento para gerar mais conversas."] });
        }
        if (adset.objective === 'OUTCOME_TRAFFIC') {
             if (adset.cpc > 1.50) insights.push({ priority: "Média", title: `Otimizar Custo por Clique (CPC) em "${adset.name}"`, diagnosis: `O CPC de R$ ${adset.cpc.toFixed(2)} está alto.`, action_plan: ["Teste novas imagens/vídeos para aumentar o CTR.", "Refine o seu público-alvo."] });
        }
    }
    
    if (insights.length === 0) insights.push({ priority: "Baixa", title: "Nenhuma Ação Crítica Necessária", diagnosis: "As campanhas ativas parecem estáveis. Continue a monitorizar.", action_plan: ["Verifique novamente amanhã.", "Considere testar novos criativos."] });
    return insights;
}

// Rota de Análise
router.post('/analyze', async (req, res) => {
    const { userGoals, adsetsData } = req.body;
    if (!userGoals || !adsetsData) return res.status(400).json({ error: 'Metas e dados dos conjuntos são necessários.' });
    try {
        const analysisResults = runRuleBasedAnalysis(userGoals, adsetsData);
        res.json(analysisResults);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao processar a análise interna.', details: error.message });
    }
});

// --- Rotas de Gestão ---
router.post('/update-adset-status', async (req, res) => {
    const { token, adset_id, status } = req.body;
    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, { params: { access_token: token, status } });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: 'Falha ao atualizar o status.', details: error.response?.data || {} }) }
});

router.post('/update-adset-budget', async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, { params: { access_token: token, daily_budget: parseFloat(daily_budget) * 100 } });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: 'Falha ao atualizar o orçamento.', details: error.response?.data || {} }) }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

