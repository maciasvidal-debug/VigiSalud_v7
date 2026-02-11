import type { ProductSubtype } from '../types';

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'number';
  required: boolean;
  options?: string[];
  placeholder?: string;
  // Grilla 12 columnas (ISO 9241)
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; 
  hint?: string;
  section?: 'HEADER' | 'TECHNICAL' | 'LOGISTICS' | 'COLD_CHAIN';
  triggerSubtypes?: ProductSubtype[]; 
  disabled?: boolean;
}

export interface ProductSchema {
  subtypes: ProductSubtype[];
  fields: FieldConfig[];
}

// DICCIONARIO DE FORMAS FARMACÉUTICAS (Estándar INVIMA)
const PHARMA_FORMS = [
  'TABLETA', 'TABLETA RECUBIERTA', 'CAPSULA', 'CAPSULA BLANDA', 
  'JARABE', 'SOLUCION ORAL', 'SUSPENSION', 'ELIXIR', 
  'SOLUCION INYECTABLE', 'POLVO PARA RECONSTITUIR', 
  'CREMA', 'UNGUENTO', 'GEL', 'LOCION', 
  'OVULO', 'SUPOSITORIO', 'AEROSOL', 'GOTAS'
];

export const PRODUCT_SCHEMAS: Record<string, ProductSchema> = {
  'MEDICAMENTO': {
    subtypes: [
      'SINTESIS_QUIMICA', 'BIOLOGICO', 'BIOTECNOLOGICO', 
      'HOMEOPATICO', 'FITOTERAPEUTICO', 'CONTROL_ESPECIAL', 
      'GAS_MEDICINAL', 'RADIOFARMACO'
    ],
    fields: [
      // Fila 1: Identificación (Buscador ocupa espacio premium)
      { key: 'cum', label: 'CUM / Expediente', type: 'text', required: false, placeholder: 'Digite para buscar...', colSpan: 5, section: 'HEADER', hint: 'F2 para Búsqueda Avanzada' },
      { key: 'invimaReg', label: 'Registro Sanitario', type: 'text', required: true, placeholder: 'Ej: 2015M-00...', colSpan: 4, section: 'HEADER' },
      { key: 'lot', label: 'Lote', type: 'text', required: true, placeholder: 'Lote Impreso', colSpan: 3, section: 'HEADER' },

      // Fila 2: Descripción Comercial
      { key: 'name', label: 'Nombre Comercial', type: 'text', required: true, placeholder: 'Nombre exacto del empaque', colSpan: 6, section: 'TECHNICAL' },
      { key: 'presentation', label: 'Presentación Comercial', type: 'text', required: true, placeholder: 'Ej: Caja x 30 Tabletas', colSpan: 6, section: 'TECHNICAL' },

      // Fila 3: Detalles Técnicos (Corrección: Forma Farmacéutica es Select)
      { key: 'activePrinciple', label: 'Principio Activo', type: 'text', required: true, placeholder: 'DCI', colSpan: 5, section: 'TECHNICAL' },
      { key: 'pharmaceuticalForm', label: 'Forma Farmacéutica', type: 'select', required: true, options: PHARMA_FORMS, colSpan: 4, section: 'TECHNICAL' },
      { key: 'concentration', label: 'Concentración', type: 'text', required: true, placeholder: 'Ej: 500mg', colSpan: 3, section: 'TECHNICAL' },
      { key: 'atcCode', label: 'Código ATC', type: 'text', required: false, section: 'TECHNICAL' },

      // Fila 4: Fechas y Titular
      { key: 'expirationDate', label: 'Vencimiento', type: 'date', required: true, colSpan: 4, section: 'TECHNICAL' },
      { key: 'manufacturer', label: 'Titular / Fabricante', type: 'text', required: true, placeholder: 'Laboratorio', colSpan: 8, section: 'TECHNICAL' },

      // Fila 5: Logística
      { key: 'quantity', label: 'Inventario', type: 'number', required: true, placeholder: '0', colSpan: 12, section: 'LOGISTICS' },
    ]
  },
  
  // Mantenemos los otros esquemas con corrección de ancho
  'DISPOSITIVO_MEDICO': {
    subtypes: ['EQUIPO_BIOMEDICO', 'INSUMO_MEDICO', 'INSTRUMENTAL', 'SOBRE_MEDIDA'],
    fields: [
      { key: 'name', label: 'Nombre Dispositivo', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'invimaReg', label: 'Registro Sanitario', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'riskClassDM', label: 'Clasificación Riesgo', type: 'select', required: true, options: ['CLASE_I', 'CLASE_IIA', 'CLASE_IIB', 'CLASE_III', 'NO_APLICA'], colSpan: 4, section: 'TECHNICAL', hint: "Verifique la etiqueta trasera del equipo." },
      { key: 'model', label: 'Modelo / Referencia', type: 'text', required: false, colSpan: 4, section: 'TECHNICAL', placeholder: "Ej: Ref. X500 / Modelo Pro..." },
      { key: 'serial', label: 'Serie / Lote', type: 'text', required: true, colSpan: 4, section: 'TECHNICAL', placeholder: "S/N del fabricante o Lote..." },
      { key: 'expirationDate', label: 'Vida Útil (Si aplica)', type: 'date', required: false, colSpan: 6, section: 'TECHNICAL' },
      // REG-T012: Calibración
      { key: 'calibrationStatus', label: 'Estado de Calibración', type: 'select', required: true, options: ['VIGENTE', 'VENCIDA', 'NO_REQUERIDA'], colSpan: 6, section: 'TECHNICAL', triggerSubtypes: ['EQUIPO_BIOMEDICO'] },
      // REG-D006: Manual de uso obligatorio
      { key: 'observations', label: '¿Manual de Uso presente?', type: 'select', required: true, options: ['SI', 'NO', 'NO_APLICA'], colSpan: 12, section: 'TECHNICAL' },
      { key: 'quantity', label: 'Cantidad', type: 'number', required: true, colSpan: 12, section: 'LOGISTICS' },
    ]
  },

  'SUPLEMENTO': {
    subtypes: ['GENERAL'],
    fields: [
      { key: 'name', label: 'Nombre Suplemento', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'invimaReg', label: 'Registro Sanitario', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'lot', label: 'Lote', type: 'text', required: true, colSpan: 4, section: 'TECHNICAL' },
      { key: 'expirationDate', label: 'Vencimiento', type: 'date', required: true, colSpan: 4, section: 'TECHNICAL' },
      // REG-D008: Tabla Nutricional
      { key: 'observations', label: '¿Tabla Nutricional presente?', type: 'select', required: true, options: ['SI', 'NO'], colSpan: 4, section: 'TECHNICAL' },
      { key: 'quantity', label: 'Cantidad', type: 'number', required: true, colSpan: 12, section: 'LOGISTICS' },
    ]
  },

  'ALIMENTO': { 
    subtypes: ['PERECEDERO', 'NO_PERECEDERO'], 
    fields: [
      {key:'name', label:'Nombre Alimento', type:'text', required:true, colSpan:6, section:'HEADER', placeholder: "Descripción exacta (Ej: Queso Mozzarella...)"},
      {key:'invimaReg', label:'Notificación/RSA', type:'text', required:true, colSpan:6, section:'HEADER', placeholder: "Ej: RSA-001234-2023"},
      {key:'lot', label:'Lote', type:'text', required:true, colSpan:4, section:'TECHNICAL'}, 
      {key:'expirationDate', label:'Vence', type:'date', required:true, colSpan:4, section:'TECHNICAL'}, 
      {key:'quantity', label:'Cant', type:'number', required:true, colSpan:4, section:'LOGISTICS'}
    ] 
  },
  
  'COSMETICO': { 
    subtypes: ['GENERAL'], 
    fields: [
      {key:'name', label:'Nombre Producto', type:'text', required:true, colSpan:6, section:'HEADER'}, 
      {key:'invimaReg', label:'NSO (Notificación)', type:'text', required:true, colSpan:6, section:'HEADER', placeholder: "Ej: NSOC12345-23CO"},
      {key:'lot', label:'Lote', type:'text', required:true, colSpan:4, section:'TECHNICAL', placeholder: "Alfanumérico (Base/Empaque)"},
      {key:'quantity', label:'Cant', type:'number', required:true, colSpan:12, section:'LOGISTICS'}
    ] 
  },

  'OTRO': { 
    subtypes: ['GENERAL'], 
    fields: [
      {key:'name', label:'Descripción del Producto', type:'text', required:true, colSpan:12, section:'HEADER'}, 
      {key:'quantity', label:'Cantidad', type:'number', required:true, colSpan:12, section:'LOGISTICS'}
    ] 
  },
  
  // Fallback para Reactivos (Agregado para completitud)
  'REACTIVO_DIAGNOSTICO': {
    subtypes: ['REACTIVO_INVITRO'],
    fields: [
      { key: 'name', label: 'Nombre Reactivo', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'invimaReg', label: 'Registro Sanitario', type: 'text', required: true, colSpan: 6, section: 'HEADER' },
      { key: 'lot', label: 'Lote', type: 'text', required: true, colSpan: 4, section: 'TECHNICAL' },
      { key: 'expirationDate', label: 'Vencimiento', type: 'date', required: true, colSpan: 4, section: 'TECHNICAL' },
      { key: 'storageTemp', label: 'Temperatura (°C)', type: 'text', required: true, colSpan: 4, section: 'COLD_CHAIN' },
      { key: 'quantity', label: 'Cantidad', type: 'number', required: true, colSpan: 12, section: 'LOGISTICS' },
    ]
  }
};