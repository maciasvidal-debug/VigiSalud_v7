// src/utils/PharmaParser.ts
import type { CommercialPresentation, PresentationMode } from '../types';

/**
 * PARSER FARMACÉUTICO (Motor Semántico v8.2)
 * Interpreta descripciones como "CAJA X 100 TABLETAS", "FRASCO X 120 ML" o "CAJA X 10 JERINGAS"
 * Cumple con Manual Técnico IVC - Sección 6.4 (Modelo Polimórfico)
 */
export const parsePresentation = (form: string = '', description: string = ''): CommercialPresentation => {
    // Normalización
    const normForm = form.toUpperCase().trim();
    const normDesc = description.toUpperCase().trim();

    // 1. CLASIFICACIÓN TAXONÓMICA (Modo)
    let mode: PresentationMode = 'DISCRETE';
    let containerType = 'UNIDAD';

    // Diccionarios Semánticos
    const liquidForms = ['JARABE', 'SOLUCION', 'SUSPENSION', 'ELIXIR', 'EMULSION', 'LOCION', 'INYECCION', 'INYECTABLE', 'VIAL', 'AMPOLLA', 'AEROSOL', 'SPRAY', 'GOTAS', 'JERINGA', 'LÍQUIDO', 'LIQUIDO'];
    const massForms = ['CREMA', 'UNGUENTO', 'GEL', 'POMADA', 'PASTA', 'POLVO', 'GRANULADO'];
    const solidForms = ['TABLETA', 'CAPSULA', 'GRAGEA', 'COMPRIMIDO', 'SUPOSITORIO', 'OVULO', 'TABLETA RECUBIERTA', 'PASTILLA'];

    // Biológicos especiales (Flag "No Aplica")
    const bioForms = ['VACUNA', 'SUERO', 'BIOLOGICO', 'TOXOIDE', 'INMUNOGLOBULINA', 'ANTITOXINA'];
    const isBiological = bioForms.some(k => normForm.includes(k) || normDesc.includes(k));

    // Regla Especial: Polvos Liofilizados (Prioridad Alta)
    // Se tratan como DISCRETE (Viales) aunque digan "PARA SOLUCION"
    const isLyophilized = normForm.includes('LIOFILIZADO') ||
                          (normForm.includes('POLVO') && (normForm.includes('RECONSTITUIR') || normForm.includes('SOLUCION') || normForm.includes('INYEC')));

    if (isLyophilized) {
        mode = 'DISCRETE';
        containerType = 'VIAL'; // Default para liofilizados
    } else if (liquidForms.some(k => normForm.includes(k))) {
        mode = 'VOLUMETRIC';
        containerType = 'FRASCO'; // Default
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

    // 1.1 REFINAMIENTO DE CONTENEDOR (Busca en Descripción si no es específico)
    // Si tenemos un tipo genérico (FRASCO, TUBO, UNIDAD), buscamos más especificidad en la descripción
    const specificContainers = ['VIAL', 'AMPOLLA', 'JERINGA', 'BOLSA', 'CARTUCHO', 'FRASCO', 'SOBRE', 'LATA', 'POTE', 'TARRO'];
    const descContainer = specificContainers.find(c => normDesc.includes(c) || normForm.includes(c));

    if (descContainer) {
        // Prioridad a lo encontrado explícitamente, salvo si es Liofilizado que ya forzamos a VIAL (aunque si dice AMPOLLA, respetamos)
        if (isLyophilized && descContainer === 'AMPOLLA') {
            containerType = 'AMPOLLA';
        } else if (!isLyophilized || descContainer !== 'FRASCO') {
             // Evitamos que 'FRASCO' sobreescriba 'VIAL' si ya estaba seteado, pero si encontramos 'VIAL' en desc, lo usamos
             containerType = descContainer;
             if (containerType === 'JERINGA' && normDesc.includes('PRELLENADA')) containerType = 'JERINGA PRELLENADA';
        }
    }

    // 2. EXTRACCIÓN DE CONTENIDO NETO (Dimensión Física)
    let contentNet = 0;
    let contentUnit = '';

    // Intentamos extraer volumen/masa incluso en DISCRETE si es relevante (ej: Vial de 50ml)
    // Pero solo afectará la visualización si mode != DISCRETE, o si queremos mostrar información extra.
    const volMatch = normDesc.match(/(\d+[\.,]?\d*)\s*(ML|LITRO|L|CC|CM3)/);
    const massMatch = normDesc.match(/(\d+[\.,]?\d*)\s*(KG|GRAMO|G|MG|MCG)/);

    if (mode === 'VOLUMETRIC' && volMatch) {
        contentNet = parseFloat(volMatch[1].replace(',', '.'));
        contentUnit = volMatch[2].replace(/(LITRO|L)/, 'L').replace(/(CC|CM3)/, 'mL');
    } else if (mode === 'MASS_BASED' && massMatch) {
        contentNet = parseFloat(massMatch[1].replace(',', '.'));
        contentUnit = massMatch[2].replace(/(GRAMO|G)/, 'g').replace('KG', 'kg');
    }

    // 3. EXTRACCIÓN DE FACTOR DE EMPAQUE (Dimensión Logística)
    let packFactor = 1;
    let packType = 'CAJA';

    // Regex mejorada para detectar multiplicadores explícitos en multipacks líquidos y sólidos
    // Soporta: "CAJA X 10", "PLEGADIZA POR 5", "CAJA CON 100", "ESTUCHE X 1"
    const multiplierRegex = /(?:CAJA|PLEGADIZA|DISPENSER|BLISTER|DISPLAY|SOBRE|ESTUCHE|PAQUETE).*?(?:POR|X|CON)\s*(\d+)/;
    const match = normDesc.match(multiplierRegex);

    if (match) {
        const detectedNum = parseInt(match[1], 10);
        
        // --- REGLA DE SEGURIDAD HEURÍSTICA ---
        if (mode !== 'DISCRETE' && detectedNum === contentNet && !normDesc.includes('CAJA') && !normDesc.includes('PLEGADIZA')) {
             packFactor = 1;
        } else {
             packFactor = detectedNum;
        }
    } else {
        // Fallback: Busca "X 100" al final o seguido de unidades
        const simpleMatch = normDesc.match(/(?:X|POR)\s*(\d+)\s*(?:UNIDADES|TABLETAS|CAPSULAS|AMPOLLAS|VIALES|FRASCOS|TUBOS|$)/);
        if (simpleMatch) {
             packFactor = parseInt(simpleMatch[1], 10);
        }
    }

    if (normDesc.includes('BLISTER')) packType = 'BLISTER';
    if (normDesc.includes('SOBRE') && mode === 'DISCRETE') packType = 'SOBRE';
    
    // Construcción del String Normalizado para UI
    const contentString = contentNet > 0 ? `${contentNet} ${contentUnit}` : '';
    const detectedString = packFactor > 1 
        ? `${packType} x ${packFactor} ${containerType}s ${contentString ? '('+contentString+')' : ''}`
        : `${containerType} Individual ${contentString ? '('+contentString+')' : ''}`;

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
