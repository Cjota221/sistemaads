const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
app.use(express.json()); // Permite que o Express analise corpos de requisição JSON
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
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&auth_type=rerequest`;
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;
  try {
    const tokenResponse = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: { client_id: META_APP_ID, redirect_uri: redirectUri, client_secret: META_APP_SECRET, code },
    });
    res.redirect(`/?access_token=${tokenResponse.data.access_token}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

// --- Rota de Dados do Facebook ---
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
    const fields = `name,campaign{name,effective_status},adset{name,effective_status,daily_budget},ad_creative{thumbnail_url},insights.time_range(${time_range}){spend,impressions,ctr,cpm,cpc,actions,action_values}`;
    const initialUrl = `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields}&limit=500`;
    const allAdData = await fetchAllPages(initialUrl);
    res.json({ data: allAdData });
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// --- Motor de Análise Baseado em Regras ---
function runRuleBasedAnalysis(userGoals, campaignData) {
    const insights = [];
    const roasGoal = parseFloat(userGoals.roasGoal);
    const cpaGoal = parseFloat(userGoals.cpaGoal);

    for (const adset of campaignData) {
        if (adset.spend < 1) continue; // Ignora conjuntos sem investimento significativo

        // Regra 1: Oportunidade de Escala
        if (adset.roas >= roasGoal && adset.cpa <= cpaGoal && adset.status === 'ACTIVE') {
            insights.push({
                priority: "Alta",
                title: `Oportunidade de Escala em "${adset.name}"`,
                diagnosis: `Este conjunto está com um excelente desempenho, com ROAS de ${adset.roas.toFixed(2)} (meta: ${roasGoal}) e CPA de R$ ${adset.cpa.toFixed(2)} (teto: R$ ${cpaGoal}).`,
                action_plan: [
                    "Aumente o orçamento diário deste conjunto em 20% para maximizar os resultados.",
                    "Continue a monitorizar o ROAS e o CPA de perto nas próximas 48 horas."
                ]
            });
        }

        // Regra 2: Alerta de Prejuízo
        if (adset.roas < 1.0 && adset.spend > cpaGoal * 2) { // Só alerta se o gasto já for considerável
             insights.push({
                priority: "Alta",
                title: `Alerta de Prejuízo em "${adset.name}"`,
                diagnosis: `Este conjunto gastou R$ ${adset.spend.toFixed(2)} e gerou apenas R$ ${adset.revenue.toFixed(2)} (ROAS de ${adset.roas.toFixed(2)}), resultando em prejuízo.`,
                action_plan: [
                    "Pause este conjunto de anúncios imediatamente para estancar o prejuízo.",
                    "Analise os criativos e o público antes de considerar reativá-lo com novas abordagens."
                ]
            });
        }
        
        // Regra 3: Otimização de CPA
        if (adset.roas >= 1.0 && adset.cpa > cpaGoal && adset.status === 'ACTIVE') {
            insights.push({
                priority: "Média",
                title: `Otimizar CPA em "${adset.name}"`,
                diagnosis: `O conjunto está a dar lucro (ROAS de ${adset.roas.toFixed(2)}), mas o Custo por Compra de R$ ${adset.cpa.toFixed(2)} está acima do seu teto de R$ ${cpaGoal}.`,
                action_plan: [
                    "Verifique os criativos com menor performance (CTR baixo) e pause-os.",
                    "Considere refinar o público-alvo para ser mais específico.",
                    "Não aumente o orçamento até que o CPA esteja sob controlo."
                ]
            });
        }
        
         // Regra 4: Criativo com Potencial
        if (adset.ctr > 2.5 && adset.cpc < 1.0 && adset.purchases < 2) {
             insights.push({
                priority: "Média",
                title: `Potencial em Criativos de "${adset.name}"`,
                diagnosis: `Este conjunto tem anúncios com excelente CTR (${adset.ctr.toFixed(2)}%) e CPC (R$ ${adset.cpc.toFixed(2)}), indicando que o público está interessado, mas não está a converter em compras.`,
                action_plan: [
                    "Verifique se a página de destino está a funcionar corretamente e otimizada para conversão.",
                    "Certifique-se de que a oferta no anúncio corresponde exatamente à da página de destino."
                ]
            });
        }
    }
    
    if (insights.length === 0) {
        insights.push({
            priority: "Baixa",
            title: "Nenhuma Ação Crítica Necessária",
            diagnosis: "Com base nas suas metas, as campanhas ativas parecem estáveis. Continue a monitorizar o desempenho.",
            action_plan: [
                "Verifique novamente amanhã para novos insights.",
                "Considere testar novos criativos para encontrar novas oportunidades."
            ]
        });
    }

    return insights;
}

// --- ROTA DE ANÁLISE (AGORA USA O MOTOR DE REGRAS INTERNO) ---
router.post('/analyze', async (req, res) => {
    const { userGoals, campaignData } = req.body;

    if (!userGoals || !campaignData) {
        return res.status(400).json({ error: 'Metas do utilizador e dados de campanha são necessários.' });
    }

    try {
        // Chama a função de análise local em vez da API externa
        const analysisResults = runRuleBasedAnalysis(userGoals, campaignData);
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
        const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, { params: { access_token: token, status } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao atualizar o status.', details: error.response ? error.response.data : {} });
    }
});

router.post('/update-adset-budget', async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    if (!token || !adset_id || !daily_budget) return res.status(400).json({ error: 'Token, adset_id e daily_budget são necessários.' });
    try {
        const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, { params: { access_token: token, daily_budget: parseFloat(daily_budget) * 100 } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao atualizar o orçamento.', details: error.response ? error.response.data : {} });
    }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

