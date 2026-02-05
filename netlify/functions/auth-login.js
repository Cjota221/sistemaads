/**
 * Netlify Function - Meta Login
 * Inicia o processo de autenticação OAuth com Meta/Facebook
 */

export const handler = async (event, context) => {
    const META_APP_ID = process.env.META_APP_ID;
    
    if (!META_APP_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'META_APP_ID não configurado' })
        };
    }
    
    // Construir URL de callback dinâmica
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const host = event.headers.host;
    const redirectUri = `${protocol}://${host}/.netlify/functions/auth-callback`;
    
    // Permissões necessárias
    const scope = 'ads_read,read_insights,ads_management';
    
    // URL de autenticação do Facebook
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('auth_type', 'rerequest');
    authUrl.searchParams.set('state', Date.now().toString()); // CSRF protection
    
    // Redirecionar para Facebook
    return {
        statusCode: 302,
        headers: {
            Location: authUrl.toString()
        }
    };
};
