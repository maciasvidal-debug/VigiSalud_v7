// src/types.ts

export type CategoryType = 'FORMAL' | 'INFORMAL' | 'AMBULANTE';
export type DocumentType = 'NIT' | 'CC' | 'PASAPORTE' | 'SINDOC';
export type EstablishmentStatus = 'ACTIVO' | 'SUSPENDIDO' | 'CLAUSURADO' | 'PENDIENTE';
export type ConceptType = 'FAVORABLE' | 'FAVORABLE_CON_REQUERIMIENTOS' | 'DESFAVORABLE' | 'PENDIENTE';

export type ProductType = 
  | 'MEDICAMENTO' 
  | 'DISPOSITIVO_MEDICO' 
  | 'REACTIVO_DIAGNOSTICO' 
  | 'COSMETICO' 
  | 'SUPLEMENTO' 
  | 'ALIMENTO' 
  | 'BEBIDA_ALCOHOLICA' 
  | 'ASEO_HIGIENE' 
  | 'MATERIA_PRIMA' 
  | 'OTRO';

export type ProductSubtype = 
  | 'SINTESIS_QUIMICA' | 'BIOLOGICO' | 'BIOTECNOLOGICO' | 'HOMEOPATICO' | 'FITOTERAPEUTICO' | 'RADIOFARMACO' | 'GAS_MEDICINAL' | 'CONTROL_ESPECIAL'
  | 'EQUIPO_BIOMEDICO' | 'INSUMO_MEDICO' | 'INSTRUMENTAL' | 'SOBRE_MEDIDA'
  | 'REACTIVO_INVITRO' 
  | 'PERECEDERO' | 'NO_PERECEDERO' | 'MATERIA_PRIMA_ALIMENTOS'
  | 'GENERAL';

export type RiskClassDM = 'CLASE_I' | 'CLASE_IIA' | 'CLASE_IIB' | 'CLASE_III' | 'NO_APLICA';
export type RiskFactor = 'NINGUNO' | 'VENCIDO' | 'FRAUDULENTO' | 'ALTERADO' | 'MAL_ALMACENAMIENTO' | 'SIN_REGISTRO' | 'USO_INSTITUCIONAL' | 'MUESTRA_MEDICA';
export type SeizureType = 'NINGUNO' | 'DECOMISO' | 'CONGELAMIENTO' | 'DESNATURALIZACION' | 'CIERRE_TEMPORAL';
export type PhysicalState = 'BUENO' | 'DETERIORADO' | 'ALTERADO';
export type ComplaintType = 'CALIDAD_PRODUCTO' | 'USO_RACIONAL' | 'LEGALIDAD_CONTRABANDO' | 'SERVICIO_TECNICO' | 'FARMACOVIGILANCIA' | 'OTRO';

export type InspectionBlock =
  | 'TALENTO_HUMANO'
  | 'LEGAL'
  | 'INFRAESTRUCTURA'
  | 'DOTACION'
  | 'PROCESOS'
  | 'SANEAMIENTO'
  | 'SANITARIO'
  | 'LOCATIVO'
  | 'PERSONAL'
  | 'DOCUMENTAL'
  | 'PRODUCTOS'
  | 'SEGURIDAD';

export interface RuleViolation {
  id: string;
  description: string;
  riskLevel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  action?: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: RuleViolation[];
}

// --- NUEVO: Estructuras para Motor Polimórfico (Manual Técnico Secc 6.1) ---
export type PresentationMode = 'DISCRETE' | 'VOLUMETRIC' | 'MASS_BASED';

export interface CommercialPresentation {
  mode: PresentationMode;
  packType: string;       // Ej: Caja, Plegadiza
  containerType: string;  // Ej: Frasco, Ampolla
  packFactor: number;     // Unidades por empaque
  contentNet: number;     // Contenido físico (mL, g)
  contentUnit: string;    // Unidad (mL, L, g, kg)
  detectedString: string; // Resumen legible
}

export interface SeizureLogistics {
  presentation: CommercialPresentation;
  inputs: {
    packs: number; // Cantidad de Cajas/Empaques
    loose: number; // Cantidad de Unidades Sueltas
  };
  totals: {
    legalUnits: number;     // Total unidades comerciales (Acta)
    logisticVolume: number; // Volumen/Masa total (Bodega)
    logisticUnit: string;   // Unidad normalizada
  };
  calculationMethod: 'AUTO_CUM' | 'MANUAL_OVERRIDE' | 'PRESET'; 
}

// --- DATA GOVERNANCE: Interfaz extendida para el CUM (Fuente de Verdad) ---
// Asegura que VigiSalud sepa qué leer de la base de datos local
export interface ExtendedCumRecord {
    id?: number; 
    expediente: string;
    producto: string;
    titular: string;
    registrosanitario: string;
    estadoregistro: string; // Vigente, Vencido
    descripcioncomercial: string;
    formafarmaceutica: string;
    principioactivo: string;
    concentracion: string;
    atc: string;
    viaadministracion: string;
    unidadmedida: string;
    fechavencimiento: string;
    cantidadcum: string; // Factor de empaque teórico
    consecutivocum: string;
    condicionAlmacenamiento?: string; // Dato derivado si existe
}

export interface ProductFinding {
  id: string;
  type: ProductType;
  subtype?: ProductSubtype; 
  customType?: string; 
  name: string;
  manufacturer?: string; 
  brand?: string; 
  
  // Identificación extendida (Manual Técnico)
  presentation?: string; 
  pharmaceuticalForm?: string; 
  activePrinciple?: string;    
  concentration?: string;      
  
  // --- CAMPOS DE GOBIERNO DE DATOS (V8.1) ---
  viaAdministration?: string;  // REG-L028
  atcCode?: string;            // Clasificación
  cumIndexRef?: string;        // ALCOA+: Trazabilidad al registro maestro original
  isLocked?: boolean;          // Data Integrity: Evita edición manual si viene de CUM
  regRuleRef?: string;         // Referencia a la regla infringida (Motor de Reglas)

  lot?: string; 
  serial?: string; 
  model?: string; 
  expirationDate?: string; 
  manufacturingDate?: string; 
  invimaReg: string; 
  cum?: string; 
  
  // Datos técnicos
  riskClassDM?: RiskClassDM; 
  calibrationStatus?: string; // REG-T012
  storageTemp?: string; 
  coldChainStatus?: string; 
  state?: PhysicalState;

  // Riesgo y Medida
  riskFactor: RiskFactor;
  seizureType: SeizureType;
  
  // Cantidades (Sincronizadas con Calculadora)
  quantity: number; 
  packLabel?: string;           
  logistics?: SeizureLogistics; 
  
  unit?: string; 
  weight?: number; 
  volume?: number; 
  actNumber?: string; 
  observations?: string;
  photoUrl?: string;
  hasEvidence?: boolean;
}

export interface Establishment {
  id?: number; 
  category: CategoryType;
  idType: DocumentType;
  nit: string; 
  name: string; 
  commercialName?: string; 
  type: string; 
  typeOther?: string; 
  city: string;
  daneCode?: string;
  address: string;
  sector?: string; 
  lat?: number;
  lng?: number;
  phone: string;
  emailJudicial?: string;
  responsibleName: string;
  responsibleId: string;
  techDirectorName?: string;
  techDirectorId?: string;
  techDirectorTp?: string; 
  mobileUnitType?: string;
  mobileUnitOther?: string;
  status: EstablishmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspectionItem {
  id: string;
  text: string; 
  block: InspectionBlock;
  isKiller: boolean; 
  triggerCondition?: 'FAIL' | 'PASS'; 
  childItems?: InspectionItem[]; 
  referencePhotoUrl?: string; 
  legalCitation?: string; 
}

export interface FindingEvidence {
  id: string;
  photoUrl: string; 
  timestamp: string; 
  gps: { lat: number; lng: number };
  hash: string; 
  notes?: string;
}

export interface CustodyChain {
  id: string;
  visitId: number; 
  items: ProductFinding[]; 
  status: 'EN_CUSTODIA' | 'EN_BODEGA' | 'DESTRUIDO' | 'DEVUELTO';
  seizedBy: string; 
  seizedAt: string; 
  qrCode?: string; 
  securityBags?: string; 
  securitySeals?: string; 
  depositLocation?: string; 
  transportCompany?: string;
  transportPlate?: string;
  driverName?: string;
  storageLocation?: string; 
  receivedBy?: string; 
  disposalEvidence?: string; 
}

export interface Report {
  id?: number;
  date: string; 
  establishment_id: string; 
  est: string; 
  category: CategoryType;
  nit?: string; 
  address?: string; 
  concept: ConceptType;
  riskScore: number; 
  riskLevel?: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'; 
  func: string; 
  data: {
    actId: string;
    motive: string;
    status: string;
    radicado?: string; 
    complaintType?: ComplaintType; 
    complaintDesc?: string; 
    attendedBy: string;
    attendedId?: string;
    attendedRole?: string;
    gpsBypass?: boolean;
    [key: string]: any;
  };
  products?: ProductFinding[]; 
  findings?: Record<string, { 
    status: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA';
    evidence?: FindingEvidence[]; 
    observation?: string;
  }>;
  seizure?: CustodyChain; 
  signature: string | null; 
  verificationHash?: string; 
  citizenFeedback?: {
    text: string; 
    signature: string;
    agreed: boolean; 
  };
  syncStatus?: 'PENDING' | 'SYNCED';
  geolocation?: { lat: number; lng: number };
}

export interface User {
  id?: number;
  name: string;
  identification: string;
  rh: string; 
  username: string; 
  pin: string; 
  photo?: string | null; 
  signature?: string | null; 
  role: 'DIRECTOR' | 'INSPECTOR' | 'ADMIN' | 'COORDINADOR'; 
  cargo?: string;
  contractType?: string;
  contractNumber?: string; 
  contractDateStart?: string; 
  contractDateEnd?: string; 
  status: 'ACTIVO' | 'INACTIVO';
  profession?: string; 
  tp?: string; 
  email?: string; 
  personalEmail?: string; 
  phone?: string;
}

export type Official = User;