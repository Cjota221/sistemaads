const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const path = require('path');

const app = express();
// Adicionado para permitir que o Express analise corpos de requisição JSON para as funções de update
app.use(express.json());
const router = express.Router();

// --- Suas Configurações ---
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID;

const getBaseUrl = (event) => {
  const headers = event.headers;
  const protocol = headers['x-forwarded-proto'] || 'http';
  const host = headers.host;
  return `${protocol}://${host}`;
};

// Rota de Login
router.get('/login', (req, res) => {
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;
  const scope = 'ads_read,read_insights,ads_management';
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&auth_type=rerequest`;
  res.redirect(authUrl);
});

// Rota de Callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;

  try {
    const tokenResponse = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        client_id: META_APP_ID,
        redirect_uri: redirectUri,
        client_secret: META_APP_SECRET,
        code,
      },
    });
    const accessToken = tokenResponse.data.access_token;
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

const fetchAllPages = async (url, allData = []) => {
  try {
    const response = await axios.get(url);
    const data = response.data.data;
    allData.push(...data);
    if (response.data.paging && response.data.paging.next) {
      return await fetchAllPages(response.data.paging.next, allData);
    } else {
      return allData;
    }
  } catch (error) {
    console.error('Erro durante a busca paginada:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Rota de Dados CORRIGIDA
router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Token de acesso é necessário.' });
  }

  const time_range = JSON.stringify({
    since: startDate,
    until: endDate,
  });

  try {
    const fields = `name,campaign{name,effective_status},adset{name,effective_status,daily_budget},ad_creative{thumbnail_url},insights.time_range(${time_range}){spend,impressions,ctr,cpm,cpc,actions,action_values}`;
    
    // **CORREÇÃO PRINCIPAL**: Aumentamos o limite de 100 para 500 para reduzir o número de chamadas à API.
    const initialUrl = `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields}&limit=500`;
    
    const allAdData = await fetchAllPages(initialUrl);
    res.json({ data: allAdData });

  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// Rota para ATUALIZAR STATUS do Conjunto de Anúncios
router.post('/update-adset-status', async (req, res) => {
  const { token, adset_id, status } = req.body;
  if (!token || !adset_id || !status) {
    return res.status(400).json({ error: 'Token, adset_id e status são necessários.' });
  }

  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, {
      params: {
        access_token: token,
        status: status,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erro ao atualizar status do conjunto:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao atualizar o status.', details: error.response ? error.response.data : {} });
  }
});

// Rota para ATUALIZAR ORÇAMENTO do Conjunto de Anúncios
router.post('/update-adset-budget', async (req, res) => {
  const { token, adset_id, daily_budget } = req.body;
  if (!token || !adset_id || !daily_budget) {
    return res.status(400).json({ error: 'Token, adset_id e daily_budget são necessários.' });
  }

  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, {
      params: {
        access_token: token,
        // O orçamento é enviado em centavos, então multiplicamos por 100
        daily_budget: parseFloat(daily_budget) * 100,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erro ao atualizar orçamento do conjunto:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao atualizar o orçamento.', details: error.response ? error.response.data : {} });
  }
});


app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

