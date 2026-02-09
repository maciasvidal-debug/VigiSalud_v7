// src/utils/PharmaParser.ts
import type { CommercialPresentation, PresentationMode } from '../types';

/**
 * PARSER FARMACÉUTICO INTELIGENTE (Motor Semántico v8.3)
 * Transforma descripciones técnicas sucias ("CAJA PLEGADIZA CONTENIENDO 100...")
 * en texto humano limpio ("CAJA POR 100 TABLETAS (10 BLISTERS POR 10 U)")
 *
 * Cumple con Manual Técnico IVC - Sección 6.4 (Modelo Polimórfico) y Requerimiento "Smart Parser"
 */
export const parsePresentation = (form: string = '', description: string = ''): CommercialPresentation => {
    // 0. LIMPIEZA INICIAL (STOP WORDS)
    const stopWords = ['PLEGADIZA', 'CONTENIENDO', 'ALUMINIO', 'PVC', 'PVDC', 'FOIL', 'CADA UNO', 'CADA UNA', 'TRANSPARENTE', 'AMBAR', 'COLOR', 'TIPO', 'I', 'II', 'III', 'VIDRIO', 'PLASTICO', 'POLIPROPILENO', 'MATERIAL', 'EMPAQUE', 'SECUNDARIO', 'PRIMARIO'];

    let cleanDesc = description.toUpperCase();
    stopWords.forEach(word => {
        // Reemplazar palabra exacta o con signos de puntuación alrededor
        cleanDesc = cleanDesc.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    });
    cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim(); // Normalizar espacios

    const normForm = form.toUpperCase().trim();

    // 1. CLASIFICACIÓN TAXONÓMICA (Modo)
    let mode: PresentationMode = 'DISCRETE';
    let containerType = 'UNIDAD';

    // Diccionarios Semánticos
    const liquidForms = ['JARABE', 'SOLUCION', 'SUSPENSION', 'ELIXIR', 'EMULSION', 'LOCION', 'INYECCION', 'INYECTABLE', 'VIAL', 'AMPOLLA', 'AEROSOL', 'SPRAY', 'GOTAS', 'JERINGA', 'LÍQUIDO', 'LIQUIDO'];
    const massForms = ['CREMA', 'UNGUENTO', 'GEL', 'POMADA', 'PASTA', 'POLVO', 'GRANULADO'];
    const solidForms = ['TABLETA', 'CAPSULA', 'GRAGEA', 'COMPRIMIDO', 'SUPOSITORIO', 'OVULO', 'TABLETA RECUBIERTA', 'PASTILLA'];

    // Biológicos especiales (Flag "No Aplica")
    const bioForms = ['VACUNA', 'SUERO', 'BIOLOGICO', 'TOXOIDE', 'INMUNOGLOBULINA', 'ANTITOXINA'];
    const isBiological = bioForms.some(k => normForm.includes(k) || cleanDesc.includes(k));

    // Regla Especial: Polvos Liofilizados (Prioridad Alta)
    const isLyophilized = normForm.includes('LIOFILIZADO') ||
                          (normForm.includes('POLVO') && (normForm.includes('RECONSTITUIR') || normForm.includes('SOLUCION') || normForm.includes('INYEC')));

    if (isLyophilized) {
        mode = 'DISCRETE';
        containerType = 'VIAL';
    } else if (liquidForms.some(k => normForm.includes(k))) {
        mode = 'VOLUMETRIC';
        containerType = 'FRASCO';
    } else if (massForms.some(k => normForm.includes(k))) {
        mode = 'MASS_BASED';
        containerType = 'TUBO';
    } else {
        // Sólidos por defecto
        if (solidForms.some(k => normForm.includes(k))) {
            const found = solidForms.find(k => normForm.includes(k));
            containerType = found ? found.replace(/S$/, '') : 'TABLETA'; 
        }
    }

    // 1.1 REFINAMIENTO DE CONTENEDOR
    const specificContainers = ['VIAL', 'AMPOLLA', 'JERINGA', 'BOLSA', 'CARTUCHO', 'FRASCO', 'SOBRE', 'LATA', 'POTE', 'TARRO'];
    const descContainer = specificContainers.find(c => cleanDesc.includes(c) || normForm.includes(c));

    if (descContainer) {
        if (isLyophilized && descContainer === 'AMPOLLA') {
            containerType = 'AMPOLLA';
        } else if (!isLyophilized || descContainer !== 'FRASCO') {
             containerType = descContainer;
             if (containerType === 'JERINGA' && cleanDesc.includes('PRELLENADA')) containerType = 'JERINGA PRELLENADA';
        }
    }

    // 2. EXTRACCIÓN DE CONTENIDO NETO (Dimensión Física)
    let contentNet = 0;
    let contentUnit = '';

    const volMatch = cleanDesc.match(/(\d+[\.,]?\d*)\s*(ML|LITRO|L|CC|CM3)/);
    const massMatch = cleanDesc.match(/(\d+[\.,]?\d*)\s*(KG|GRAMO|G|MG|MCG)/);

    if (mode === 'VOLUMETRIC' && volMatch) {
        contentNet = parseFloat(volMatch[1].replace(',', '.'));
        contentUnit = volMatch[2].replace(/(LITRO|L)/, 'L').replace(/(CC|CM3)/, 'mL');
    } else if (mode === 'MASS_BASED' && massMatch) {
        contentNet = parseFloat(massMatch[1].replace(',', '.'));
        contentUnit = massMatch[2].replace(/(GRAMO|G)/, 'g').replace('KG', 'kg');
    }

    // 3. EXTRACCIÓN DE FACTOR DE EMPAQUE (Dimensión Logística - Smart Grouping)
    let packFactor = 1;
    let packType = 'CAJA';
    let groupingText = '';

    // Lógica Avanzada: Detectar Total vs Sub-Empaque
    // Ejemplo: "CAJA POR 100 TABLETAS EN BLISTER POR 10" -> packFactor = 100, pero detectamos agrupación

    // Buscar el número mayor asociado a "POR" o "X" o "CON" (Total)
    const totalMatch = cleanDesc.match(/(?:CAJA|FRASCO|TUBO|SOBRE).*?(?:POR|X|CON)\s*(\d+)/);
    // Buscar un número menor asociado a sub-empaques (Blister, Sobre)
    const subMatch = cleanDesc.match(/(?:BLISTER|SOBRE|DISPLAY).*?(?:POR|X|CON)\s*(\d+)/);

    if (totalMatch) {
        const total = parseInt(totalMatch[1], 10);
        
        // Evitar confusión con contenido neto (ej: Frasco x 120 mL)
        if (mode !== 'DISCRETE' && total === contentNet && !cleanDesc.includes('CAJA')) {
             packFactor = 1;
        } else {
             packFactor = total;
        }

        // Calcular agrupación si existe sub-empaque
        if (subMatch && packFactor > 1) {
            const subQty = parseInt(subMatch[1], 10);
            if (subQty > 0 && subQty < packFactor && packFactor % subQty === 0) {
                const numSubPacks = packFactor / subQty;
                // Detectar tipo de sub-empaque
                const subType = cleanDesc.includes('BLISTER') ? 'BLISTERS' : (cleanDesc.includes('SOBRE') ? 'SOBRES' : 'EMPAQUES');
                groupingText = `(${numSubPacks} ${subType} POR ${subQty} U)`;
            }
        }
    } else {
        // Fallback simple
        const simpleMatch = cleanDesc.match(/(?:X|POR)\s*(\d+)\s*(?:UNIDADES|TABLETAS|CAPSULAS|AMPOLLAS|VIALES|FRASCOS|TUBOS|$)/);
        if (simpleMatch) {
             packFactor = parseInt(simpleMatch[1], 10);
        }
    }

    if (cleanDesc.includes('BLISTER') && !cleanDesc.includes('CAJA')) packType = 'BLISTER';
    
    // Construcción del String Normalizado para UI (Limpio y Humano)
    // Ejemplo: "CAJA POR 100 TABLETAS (10 BLISTERS POR 10 U)"
    const contentString = contentNet > 0 ? `${contentNet} ${contentUnit}` : '';

    let detectedString = '';

    if (packFactor > 1) {
        detectedString = `${packType} POR ${packFactor} ${containerType}S`;
        if (groupingText) detectedString += ` ${groupingText}`;
        if (contentString) detectedString += ` DE ${contentString}`;
    } else {
        detectedString = `${containerType} INDIVIDUAL`;
        if (contentString) detectedString += ` DE ${contentString}`;
    }

    // Capitalize first letter logic for better UI look (optional, keeping uppercase for consistency with pharma standard)

    return {
        mode,
        packType,
        containerType,
        packFactor,
        contentNet,
        contentUnit,
        detectedString,
        isConcentrationIrrelevant: isBiological
    };
};
