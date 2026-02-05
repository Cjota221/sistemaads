/**
 * CJOTA Analytics - Supabase Configuration
 * Configuração e inicialização do cliente Supabase
 */

// Configuração do Supabase (será carregada das variáveis de ambiente no deploy)
const SUPABASE_CONFIG = {
    url: window.SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || 'your-anon-key'
};

// Cliente Supabase singleton
let supabaseClient = null;

/**
 * Inicializa e retorna o cliente Supabase
 * @returns {Object} Cliente Supabase
 */
export function getSupabase() {
    if (!supabaseClient) {
        if (!window.supabase) {
            console.error('Supabase library not loaded');
            return null;
        }
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                }
            }
        );
    }
    return supabaseClient;
}

/**
 * Obtém a sessão atual do usuário
 * @returns {Promise<Object|null>} Sessão do usuário ou null
 */
export async function getSession() {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return session;
}

/**
 * Obtém o usuário atual
 * @returns {Promise<Object|null>} Usuário ou null
 */
export async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
}

/**
 * Verifica se o usuário está autenticado
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
    const session = await getSession();
    return !!session;
}

/**
 * Listener para mudanças de autenticação
 * @param {Function} callback - Função a ser chamada quando o estado de auth mudar
 * @returns {Object} Subscription para cancelar o listener
 */
export function onAuthStateChange(callback) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

export default {
    getSupabase,
    getSession,
    getCurrentUser,
    isAuthenticated,
    onAuthStateChange
};
