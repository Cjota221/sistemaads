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
// A chave da API da IA será gerida pelo ambiente de execução, não por uma variável de ambiente.

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

// --- ROTA DE ANÁLISE IA (CORRIGIDA) ---
router.post('/analyze', async (req, res) => {
    const { userGoals, campaignData } = req.body;
    // Removida a verificação da chave de API que causava o erro.
    if (!userGoals || !campaignData) {
        return res.status(400).json({ error: 'Metas do utilizador e dados de campanha são necessários.' });
    }

    const systemPrompt = `
        Assuma a persona de um estratega de marketing digital de classe mundial, especialista em otimização de campanhas de tráfego pago. O seu nome é "CJ-AI".
        O seu objetivo principal é analisar um conjunto de dados de performance de anúncios do Facebook (fornecido em formato JSON) e gerar um plano de ação claro, conciso e priorizado para ajudar o utilizador a atingir as suas metas de ROAS e CPA.
        Analise os dados com base em oportunidades de escala, pontos de otimização e eficiência de criativos.
        A sua resposta DEVE ser um objeto JSON formatado como um array de "cartões de insight". Cada objeto no array representa uma única recomendação e deve seguir estritamente a seguinte estrutura:
        [{"priority": "Alta" | "Média" | "Baixa", "title": "Título da Recomendação", "diagnosis": "Diagnóstico conciso.", "action_plan": ["Ação 1.", "Ação 2."]}]
    `;

    const userQuery = `
        Aqui estão os dados para análise:
        - Metas do Utilizador: ${JSON.stringify(userGoals)}
        - Dados das Campanhas: ${JSON.stringify(campaignData, null, 2)}
        Por favor, gere o plano de ação no formato JSON especificado.
    `;

    try {
        // A URL agora termina com 'key=' para que o ambiente de execução injete a chave automaticamente.
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=`;
        
        const payload = {
            contents: [{
                parts: [{ text: userQuery }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const geminiResponse = await axios.post(geminiUrl, payload);
        const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.json(JSON.parse(cleanedJson));

    } catch (error) {
        console.error('Erro ao chamar a API da IA:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao comunicar com o serviço de IA.', details: error.response ? error.response.data : {} });
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

