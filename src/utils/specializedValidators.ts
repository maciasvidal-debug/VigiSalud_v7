import type { ProductFinding } from '../types';

/**
 * Validadores Especializados (Logic Engine v2)
 * Funciones puras para validación técnica de productos farmacéuticos.
 */

export const validateColdChain = (product: ProductFinding): { isValid: boolean; message?: string } => {
    // Solo aplica a Biológicos, Reactivos In Vitro, etc.
    const coldChainSubtypes = ['BIOLOGICO', 'BIOTECNOLOGICO', 'REACTIVO_INVITRO', 'VACUNA', 'SUERO'];
    const needsColdChain = coldChainSubtypes.includes(product.subtype || '') ||
                           (product.type === 'MEDICAMENTO' && (product.pharmaceuticalForm || '').includes('VACUNA')); // Fallback

    if (!needsColdChain) return { isValid: true };

    if (!product.storageTemp) return { isValid: true }; // Si no hay dato, no podemos validar (o podría ser warning)

    const temp = parseFloat(product.storageTemp);
    if (isNaN(temp)) return { isValid: false, message: 'Temperatura inválida' };

    if (temp < 2.0 || temp > 8.0) {
        return {
            isValid: false,
            message: `Ruptura de Cadena de Frío: ${temp}°C (Rango: 2°C - 8°C)`
        };
    }

    return { isValid: true };
};

export const validateExpiration = (product: ProductFinding): { isValid: boolean; message?: string } => {
    if (!product.expirationDate) return { isValid: true };

    const expDate = new Date(product.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expDate < today) {
        return {
            isValid: false,
            message: `Producto VENCIDO (Expira: ${product.expirationDate})`
        };
    }

    return { isValid: true };
};

export const validateInstitucional = (product: ProductFinding): { isValid: boolean; message?: string } => {
    const textToCheck = (product.presentation || '') + ' ' + (product.packLabel || '');
    const cleanText = textToCheck.toUpperCase();

    if (cleanText.includes('INSTITUCIONAL') && !cleanText.includes('COMERCIAL')) {
        return {
            isValid: false,
            message: 'Uso Institucional detectado (Prohibida su venta comercial)'
        };
    }

    return { isValid: true };
};
