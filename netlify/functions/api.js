const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const path = require('path');

const app = express();
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
  // Adicionando permissões para gerir campanhas e ler criativos
  const scope = 'ads_read,read_insights,ads_management,business_management';
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&auth_type=rerequest`;
  res.redirect(authUrl);
});

// Rota de Callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;

  try {
    const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
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

// Rota de Dados ATUALIZADA para buscar mais métricas e criativos
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
    // ATUALIZAÇÃO: Adicionamos 'effective_status', 'adset{daily_budget,effective_status}',
    // 'ad_creative{thumbnail_url}' e as métricas 'ctr', 'cpm', 'cpc' e 'clicks'.
    const fields = 'name,effective_status,campaign{name},adset{name,daily_budget,effective_status},insights{spend,impressions,clicks,ctr,cpm,cpc,actions,action_values},ad_creative{thumbnail_url}';
    const initialUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=${fields}&time_range=${time_range}&limit=100`;
    
    const allAdData = await fetchAllPages(initialUrl);

    res.json({ data: allAdData });

  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});


// Rota para ATUALIZAR STATUS do Adset
router.post('/update-adset-status', express.json(), async (req, res) => {
    const { token, adset_id, status } = req.body;
    if (!token || !adset_id || !status) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, {
            params: { access_token: token, status: status }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao atualizar status do adset:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao atualizar status.', details: error.response ? error.response.data : {} });
    }
});

// Rota para ATUALIZAR ORÇAMENTO do Adset
router.post('/update-adset-budget', express.json(), async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    if (!token || !adset_id || !daily_budget) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    try {
        // O orçamento é enviado em centavos, então multiplicamos por 100.
        const budgetInCents = Math.round(parseFloat(daily_budget) * 100);
        const response = await axios.post(`https://graph.facebook.com/v19.0/${adset_id}`, null, {
            params: { access_token: token, daily_budget: budgetInCents }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao atualizar orçamento do adset:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao atualizar orçamento.', details: error.response ? error.response.data : {} });
    }
});


app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

