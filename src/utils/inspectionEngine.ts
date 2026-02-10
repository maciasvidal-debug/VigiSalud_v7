import type { Establishment, InspectionItem, CategoryType, InspectionBlock, ProductFinding, ValidationResult, RuleViolation, ConceptType } from '../types';

// =============================================================================
// 1. CONFIGURACIÓN TÁCTICA DE GOBERNANZA (PRIORIDAD DE BLOQUES)
// =============================================================================

// Define el "Camino Crítico" lógico de la visita para evitar reprocesos
// Orden lógico según el flujo de procesos del establecimiento
const BLOCK_PRIORITY: Record<InspectionBlock, number> = {
  // --- NUEVO ESTÁNDAR (IVC PRUEBAS) ---
  'TALENTO_HUMANO': 1,   // Primero: ¿Quién atiende? (Idoneidad - Dec 780)
  'LEGAL': 2,            // Segundo: ¿Existe legalmente? (Formalización)
  'INFRAESTRUCTURA': 3,  // Tercero: Recorrido locativo (Condiciones Res 1403)
  'DOTACION': 4,         // Cuarto: Equipos y Herramientas (Capacidad)
  'PROCESOS': 5,         // Quinto: Operación (Recepción, Vencimientos)
  'SANEAMIENTO': 6,      // Sexto: Limpieza y Plagas (Salubridad)
  
  // --- COMPATIBILIDAD LEGACY (DATOS ANTIGUOS) ---
  'SANITARIO': 90,
  'LOCATIVO': 91,
  'PERSONAL': 92,
  'DOCUMENTAL': 93,
  'PRODUCTOS': 94,
  'SEGURIDAD': 95
};

// Definimos un tipo interno extendido para filtrar el catálogo
interface MasterItem extends InspectionItem {
  scope: CategoryType[]; // Alcance: FORMAL, INFORMAL, AMBULANTE
  tags: string[]; // Contexto: DROGUERIA, ALIMENTOS, REFRIGERACION, etc.
}

// =============================================================================
// 2. CATÁLOGO MAESTRO DE PREGUNTAS (Res. 1403/2007 - Dec. 780/2016)
// =============================================================================

const MASTER_CATALOG: MasterItem[] = [
  
  // --- BLOQUE 1: TALENTO HUMANO (Idoneidad) ---
  {
    id: 'TH_001',
    block: 'TALENTO_HUMANO',
    text: 'Dirección Técnica a cargo de Químico Farmacéutico o Regente de Farmacia según complejidad del servicio.',
    isKiller: true, // Causal de cierre (Riesgo Crítico)
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'FARMACIA'],
    triggerCondition: 'FAIL',
    childItems: [
      { id: 'TH_001_A', block: 'TALENTO_HUMANO', text: '¿Ausencia del DT es temporal o definitiva?', isKiller: false },
      { id: 'TH_001_B', block: 'TALENTO_HUMANO', text: 'Acto administrativo de inscripción ante SDS/IDS', isKiller: true }
    ],
    legalCitation: 'Dec. 780/2016 (Art. 2.5.3.10.18) - Res. 1403/2007'
  },
  {
    id: 'TH_002',
    block: 'TALENTO_HUMANO',
    text: 'Personal auxiliar idóneo (Expendedor de Drogas / Auxiliar SF) con credencial vigente.',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['DROGUERIA'],
    legalCitation: 'Dec. 780/2016 (Art. 2.5.3.10.19) - Ley 17/1974'
  },
  {
    id: 'TH_003',
    block: 'TALENTO_HUMANO',
    text: 'Personal manipulador con indumentaria (uniforme), carnet y capacitación en higiene.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL', 'AMBULANTE'],
    tags: ['ALIMENTOS', 'DROGUERIA', 'RESTAURANTE'],
    legalCitation: 'Res. 2674/2013 (Art. 14)'
  },

  // --- BLOQUE 2: LEGAL / DOCUMENTAL ---
  {
    id: 'LEG_001',
    block: 'LEGAL',
    text: 'Certificado de Inscripción en Cámara de Comercio vigente y renovada.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Código de Comercio'
  },
  {
    id: 'LEG_002',
    block: 'LEGAL',
    text: 'Concepto de Uso de Suelo compatible con la actividad económica.',
    isKiller: false,
    scope: ['FORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Ley 1801/2016 (Código de Policía)'
  },

  // --- BLOQUE 3: INFRAESTRUCTURA (Locativo) ---
  {
    id: 'INF_001',
    block: 'INFRAESTRUCTURA',
    text: 'Pisos, Paredes y Techos (Material sanitario, lavable, continuo, resistente, de fácil limpieza).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    triggerCondition: 'FAIL',
    childItems: [
      { id: 'INF_001_A', block: 'INFRAESTRUCTURA', text: 'Evidencia crítica de humedad, moho o grietas', isKiller: true },
      { id: 'INF_001_B', block: 'INFRAESTRUCTURA', text: 'Uniones media caña en zonas de asepsia', isKiller: false }
    ],
    legalCitation: 'Res. 1403/2007 (Manual de Condiciones) - Res. 2674/2013'
  },
  {
    id: 'INF_002',
    block: 'INFRAESTRUCTURA',
    text: 'Áreas delimitadas, señalizadas e independientes (Recepción, Almacenamiento, Cuarentena, Dispensación).',
    isKiller: false, 
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'TIENDA_NATURISTA'],
    legalCitation: 'Res. 1403/2007 (Art. 12)'
  },
  {
    id: 'INF_003',
    block: 'INFRAESTRUCTURA',
    text: 'Protección adecuada contra el ambiente exterior (Techo, Parasol, barreras físicas).',
    isKiller: false,
    scope: ['AMBULANTE'],
    tags: ['TODOS'],
    legalCitation: 'Res. 604/1993'
  },

  // --- BLOQUE 4: DOTACIÓN (Equipos) ---
  {
    id: 'DOT_001',
    block: 'DOTACION',
    text: 'Termohigrómetro calibrado con registro diario de condiciones ambientales (Humedad y Temperatura).',
    isKiller: true, // Vital para estabilidad de medicamentos
    scope: ['FORMAL'],
    tags: ['DROGUERIA', 'TIENDA_NATURISTA'],
    childItems: [
      { id: 'DOT_001_A', block: 'DOTACION', text: 'Certificado de calibración vigente (1 año)', isKiller: true },
      { id: 'DOT_001_B', block: 'DOTACION', text: 'Planilla de registro de temperatura y humedad diligenciada', isKiller: false }
    ],
    legalCitation: 'Dec. 780/2016 (Buenas Prácticas) - Res. 1403/2007'
  },
  {
    id: 'DOT_002',
    block: 'DOTACION',
    text: 'Equipos de cadena de frío (Nevera) exclusivos para productos y funcionales.',
    isKiller: true,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['REFRIGERACION'],
    legalCitation: 'Manual de Cadena de Frío'
  },
  {
    id: 'DOT_003',
    block: 'DOTACION',
    text: 'Estanterías en material sanitario (Inoxidable, Plástico técnico). No madera.',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['DROGUERIA', 'ALIMENTOS'],
    legalCitation: 'Res. 1403/2007'
  },

  // --- BLOQUE 5: PROCESOS (Operacional) ---
  {
    id: 'PROC_001',
    block: 'PROCESOS',
    text: 'Prohibición de actividades no autorizadas (Inyectología sin requisitos, consulta médica, reenvase).',
    isKiller: true, // Riesgo salud pública
    scope: ['FORMAL'],
    tags: ['DROGUERIA'],
    triggerCondition: 'FAIL',
    childItems: [
      { id: 'PROC_001_A', block: 'PROCESOS', text: 'Evidencia de inyectología sin área autorizada independiente', isKiller: true },
      { id: 'PROC_001_B', block: 'PROCESOS', text: 'Evidencia de fraccionamiento de antibióticos u orales', isKiller: true }
    ],
    legalCitation: 'Dec. 780/2016 (Art. 2.5.3.10.11)'
  },
  {
    id: 'PROC_002',
    block: 'PROCESOS',
    text: 'Control de Fechas de Vencimiento y segregación de productos en Cuarentena/Baja.',
    isKiller: true,
    scope: ['FORMAL', 'INFORMAL', 'AMBULANTE'],
    tags: ['TODOS'],
    childItems: [
      { id: 'PROC_002_A', block: 'PROCESOS', text: 'Hallazgo de productos vencidos en estantería de venta', isKiller: true },
      { id: 'PROC_002_B', block: 'PROCESOS', text: 'Área de Baja/Rechazo claramente identificada', isKiller: false }
    ],
    legalCitation: 'Dec. 780/2016 - Res. 1403/2007'
  },
  {
    id: 'PROC_003',
    block: 'PROCESOS',
    text: 'Procedencia lícita de productos (Factura proveedor autorizado, Trazabilidad, Integridad de sellos).',
    isKiller: true, // Contrabando
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    legalCitation: 'Ley 1762/2015 (Ley Anticontrabando)'
  },

  // --- BLOQUE 6: SANEAMIENTO (Salida) ---
  {
    id: 'SAN_001',
    block: 'SANEAMIENTO',
    text: 'Control de Plagas y Vectores (Concepto Técnico / Certificado de Fumigación vigente).',
    isKiller: true,
    scope: ['FORMAL', 'INFORMAL', 'AMBULANTE'],
    tags: ['TODOS'],
    triggerCondition: 'FAIL',
    childItems: [
      { id: 'SAN_001_A', block: 'SANEAMIENTO', text: 'Evidencia visual de plagas (Heces, nidos, insectos vivos)', isKiller: true },
      { id: 'SAN_001_B', block: 'SANEAMIENTO', text: 'Foco de contaminación externo cercano', isKiller: true }
    ],
    legalCitation: 'Ley 9/1979 - Res. 2674/2013'
  },
  {
    id: 'SAN_002',
    block: 'SANEAMIENTO',
    text: 'Gestión Integral de Residuos (PGIRASA / Código de colores / Recolección).',
    isKiller: false,
    scope: ['FORMAL', 'INFORMAL'],
    tags: ['TODOS'],
    childItems: [
      { id: 'SAN_002_A', block: 'SANEAMIENTO', text: 'Contrato vigente de recolección de residuos peligrosos', isKiller: false },
      { id: 'SAN_002_B', block: 'SANEAMIENTO', text: 'Recipientes con tapa y pedal (Código de colores)', isKiller: false }
    ],
    legalCitation: 'Dec. 780/2016'
  }
];

// =============================================================================
// 3. CATALOGO DE REGLAS DE PRODUCTO (Manual Técnico Sec 3 y 4)
// =============================================================================

interface InternalRule {
  id: string;
  description: string;
  riskLevel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  condition: (product: ProductFinding) => boolean;
  action?: string;
}

const PRODUCT_RULES: InternalRule[] = [
  // --- SECCION 3.1 VALIDACIONES LEGALES ---
  {
    id: 'REG-L001',
    description: 'El producto debe contar con Registro Sanitario vigente o Notificación Sanitaria.',
    riskLevel: 'CRITICO',
    condition: (p) => !p.invimaReg || p.invimaReg.trim().length < 5
  },
  {
    id: 'REG-L006',
    description: 'Prohibición de comercialización sin RS o con RS vencido (Riesgo Crítico).',
    riskLevel: 'CRITICO',
    condition: (p) => (p.riskFactors || []).includes('SIN_REGISTRO')
  },
  {
    id: 'REG-L020',
    description: 'Decomiso inmediato por evidencia de falsificación o fraude.',
    riskLevel: 'CRITICO',
    condition: (p) => (p.riskFactors || []).includes('FRAUDULENTO') || (p.riskFactors || []).includes('ALTERADO')
  },

  // --- SECCION 3.3 VALIDACIONES CUANTITATIVAS ---
  {
    id: 'REG-Q001',
    description: 'La cantidad inventariada debe ser mayor a cero.',
    riskLevel: 'BAJO',
    condition: (p) => p.quantity <= 0
  },

  // --- SECCION 3.4 VALIDACIONES TÉCNICAS ---
  {
    id: 'REG-T015',
    description: 'Producto vencido. Se prohíbe su venta o dispensación.',
    riskLevel: 'ALTO',
    condition: (p) => {
      // Si ya está marcado como vencido explícitamente
      if ((p.riskFactors || []).includes('VENCIDO')) return true;
      // Validación dinámica de fecha
      if (p.expirationDate) {
        const expDate = new Date(p.expirationDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        return expDate < today;
      }
      return false;
    }
  },
  {
    id: 'REG-T001',
    description: 'Condiciones de almacenamiento inadecuadas / Ruptura de cadena de frío.',
    riskLevel: 'ALTO',
    condition: (p) => (p.riskFactors || []).includes('MAL_ALMACENAMIENTO') || (!!p.coldChainStatus && p.coldChainStatus.includes('INCUMPLE'))
  },

  // --- SECCION 3.2 VALIDACIONES DOCUMENTALES ---
  {
    id: 'REG-D006',
    description: 'Los dispositivos médicos deben contar con manual de uso visible.',
    riskLevel: 'MEDIO',
    condition: (p) => p.type === 'DISPOSITIVO_MEDICO' && p.observations === 'NO'
  },
  {
    id: 'REG-T012',
    description: 'Equipos biomédicos deben tener calibración vigente (Decreto 4725).',
    riskLevel: 'ALTO',
    condition: (p) => p.type === 'DISPOSITIVO_MEDICO' && p.subtype === 'EQUIPO_BIOMEDICO' && p.calibrationStatus === 'VENCIDA'
  },
  {
    id: 'REG-D008',
    description: 'Suplementos dietarios requieren tabla nutricional obligatoria.',
    riskLevel: 'MEDIO',
    condition: (p) => p.type === 'SUPLEMENTO' && p.observations === 'NO'
  }
];

// =============================================================================
// 4. EL MOTOR LÓGICO
// =============================================================================

class NarrativeBuilder {
  private static OPENERS = ["Se evidencia", "Se observa", "Se constata", "Se verifica", "Se identifica"];
  private static CONNECTORS = ["Adicionalmente,", "Por otro lado,", "Aunado a lo anterior,", "Así mismo,", "En lo referente a"];
  private static CLOSERS = ["Lo anterior configura un riesgo sanitario.", "Se requiere subsanación inmediata.", "Dichos hallazgos contravienen la norma.", "Situación que compromete la inocuidad."];

  static build(failedItems: InspectionItem[], products: ProductFinding[]): string {
    const seized = products.filter(p => p.seizureType !== 'NINGUNO');

    if (failedItems.length === 0 && seized.length === 0) {
      return "No se evidencian hallazgos críticos al momento de la visita. El establecimiento cumple con las condiciones sanitarias evaluadas conforme a la normatividad vigente.";
    }

    let narrative = "";

    // Agrupación por Bloque
    const groups: Record<string, string[]> = {};
    failedItems.forEach(item => {
      if (!groups[item.block]) groups[item.block] = [];
      // Limpiar texto para fluidez (eliminar puntos finales, etc)
      const cleanText = item.text.trim().replace(/\.$/, '').toLowerCase();
      groups[item.block].push(cleanText);
    });

    // Construcción de Oraciones (Loop Determinista)
    const blocks = Object.keys(groups);
    blocks.forEach((block, index) => {
      const findings = groups[block];
      let prefix = "";

      if (index === 0) {
        prefix = this.OPENERS[Math.floor(Math.random() * this.OPENERS.length)];
      } else {
        prefix = this.CONNECTORS[Math.floor(Math.random() * this.CONNECTORS.length)];
      }

      // Unir hallazgos con comas y 'y' final
      let findingsText = "";
      if (findings.length === 1) {
          findingsText = findings[0];
      } else {
          const last = findings.pop();
          findingsText = findings.join(", ") + " y " + last;
      }

      const blockName = block.replace(/_/g, ' ');
      narrative += `${prefix} en el subsistema de ${blockName} ${findingsText}. `;
    });

    // Productos
    if (seized.length > 0) {
        const total = seized.reduce((acc, p) => acc + p.quantity, 0);
        const types = [...new Set(seized.map(p => p.type))].join(', ');
        narrative += `En relación a los productos, se aplicó Medida Sanitaria a ${total} unidades (${types}) debido a incumplimientos de calidad y seguridad. `;
    }

    // Cierre
    if (narrative.length > 0) {
        narrative += this.CLOSERS[Math.floor(Math.random() * this.CLOSERS.length)];
    }

    return narrative;
  }
}

const mockCloudGeneration = async (establishment: Establishment, failedItems: InspectionItem[]): Promise<string> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const count = failedItems.length;
            const riskLevel = count > 3 ? "ALTO" : "MODERADO";
            resolve(`[IA CLOUD] De acuerdo con la evaluación técnica realizada en ${establishment.name}, se identifican ${count} no conformidades que configuran un nivel de riesgo ${riskLevel}. La inteligencia artificial sugiere intervención prioritaria en los procesos críticos para garantizar el cumplimiento normativo y la seguridad sanitaria.`);
        }, 1500);
    });
};

export const inspectionEngine = {
  /**
   * Genera una lista de inspección adaptada al perfil del establecimiento.
   * Filtra por Scope (Categoría) y Tags (Tipo de negocio).
   * Ordena estrictamente por Bloque Lógico y luego por Criticidad.
   */
  generate: (establishment: Establishment): InspectionItem[] => {
    const { category, type } = establishment;
    
    // 1. Normalización de Tags (Inteligencia de Negocio)
    const activeTags = new Set<string>(['TODOS']);
    const upperType = type.toUpperCase();

    // Mapeo Inteligente de Tags según actividad económica
    if (upperType.includes('DROGUERÍA') || upperType.includes('FARMACIA') || upperType.includes('DROGAS') || upperType.includes('FARMACÉUTICO')) {
      activeTags.add('DROGUERIA');
      activeTags.add('FARMACIA');
      activeTags.add('REFRIGERACION');
    }
    if (upperType.includes('RESTAURANTE') || upperType.includes('COMIDA') || upperType.includes('ALIMENTO') || upperType.includes('FRUTAS') || upperType.includes('CARNICERÍA')) {
      activeTags.add('ALIMENTOS');
      activeTags.add('REFRIGERACION');
      activeTags.add('RESTAURANTE');
    }
    if (upperType.includes('TIENDA NATURISTA')) {
      activeTags.add('TIENDA_NATURISTA');
    }

    // 2. Filtrado del Catálogo (Solo lo relevante)
    const checklist = MASTER_CATALOG.filter(item => {
      // Filtro A: Alcance
      const scopeMatch = item.scope.includes(category);
      // Filtro B: Relevancia
      const tagMatch = item.tags.some(tag => activeTags.has(tag));
      return scopeMatch && tagMatch;
    });

    // 3. Ordenamiento Táctico (NUEVO ALGORITMO)
    // Prioridad 1: Orden de Bloque (Flujo de visita lógica)
    // Prioridad 2: Criticidad (Killer primero dentro del bloque para alerta temprana)
    return checklist.sort((a, b) => {
      const priorityA = BLOCK_PRIORITY[a.block as InspectionBlock] || 99;
      const priorityB = BLOCK_PRIORITY[b.block as InspectionBlock] || 99;

      // Ordenar por Bloque
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Ordenar por Criticidad dentro del bloque (Killer primero)
      if (a.isKiller && !b.isKiller) return -1;
      if (!a.isKiller && b.isKiller) return 1;

      return 0; // Orden estable
    });
  },

  /**
   * Calcula el riesgo ponderado.
   * Data Governance: Killers pesan 10x (Impacto Salud Pública)
   */
  calculateRisk: (items: InspectionItem[], responses: Record<string, string>): number => {
    if (items.length === 0) return 100;

    let totalWeight = 0;
    let earnedWeight = 0;

    items.forEach(item => {
      const response = responses[item.id];
      // Peso Táctico: 10x para críticos, 1x para normales
      const weight = item.isKiller ? 10 : 1; 

      // Data Governance: Si NO APLICA, sacamos el ítem de la ecuación (ponderación dinámica)
      if (response === 'NO_APLICA') return;

      totalWeight += weight;

      if (response === 'CUMPLE') {
        earnedWeight += weight;
      }
      // NO_CUMPLE suma 0 al earnedWeight
    });

    // Evitar división por cero
    return totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);
  },

  /**
   * Valida un producto contra el Motor de Reglas (Manual Técnico Sec 4).
   * @param product Producto a validar
   * @returns Resultado de validación con lista de violaciones
   */
  validateProduct: (product: ProductFinding): ValidationResult => {
    const violations: RuleViolation[] = [];

    for (const rule of PRODUCT_RULES) {
      // Si la regla se cumple (condition returns true), es una violación
      if (rule.condition(product)) {
        violations.push({
          id: rule.id,
          description: rule.description,
          riskLevel: rule.riskLevel,
          action: rule.action
        });
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  },

  /**
   * Determina el concepto técnico basado en el puntaje y hallazgos críticos.
   */
  getConcept: (score: number, hasCriticalFindings: boolean): ConceptType => {
    if (hasCriticalFindings || score < 60) {
      return 'DESFAVORABLE';
    }
    if (score < 100) {
      return 'FAVORABLE_CON_REQUERIMIENTOS';
    }
    return 'FAVORABLE';
  },

  /**
   * Genera el relato de hechos (Híbrido IA/Local).
   * Contexto: Tablero de Cierre.
   */
  generateHybridNarrative: async (
    checklistResponses: Record<string, { status: string }>,
    products: ProductFinding[],
    establishment: Establishment
  ): Promise<{ narrativeSuggestion: string; legalBasisSuggestion: string; violatedNorms: string[] }> => {

    // Recopilar hallazgos para el motor
    const allItems = inspectionEngine.generate(establishment);
    const failedItems = allItems.filter(item => {
      const resp = checklistResponses[item.id];
      return resp && resp.status === 'NO_CUMPLE';
    });

    let narrative = "";

    // ESTRATEGIA: PROGRESSIVE ENHANCEMENT
    if (navigator.onLine) {
        try {
            console.log("☁️ Intentando generación Cloud AI...");
            narrative = await mockCloudGeneration(establishment, failedItems);
        } catch (e) {
            console.warn("⚠️ Fallo Cloud. Degradando a Local...");
            narrative = NarrativeBuilder.build(failedItems, products);
        }
    } else {
        console.log("🔋 Modo Offline. Usando Motor Local...");
        narrative = NarrativeBuilder.build(failedItems, products);
    }

    // PLANTILLA FORMAL
    const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short' }).format(new Date());
    const city = establishment.city || 'Barranquilla';

    const header = `En la ciudad de ${city}, siendo las ${date}, se constituyó el funcionario competente en las instalaciones del establecimiento de comercio denominado ${establishment.name}.`;
    const footer = "Se suscribe la presente acta en constancia de lo anterior, informando al atendido sobre el derecho de contradicción y defensa.";

    const fullNarrative = `${header}\n\n${narrative}\n\n${footer}`;

    // --- GENERACIÓN DE FUNDAMENTOS LEGALES (Reutilizando lógica legacy) ---
    // (Simplificado para evitar duplicación masiva, extraemos lo esencial del método anterior)
    const violatedNorms: string[] = [];
    const legalBasisParts: Set<string> = new Set();

    failedItems.forEach(item => {
        const citation = item.legalCitation || 'Normatividad Sanitaria Vigente';
        violatedNorms.push(`• [${citation}]: ${item.text}`);
        if (item.legalCitation) legalBasisParts.add(item.legalCitation);
    });

    const seizedProducts = products.filter(p => p.seizureType !== 'NINGUNO');
    if (seizedProducts.length > 0) {
        legalBasisParts.add("Ley 9 de 1979 (Código Sanitario Nacional)");
        seizedProducts.forEach(p => {
             violatedNorms.push(`• [PRODUCTO]: ${p.name} presenta factores de riesgo sanitario.`);
        });
    }

    return {
      narrativeSuggestion: fullNarrative,
      legalBasisSuggestion: Array.from(legalBasisParts).join('.\n'),
      violatedNorms
    };
  },

  /**
   * @deprecated Usar generateHybridNarrative (Async)
   */
  generateLegalContext: (
    checklistResponses: Record<string, { status: string }>,
    products: ProductFinding[],
    establishment: Establishment
  ): { narrativeSuggestion: string; legalBasisSuggestion: string; violatedNorms: string[] } => {
      // Wrapper síncrono para mantener compatibilidad si algo falla,
      // pero idealmente todo debe migrar a async.
      // Retornamos el builder local directamente.
      const allItems = inspectionEngine.generate(establishment);
      const failedItems = allItems.filter(item => checklistResponses[item.id]?.status === 'NO_CUMPLE');
      const narrative = NarrativeBuilder.build(failedItems, products);

      return {
          narrativeSuggestion: narrative,
          legalBasisSuggestion: "Ver fundamentos en modo asíncrono.",
          violatedNorms: []
      };
  }
};
