/**
 * CJOTA Analytics - Loading Component
 * Sistema de indicadores de carregamento
 */

class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
    }

    /**
     * Mostra indicador de loading global
     * @param {string} message - Mensagem de carregamento
     * @returns {string} ID do loader
     */
    show(message = 'Carregando...') {
        const id = 'global-loader';
        
        // Remover loader existente
        if (this.activeLoaders.has(id)) {
            this.hide(id);
        }

        const loader = this.createLoader(id, message, true);
        document.body.appendChild(loader);
        this.activeLoaders.set(id, loader);

        return id;
    }

    /**
     * Cria um loader em um elemento específico
     * @param {string} elementId - ID do elemento
     * @param {string} message - Mensagem
     * @returns {string} ID do loader
     */
    showInElement(elementId, message = 'Carregando...') {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Elemento ${elementId} não encontrado`);
            return null;
        }

        const id = `loader-${elementId}`;
        
        // Remover loader existente
        const existing = element.querySelector(`#${id}`);
        if (existing) existing.remove();

        const loader = this.createLoader(id, message, false);
        element.appendChild(loader);
        this.activeLoaders.set(id, loader);

        return id;
    }

    createLoader(id, message, isFullScreen) {
        const loader = document.createElement('div');
        loader.id = id;
        
        if (isFullScreen) {
            loader.className = 'fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center';
        } else {
            loader.className = 'absolute inset-0 bg-slate-900/80 z-10 flex items-center justify-center rounded-lg';
        }

        loader.innerHTML = `
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-lg font-medium text-slate-300">${message}</p>
            </div>
        `;

        return loader;
    }

    /**
     * Cria um skeleton loader para conteúdo
     * @param {string} elementId - ID do elemento
     * @param {number} lines - Número de linhas
     */
    showSkeleton(elementId, lines = 3) {
        const element = document.getElementById(elementId);
        if (!element) return null;

        const id = `skeleton-${elementId}`;
        const skeleton = document.createElement('div');
        skeleton.id = id;
        skeleton.className = 'space-y-4 animate-pulse';

        for (let i = 0; i < lines; i++) {
            const line = document.createElement('div');
            line.className = 'h-4 bg-slate-700 rounded';
            const width = Math.random() * 40 + 60; // 60-100%
            line.style.width = `${width}%`;
            skeleton.appendChild(line);
        }

        element.innerHTML = '';
        element.appendChild(skeleton);
        this.activeLoaders.set(id, skeleton);

        return id;
    }

    /**
     * Remove um loader específico
     */
    hide(id) {
        const loader = this.activeLoaders.get(id);
        if (!loader) return;

        loader.classList.add('opacity-0', 'transition-opacity', 'duration-200');
        setTimeout(() => {
            loader.remove();
            this.activeLoaders.delete(id);
        }, 200);
    }

    /**
     * Remove todos os loaders
     */
    hideAll() {
        this.activeLoaders.forEach((loader, id) => {
            this.hide(id);
        });
    }

    /**
     * Mostra spinner inline pequeno
     * @returns {string} HTML do spinner
     */
    getInlineSpinner() {
        return `<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>`;
    }
}

// Criar instância global
const loadingManager = new LoadingManager();
window.loadingManager = loadingManager;

export default loadingManager;
