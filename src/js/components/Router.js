/**
 * CJOTA Analytics - Router
 * Sistema de roteamento SPA simples
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.defaultRoute = 'dashboard';
        
        // Listener para mudanças de hash
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * Registra uma rota
     * @param {string} path - Caminho da rota
     * @param {Function} handler - Função para renderizar a rota
     */
    register(path, handler) {
        this.routes.set(path, handler);
    }

    /**
     * Navega para uma rota
     * @param {string} path - Caminho da rota
     * @param {Object} params - Parâmetros opcionais
     */
    navigate(path, params = {}) {
        window.location.hash = path;
        if (Object.keys(params).length > 0) {
            this.currentParams = params;
        }
    }

    /**
     * Manipula mudanças de rota
     */
    async handleRouteChange() {
        const hash = window.location.hash.slice(1) || this.defaultRoute;
        const route = hash.split('?')[0];
        
        if (!this.routes.has(route)) {
            console.warn(`Rota não encontrada: ${route}`);
            this.navigate(this.defaultRoute);
            return;
        }

        // Esconder todas as views
        document.querySelectorAll('[data-view]').forEach(view => {
            view.classList.add('hidden');
        });

        // Atualizar navegação ativa
        this.updateActiveNav(route);

        // Executar handler da rota
        this.currentRoute = route;
        const handler = this.routes.get(route);
        
        try {
            await handler(this.currentParams || {});
            this.currentParams = null; // Limpar parâmetros após uso
        } catch (error) {
            console.error(`Erro ao carregar rota ${route}:`, error);
        }
    }

    /**
     * Atualiza o estado ativo na navegação
     */
    updateActiveNav(route) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('bg-blue-600/20', 'text-blue-300');
            link.classList.add('text-slate-400');
            
            const href = link.getAttribute('href');
            if (href === `#${route}`) {
                link.classList.add('bg-blue-600/20', 'text-blue-300');
                link.classList.remove('text-slate-400');
            }
        });
    }

    /**
     * Obtém a rota atual
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Volta para a rota anterior
     */
    goBack() {
        window.history.back();
    }

    /**
     * Define a rota padrão
     */
    setDefaultRoute(route) {
        this.defaultRoute = route;
    }
}

// Criar instância global
const router = new Router();
window.router = router;

export default router;
