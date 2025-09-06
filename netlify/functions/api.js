const express = require('express');
const serverless = require('serverless-http'); // CORREÇÃO AQUI
const axios = require('axios');

const app = express();
const router = express.Router();
app.use(express.json());

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID;

const getBaseUrl = (event) => {
  const headers = event.headers;
  const protocol = headers['x-forwarded-proto'] || 'http';
  const host = headers.host;
  return `${protocol}://${host}`;
};

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
    const accessToken = tokenResponse.data.access_token;
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('Erro ao obter o token de acesso:', error.response ? error.response.data : error.message);
    res.status(500).send('Erro ao autenticar com o Facebook.');
  }
});

router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) return res.status(400).json({ error: 'Token de acesso é necessário.' });

  try {
    let allData = [];
    let nextUrl = `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads`;
    
    const time_range = JSON.stringify({
        since: startDate,
        until: endDate,
    });

    const params = {
      access_token: token,
      fields: 'name,status,effective_status,campaign{name},adset{id,name,status,effective_status,daily_budget},creative{thumbnail_url},insights{spend,actions,action_values,ctr,cpm,cpc}',
      time_range: time_range,
      limit: 100, 
    };

    while (nextUrl) {
      const response = await axios.get(nextUrl, { params: (nextUrl.includes('?') ? null : params) });
      allData = allData.concat(response.data.data);
      
      if (response.data.paging && response.data.paging.next) {
        nextUrl = response.data.paging.next;
      } else {
        nextUrl = null;
      }
    }
    
    res.json({ data: allData });

  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});


router.post('/update-adset-status', async (req, res) => {
    const { token, adset_id, status } = req.body;
    if (!token || !adset_id || !status) return res.status(400).json({ error: 'Token, adset_id e status são necessários.' });
    try {
        await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, { params: { status, access_token: token } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, details: error.response ? error.response.data : {} });
    }
});

router.post('/update-adset-budget', async (req, res) => {
    const { token, adset_id, daily_budget } = req.body;
    if (!token || !adset_id || !daily_budget) return res.status(400).json({ error: 'Token, adset_id e daily_budget são necessários.' });
    try {
        const budgetInCents = Math.round(parseFloat(daily_budget) * 100);
        await axios.post(`https://graph.facebook.com/v18.0/${adset_id}`, null, { params: { daily_budget: budgetInCents, access_token: token } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, details: error.response ? error.response.data : {} });
    }
});


app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

