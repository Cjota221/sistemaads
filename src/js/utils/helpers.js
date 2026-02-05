/**
 * CJOTA Analytics - Utility Functions
 * Funções auxiliares para formatação e cálculos
 */

/**
 * Formata um número para exibição
 * @param {number} value - Valor a formatar
 * @param {number} decimals - Número de casas decimais
 * @returns {string}
 */
export function formatNumber(value, decimals = 2) {
    if (typeof value !== 'number' || !isFinite(value)) {
        return (0).toFixed(decimals);
    }
    return value.toFixed(decimals);
}

/**
 * Formata um valor monetário
 * @param {number} value - Valor a formatar
 * @returns {string}
 */
export function formatCurrency(value) {
    return `R$ ${formatNumber(value)}`;
}

/**
 * Formata uma data para exibição
 * @param {string|Date} date - Data a formatar
 * @param {string} format - Formato desejado
 * @returns {string}
 */
export function formatDate(date, format = 'pt-BR') {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(format, { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * Formata uma data para o formato ISO (yyyy-mm-dd)
 * @param {Date} date - Data a formatar
 * @returns {string}
 */
export function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Obtém datas padrão (últimos 30 dias)
 * @returns {Object} {startDate, endDate}
 */
export function getDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);
    
    return {
        startDate: formatDateISO(startDate),
        endDate: formatDateISO(endDate)
    };
}

/**
 * Determina a cor de performance baseada em meta
 * @param {number} metric - Valor da métrica
 * @param {number} target - Meta
 * @param {boolean} isHigherBetter - Se maior é melhor
 * @returns {string} Classe CSS da cor
 */
export function getPerformanceColor(metric, target, isHigherBetter = true) {
    if (target == null || target === 0 || !isFinite(metric)) {
        return 'text-slate-100';
    }
    
    const ratio = metric / target;
    
    if (isHigherBetter) {
        if (ratio >= 1.2) return 'text-green-400';
        if (ratio >= 0.9) return 'text-yellow-400';
        return 'text-red-400';
    } else {
        if (ratio <= 0.8) return 'text-green-400';
        if (ratio <= 1.1) return 'text-yellow-400';
        return 'text-red-400';
    }
}

/**
 * Sanitiza texto para prevenir XSS
 * @param {string} text - Texto a sanitizar
 * @returns {string}
 */
export function sanitizeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escapa caracteres especiais para uso em atributos HTML
 * @param {string} text - Texto a escapar
 * @returns {string}
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Debounce para limitar chamadas de função
 * @param {Function} func - Função a fazer debounce
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Formata números grandes com sufixos (K, M, B)
 * @param {number} num - Número a formatar
 * @returns {string}
 */
export function formatCompactNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Calcula a diferença percentual entre dois valores
 * @param {number} current - Valor atual
 * @param {number} previous - Valor anterior
 * @returns {number} Diferença percentual
 */
export function calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

/**
 * Valida se uma data está em formato válido
 * @param {string} dateString - String da data
 * @returns {boolean}
 */
export function isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

/**
 * Valida se um número está dentro de um intervalo
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean}
 */
export function isInRange(value, min, max) {
    return value >= min && value <= max;
}

/**
 * Trunca texto longo
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Comprimento máximo
 * @returns {string}
 */
export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Gera um ID único
 * @returns {string}
 */
export function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copia texto para a área de transferência
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erro ao copiar texto:', err);
        return false;
    }
}

/**
 * Baixa dados como arquivo JSON
 * @param {Object} data - Dados a baixar
 * @param {string} filename - Nome do arquivo
 */
export function downloadJSON(data, filename = 'data.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default {
    formatNumber,
    formatCurrency,
    formatDate,
    formatDateISO,
    getDefaultDates,
    getPerformanceColor,
    sanitizeHTML,
    escapeHtml,
    debounce,
    formatCompactNumber,
    calculatePercentageChange,
    isValidDate,
    isInRange,
    truncateText,
    generateUniqueId,
    copyToClipboard,
    downloadJSON
};
