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
  const scope = 'ads_read,read_insights';
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

// Rota de Dados
router.get('/data', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Token de acesso é necessário.' });
  }

  try {
    const adDataResponse = await axios.get(`https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads`, {
      params: {
        access_token: token,
        // **CORREÇÃO AQUI**
        // Os campos foram reestruturados para buscar as métricas dentro do campo 'insights'
        // e os nomes das campanhas/conjuntos de seus respectivos objetos.
        fields: 'name,campaign{name},adset{name},insights{spend,impressions,actions,action_values}',
        date_preset: 'last_30d',
        limit: 1000,
      },
    });
    res.json(adDataResponse.data);
  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

