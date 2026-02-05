import type { Establishment, InspectionItem, CategoryType, InspectionBlock, ConceptType, ProductFinding } from '../types';
import { MANUAL_RULES, type ManualRule } from '../data/manualRules';

// =============================================================================
// 1. CONFIGURACIÓN TÁCTICA DE GOBERNANZA (PRIORIDAD DE BLOQUES)
// =============================================================================

// Define el orden lógico del recorrido de inspección según Manual IVC
const BLOCK_PRIORITY: Record<InspectionBlock, number> = {
  'LEGAL': 1,            // Documentación habilitante
  'TALENTO_HUMANO': 2,   // Responsabilidad técnica
  'INFRAESTRUCTURA': 3,  // Condiciones locativas
  'DOTACION': 4,         // Equipos e instrumentos
  'PROCESOS': 5,         // Operación (Recepción, Almacenamiento)
  'SANEAMIENTO': 6,      // Limpieza y Plagas
  'PRODUCTOS': 7,        // Muestreo selectivo (Inventario)
  'SANITARIO': 90,       // Legacy
  'LOCATIVO': 91,        // Legacy
  'PERSONAL': 92,        // Legacy
  'DOCUMENTAL': 93,      // Legacy
  'SEGURIDAD': 99        // Cierre
};

// Interfaz interna para el catálogo maestro
interface MasterItem extends InspectionItem {
  scope: CategoryType[]; // Alcance: FORMAL, INFORMAL, etc.
  tags: string[]; // Etiquetas para filtrado contextual (Ej: TIENDA_NATURISTA, CADENA_FRIO)
}

// =============================================================================
// 2. CATÁLOGO MAESTRO DE PREGUNTAS (ROBUSTO - RES. 1403/2007 & DEC. 780/2016)
// =============================================================================

const MASTER_CATALOG: MasterItem[] = [
  // ---------------------------------------------------------------------------
  // BLOQUE: ASPECTOS LEGALES Y ADMINISTRATIVOS
  // ---------------------------------------------------------------------------
  {
    id: 'LEG_001',
    block: 'LEGAL',
    text: 'Cuenta con autorización de apertura o funcionamiento vigente (Resolución/Concepto previo).',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Dec. 780/2016'
  },
  {
    id: 'LEG_002',
    block: 'LEGAL',
    text: 'El establecimiento cuenta con letrero exterior que lo identifica claramente (Razón Social).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },

  // ---------------------------------------------------------------------------
  // BLOQUE: TALENTO HUMANO (CRÍTICO)
  // ---------------------------------------------------------------------------
  {
    id: 'TH_001',
    block: 'TALENTO_HUMANO',
    text: 'La Dirección Técnica está a cargo de personal idóneo (Q.F. o Regente de Farmacia) con presencia verificada.',
    isKiller: true, // CAUSAL DE CIERRE
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'FARMACIA'],
    triggerCondition: 'FAIL',
    legalCitation: 'Dec. 780/2016 Art. 2.5.3.10.12'
  },
  {
    id: 'TH_002',
    block: 'TALENTO_HUMANO',
    text: 'El Director Técnico presenta contrato vigente y certificado de inscripción en RETHUS.',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'FARMACIA'],
    legalCitation: 'Ley 1164/2007'
  },
  {
    id: 'TH_003',
    block: 'TALENTO_HUMANO',
    text: 'El personal auxiliar (Expendedor de Drogas/Aux. Farmacia) cuenta con credencial expedida por autoridad competente.',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['DROGUERIA'],
    legalCitation: 'Ley 17/1974'
  },
  {
    id: 'TH_004',
    block: 'TALENTO_HUMANO',
    text: 'El personal cuenta con dotación adecuada (bata, identificación) y elementos de protección personal.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },

  // ---------------------------------------------------------------------------
  // BLOQUE: INFRAESTRUCTURA (LOCATIVO)
  // ---------------------------------------------------------------------------
  {
    id: 'INF_001',
    block: 'INFRAESTRUCTURA',
    text: 'Pisos en material impermeable, resistente, uniforme y de fácil limpieza (Media caña).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007 - Manual de Condiciones'
  },
  {
    id: 'INF_002',
    block: 'INFRAESTRUCTURA',
    text: 'Paredes y techos limpios, en buen estado, resistentes a factores ambientales e impermeables.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'INF_003',
    block: 'INFRAESTRUCTURA',
    text: 'Áreas de almacenamiento independientes, delimitadas e identificadas (Recepción, Cuarentena, Bodega, Averiados).',
    isKiller: true, // CRÍTICO: MEZCLA DE PRODUCTOS
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'TIENDA_NATURISTA', 'FARMACIA'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'INF_004',
    block: 'INFRAESTRUCTURA',
    text: 'Ventilación e iluminación (natural o artificial) adecuadas para la conservación de productos.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'INF_005',
    block: 'INFRAESTRUCTURA',
    text: 'Cuenta con unidad sanitaria limpia y funcional, aislada del área de almacenamiento.',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Ley 9/1979'
  },

  // ---------------------------------------------------------------------------
  // BLOQUE: DOTACIÓN Y EQUIPOS
  // ---------------------------------------------------------------------------
  {
    id: 'DOT_001',
    block: 'DOTACION',
    text: 'Cuenta con termohigrómetros calibrados en áreas de almacenamiento (Certificado de calibración vigente).',
    isKiller: true, // CRÍTICO
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'TIENDA_NATURISTA', 'FARMACIA'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'DOT_002',
    block: 'DOTACION',
    text: 'Estanterías en material lavable, en buen estado y separadas de paredes/piso (Uso de estibas).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'DOT_003',
    block: 'DOTACION',
    text: 'Sistema de cadena de frío (Nevera) con control de temperatura, plan de contingencia y planta eléctrica.',
    isKiller: true, // CRÍTICO PARA BIOLÓGICOS
    scope: ['FORMAL'],
    tags: ['REFRIGERACION'],
    legalCitation: 'Dec. 1782/2014'
  },

  // ---------------------------------------------------------------------------
  // BLOQUE: PROCESOS GENERALES
  // ---------------------------------------------------------------------------
  {
    id: 'PRO_001',
    block: 'PROCESOS',
    text: 'Realiza proceso técnico de Recepción comparando administrativo vs técnico (Actas de recepción).',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'PRO_002',
    block: 'PROCESOS',
    text: 'Almacenamiento ordenado (Alfabético, Farmacológico o Laboratorio) evitando confusión.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'PRO_003',
    block: 'PROCESOS',
    text: 'Control de fechas de vencimiento (Semaforización, sistema o revisión periódica).',
    isKiller: true, // CRÍTICO
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  },
  {
    id: 'PRO_004',
    block: 'PROCESOS',
    text: 'Manejo de Medicamentos de Control Especial (MCE): Libro oficial, resoluciones y armario de seguridad.',
    isKiller: true, // CRÍTICO LEGAL
    scope: ['FORMAL'],
    tags: ['FARMACIA', 'DROGUERIA'], // Tiendas naturistas no pueden manejar MCE
    legalCitation: 'Res. 1478/2006'
  },
  {
    id: 'PRO_005',
    block: 'PROCESOS',
    text: 'Se prohíbe la realización de procedimientos de inyectología sin cumplimiento de requisitos (Área, camilla, dotación).',
    isKiller: true, // CRÍTICO
    scope: ['FORMAL'],
    tags: ['DROGUERIA'],
    legalCitation: 'Dec. 2330/2006'
  },

  // ---------------------------------------------------------------------------
  // BLOQUE: SANEAMIENTO
  // ---------------------------------------------------------------------------
  {
    id: 'SAN_001',
    block: 'SANEAMIENTO',
    text: 'Programa de control de plagas y roedores vigente (Certificado de fumigación).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Ley 9/1979'
  },
  {
    id: 'SAN_002',
    block: 'SANEAMIENTO',
    text: 'Manejo de residuos sólidos y líquidos (PGIRH, guardianes, ruta sanitaria, contrato de recolección).',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Dec. 351/2014'
  },
  {
    id: 'SAN_003',
    block: 'SANEAMIENTO',
    text: 'Áreas, estanterías y productos libres de polvo y suciedad visible.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Res. 1403/2007'
  }
];

// =============================================================================
// 3. EL MOTOR LÓGICO (CORE)
// =============================================================================

export const inspectionEngine = {
  /**
   * Genera la lista de inspección filtrada y ordenada según el establecimiento.
   */
  generate: (establishment: Establishment): InspectionItem[] => {
    const { category, type } = establishment;
    const activeTags = new Set<string>(['TODOS']);
    const upperType = (type || '').toUpperCase();

    // 1. Detección de Tags basada en el Tipo de Establecimiento
    if (upperType.includes('DROGUERÍA') || upperType.includes('FARMACIA') || upperType.includes('DROGAS')) {
      activeTags.add('DROGUERIA');
      activeTags.add('FARMACIA');
      activeTags.add('REFRIGERACION'); // Asumimos capacidad de cadena de frío por defecto
    }
    
    if (upperType.includes('TIENDA NATURISTA')) {
      activeTags.add('TIENDA_NATURISTA');
    }

    if (upperType.includes('DEPOSITO')) {
        activeTags.add('DROGUERIA'); // Aplican normas similares
    }

    // 2. Filtrado del Catálogo Maestro
    const checklist = MASTER_CATALOG.filter(item => {
      // Filtro por Categoría (Formal/Informal)
      const scopeMatch = item.scope.includes(category);
      
      // Filtro por Etiquetas (Tags)
      // El item debe tener al menos un tag que coincida con los tags activos del establecimiento
      const tagMatch = item.tags.some(tag => activeTags.has(tag));
      
      return scopeMatch && tagMatch;
    });

    // 3. Ordenamiento Lógico (Primero lo crítico, luego el flujo)
    return checklist.sort((a, b) => {
      // Type assertion para asegurar que las claves existen en BLOCK_PRIORITY
      const priorityA = BLOCK_PRIORITY[a.block as InspectionBlock] || 99;
      const priorityB = BLOCK_PRIORITY[b.block as InspectionBlock] || 99;

      // Ordenar por Bloque
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Dentro del bloque, los items "Killer" (Críticos) van primero
      if (a.isKiller && !b.isKiller) return -1;
      if (!a.isKiller && b.isKiller) return 1;
      
      // Ordenar por ID para consistencia visual
      return a.id.localeCompare(b.id);
    });
  },

  /**
   * Calcula el porcentaje de cumplimiento ponderado.
   * Killers pesan 10x más que items normales.
   */
  calculateRisk: (items: InspectionItem[], responses: Record<string, string>): number => {
    if (items.length === 0) return 100;

    let totalWeight = 0;
    let earnedWeight = 0;

    items.forEach(item => {
      const response = responses[item.id];
      // Si el item fue marcado como 'NO_APLICA', se excluye del denominador
      if (response === 'NO_APLICA') return;

      const weight = item.isKiller ? 10 : 1; 
      totalWeight += weight;

      if (response === 'CUMPLE') {
        earnedWeight += weight;
      }
    });

    // Evitar división por cero
    return totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);
  },

  /**
   * Determina el concepto técnico final basado en puntaje y hallazgos críticos.
   */
  getConcept: (score: number, hasCriticalFindings: boolean): ConceptType => {
    // Si hay productos decomisados (Riesgo Crítico), el concepto es Desfavorable automáticamente
    if (hasCriticalFindings) return 'DESFAVORABLE';
    
    // Escala de calificación estándar INVIMA
    if (score >= 90) return 'FAVORABLE';
    if (score >= 60) return 'FAVORABLE_CON_REQUERIMIENTOS';
    return 'DESFAVORABLE';
  },

  /**
   * Valida un producto contra el Motor de Reglas (Jules).
   * Devuelve estado de validez y lista de violaciones normativas.
   */
  validateProduct: (product: Partial<ProductFinding>): { isValid: boolean, violations: ManualRule[] } => {
    const violations: ManualRule[] = [];

    // 1. Regla Legal: Registro Sanitario Inválido o Corto (REG-L001)
    if (!product.invimaReg || product.invimaReg.length < 5) {
       const rule = MANUAL_RULES.find(r => r.id === 'REG-L001');
       if (rule) violations.push(rule);
    }

    // 2. Regla Estado: Vencido o Sin Registro (REG-L006)
    if (product.riskFactor === 'SIN_REGISTRO' || product.riskFactor === 'VENCIDO') {
       const rule = MANUAL_RULES.find(r => r.id === 'REG-L006');
       if (rule) violations.push(rule);
    }

    // 3. Regla Documental: Falta de Lote (REG-D003)
    if (!product.lot || product.lot.length < 3) {
       const rule = MANUAL_RULES.find(r => r.id === 'REG-D003');
       if (rule) violations.push(rule);
    }

    // 4. Regla Técnica: Cadena de Frío (REG-T002)
    if (product.coldChainStatus && product.coldChainStatus.includes('INCUMPLE')) {
        const rule = MANUAL_RULES.find(r => r.id === 'REG-T002');
        if (rule) violations.push(rule);
    }

    // 5. Regla Cuantitativa: Cantidades negativas o cero (REG-Q003)
    if (product.quantity !== undefined && product.quantity <= 0) {
        const rule = MANUAL_RULES.find(r => r.id === 'REG-Q003');
        if (rule) violations.push(rule);
    }

    return {
        isValid: violations.length === 0,
        violations: violations.filter(Boolean) as ManualRule[]
    };
  }
};
