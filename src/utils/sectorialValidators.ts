import type { ProductFinding, RiskFactor } from '../types';

export interface SectorialValidationResult {
  alerts: { message: string; severity: 'ERROR' | 'WARNING' }[];
  suggestedRisks: RiskFactor[];
}

// 1. Módulo Bio-Guardian (Dispositivos Médicos)
const validateMedicalDevice = (product: ProductFinding): SectorialValidationResult => {
  const result: SectorialValidationResult = { alerts: [], suggestedRisks: [] };

  if (product.type === 'DISPOSITIVO_MEDICO') {
    // Regla de Calibración (REG-T012)
    if (product.subtype === 'EQUIPO_BIOMEDICO' && product.calibrationStatus === 'VENCIDA') {
      result.alerts.push({ 
        message: "Equipo biomédico sin metrología vigente (Dec 4725/05)", 
        severity: 'ERROR' 
      });
      result.suggestedRisks.push('MAL_ALMACENAMIENTO'); // Asumimos esto como riesgo técnico
    }

    // Regla de Manuales (REG-D006)
    if (product.observations === 'NO') {
      result.alerts.push({ 
        message: "Requiere manual de operación visible", 
        severity: 'WARNING' 
      });
      // No asigna riesgo crítico, solo advertencia
    }
  }
  return result;
};

// 2. Módulo Gastro-Logic (Alimentos)
const validateFoodSafety = (product: ProductFinding): SectorialValidationResult => {
  const result: SectorialValidationResult = { alerts: [], suggestedRisks: [] };

  if (product.type === 'ALIMENTO') {
    // Detector de Engaño (REG-D032)
    const forbiddenKeywords = ['CURA', 'SANA', 'ALIVIA', 'TRATAMIENTO', 'TERAPEUTICO', 'MEDICINAL'];
    const nameUpper = (product.name || '').toUpperCase();
    
    const hasForbidden = forbiddenKeywords.some(keyword => nameUpper.includes(keyword));
    
    if (hasForbidden) {
      result.alerts.push({ 
        message: "Alerta Legal: Alimento declarando propiedades en salud (Engaño al consumidor)", 
        severity: 'WARNING' 
      });
      result.suggestedRisks.push('FRAUDULENTO');
    }
  }
  return result;
};

// 3. Módulo Derma-Check (Cosméticos)
const validateCosmetic = (product: ProductFinding): SectorialValidationResult => {
  const result: SectorialValidationResult = { alerts: [], suggestedRisks: [] };

  if (product.type === 'COSMETICO') {
    // Validador NSO (REG-L001) - Formato Andino NSOC
    // Regex aproximada: NSOC + 5 digitos + - + 2 digitos + CO
    // Ej: NSOC12345-23CO
    const nsoRegex = /^NSOC\d{5}-\d{2}CO$/i;
    
    if (product.invimaReg && !nsoRegex.test(product.invimaReg.trim())) {
      result.alerts.push({ 
        message: "Formato NSO inválido. Verifique si es contrabando o error de digitación.", 
        severity: 'WARNING' 
      });
      // Sugerimos revisar legalidad
      result.suggestedRisks.push('SIN_REGISTRO');
    }
  }
  return result;
};

// 4. Módulo Cross-Check (Contaminación Cruzada)
const checkCrossContamination = (newProduct: ProductFinding, inventory: ProductFinding[]): SectorialValidationResult => {
  const result: SectorialValidationResult = { alerts: [], suggestedRisks: [] };

  if (newProduct.type === 'ALIMENTO') {
    const hasChemicals = inventory.some(p => ['ASEO_HIGIENE', 'REACTIVO_DIAGNOSTICO'].includes(p.type));
    
    if (hasChemicals) {
      result.alerts.push({ 
        message: "⛔ RIESGO CRÍTICO: Está ingresando ALIMENTOS en un inventario que ya contiene QUÍMICOS/ASEO. Verifique separación física inmediata.", 
        severity: 'ERROR' 
      });
      result.suggestedRisks.push('MAL_ALMACENAMIENTO');
    }
  }
  return result;
};

// Aggregator
export const sectorialValidators = {
  analyze: (product: ProductFinding, inventory: ProductFinding[]): SectorialValidationResult => {
    const combined: SectorialValidationResult = { alerts: [], suggestedRisks: [] };

    const merge = (res: SectorialValidationResult) => {
      combined.alerts.push(...res.alerts);
      res.suggestedRisks.forEach(r => {
        if (!combined.suggestedRisks.includes(r)) {
          combined.suggestedRisks.push(r);
        }
      });
    };

    merge(validateMedicalDevice(product));
    merge(validateFoodSafety(product));
    merge(validateCosmetic(product));
    merge(checkCrossContamination(product, inventory));

    return combined;
  }
};