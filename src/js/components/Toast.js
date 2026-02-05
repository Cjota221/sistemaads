/**
 * CJOTA Analytics - Toast Component
 * Sistema de notificações toast
 */

import { generateUniqueId } from '../utils/helpers.js';

class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Criar container se não existir
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-5 right-5 z-50 space-y-3';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Mostra uma notificação toast
     * @param {string} message - Mensagem a exibir
     * @param {string} type - Tipo: success, error, warning, info
     * @param {number} duration - Duração em ms (0 = permanente)
     */
    show(message, type = 'info', duration = 4000) {
        const id = generateUniqueId();
        const toast = this.createToastElement(id, message, type);
        
        this.container.appendChild(toast);
        
        // Animação de entrada
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        }, 10);

        // Auto-remover se duration > 0
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        return id;
    }

    createToastElement(id, message, type) {
        const toast = document.createElement('div');
        toast.id = `toast-${id}`;
        toast.className = `transform transition-all duration-300 translate-x-full opacity-0 max-w-sm`;
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="${colors[type] || colors.info} text-white font-bold rounded-lg shadow-lg py-3 px-5 flex items-center gap-3">
                <span class="text-xl">${icons[type] || icons.info}</span>
                <span class="flex-1">${message}</span>
                <button onclick="window.toastManager.remove('${id}')" class="text-white hover:text-gray-200 font-bold text-xl">
                    ×
                </button>
            </div>
        `;

        return toast;
    }

    /**
     * Remove um toast específico
     */
    remove(id) {
        const toast = document.getElementById(`toast-${id}`);
        if (!toast) return;

        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    /**
     * Remove todos os toasts
     */
    clearAll() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    // Atalhos
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Criar instância global
const toastManager = new ToastManager();
window.toastManager = toastManager;

export default toastManager;
