// src/utils/PharmaParser.ts
import type { CommercialPresentation, PresentationMode } from '../types';

/**
 * PARSER FARMACÉUTICO (Motor Semántico v8.1)
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
    const liquidForms = ['JARABE', 'SOLUCION', 'SUSPENSION', 'ELIXIR', 'EMULSION', 'LOCION', 'INYECCION', 'AMPOLLA', 'AEROSOL', 'SPRAY', 'GOTAS', 'JERINGA', 'LÍQUIDO', 'LIQUIDO'];
    const massForms = ['CREMA', 'UNGUENTO', 'GEL', 'POMADA', 'PASTA', 'GRANULADO'];
    const solidForms = ['TABLETA', 'CAPSULA', 'GRAGEA', 'COMPRIMIDO', 'SUPOSITORIO', 'OVULO', 'TABLETA RECUBIERTA', 'PASTILLA'];

    // Biológicos especiales (Flag "No Aplica")
    const bioForms = ['VACUNA', 'SUERO', 'BIOLOGICO', 'TOXOIDE', 'INMUNOGLOBULINA', 'ANTITOXINA'];
    const isBiological = bioForms.some(k => normForm.includes(k) || normDesc.includes(k));

    // --- NUEVA LÓGICA DE PRECEDENCIA (TAREA 1) ---

    // 1.1 BIOLÓGICOS / LIOFILIZADOS / VIALES (Prioridad Alta)
    if (normForm.includes('LIOFILIZADO') || normDesc.includes('LIOFILIZADO') || normForm.includes('VIAL') || normDesc.includes('VIAL')) {
        mode = 'DISCRETE';
        containerType = 'VIAL';
    }
    // 1.2 MANEJO ESPECIAL DE "POLVO" (Refinamiento - Subió de prioridad para evitar captura por "SUSPENSION")
    else if (normForm.includes('POLVO')) {
        // "POLVO" sin ser liofilizado
        if (normDesc.includes('SOBRE') || normForm.includes('SOBRE')) {
            mode = 'MASS_BASED';
            containerType = 'SOBRE';
        } else if (normDesc.includes('FRASCO') || normForm.includes('FRASCO')) {
            // Ej: Polvo para suspensión oral
            mode = 'DISCRETE';
            containerType = 'FRASCO';
        } else {
            // Default Polvo
            mode = 'MASS_BASED';
            containerType = 'SOBRE';
        }
    }
    // 1.3 LÍQUIDOS GENÉRICOS
    else if (liquidForms.some(k => normForm.includes(k))) {
        mode = 'VOLUMETRIC';
        containerType = 'FRASCO'; // Default
        if (normForm.includes('AMPOLLA')) containerType = 'AMPOLLA';
        if (normForm.includes('JERINGA')) containerType = 'JERINGA';
        if (normForm.includes('BOLS')) containerType = 'BOLSA';
    }
    // 1.4 MASAS / SEMISÓLIDOS
    else if (massForms.some(k => normForm.includes(k))) {
        mode = 'MASS_BASED';
        containerType = 'TUBO';
        if (normForm.includes('POTE')) containerType = 'POTE';
        if (normForm.includes('TARRO')) containerType = 'TARRO';
    }
    // 1.5 SÓLIDOS (Default)
    else {
        if (solidForms.some(k => normForm.includes(k))) {
            const found = solidForms.find(k => normForm.includes(k));
            containerType = found ? found.replace(/S$/, '') : 'TABLETA'; 
        }
    }

    // 2. EXTRACCIÓN DE CONTENIDO NETO (Dimensión Física)
    let contentNet = 0;
    let contentUnit = '';

    if (mode === 'VOLUMETRIC') {
        // Busca: 120 mL, 500 ml, 1 Litro, 0.5 L
        const volMatch = normDesc.match(/(\d+[\.,]?\d*)\s*(ML|LITRO|L|CC|CM3)/);
        if (volMatch) {
            contentNet = parseFloat(volMatch[1].replace(',', '.'));
            contentUnit = volMatch[2].replace(/(LITRO|L)/, 'L').replace(/(CC|CM3)/, 'mL');
        }
    } else if (mode === 'MASS_BASED') {
        // Busca: 30 g, 500 mg, 1 Kg
        const massMatch = normDesc.match(/(\d+[\.,]?\d*)\s*(KG|GRAMO|G|MG|MCG)/);
        if (massMatch) {
            contentNet = parseFloat(massMatch[1].replace(',', '.'));
            contentUnit = massMatch[2].replace(/(GRAMO|G)/, 'g').replace('KG', 'kg');
        }
    } else if (mode === 'DISCRETE') {
        // TAREA 1.3: Extracción de Masa en Viales/Tabletas para Display informativo (NO volumen)
        // Busca: 440 mg, 500 mg (pero NO asignamos a Volume en Calculator)
        const massMatch = normDesc.match(/(\d+[\.,]?\d*)\s*(KG|GRAMO|G|MG|MCG|UI)/);
        if (massMatch) {
            contentNet = parseFloat(massMatch[1].replace(',', '.'));
            contentUnit = massMatch[2].replace(/(GRAMO|G)/, 'g').replace('KG', 'kg');
        }
    }

    // 3. EXTRACCIÓN DE FACTOR DE EMPAQUE (Dimensión Logística)
    let packFactor = 1;
    let packType = 'CAJA';

    // Regex mejorada para detectar multiplicadores explícitos
    const multiplierRegex = /(?:CAJA|PLEGADIZA|DISPENSER|BLISTER|DISPLAY|SOBRE|ESTUCHE|PAQUETE).*?(?:POR|X|CON)\s*(\d+)/;
    const match = normDesc.match(multiplierRegex);

    if (match) {
        const detectedNum = parseInt(match[1], 10);
        
        // Anti-false positive logic
        if (mode !== 'DISCRETE' && detectedNum === contentNet && !normDesc.includes('CAJA') && !normDesc.includes('PLEGADIZA')) {
             packFactor = 1;
        } else {
             packFactor = detectedNum;
        }
    } else {
        // Fallback
        const simpleMatch = normDesc.match(/(?:X|POR)\s*(\d+)\s*(?:UNIDADES|TABLETAS|CAPSULAS|AMPOLLAS|VIALES|FRASCOS|TUBOS|$)/);
        if (simpleMatch) {
             const val = parseInt(simpleMatch[1], 10);
             packFactor = val;
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
