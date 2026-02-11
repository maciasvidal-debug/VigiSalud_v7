// Validadores de reglas de negocio para productos farmacéuticos
import type { ProductFinding } from '../types';

/**
 * Validadores Especializados (Logic Engine v2) - VERSIÓN BLINDADA
 */

export const validateColdChain = (product: ProductFinding): { isValid: boolean; message?: string } => {
    // Lista maestra de subtipos que requieren frío (Normalizada)
    const coldChainSubtypes = ['BIOLOGICO', 'BIOTECNOLOGICO', 'REACTIVO_INVITRO', 'VACUNA', 'SUERO', 'INSULINA'];
    
    // Normalización de entradas para evitar errores por mayúsculas/minúsculas
    const subtype = (product.subtype || '').toUpperCase();
    const form = (product.pharmaceuticalForm || '').toUpperCase();
    const type = (product.type || '').toUpperCase();

    const needsColdChain = coldChainSubtypes.includes(subtype) || 
                           (type === 'MEDICAMENTO' && form.includes('VACUNA'));

    if (!needsColdChain) return { isValid: true };

    // ALERTA CRÍTICA: Si requiere frío y no tiene dato registrado
    if (product.storageTemp === undefined || product.storageTemp === null || product.storageTemp === '') {
        return { isValid: false, message: 'Producto Termolábil SIN registro de temperatura.' };
    }

    const temp = parseFloat(product.storageTemp);
    
    // Validación numérica estricta
    if (isNaN(temp)) {
        return { isValid: false, message: 'El valor de temperatura no es numérico.' };
    }

    // Rango estricto 2°C a 8°C (Decreto 1782)
    if (temp < 2.0 || temp > 8.0) {
        return { 
            isValid: false, 
            message: `⛔ RUPTURA DE CADENA DE FRÍO DETECTADA: ${temp}°C (Rango permitido: 2°C - 8°C). Se requiere inmovilización.` 
        };
    }

    return { isValid: true };
};

export const validateExpiration = (product: ProductFinding): { isValid: boolean; message?: string } => {
    if (!product.expirationDate) return { isValid: true };

    // Forzar interpretación de zona horaria local para evitar errores de "día anterior"
    // Asumiendo formato YYYY-MM-DD del input type="date"
    const expDate = new Date(product.expirationDate + 'T00:00:00'); 
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validación de fecha corrupta
    if (isNaN(expDate.getTime())) {
        return { isValid: false, message: 'Fecha de vencimiento inválida o malformada.' };
    }

    if (expDate < today) {
        return { 
            isValid: false, 
            message: `⛔ PRODUCTO VENCIDO: Expiró el ${product.expirationDate}.` 
        };
    }

    return { isValid: true };
};

export const validateInstitucional = (product: ProductFinding): { isValid: boolean; message?: string } => {
    // Concatenar todos los campos visuales donde podría aparecer la marca
    const textToCheck = `${product.presentation || ''} ${product.packLabel || ''} ${product.name || ''}`;
    const cleanText = textToCheck.toUpperCase();

    // Lógica negativa: Si dice Institucional Y NO dice Comercial
    if ((cleanText.includes('INSTITUCIONAL') || cleanText.includes('USO EXCLUSIVO')) && !cleanText.includes('COMERCIAL')) {
        return { 
            isValid: false, 
            message: '⚠️ USO INSTITUCIONAL DETECTADO: Prohibida su venta en establecimiento comercial.' 
        };
    }

    return { isValid: true };
};