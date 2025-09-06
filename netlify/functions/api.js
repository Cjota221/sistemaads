const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
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
      params: { client_id: META_APP_ID, redirect_uri: redirectUri, client_secret: META_APP_SECRET, code },
    });
    const accessToken = tokenResponse.data.access_token;
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

// Rota de Dados
router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query; // Recebe as datas
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });

  try {
    const params = {
        access_token: token,
        fields: 'name,effective_status,campaign{name,effective_status},adset{id,name,effective_status,daily_budget},insights{spend,impressions,actions,action_values,ctr,cpm,cpc}',
        limit: 1000,
    };

    // **ATUALIZAÇÃO AQUI**: Usa o intervalo de datas se fornecido, senão usa o padrão.
    if (startDate && endDate) {
        params.time_range = JSON.stringify({
            since: startDate,
            until: endDate,
        });
    } else {
        params.date_preset = 'last_30d';
    }

    const adDataResponse = await axios.get(`https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads`, { params });
    res.json(adDataResponse.data);
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

// Outras rotas (update-adset-status, update-adset-budget) permanecem as mesmas...
router.post('/update-adset-status', async (req, res) => {
  const { token, adset_id, status } = req.body;
  if (!token || !adset_id || !status) {
    return res.status(400).json({ error: 'Token, adset_id e status são necessários.' });
  }
  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, {
        params: { status: status, access_token: token }
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Erro ao atualizar o status do conjunto de anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o status.', details: error.response ? error.response.data : {} });
  }
});

router.post('/update-adset-budget', async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    if (!token || !adset_id || !daily_budget) {
      return res.status(400).json({ error: 'Token, adset_id e daily_budget são necessários.' });
    }
    try {
      const budgetInCents = Math.round(parseFloat(daily_budget) * 100);
      const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, {
          params: { daily_budget: budgetInCents, access_token: token }
      });
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('Erro ao atualizar o orçamento do conjunto de anúncios:', error.response ? error.response.data : error.message);
      res.status(500).json({ success: false, error: 'Erro ao atualizar o orçamento.', details: error.response ? error.response.data : {} });
    }
  });


app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

