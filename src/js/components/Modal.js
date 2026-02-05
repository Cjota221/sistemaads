/**
 * CJOTA Analytics - Modal Component
 * Sistema de modais reutilizáveis
 */

import { generateUniqueId } from '../utils/helpers.js';

class ModalManager {
    constructor() {
        this.activeModals = new Map();
    }

    /**
     * Mostra um modal de confirmação
     * @param {Object} options - Opções do modal
     * @returns {Promise<boolean>}
     */
    confirm({
        title = 'Confirmar Ação',
        message = 'Tem certeza?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        confirmColor = 'blue',
        isDangerous = false
    } = {}) {
        return new Promise((resolve) => {
            const id = generateUniqueId();
            const modal = this.createConfirmModal(id, {
                title,
                message,
                confirmText,
                cancelText,
                confirmColor: isDangerous ? 'red' : confirmColor
            });

            document.body.appendChild(modal);
            this.activeModals.set(id, modal);

            // Event listeners
            modal.querySelector(`#modal-confirm-${id}`).addEventListener('click', () => {
                this.close(id);
                resolve(true);
            });

            modal.querySelector(`#modal-cancel-${id}`).addEventListener('click', () => {
                this.close(id);
                resolve(false);
            });

            // Fechar ao clicar fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close(id);
                    resolve(false);
                }
            });

            // Fechar com ESC
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close(id);
                    resolve(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    createConfirmModal(id, { title, message, confirmText, cancelText, confirmColor }) {
        const modal = document.createElement('div');
        modal.id = `modal-${id}`;
        modal.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in';
        
        const colorClasses = {
            blue: 'bg-blue-600 hover:bg-blue-700',
            red: 'bg-red-600 hover:bg-red-700',
            green: 'bg-green-600 hover:bg-green-700',
            yellow: 'bg-yellow-600 hover:bg-yellow-700'
        };

        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-6 w-full max-w-sm text-center animate-scale-in">
                <h3 class="text-lg font-bold text-slate-100 mb-3">${title}</h3>
                <p class="text-slate-400 mb-6">${message}</p>
                <div class="flex justify-center gap-4">
                    <button 
                        id="modal-cancel-${id}" 
                        class="px-6 py-2 bg-slate-600 text-slate-100 rounded-md hover:bg-slate-500 transition-colors font-semibold"
                    >
                        ${cancelText}
                    </button>
                    <button 
                        id="modal-confirm-${id}" 
                        class="px-6 py-2 ${colorClasses[confirmColor] || colorClasses.blue} text-white rounded-md transition-colors font-semibold"
                    >
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * Mostra um modal customizado
     * @param {Object} options - Opções do modal
     * @returns {string} ID do modal
     */
    show({
        title,
        content,
        size = 'medium',
        showClose = true,
        onClose = null
    }) {
        const id = generateUniqueId();
        const modal = this.createCustomModal(id, { title, content, size, showClose });

        document.body.appendChild(modal);
        this.activeModals.set(id, modal);

        // Event listener para fechar
        if (showClose) {
            const closeBtn = modal.querySelector(`#modal-close-${id}`);
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close(id);
                    if (onClose) onClose();
                });
            }
        }

        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close(id);
                if (onClose) onClose();
            }
        });

        return id;
    }

    createCustomModal(id, { title, content, size, showClose }) {
        const modal = document.createElement('div');
        modal.id = `modal-${id}`;
        modal.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in';
        
        const sizeClasses = {
            small: 'max-w-md',
            medium: 'max-w-2xl',
            large: 'max-w-4xl',
            full: 'max-w-full'
        };

        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-scale-in">
                ${title ? `
                    <div class="flex justify-between items-center p-6 border-b border-slate-700">
                        <h3 class="text-xl font-bold text-slate-100">${title}</h3>
                        ${showClose ? `
                            <button 
                                id="modal-close-${id}" 
                                class="text-slate-400 hover:text-slate-200 text-2xl font-bold leading-none"
                            >
                                ×
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="p-6 overflow-y-auto flex-1">
                    ${content}
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * Fecha um modal específico
     */
    close(id) {
        const modal = this.activeModals.get(id);
        if (!modal) return;

        modal.classList.add('animate-fade-out');
        setTimeout(() => {
            modal.remove();
            this.activeModals.delete(id);
        }, 200);
    }

    /**
     * Fecha todos os modais
     */
    closeAll() {
        this.activeModals.forEach((modal, id) => {
            this.close(id);
        });
    }
}

// Criar instância global
const modalManager = new ModalManager();
window.modalManager = modalManager;

export default modalManager;
