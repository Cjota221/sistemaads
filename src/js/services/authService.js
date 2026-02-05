/**
 * CJOTA Analytics - Authentication Service
 * Gerencia autenticação com Supabase e Meta/Facebook
 */

import { getSupabase } from '../config/supabase.js';
import { API_ENDPOINTS } from '../config/constants.js';

class AuthService {
    constructor() {
        this.supabase = getSupabase();
    }

    /**
     * Faz login com Facebook/Meta
     */
    async loginWithMeta() {
        window.location.href = API_ENDPOINTS.LOGIN;
    }

    /**
     * Logout do usuário
     */
    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            console.error('Erro ao fazer logout:', error);
            throw error;
        }
        window.location.href = '/';
    }

    /**
     * Obtém o usuário atual com suas configurações
     */
    async getCurrentUserProfile() {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error || !user) {
            console.error('Erro ao obter usuário:', error);
            return null;
        }

        // Buscar dados completos do usuário
        const { data: profile, error: profileError } = await this.supabase
            .from('users')
            .select('*, user_settings(*)')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Erro ao obter perfil:', profileError);
            return user;
        }

        return profile;
    }

    /**
     * Atualiza o token de acesso do Meta
     */
    async updateMetaToken(accessToken, expiresIn = 5184000) {
        const user = await this.supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error('Usuário não autenticado');
        }

        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

        const { data, error } = await this.supabase
            .from('users')
            .update({
                meta_access_token: accessToken,
                meta_token_expires_at: expiresAt.toISOString()
            })
            .eq('id', user.data.user.id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar token:', error);
            throw error;
        }

        return data;
    }

    /**
     * Atualiza o ID da conta de anúncios
     */
    async updateAdAccountId(adAccountId) {
        const user = await this.supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error('Usuário não autenticado');
        }

        const { data, error } = await this.supabase
            .from('users')
            .update({ ad_account_id: adAccountId })
            .eq('id', user.data.user.id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar conta de anúncios:', error);
            throw error;
        }

        return data;
    }

    /**
     * Verifica se o token do Meta ainda é válido
     */
    async isMetaTokenValid() {
        const profile = await this.getCurrentUserProfile();
        if (!profile || !profile.meta_token_expires_at) {
            return false;
        }

        const expiresAt = new Date(profile.meta_token_expires_at);
        const now = new Date();
        
        // Considera inválido se faltar menos de 1 hora para expirar
        return expiresAt.getTime() - now.getTime() > 3600000;
    }

    /**
     * Obtém o token de acesso do Meta
     */
    async getMetaAccessToken() {
        const profile = await this.getCurrentUserProfile();
        if (!profile || !profile.meta_access_token) {
            return null;
        }

        const isValid = await this.isMetaTokenValid();
        if (!isValid) {
            return null;
        }

        return profile.meta_access_token;
    }
}

export default new AuthService();
