// src/utils/PharmaParser.ts
import type { CommercialPresentation, PresentationMode } from '../types';

/**
 * PARSER FARMACÉUTICO (Motor Semántico v8)
 * Interpreta descripciones como "CAJA X 100 TABLETAS" o "FRASCO X 120 ML"
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
    const liquidForms = ['JARABE', 'SOLUCION', 'SUSPENSION', 'ELIXIR', 'EMULSION', 'LOCION', 'INYECCION', 'VIAL', 'AMPOLLA', 'AEROSOL', 'SPRAY', 'GOTAS'];
    const massForms = ['CREMA', 'UNGUENTO', 'GEL', 'POMADA', 'PASTA', 'POLVO', 'GRANULADO'];
    const solidForms = ['TABLETA', 'CAPSULA', 'GRAGEA', 'COMPRIMIDO', 'SUPOSITORIO', 'OVULO', 'TABLETA RECUBIERTA'];

    if (liquidForms.some(k => normForm.includes(k))) {
        mode = 'VOLUMETRIC';
        containerType = 'FRASCO'; // Default
        if (normForm.includes('AMPOLLA')) containerType = 'AMPOLLA';
        if (normForm.includes('VIAL')) containerType = 'VIAL';
        if (normForm.includes('JERINGA')) containerType = 'JERINGA';
        if (normForm.includes('BOLS')) containerType = 'BOLSA';
    } else if (massForms.some(k => normForm.includes(k))) {
        mode = 'MASS_BASED';
        containerType = 'TUBO';
        if (normForm.includes('SOBRE')) containerType = 'SOBRE';
        if (normForm.includes('POTE')) containerType = 'POTE';
        if (normForm.includes('TARRO')) containerType = 'TARRO';
    } else {
        // Sólidos por defecto
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
    }

    // 3. EXTRACCIÓN DE FACTOR DE EMPAQUE (Dimensión Logística)
    let packFactor = 1;
    let packType = 'CAJA';

    // Regex para detectar multiplicadores explícitos: "Caja por 100", "Plegadiza x 30"
    // El orden es vital: Buscamos primero la palabra contenedora + número
    const multiplierRegex = /(?:CAJA|PLEGADIZA|DISPENSER|BLISTER|DISPLAY|SOBRE|ESTUCHE)\s*(?:POR|X|CON)?\s*(\d+)\s*(?:UNIDADES|TABLETAS|CAPSULAS|AMPOLLAS|VIALES|FRASCOS|TUBOS|$)/;
    const match = normDesc.match(multiplierRegex);

    if (match) {
        const detectedNum = parseInt(match[1], 10);
        
        // --- REGLA DE SEGURIDAD HEURÍSTICA ---
        // Evitamos confundir "120" de "120 mL" con "Caja x 120".
        // Si detectamos un número igual al contenido neto en un producto NO sólido, asumimos falso positivo.
        if (mode !== 'DISCRETE' && detectedNum === contentNet) {
            packFactor = 1; // Es un unitario (Ej: Caja con 1 Frasco de 120mL)
        } else {
            packFactor = detectedNum; // Es un multipack (Ej: Caja x 100 Tabletas)
        }
    } else {
        // Fallback para Sólidos: Si dice "X 100" sin decir "Caja", asumimos factor si no hay otra unidad
        if (mode === 'DISCRETE') {
             const simpleMatch = normDesc.match(/(?:X|POR)\s*(\d+)/);
             if (simpleMatch) packFactor = parseInt(simpleMatch[1], 10);
        } else {
             // Líquidos por defecto: 1
             packFactor = 1;
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
        detectedString
    };
};