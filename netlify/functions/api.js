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
    // Pede o 'objective' da campanha e métricas específicas como 'onsite_conversion_messaging_conversation_started_7d'
    const fields = `name,campaign{name,effective_status,objective},adset{name,effective_status,daily_budget},ad_creative{thumbnail_url},insights.time_range(${time_range}){spend,impressions,clicks,ctr,cpm,cpc,actions,action_values}`;
    const initialUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields}&limit=500`;
    const allAdData = await fetchAllPages(initialUrl);
    res.json({ data: allAdData });
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// --- Motor de Análise Baseado em Regras (ATUALIZADO) ---
function runRuleBasedAnalysis(userGoals, adsetsData) {
    const insights = [];
    const roasGoal = parseFloat(userGoals.roasGoal);
    const cpaGoal = parseFloat(userGoals.cpaGoal);

    for (const adset of adsetsData) {
        if (adset.spend < 5) continue; 

        // === REGRAS PARA CAMPANHAS DE VENDAS/LEADS ===
        if (adset.objective === 'OUTCOME_SALES' || adset.objective === 'OUTCOME_LEADS') {
            // Regra 1: Oportunidade de Escala (Vendas)
            if (adset.roas >= roasGoal && adset.cpa <= cpaGoal) {
                insights.push({
                    priority: "Alta",
                    title: `Oportunidade de Escala em "${adset.name}"`,
                    diagnosis: `Este conjunto de Vendas está com excelente performance: ROAS de ${adset.roas.toFixed(2)} (meta: ${roasGoal}) e CPA de R$ ${adset.cpa.toFixed(2)} (teto: R$ ${cpaGoal}).`,
                    action_plan: ["Aumente o orçamento diário deste conjunto em 20% para maximizar os resultados.", "Continue a monitorizar o ROAS e o CPA de perto nas próximas 48 horas."]
                });
            }
            // Regra 2: Alerta de Prejuízo (Vendas)
            if (adset.roas < 1.0 && adset.spend > cpaGoal * 1.5) {
                 insights.push({
                    priority: "Alta",
                    title: `Alerta de Prejuízo em "${adset.name}"`,
                    diagnosis: `Este conjunto de Vendas gastou R$ ${adset.spend.toFixed(2)} e gerou apenas R$ ${adset.revenue.toFixed(2)} (ROAS de ${adset.roas.toFixed(2)}), resultando em prejuízo.`,
                    action_plan: ["Pause este conjunto imediatamente para estancar o prejuízo.", "Analise os criativos e o público antes de reativar com novas abordagens."]
                });
            }
        }

        // === REGRAS PARA CAMPANHAS DE MENSAGENS ===
        if (adset.objective === 'OUTCOME_MESSAGES') {
            const costPerConv = adset.costPerConv;
            // Regra 3: Otimizar Custo por Conversa (Mensagens)
            if (costPerConv > 10) { // Custo por conversa acima de R$10
                insights.push({
                    priority: "Média",
                    title: `Otimizar Custo por Conversa em "${adset.name}"`,
                    diagnosis: `O Custo por Conversa Iniciada está em R$ ${costPerConv.toFixed(2)}, o que pode ser alto. O ideal é manter abaixo de R$10.`,
                    action_plan: ["Revise o texto do anúncio para garantir que a chamada para ação (CTA) para 'Enviar Mensagem' seja clara e atrativa.", "Teste novos criativos ou públicos para encontrar combinações mais eficientes."]
                });
            }
             // Regra 4: Bom Desempenho (Mensagens)
            if (costPerConv > 0 && costPerConv <= 5) { // Custo por conversa abaixo de R$5
                insights.push({
                    priority: "Alta",
                    title: `Excelente Performance em "${adset.name}"`,
                    diagnosis: `Este conjunto de Mensagens está a gerar conversas a um custo muito baixo (R$ ${costPerConv.toFixed(2)} por conversa).`,
                    action_plan: ["Considere aumentar o orçamento neste conjunto para gerar mais conversas a um bom custo.", "Mantenha os criativos atuais ativos, pois estão a performar bem."]
                });
            }
        }
        
        // === REGRAS PARA CAMPANHAS DE TRÁFEGO ===
        if (adset.objective === 'OUTCOME_TRAFFIC') {
             if (adset.cpc > 1.50) { // Custo por Clique acima de R$1.50
                insights.push({
                    priority: "Média",
                    title: `Otimizar Custo por Clique (CPC) em "${adset.name}"`,
                    diagnosis: `O CPC de R$ ${adset.cpc.toFixed(2)} está alto, indicando que os anúncios podem não estar atrativos o suficiente para o público.`,
                    action_plan: ["Teste novas imagens ou vídeos nos seus anúncios para aumentar a taxa de cliques (CTR).", "Refine o seu público para ser mais específico aos interesses de quem realmente clicaria no seu anúncio."]
                });
            }
        }
    }
    
    if (insights.length === 0) {
        insights.push({
            priority: "Baixa",
            title: "Nenhuma Ação Crítica Necessária",
            diagnosis: "Com base nas regras do sistema, as campanhas ativas parecem estáveis. Continue a monitorizar o desempenho.",
            action_plan: ["Verifique novamente amanhã para novos insights.", "Considere testar novos criativos para encontrar novas oportunidades."]
        });
    }

    return insights;
}

// Rota de Análise (Usa o motor de regras)
router.post('/analyze', async (req, res) => {
    const { userGoals, adsetsData } = req.body; // Alterado de campaignData para adsetsData

    if (!userGoals || !adsetsData) {
        return res.status(400).json({ error: 'Metas do utilizador e dados dos conjuntos de anúncios são necessários.' });
    }

    try {
        const analysisResults = runRuleBasedAnalysis(userGoals, adsetsData);
        res.json(analysisResults);
    } catch (error) {
        console.error('Erro durante a análise baseada em regras:', error.message);
        res.status(500).json({ error: 'Falha ao processar a análise interna.', details: error.message });
    }
});


// --- Rotas de Gestão ---
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

