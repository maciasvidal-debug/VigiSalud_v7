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
    const liquidForms = ['JARABE', 'SOLUCION', 'SUSPENSION', 'ELIXIR', 'EMULSION', 'LOCION', 'INYECCION', 'VIAL', 'AMPOLLA', 'AEROSOL', 'SPRAY', 'GOTAS', 'JERINGA', 'LÍQUIDO', 'LIQUIDO'];
    const massForms = ['CREMA', 'UNGUENTO', 'GEL', 'POMADA', 'PASTA', 'POLVO', 'GRANULADO'];
    const solidForms = ['TABLETA', 'CAPSULA', 'GRAGEA', 'COMPRIMIDO', 'SUPOSITORIO', 'OVULO', 'TABLETA RECUBIERTA', 'PASTILLA'];

    // Biológicos especiales (Flag "No Aplica")
    const bioForms = ['VACUNA', 'SUERO', 'BIOLOGICO', 'TOXOIDE', 'INMUNOGLOBULINA', 'ANTITOXINA'];
    const isBiological = bioForms.some(k => normForm.includes(k) || normDesc.includes(k));

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

    // Regex mejorada para detectar multiplicadores explícitos en multipacks líquidos y sólidos
    // Soporta: "CAJA X 10", "PLEGADIZA POR 5", "CAJA CON 100", "ESTUCHE X 1"
    const multiplierRegex = /(?:CAJA|PLEGADIZA|DISPENSER|BLISTER|DISPLAY|SOBRE|ESTUCHE|PAQUETE).*?(?:POR|X|CON)\s*(\d+)/;
    const match = normDesc.match(multiplierRegex);

    if (match) {
        const detectedNum = parseInt(match[1], 10);
        
        // --- REGLA DE SEGURIDAD HEURÍSTICA ---
        // Si detectamos un número igual al contenido neto en un producto NO sólido, asumimos falso positivo
        // EXCEPTO si es explícitamente "CAJA X ...", en cuyo caso el regex manda.
        // Pero mantenemos la cautela: si dice "FRASCO X 120 ML", el regex de arriba NO debería matchear porque busca palabras contenedoras (CAJA, PLEGADIZA).
        // Si el regex matchea "CAJA ... X 10", es muy probable que sea el factor.

        if (mode !== 'DISCRETE' && detectedNum === contentNet && !normDesc.includes('CAJA') && !normDesc.includes('PLEGADIZA')) {
             // Caso ambiguo raro, conservador:
             packFactor = 1;
        } else {
             packFactor = detectedNum;
        }
    } else {
        // Fallback para Sólidos y otros: Si dice "X 100" sin decir "Caja", asumimos factor
        const simpleMatch = normDesc.match(/(?:X|POR)\s*(\d+)\s*(?:UNIDADES|TABLETAS|CAPSULAS|AMPOLLAS|VIALES|FRASCOS|TUBOS|$)/);
        if (simpleMatch) {
             const val = parseInt(simpleMatch[1], 10);
             // Evitar confundir con concentración o contenido (ej: "X 500mg")
             // Si el número es seguido de una unidad de medida, NO es factor. El regex arriba busca UNIDADES/TABLETAS/etc o fin de linea.
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
