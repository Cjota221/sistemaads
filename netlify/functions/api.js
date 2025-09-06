const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
const router = express.Router();
// Adiciona o middleware para parsear JSON no corpo das requisições
app.use(express.json()); 

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
  // Adicionamos a permissão 'ads_management' para poder pausar/editar
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
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });

  try {
    const adDataResponse = await axios.get(`https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads`, {
      params: {
        access_token: token,
        // Pedimos o ID do adset para saber qual pausar
        fields: 'name,campaign{name},adset{id,name},insights{spend,impressions,actions,action_values,ctr,cpm,cpc}',
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

// **NOVA ROTA** - Rota para Atualizar (Pausar) um Conjunto de Anúncios
router.post('/update-adset', async (req, res) => {
  const { token, adset_id, status } = req.body;

  if (!token || !adset_id || !status) {
    return res.status(400).json({ error: 'Token, adset_id e status são necessários.' });
  }

  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, {
        params: {
            status: status,
            access_token: token,
        }
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Erro ao atualizar o conjunto de anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o conjunto de anúncios.', details: error.response ? error.response.data : {} });
  }
});


app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

