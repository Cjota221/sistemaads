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
  // CORREÇÃO: O cabeçalho correto é 'x-forwarded-proto'
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

/**
 * Função recursiva para buscar todos os dados da API do Facebook usando paginação.
 * Isso evita erros de "muitos dados" ao buscar os resultados em lotes.
 * @param {string} url - A URL da API para buscar.
 * @param {Array} allData - O array acumulado de dados de chamadas anteriores.
 * @returns {Promise<Array>} - Uma promessa que resolve com todos os dados agregados.
 */
const fetchAllPages = async (url, allData = []) => {
  try {
    const response = await axios.get(url);
    const data = response.data.data;
    allData.push(...data);

    // Se a resposta da API incluir um URL para a "próxima" página, busca recursivamente.
    if (response.data.paging && response.data.paging.next) {
      return await fetchAllPages(response.data.paging.next, allData);
    } else {
      // Caso contrário, retorna todos os dados coletados.
      return allData;
    }
  } catch (error) {
    console.error('Erro durante a busca paginada:', error.response ? error.response.data : error.message);
    // Propaga o erro para ser tratado pela rota principal.
    throw error;
  }
};


// Rota de Dados ATUALIZADA com Paginação e Filtro de Datas
router.get('/data', async (req, res) => {
  const { token, startDate, endDate } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Token de acesso é necessário.' });
  }
  
  // Utiliza as datas do frontend para criar um `time_range` para a API.
  const time_range = JSON.stringify({
    since: startDate,
    until: endDate,
  });

  try {
    // URL inicial para a primeira chamada à API. O limite é definido para um valor seguro (ex: 100).
    const initialUrl = `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/ads?access_token=${token}&fields=name,campaign{name},adset{name},insights{spend,impressions,actions,action_values}&time_range=${time_range}&limit=100`;
    
    // Inicia o processo de busca paginada.
    const allAdData = await fetchAllPages(initialUrl);

    // Retorna todos os dados coletados em um único JSON.
    res.json({ data: allAdData });

  } catch (error) {
    console.error('Erro ao buscar dados dos anúncios:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Facebook.', details: error.response ? error.response.data : {} });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
