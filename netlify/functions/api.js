const express = require('express');
const axios = require('axios');
const serverless = require('serverless-http');

const app = express();
const router = express.Router();

// --- CONFIGURAÇÃO (!! IMPORTANTE !!) ---
// Suas chaves foram inseridas aqui. Falta apenas o ID da Conta de Anúncios.
const META_APP_ID = '1282670113401964'; // SEU APP ID
const META_APP_SECRET = 'e866c4ebd088bf10f0818b5d75a83151'; // SUA CHAVE SECRETA
const AD_ACCOUNT_ID = 'act_1244920119465862'; // SUBSTITUA AQUI PELO ID DA SUA CONTA DE ANÚNCIOS

// --- Lógica da API ---
const getRedirectUri = (event) => {
  const host = event.headers.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/.netlify/functions/api/callback`;
};

// Rota para iniciar o login
router.get('/login', (req, res) => {
  const redirectUri = getRedirectUri(req.apiGateway.event);
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=ads_read,read_insights`;
  res.redirect(authUrl);
});

// Rota de callback do Facebook
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = getRedirectUri(req.apiGateway.event);

  if (!code) {
    return res.status(400).send('Erro: código de autorização não encontrado.');
  }

  try {
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&client_secret=${META_APP_SECRET}&code=${code}`;
    const response = await axios.get(tokenUrl);
    const accessToken = response.data.access_token;
    res.redirect(`/#access_token=${accessToken}`);
  } catch (error) {
    console.error('Erro ao obter token:', error.response ? error.response.data : error.message);
    res.status(500).send('Falha ao autenticar com o Facebook.');
  }
});

// Rota para buscar os dados de anúncios
router.get('/ad-data', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Token não fornecido.' });
  }
  const accessToken = authHeader.split(' ')[1];

  try {
    const fields = 'campaign_name,adset_name,ad_name,spend,actions,action_values,roas,cpa,cpm,ctr,impressions,reach';
    const adDataUrl = `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/insights?level=ad&fields=${fields}&date_preset=last_30d&access_token=${accessToken}`;
    
    const response = await axios.get(adDataUrl);
    const insights = response.data.data || [];

    const formattedData = insights.map(item => {
        const purchasesAction = item.actions?.find(a => a.action_type === 'purchase');
        const purchaseValueAction = item.action_values?.find(a => a.action_type === 'purchase');
        return {
            campaignName: item.campaign_name, adSetName: item.adset_name, adName: item.ad_name,
            spent: parseFloat(item.spend || 0), purchases: parseInt(purchasesAction?.value || 0),
            purchaseValue: parseFloat(purchaseValueAction?.value || 0),
            roas: parseFloat(item.roas?.[0]?.value || 0), cpm: parseFloat(item.cpm || 0),
            ctr: parseFloat(item.ctr || 0), impressions: parseInt(item.impressions || 0),
            reach: parseInt(item.reach || 0),
        };
    });
    res.json(formattedData);
  } catch (error) {
    console.error('Erro ao buscar dados:', error.response ? error.response.data.error : error.message);
    res.status(500).json({ error: 'Falha ao buscar dados da conta de anúncios.' });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

