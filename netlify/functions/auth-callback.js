/**
 * Netlify Function - Meta OAuth Callback
 * Processa o callback do OAuth e troca o code por access token
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const { code, error, error_description } = event.queryStringParameters || {};
    
    // Verificar erros do OAuth
    if (error) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <html>
                    <body>
                        <h1>Erro na Autenticação</h1>
                        <p>${error_description || error}</p>
                        <a href="/">Voltar</a>
                    </body>
                </html>
            `
        };
    }
    
    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Code não fornecido' })
        };
    }
    
    const META_APP_ID = process.env.META_APP_ID;
    const META_APP_SECRET = process.env.META_APP_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!META_APP_ID || !META_APP_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Credenciais Meta não configuradas' })
        };
    }
    
    try {
        // Construir URL de callback
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const host = event.headers.host;
        const redirectUri = `${protocol}://${host}/.netlify/functions/auth-callback`;
        
        // Trocar code por access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id: META_APP_ID,
                redirect_uri: redirectUri,
                client_secret: META_APP_SECRET,
                code
            }
        });
        
        const { access_token, expires_in = 5184000 } = tokenResponse.data;
        
        if (!access_token) {
            throw new Error('Token de acesso não recebido');
        }
        
        // Buscar informações do usuário do Facebook
        const userResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
            params: {
                access_token,
                fields: 'id,name,email'
            }
        });
        
        const fbUser = userResponse.data;
        
        // Inicializar Supabase Admin Client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Criar ou atualizar usuário no Supabase
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: fbUser.email || `${fbUser.id}@facebook.com`,
            email_confirm: true,
            user_metadata: {
                full_name: fbUser.name,
                facebook_id: fbUser.id,
                provider: 'facebook'
            }
        });
        
        if (authError && !authError.message.includes('already registered')) {
            throw authError;
        }
        
        // Buscar ou criar usuário
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', fbUser.email || `${fbUser.id}@facebook.com`)
            .single();
        
        const userId = existingUser?.id || authData?.user?.id;
        
        if (!userId) {
            throw new Error('Erro ao criar usuário');
        }
        
        // Salvar ou atualizar token do Meta
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);
        
        const { error: updateError } = await supabase
            .from('users')
            .upsert({
                id: userId,
                email: fbUser.email || `${fbUser.id}@facebook.com`,
                full_name: fbUser.name,
                meta_access_token: access_token,
                meta_token_expires_at: expiresAt.toISOString()
            });
        
        if (updateError) {
            console.error('Erro ao salvar token:', updateError);
        }
        
        // Gerar sessão do Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: fbUser.email || `${fbUser.id}@facebook.com`
        });
        
        // Redirecionar para o app com sucesso
        return {
            statusCode: 302,
            headers: {
                Location: `/app.html?access_token=${access_token}&success=true`
            }
        };
        
    } catch (error) {
        console.error('Erro no callback:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <html>
                    <body>
                        <h1>Erro ao Autenticar</h1>
                        <p>${error.message}</p>
                        <a href="/">Tentar Novamente</a>
                    </body>
                </html>
            `
        };
    }
};
