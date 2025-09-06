const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const path = require('path');

const app = express();
const router = express.Router();

// --- Suas Configurações ---
// Estas chaves serão lidas a partir das Variáveis de Ambiente no Netlify
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID;

// O URL base do seu site Netlify. Ele é construído dinamicamente.
const getBaseUrl = (event) => {
  const headers = event.headers;
  const protocol = headers['x-forwarded-proto'] || 'http';
  const host = headers.host;
  return `${protocol}://${host}`;
};

// Rota de Login: Inicia o processo de autenticação com o Facebook
router.get('/login', (req, res) => {
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;
  
  // As permissões necessárias para ler os dados dos anúncios
  const scope = 'ads_read,read_insights';
  
  // Adicionamos auth_type=rerequest para forçar o ecrã de permissões todas as vezes.
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&auth_type=rerequest`;
  
  res.redirect(authUrl);
});

// Rota de Callback: O Facebook redireciona para cá após o login
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const event = req.apiGateway.event;
  const baseUrl = getBaseUrl(event);
  const redirectUri = `${baseUrl}/.netlify/functions/api/callback`;

  try {
    // Troca o código recebido por um token de acesso
    const tokenResponse = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        client_id: META_APP_ID,
        redirect_uri: redirectUri,
        client_secret: META_APP_SECRET,
        code,
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // Redireciona de volta para a página principal com o token de acesso
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

// Rota de Dados: Busca os dados dos anúncios usando o token de acesso
router.get('/data', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token de acesso é necessário.' });
  }

  try {
    // Faz a chamada à API de Marketing do Facebook
    const adDataResponse = await axios.get(`https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads`, {
      params: {
        access_token: token,
        // Os campos que queremos obter para a nossa análise
        fields: 'campaign_name,adset_name,ad_name,spend,impressions,actions,action_values',
        // Filtra para os últimos 30 dias
        date_preset: 'last_30d',
        // Limite de dados a serem retornados
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

