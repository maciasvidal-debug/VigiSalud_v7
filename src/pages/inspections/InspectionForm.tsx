import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../db'; 
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { WizardStepper, type StepItem } from '../../components/ui/WizardStepper'; 
import { SignaturePad } from '../../components/ui/SignaturePad';
import { generateInspectionHash } from '../../utils/crypto';
import { inspectionEngine } from '../../utils/inspectionEngine';
import { TacticalMatrix } from '../../components/inspection/TacticalMatrix';
import { SeizureCalculator } from '../../components/seizure/SeizureCalculator'; 
import { PRODUCT_SCHEMAS, type FieldConfig } from '../../utils/productSchemas'; 
import { generateInspectionPDF } from '../../utils/PdfGenerator'; 
import { parsePresentation } from '../../utils/PharmaParser';
import type { 
    Report, 
    ProductFinding, 
    ProductType, 
    InspectionItem, 
    FindingEvidence, 
    RiskFactor, 
    SeizureType, 
    ComplaintType, 
    CustodyChain, 
    ProductSubtype, 
    SeizureLogistics, 
    ExtendedCumRecord,
    ConceptType
} from '../../types';

// =============================================================================
// 1. EXTENSIONES DE TIPO Y UTILIDADES LOCALES
// =============================================================================

// Props del Componente Principal
interface InspectionFormProps {
  contextData?: {
    actId: string;
    motive: string;
    status: string;
    attendedBy: string;
    attendedId?: string;
    attendedRole?: string;
    radicado?: string;
    complaintType?: ComplaintType;
    complaintDesc?: string;
    gpsBypass?: boolean;
  };
}

// Extensión del Hallazgo para manejo en UI
interface LocalProductFinding extends ProductFinding {
    // Control de UI
    isExpanded?: boolean;
    hasEvidence?: boolean;
    containerId?: string; 
    
    // Auditoría de Datos (ALCOA+)
    originalCumData?: Partial<ProductFinding>; // Snapshot de la BD al momento de la selección
    originalInput?: { packs: number; loose: number }; // Inputs crudos del usuario
    
    // Metadatos de Validación
    validationStatus?: 'VALID' | 'WARNING' | 'ERROR';
    validationMessage?: string;
}

// Estructura de Contenedor de Custodia
interface EvidenceContainer {
    id: string;
    type: 'BOLSA_SEGURIDAD' | 'CAJA_SELLADA' | 'NEVERA_PORTATIL' | 'SOBRE_MANILA';
    code: string; 
    items: string[]; // IDs de productos
    weight?: number;
    sealedAt?: string;
}

// Soporte para Web Speech API
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

// Helpers de Formateo
const formatEnum = (text: string | undefined) => text ? text.replace(/_/g, ' ') : '';

// Helper de Grilla Estricta (12 Columnas)
const getColSpanClass = (field: FieldConfig) => {
    const colSpans: Record<number, string> = {
        1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3',
        4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6',
        7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9',
        10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
    };
    return field.colSpan ? `col-span-12 ${colSpans[field.colSpan]}` : 'col-span-12';
};

// =============================================================================
// 2. COMPONENTE PRINCIPAL (MONOLITO LÓGICO)
// =============================================================================

export const InspectionForm: React.FC<InspectionFormProps> = ({ contextData }) => {
  // --- HOOKS DE RUTEO Y CONTEXTO ---
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // --- REFERENCIAS ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADOS DE LA MÁQUINA DE INSPECCIÓN ---
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'DIAGNOSTICO' | 'PRODUCTOS' | 'CUSTODIA' | 'CIERRE'>('DIAGNOSTICO');

  // --- ESTADOS DE DIAGNÓSTICO (MATRIZ) ---
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number>(100);
  const [concept, setConcept] = useState<ConceptType>('PENDIENTE');

  // --- ESTADOS DE INVENTARIO Y PRODUCTOS ---
  const [products, setProducts] = useState<LocalProductFinding[]>([]);
  const [containers, setContainers] = useState<EvidenceContainer[]>([]); 
  const [newContainer, setNewContainer] = useState<{type: string, code: string}>({ type: 'BOLSA_SEGURIDAD', code: '' }); 
  
  // --- ESTADOS DE FORMULARIO DE PRODUCTO ---
  const [formError, setFormError] = useState<string | null>(null); 
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [evidenceTemp, setEvidenceTemp] = useState(false); 
  const [packsInput, setPacksInput] = useState<number>(0);
  const [looseInput, setLooseInput] = useState<number>(0);
  const [interpretedQty, setInterpretedQty] = useState<string>('');

  // --- ESTADOS DE BÚSQUEDA CUM (MOTOR HÍBRIDO) ---
  const [isSearchingCum, setIsSearchingCum] = useState(false);
  const [cumSearchStatus, setCumSearchStatus] = useState<'IDLE' | 'FOUND' | 'NOT_FOUND'>('IDLE');
  const [cumValidationState, setCumValidationState] = useState<'VALID' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | null>(null);
  const [cumQuery, setCumQuery] = useState('');
  const [cumResults, setCumResults] = useState<ExtendedCumRecord[]>([]);
  
  // --- ESTADOS DE CUSTODIA Y LOGÍSTICA ---
  const [custodyData, setCustodyData] = useState<Partial<CustodyChain> & { transportType?: string }>({
    depositLocation: '', 
    transportType: 'INSTITUCIONAL', 
    transportCompany: '', 
    transportPlate: '', 
    driverName: ''
  });

  // --- ESTADOS DE CIERRE Y LEGAL ---
  const [signature, setSignature] = useState<string | null>(null);
  const [citizenObservation, setCitizenObservation] = useState('');
  const [inspectionNarrative, setInspectionNarrative] = useState(''); 
  const [legalBasis, setLegalBasis] = useState(''); 
  const [isListening, setIsListening] = useState<string | null>(null); 
  const [refusalToSign, setRefusalToSign] = useState(false);
  const [witness, setWitness] = useState({ name: '', id: '', signature: null as string | null });
  
  // --- ESTADOS DE MODALES ---
  const [showCumModal, setShowCumModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pendingEvidenceId, setPendingEvidenceId] = useState<string | null>(null);
  
  // --- ESTADOS DE PDF ---
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | undefined>(undefined);
  const [pendingReportData, setPendingReportData] = useState<Partial<Report> | null>(null);

  // --- ESTADO OBJETO PRODUCTO (WORK IN PROGRESS) ---
  const [newProduct, setNewProduct] = useState<Partial<ProductFinding> & { 
      coldChainStatus?: string; 
      pharmaceuticalForm?: string;
      activePrinciple?: string;    
      concentration?: string;      
      packLabel?: string; 
      viaAdministration?: string;
      atcCode?: string;
      logistics?: SeizureLogistics;
      originalCumData?: Partial<ProductFinding>;
      calibrationStatus?: string; // Support for Medical Devices
  }>({
    type: 'MEDICAMENTO', 
    subtype: 'SINTESIS_QUIMICA', 
    name: '', manufacturer: '', riskFactor: 'NINGUNO', seizureType: 'NINGUNO', quantity: 0, 
    cum: '', invimaReg: '', lot: '', serial: '', storageTemp: '', coldChainStatus: '', presentation: '',
    pharmaceuticalForm: '', activePrinciple: '', concentration: '', viaAdministration: '', atcCode: '',
    packLabel: '', logistics: undefined, calibrationStatus: ''
  });

  // --- QUERIES DE BASE DE DATOS (DEXIE) ---
  const establishment = useLiveQuery(() => (establishmentId ? db.establishments.get(Number(establishmentId)) : undefined), [establishmentId]);
  
  // --- VARIABLES DERIVADAS ---
  const hasSeizures = useMemo(() => products.some(p => p.seizureType !== 'NINGUNO'), [products]);
  
  const INSPECTION_STEPS: StepItem[] = [
      { id: 'DIAGNOSTICO', label: '1. Condiciones', icon: 'clipboard', description: 'Matriz IVC' }, 
      { id: 'PRODUCTOS', label: '2. Evidencia', icon: 'search', description: 'Inventario' }, 
      { id: 'CUSTODIA', label: '3. Custodia', icon: 'shield', description: 'Aseguramiento', disabled: !hasSeizures }, 
      { id: 'CIERRE', label: '4. Cierre', icon: 'pen-tool', description: 'Acta Final' }
  ];

  // ===========================================================================
  // 3. LOGICA DE NEGOCIO Y EFECTOS
  // ===========================================================================

  // --- INICIALIZACIÓN ---
  useEffect(() => { 
      if (establishment) {
          const items = inspectionEngine.generate(establishment);
          setInspectionItems(items); 
      }
  }, [establishment]);

  // --- CÁLCULO DE RIESGO EN TIEMPO REAL ---
  useEffect(() => { 
      if (inspectionItems.length === 0) return; 
      
      const simpleResponses: Record<string, string> = {}; 
      Object.keys(checklistResponses).forEach(key => simpleResponses[key] = checklistResponses[key].status); 
      
      const engineScore = inspectionEngine.calculateRisk(inspectionItems, simpleResponses); 
      const hasCriticalProductFindings = products.some(p => p.riskFactor !== 'NINGUNO');
      
      const finalScore = hasCriticalProductFindings ? Math.min(engineScore, 59) : engineScore;
      
      setScore(finalScore); 
      setConcept(inspectionEngine.getConcept(finalScore, hasCriticalProductFindings)); 
  }, [checklistResponses, products, inspectionItems]);

  // --- PARSER DE CANTIDADES (FEEDBACK VISUAL) ---
  useEffect(() => {
      if (newProduct.presentation && newProduct.pharmaceuticalForm && (packsInput > 0 || looseInput > 0) && !isReportingIssue) {
          const model = parsePresentation(newProduct.pharmaceuticalForm, newProduct.presentation);
          const totalUnits = (packsInput * model.packFactor) + looseInput;
          
          if (packsInput > 0) {
              setInterpretedQty(`Total Legal: ${totalUnits} ${model.containerType}s (${packsInput} ${model.packType}s x ${model.packFactor} + ${looseInput})`);
          } else {
              setInterpretedQty(`Total: ${totalUnits} ${model.containerType}s Sueltos`);
          }
      } else {
          setInterpretedQty('');
      }
  }, [newProduct.presentation, newProduct.pharmaceuticalForm, packsInput, looseInput, isReportingIssue]);

  // --- HANDLER: DICTADO POR VOZ ---
  const toggleListening = (fieldId: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (isListening === fieldId) { setIsListening(null); return; }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { 
        showToast("Navegador no compatible con dictado.", 'error'); 
        return; 
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(fieldId);
    showToast("🎤 Escuchando... hable claro.", 'info');

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setter(prev => prev ? `${prev} ${transcript}` : transcript); 
        setIsListening(null);
    };

    recognition.onerror = (event: any) => {
        console.warn("Error voz:", event.error);
        setIsListening(null);
    };

    recognition.onend = () => setIsListening(null);
    recognition.start();
  };

  // --- LOGÍSTICA: GESTIÓN DE CUSTODIA ---
  const addContainer = () => { 
      if (!newContainer.code) { showToast("⚠️ Código de precinto requerido.", 'warning'); return; } 
      const newId = crypto.randomUUID(); 
      setContainers(prev => [...prev, { 
          id: newId, 
          type: newContainer.type as any, 
          code: newContainer.code, 
          items: [] 
      }]); 
      setNewContainer({ ...newContainer, code: '' }); 
      showToast("Contenedor creado.", 'success');
  };
  
  const removeContainer = (containerId: string) => { 
      // Liberar items
      setProducts(prev => prev.map(p => p.containerId === containerId ? { ...p, containerId: undefined } : p)); 
      setContainers(prev => prev.filter(c => c.id !== containerId)); 
      showToast("Contenedor eliminado.", 'info');
  };
  
  const assignItemToContainer = (productId: string, containerId: string) => { 
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, containerId } : p)); 
  };
  
  const unassignItem = (productId: string) => { 
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, containerId: undefined } : p)); 
  };

  // --- EVIDENCIA FOTOGRÁFICA ---
  const handlePhotoClick = () => { fileInputRef.current?.click(); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (e.target.files && e.target.files[0]) { 
          const fakeUrl = URL.createObjectURL(e.target.files[0]); 
          
          if (pendingEvidenceId) { 
              // Flujo de Corrección (Lista)
              setProducts(prev => prev.map(p => p.id === pendingEvidenceId ? { ...p, hasEvidence: true, photoUrl: fakeUrl } : p)); 
              setPendingEvidenceId(null); 
              showToast("Evidencia vinculada.", 'success'); 
          } else { 
              // Flujo de Creación
              setEvidenceTemp(true); 
              setShowEvidenceModal(false); 
          } 
          e.target.value = ''; 
      } 
  };
  
  const triggerEvidenceCheck = (id: string) => { 
      setPendingEvidenceId(id); 
      fileInputRef.current?.click(); 
  };

  // --- MOTOR DE BÚSQUEDA CUM (CORE) ---
  const searchCum = async (query: string) => {
      setIsSearchingCum(true);
      const cleanQuery = query.trim().toUpperCase();
      let results: ExtendedCumRecord[] = [];

      try {
          if (!cleanQuery) {
              setCumResults([]);
              setIsSearchingCum(false);
              return;
          }

          // Estrategia de Búsqueda
          if (/^\d+/.test(cleanQuery)) {
              // Numérica: Expediente
              results = await db.cums
                  .where('expediente')
                  .startsWith(cleanQuery)
                  .limit(20)
                  .toArray() as unknown as ExtendedCumRecord[];
          } else {
              // Texto: Producto o Principio
              const byProduct = await db.cums
                  .where('producto')
                  .startsWithIgnoreCase(cleanQuery)
                  .limit(15)
                  .toArray();
                  
              const byActive = await db.cums
                  .where('principioactivo')
                  .startsWithIgnoreCase(cleanQuery)
                  .limit(10)
                  .toArray();

              // Merge Único
              const combined = [...byProduct, ...byActive];
              const unique = new Map();
              combined.forEach(item => unique.set(item.expediente, item));
              results = Array.from(unique.values()) as unknown as ExtendedCumRecord[];
          }
      } catch (e) {
          console.error("Error CUM:", e);
      } finally {
          setCumResults(results);
          setIsSearchingCum(false);
          setCumSearchStatus(results.length > 0 ? 'FOUND' : 'NOT_FOUND');
      }
  };

  // Debounce para input en modal
  useEffect(() => {
      if (!showCumModal) return; 
      const timer = setTimeout(() => {
          if (cumQuery.length > 2) searchCum(cumQuery);
      }, 400); 
      return () => clearTimeout(timer);
  }, [cumQuery, showCumModal]);

  const selectFromModal = (record: ExtendedCumRecord) => {
      let validation: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' = 'VALID';
      const status = record.estadoregistro ? record.estadoregistro.toUpperCase() : '';
      
      if (status.includes('VENCID') || status.includes('CANCELAD') || status.includes('REVOCAD')) {
          validation = 'EXPIRED';
      } else if (record.fechavencimiento) {
          const expiration = new Date(record.fechavencimiento);
          if (expiration < new Date()) validation = 'EXPIRED';
      }
      
      setCumValidationState(validation);
      if (validation !== 'VALID') {
          setIsReportingIssue(true);
          showToast("⚠️ ALERTA: Registro Sanitario NO VIGENTE en BD.", "warning");
      }

      // Mapeo Automático
      const mappedProduct: Partial<ProductFinding> = {
          cum: record.expediente + (record.consecutivocum ? `-${record.consecutivocum}` : ''), 
          name: record.producto,
          manufacturer: record.titular,
          invimaReg: record.registrosanitario,
          presentation: record.descripcioncomercial, 
          pharmaceuticalForm: record.formafarmaceutica,
          activePrinciple: record.principioactivo,
          concentration: record.concentracion,
          viaAdministration: record.viaadministracion,
          atcCode: record.atc,
          riskFactor: validation !== 'VALID' ? (validation === 'EXPIRED' ? 'VENCIDO' : 'SIN_REGISTRO') : 'NINGUNO'
      };

      setNewProduct(prev => ({ ...prev, ...mappedProduct, originalCumData: mappedProduct }));
      setShowCumModal(false);
      setCumQuery('');
  };

  // --- CALCULADORA DE VOLUMEN (CALLBACK) ---
  const handleCalculatorUpdate = useCallback((total: number, label: string, logistics: SeizureLogistics) => {
      setNewProduct(prev => {
          if (prev.quantity === total && prev.packLabel === label) return prev; 
          return { ...prev, quantity: total, packLabel: label, logistics };
      });
  }, []);

  // --- AGREGAR PRODUCTO (COMMIT) ---
  const commitProduct = (overrideEvidence: boolean) => {
      const finalRisk = newProduct.riskFactor || 'NINGUNO';
      let finalQuantity = 0;
      let smartLabel = '';
      let currentLogistics = newProduct.logistics;

      // Cálculo de Inventario
      if (!isReportingIssue && newProduct.presentation && newProduct.pharmaceuticalForm) {
          const model = parsePresentation(newProduct.pharmaceuticalForm, newProduct.presentation);
          finalQuantity = (packsInput * model.packFactor) + looseInput;
          
          if (packsInput > 0 && looseInput > 0) {
              smartLabel = `${packsInput} ${model.packType}s + ${looseInput} ${model.containerType}s`;
          } else if (packsInput > 0) {
              smartLabel = `${packsInput} ${model.packType}s`;
          } else {
              smartLabel = `${looseInput} ${model.containerType}s`;
          }

          if (!currentLogistics) {
              currentLogistics = {
                  presentation: model,
                  inputs: { packs: packsInput, loose: looseInput },
                  totals: { 
                      legalUnits: finalQuantity, 
                      logisticVolume: (finalQuantity * model.contentNet), 
                      logisticUnit: model.contentUnit || 'Unid'
                  },
                  calculationMethod: 'AUTO_CUM'
              };
          }
      } else {
          finalQuantity = newProduct.quantity || 0;
          smartLabel = newProduct.packLabel || `${finalQuantity} Unidades`;
      }

      if (finalQuantity <= 0) {
          setFormError("La cantidad debe ser mayor a cero.");
          return;
      }

      const finding: LocalProductFinding = {
        ...(newProduct as LocalProductFinding), 
        id: crypto.randomUUID(), 
        riskFactor: finalRisk,
        seizureType: newProduct.seizureType || 'NINGUNO',
        quantity: finalQuantity,
        packLabel: smartLabel,
        logistics: currentLogistics,
        hasEvidence: overrideEvidence,
        pharmaceuticalForm: newProduct.pharmaceuticalForm,
        originalInput: { packs: packsInput, loose: looseInput }
      };

      setProducts(prev => [finding, ...prev]);
      
      // Reset Form
      setNewProduct({ 
        type: newProduct.type, subtype: newProduct.subtype,
        name: '', manufacturer: '', riskFactor: 'NINGUNO', seizureType: 'NINGUNO', quantity: 0,
        cum: '', invimaReg: '', lot: '', serial: '', storageTemp: '', coldChainStatus: '', presentation: '', 
        pharmaceuticalForm: '', activePrinciple: '', concentration: '', viaAdministration: '', atcCode: '',
        packLabel: '', logistics: undefined, originalCumData: undefined, calibrationStatus: ''
      });
      setPacksInput(0);
      setLooseInput(0);
      setCumSearchStatus('IDLE'); 
      setCumValidationState(null); 
      setIsReportingIssue(false); 
      setEvidenceTemp(false); 
      setShowEvidenceModal(false);
  };

  const handleAddProduct = (isConform: boolean) => {
    setFormError(null); 
    
    // 1. VALIDACIÓN BÁSICA
    if (!newProduct.name) { setFormError("El nombre del producto es obligatorio."); return; }
    
    // 2. VALIDACIÓN MOTOR DE REGLAS (NUEVO)
    const validation = inspectionEngine.validateProduct({ ...newProduct, riskFactor: isConform ? 'NINGUNO' : (newProduct.riskFactor || 'NINGUNO') } as ProductFinding);
    
    if (!validation.isValid) {
        const violationsText = validation.violations.map(v => `${v.id}: ${v.description}`).join(' | ');
        
        // Bloqueo duro si hay regla CRITICA y se intenta pasar como CONFORME
        const isCritical = validation.violations.some(v => v.riskLevel === 'CRITICO');
        if (isConform && isCritical) {
             setFormError(`⛔ BLOQUEO REGULATORIO: ${violationsText}`);
             return;
        }
        
        // Alerta si es no conforme pero se permite guardar
        if (!isConform) {
            showToast(`⚠️ Alerta Regulatoria: ${violationsText}`, 'warning');
        }
    }

    // 3. SEMÁFORO CUM (Backup)
    if (isConform && (cumValidationState === 'EXPIRED' || cumValidationState === 'SUSPENDED' || cumValidationState === 'REVOKED')) {
        setFormError("⛔ BLOQUEO: Registro Vencido/Cancelado. Debe reportarlo como Hallazgo.");
        return;
    }

    const finalRisk = isConform ? 'NINGUNO' : (newProduct.riskFactor || 'NINGUNO');
    if (isConform && finalRisk !== 'NINGUNO') { setFormError("Inconsistencia: No puede ser Conforme si seleccionó un Riesgo."); return; }
    
    // 4. EVIDENCIA OBLIGATORIA
    if (!isConform && finalRisk !== 'NINGUNO' && !evidenceTemp) { 
        setShowEvidenceModal(true); 
        return; 
    }
    
    // 5. REGISTRAR REGLA VIOLADA
    if (!validation.isValid && validation.violations.length > 0) {
        newProduct.regRuleRef = validation.violations[0].id;
    }

    commitProduct(evidenceTemp || finalRisk === 'NINGUNO');
  };

  const removeProduct = (id: string) => {
      setProducts(prev => prev.filter(p => p.id !== id));
  };

  // --- CIERRE Y PDF (LÓGICA FINAL) ---
  const handleReviewDraft = async () => {
    if (!establishment || !establishmentId) return;
    if (!inspectionNarrative) { showToast("⚠️ Debe completar la narrativa de los hechos.", 'error'); return; }
    
    // Validación de Bloqueo por Falta de Evidencia
    const pendingEvidence = products.some(p => p.riskFactor !== 'NINGUNO' && !p.hasEvidence);
    if (pendingEvidence) { 
        setShowBlockModal(true); 
        return; 
    }

    setLoading(true);
    try {
      let seizureRecord: CustodyChain | undefined = undefined;
      if (products.some(p => p.seizureType !== 'NINGUNO')) {
        seizureRecord = { 
            id: crypto.randomUUID(), 
            visitId: 0, 
            items: products.filter(p => p.seizureType !== 'NINGUNO'), 
            status: 'EN_CUSTODIA', 
            seizedBy: contextData?.actId || 'INSPECTOR', 
            seizedAt: new Date().toISOString(), 
            depositLocation: custodyData.depositLocation || '', 
            transportCompany: custodyData.transportCompany, 
            transportPlate: custodyData.transportPlate, 
            driverName: custodyData.driverName 
        };
      }
      
      const reportDraft: Partial<Report> = {
        date: new Date().toISOString(), 
        establishment_id: establishmentId, 
        est: establishment.name, 
        category: establishment.category, 
        nit: establishment.nit, 
        address: establishment.address, 
        concept: concept, 
        riskScore: score, 
        riskLevel: score < 60 ? 'CRITICO' : 'BAJO', 
        func: "INSPECTOR VIGISALUD",
        data: { 
            actId: contextData?.actId || '', 
            motive: contextData?.motive || '', 
            status: 'ATENDIDA', 
            attendedBy: contextData?.attendedBy || '', 
            attendedId: contextData?.attendedId, 
            attendedRole: contextData?.attendedRole, 
            gpsBypass: false, 
            witness: refusalToSign ? witness : undefined, 
            refusalToSign: refusalToSign, 
            inspectionNarrative, 
            legalBasis, 
            city: establishment.city 
        },
        findings: checklistResponses, 
        products: products, 
        seizure: seizureRecord, 
        signature: refusalToSign ? null : signature, 
        citizenFeedback: { text: citizenObservation, signature: '', agreed: !refusalToSign }
      };
      
      setPendingReportData(reportDraft); 
      const blob = await generateInspectionPDF(reportDraft as Report, true); 
      setPdfBlobUrl(URL.createObjectURL(blob));
      setShowDraftModal(true);
    } catch (e) { 
        console.error(e); 
        showToast("Error generando el PDF del acta.", 'error'); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleFinalizeInspection = async () => {
      if (!pendingReportData) return;
      setLoading(true);
      try {
          const hash = await generateInspectionHash(pendingReportData);
          pendingReportData.verificationHash = hash;
          await db.inspections.add(pendingReportData as Report);
          showToast(`✅ Acta N° ${pendingReportData.data?.actId} cerrada correctamente.`, 'success');
          navigate('/dashboard/inspections');
      } catch (e) { 
          console.error(e); 
          showToast("Error guardando en base de datos local.", 'error'); 
      } finally { 
          setLoading(false); 
          setShowDraftModal(false); 
      }
  };

  // --- HANDLERS MATRIZ ---
  const handleMatrixResponse = (itemId: string, value: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA') => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], status: value } }));
  };
  const handleEvidence = (itemId: string, evidence: FindingEvidence) => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], evidence: [...(prev[itemId]?.evidence || []), evidence] } })); 
  };
  const handleObservation = (itemId: string, observation: string) => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], observation } })); 
  };

  // ===========================================================================
  // 4. RENDERIZADO DINÁMICO DE CAMPOS (UI PROFESIONAL)
  // ===========================================================================

  const renderField = (field: FieldConfig) => {
      if (field.key === 'quantity' && isReportingIssue && newProduct.seizureType !== 'NINGUNO') return null;
      if (field.triggerSubtypes && !field.triggerSubtypes.includes(newProduct.subtype as ProductSubtype)) return null;

      const colClass = getColSpanClass(field);
      const isColdChainError = field.section === 'COLD_CHAIN' && newProduct.coldChainStatus?.includes('INCUMPLE');
      
      const originalValue = newProduct.originalCumData ? newProduct.originalCumData[field.key as keyof ProductFinding] : undefined;
      const currentValue = newProduct[field.key as keyof ProductFinding];
      const isDiscrepant = originalValue && currentValue && originalValue !== currentValue;

      // CAMPO CUM (Input Libre + Botón)
      if (field.key === 'cum') {
          return (
              <div className={colClass} key={field.key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{field.label}</label>
                    {newProduct.originalCumData && <Badge label="✓ BD OFICIAL" className="bg-emerald-100 text-emerald-700 border-emerald-200"/>}
                  </div>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <Input 
                              value={newProduct.cum || ''} 
                              onChange={e => setNewProduct({...newProduct, cum: e.target.value})} 
                              placeholder={field.placeholder || "Digite..."}
                              className="font-mono text-sm"
                          />
                      </div>
                      <button 
                          type="button"
                          onClick={() => { setCumQuery(newProduct.cum || ''); setShowCumModal(true); }}
                          className="px-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 shadow-md transition-all flex items-center justify-center gap-2 font-bold text-xs"
                          title="Abrir Buscador Maestro (F2)"
                      >
                          <Icon name="database" size={16}/> BÚSQUEDA
                      </button>
                  </div>
              </div>
          );
      }

      // CAMPO CANTIDAD (Tarjeta Visual)
      if (field.key === 'quantity') {
          return (
              <div className={colClass} key={field.key}>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-full flex flex-col justify-center shadow-inner">
                      <label className="text-xs font-black text-slate-600 mb-3 block border-b border-slate-200 pb-2">CONTEO FÍSICO</label>
                      <div className="flex items-end gap-3">
                          <div className="flex-1">
                              <label className="text-[9px] font-bold text-slate-400 mb-1 block uppercase">Cajas/Empaques</label>
                              <Input 
                                  type="number" 
                                  value={packsInput || ''} 
                                  onChange={e => setPacksInput(Math.max(0, parseInt(e.target.value) || 0))} 
                                  placeholder="0" 
                                  className="text-center font-black text-lg h-12 border-slate-300"
                              />
                          </div>
                          <div className="pb-3 text-slate-300"><Icon name="plus" size={24}/></div>
                          <div className="flex-1">
                              <label className="text-[9px] font-bold text-slate-400 mb-1 block uppercase">Unidades Sueltas</label>
                              <Input 
                                  type="number" 
                                  value={looseInput || ''} 
                                  onChange={e => setLooseInput(Math.max(0, parseInt(e.target.value) || 0))} 
                                  placeholder="0" 
                                  className="text-center font-black text-lg h-12 border-slate-300"
                              />
                          </div>
                      </div>
                      {interpretedQty && !isReportingIssue && (
                          <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center animate-in fade-in">
                              <p className="text-emerald-700 text-xs font-bold flex items-center justify-center gap-2">
                                  <Icon name="check-circle" size={14}/> {interpretedQty}
                              </p>
                          </div>
                      )}
                  </div>
              </div>
          );
      }

      // CAMPOS ESTÁNDAR
      return (
          <div className={colClass} key={field.key}>
              <div className="flex justify-between items-end mb-1">
                  <label className={`text-xs font-bold text-slate-500 uppercase tracking-wider ${isColdChainError ? 'text-red-500' : ''}`}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {isDiscrepant && <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-100">MODIFICADO</span>}
              </div>
              
              {field.type === 'select' ? (
                  <div className="relative">
                      <select 
                          className={`w-full h-12 px-4 bg-white border rounded-xl text-slate-700 font-medium text-sm outline-none transition-all appearance-none cursor-pointer shadow-sm hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 ${isDiscrepant ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}
                          value={newProduct[field.key as keyof ProductFinding] as string || ''} 
                          onChange={e => setNewProduct({...newProduct, [field.key]: e.target.value})}
                          disabled={field.disabled}
                      >
                          <option value="">Seleccione...</option>
                          {field.options?.map(opt => <option key={opt} value={opt}>{formatEnum(opt)}</option>)}
                      </select>
                      <div className="absolute right-4 top-4 text-slate-400 pointer-events-none"><Icon name="chevron-down" size={16}/></div>
                  </div>
              ) : (
                  <Input 
                      type={field.type} 
                      value={newProduct[field.key as keyof ProductFinding] as string || ''} 
                      onChange={e => setNewProduct({...newProduct, [field.key]: e.target.value})} 
                      placeholder={field.placeholder} 
                      disabled={field.disabled}
                      className={`h-12 shadow-sm ${isDiscrepant ? 'border-amber-300 bg-amber-50/20' : ''}`}
                  />
              )}
          </div>
      );
  };

  if (!establishment) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Icon name="loader" className="animate-spin text-blue-600 mx-auto mb-4" size={40}/><h2 className="text-slate-600 font-bold">Cargando Expediente...</h2></div></div>;
  const currentSchema = PRODUCT_SCHEMAS[newProduct.type as string] || PRODUCT_SCHEMAS['OTRO'];
  const needsColdChain = newProduct.type === 'MEDICAMENTO' && ['BIOLOGICO', 'BIOTECNOLOGICO', 'REACTIVO_INVITRO'].includes(newProduct.subtype as string);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-in fade-in relative">
        {/* HEADER EMPRESARIAL */}
        <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-30 backdrop-blur-md bg-white/95">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Badge label={establishment.category} variant="neutral"/>
                    <Badge label={establishment.type} variant="neutral"/>
                    {hasSeizures && <Badge label="MEDIDA SANITARIA" className="bg-red-600 text-white animate-pulse"/>}
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{establishment.name}</h1>
                <p className="text-xs font-bold text-slate-500 flex items-center gap-2 mt-1"><Icon name="map-pin" size={12}/> {establishment.address} • NIT: {establishment.nit}</p>
            </div>
            <div className={`flex flex-col items-end`}>
                <div className={`text-3xl font-black px-5 py-2 rounded-xl border-2 shadow-sm ${score < 60 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>{score}%</div>
                <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{concept}</span>
            </div>
        </header>

        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 sticky top-28 z-20">
            <WizardStepper steps={INSPECTION_STEPS} currentStep={currentTab} onStepClick={setCurrentTab} />
        </div>

        <div className="grid grid-cols-1 gap-8">
            {/* PESTAÑA 1: DIAGNÓSTICO */}
            {currentTab === 'DIAGNOSTICO' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    <TacticalMatrix items={inspectionItems} responses={checklistResponses} onResponse={handleMatrixResponse} onEvidence={handleEvidence} onObservation={handleObservation} />
                    <div className="flex justify-end mt-8"><Button onClick={() => setCurrentTab('PRODUCTOS')} className="bg-slate-900 text-white shadow-lg h-12 px-8">Continuar a Inventario <Icon name="arrow-right" size={18}/></Button></div>
                </div>
            )}

            {/* PESTAÑA 2: PRODUCTOS (REDISEÑADA) */}
            {currentTab === 'PRODUCTOS' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    {/* ENCABEZADO DE SECCIÓN */}
                    <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">CATEGORÍA</label>
                            <div className="relative">
                                <select className="w-full h-14 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value as ProductType, subtype: PRODUCT_SCHEMAS[e.target.value]?.subtypes[0] || 'GENERAL', cum: '', name: ''})}>{Object.keys(PRODUCT_SCHEMAS).map(t => <option key={t} value={t}>{formatEnum(t)}</option>)}</select>
                                <div className="absolute left-4 top-4 text-slate-400"><Icon name="package" size={24}/></div>
                                <div className="absolute right-4 top-5 text-slate-400 pointer-events-none"><Icon name="chevron-down" size={16}/></div>
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">SUBTIPO</label>
                            <div className="relative">
                                <select className="w-full h-14 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer" value={newProduct.subtype} onChange={e => setNewProduct({...newProduct, subtype: e.target.value as ProductSubtype})}>{PRODUCT_SCHEMAS[newProduct.type as ProductType]?.subtypes.map(s => <option key={s} value={s}>{formatEnum(s)}</option>)}</select>
                                <div className="absolute left-4 top-4 text-slate-400"><Icon name="tag" size={24}/></div>
                                <div className="absolute right-4 top-5 text-slate-400 pointer-events-none"><Icon name="chevron-down" size={16}/></div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
                            {currentSchema.fields.map(renderField)}
                            {needsColdChain && (<div className="col-span-12 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-4 text-sky-800"><div className="p-2 bg-sky-100 rounded-lg"><Icon name="snowflake" size={24}/></div><div><h4 className="font-bold text-sm">CADENA DE FRÍO REQUERIDA</h4><p className="text-xs opacity-80">Verifique temperatura entre 2°C y 8°C según Decreto 1782.</p></div></div>)}
                        </div>
                        
                        {formError && (
                            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                                <Icon name="alert-circle" size={24}/>
                                <span className="font-bold text-sm">{formError}</span>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-4 justify-end mt-10 pt-8 border-t border-slate-100">
                            {!isReportingIssue ? (
                                <>
                                    <button onClick={() => setIsReportingIssue(true)} className="px-6 py-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center gap-2 group"><div className="p-1 bg-slate-100 rounded group-hover:bg-red-100 transition-colors"><Icon name="alert-triangle" size={18}/></div> REPORTAR HALLAZGO</button>
                                    <button onClick={() => handleAddProduct(true)} disabled={cumValidationState === 'EXPIRED'} className={`px-8 py-4 rounded-xl font-bold shadow-xl flex items-center gap-3 text-white transition-all transform hover:scale-[1.02] ${cumValidationState === 'EXPIRED' ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}><Icon name="check-circle" size={20}/> REGISTRAR CONFORME</button>
                                </>
                            ) : (
                                <div className="w-full bg-red-50 p-6 rounded-2xl border border-red-100 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-200/50">
                                        <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Icon name="shield-off" size={24}/></div>
                                        <div><h4 className="font-black text-red-900 uppercase">Panel de Medidas Sanitarias</h4><p className="text-xs text-red-700">Configure la causal y la medida a aplicar.</p></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 mb-6">
                                        <div><label className="text-xs font-bold text-red-800 uppercase mb-2 block">Causal del Riesgo</label><select className="w-full h-12 border-2 border-red-200 rounded-xl text-red-900 font-bold bg-white px-3 focus:ring-4 focus:ring-red-100 outline-none" value={newProduct.riskFactor} onChange={e=>setNewProduct({...newProduct, riskFactor: e.target.value as RiskFactor})}><option value="NINGUNO">Seleccione...</option><option value="VENCIDO">VENCIDO / EXPIRADO</option><option value="SIN_REGISTRO">SIN REGISTRO / FRAUDULENTO</option><option value="ALTERADO">ALTERADO (Físico-Químico)</option><option value="USO_INSTITUCIONAL">USO INSTITUCIONAL</option></select></div>
                                        <div><label className="text-xs font-bold text-red-800 uppercase mb-2 block">Medida a Aplicar</label><select className="w-full h-12 border-2 border-red-200 rounded-xl text-red-900 font-bold bg-white px-3 focus:ring-4 focus:ring-red-100 outline-none" value={newProduct.seizureType} onChange={e=>setNewProduct({...newProduct, seizureType: e.target.value as SeizureType})}><option value="NINGUNO">Seleccione...</option><option value="DECOMISO">DECOMISO (Incautación)</option><option value="CONGELAMIENTO">CONGELAMIENTO</option><option value="DESNATURALIZACION">DESTRUCCIÓN IN SITU</option></select></div>
                                    </div>
                                    {newProduct.seizureType !== 'NINGUNO' && (<div className="mb-6"><SeizureCalculator onCalculate={handleCalculatorUpdate} cum={newProduct.cum} presentation={newProduct.presentation} pharmaceuticalForm={newProduct.pharmaceuticalForm} isVerified={cumSearchStatus === 'FOUND'} /></div>)}
                                    <div className="flex justify-end gap-4"><button onClick={() => setIsReportingIssue(false)} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button><button onClick={() => handleAddProduct(false)} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 flex items-center gap-2"><Icon name="alert-octagon" size={18}/> CONFIRMAR HALLAZGO</button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* HISTORIAL */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2"><Icon name="clock" size={14}/> Historial de Registros</h4>
                    {products.length === 0 && <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50"><Icon name="inbox" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-500 font-medium">No se han registrado productos en esta visita.</p></div>}
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className={`w-1.5 h-12 rounded-full ${p.riskFactor === 'NINGUNO' ? 'bg-emerald-400' : 'bg-red-500'}`}></div>
                                <div><h5 className="font-black text-slate-700">{p.name}</h5><div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded"><Icon name="tag" size={10}/> Lote: {p.lot || 'N/A'}</span><span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded"><Icon name="box" size={10}/> {p.packLabel}</span></div></div>
                            </div>
                            <div className="flex items-center gap-4">
                                {p.riskFactor !== 'NINGUNO' && <Badge label={p.seizureType} className="bg-red-100 text-red-700 border-red-200"/>}
                                {p.riskFactor !== 'NINGUNO' && !p.hasEvidence && (<button onClick={() => triggerEvidenceCheck(p.id)} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100"><Icon name="camera" size={12}/> FOTO</button>)}
                                <button onClick={() => removeProduct(p.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icon name="trash" size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between mt-12 pt-8 border-t border-slate-200">
                    <Button variant="secondary" onClick={() => setCurrentTab('DIAGNOSTICO')} className="px-6 h-12">Atrás</Button>
                    {hasSeizures ? <Button onClick={() => setCurrentTab('CUSTODIA')} className="bg-orange-600 text-white h-12 px-8 shadow-lg shadow-orange-200 hover:bg-orange-700">Continuar a Custodia <Icon name="shield"/></Button> : <Button onClick={() => setCurrentTab('CIERRE')} className="bg-slate-900 text-white h-12 px-8 shadow-lg hover:bg-slate-800">Finalizar Inventario <Icon name="check"/></Button>}
                </div>
            </div>
            )}

            {/* PESTAÑA 3: CUSTODIA (LOGÍSTICA) */}
            {currentTab === 'CUSTODIA' && hasSeizures && (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-8">
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-2xl shadow-sm flex gap-4">
                        <div className="bg-orange-100 p-3 rounded-xl text-orange-600 h-fit"><Icon name="shield-alert" size={32}/></div>
                        <div><h3 className="font-black text-orange-900 text-lg uppercase tracking-tight">Protocolo de Cadena de Custodia</h3><p className="text-sm text-orange-800 mt-2 leading-relaxed opacity-90">Se han generado medidas sanitarias que requieren aseguramiento físico. Diligencie la información de embalaje y transporte conforme a la Resolución 1234.</p></div>
                    </div>
                    
                    <Card title="1. Estación de Embalaje (Individualización)" icon="box">
                        <div className="space-y-8 p-2">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full"><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tipo de Embalaje</label><select className="w-full h-12 px-4 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white" value={newContainer.type} onChange={e => setNewContainer({...newContainer, type: e.target.value})}><option value="BOLSA_SEGURIDAD">BOLSA DE SEGURIDAD</option><option value="CAJA_SELLADA">CAJA DE CARTÓN SELLADA</option><option value="NEVERA_PORTATIL">NEVERA / CONTENEDOR FRÍO</option></select></div>
                                <div className="flex-1 w-full"><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Código de Precinto</label><input className="w-full h-12 px-4 rounded-xl border border-slate-300 font-bold text-slate-700" placeholder="Ej: B-10293..." value={newContainer.code} onChange={e => setNewContainer({...newContainer, code: e.target.value})} /></div>
                                <button onClick={addContainer} className="h-12 px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition-all"><Icon name="plus" size={18}/> Crear Contenedor</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                                    <h4 className="text-xs font-black text-red-600 uppercase mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Pendientes por Empacar</h4>
                                    <div className="space-y-3">
                                        {products.filter(p => p.seizureType !== 'NINGUNO' && !p.containerId).map(p => (
                                            <div key={p.id} className="p-4 bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-all">
                                                <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">{p.packLabel}</span>
                                                    {containers.length > 0 ? (
                                                        <select className="h-8 pl-2 pr-6 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-slate-50 cursor-pointer" onChange={(e) => assignItemToContainer(p.id, e.target.value)} defaultValue=""><option value="" disabled>Asignar a...</option>{containers.map(c => <option key={c.id} value={c.id}>{c.code.slice(-6)}</option>)}</select>
                                                    ) : <span className="text-[10px] text-slate-400 italic">Cree un contenedor</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {products.filter(p => p.seizureType !== 'NINGUNO' && !p.containerId).length === 0 && <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium">Todo empacado ✅</div>}
                                    </div>
                                </div>
                                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                                    <h4 className="text-xs font-black text-teal-600 uppercase mb-4 flex items-center gap-2"><Icon name="package" size={14}/> Contenedores Listos</h4>
                                    <div className="space-y-4">
                                        {containers.map(c => (
                                            <div key={c.id} className="p-4 bg-white border border-teal-100 rounded-xl shadow-sm relative group">
                                                <button onClick={() => removeContainer(c.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors"><Icon name="x" size={16}/></button>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 bg-teal-100 text-teal-600 rounded-lg"><Icon name="archive" size={20}/></div>
                                                    <div><p className="font-bold text-slate-700 text-sm">{c.type.replace('_', ' ')}</p><p className="font-mono text-xs text-teal-600 bg-teal-50 px-1.5 rounded inline-block">{c.code}</p></div>
                                                </div>
                                                <div className="pl-4 border-l-2 border-teal-100 space-y-2">
                                                    {products.filter(p => p.containerId === c.id).map(p => (
                                                        <div key={p.id} className="flex justify-between items-center text-xs group/item">
                                                            <span className="text-slate-600 font-medium truncate w-3/4">{p.quantity}x {p.name}</span>
                                                            <button onClick={() => unassignItem(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"><Icon name="minus-circle" size={14}/></button>
                                                        </div>
                                                    ))}
                                                    {products.filter(p => p.containerId === c.id).length === 0 && <span className="text-[10px] text-slate-400 italic">Contenedor vacío</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card title="2. Logística de Transporte" icon="truck">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-2">
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Modalidad de Transporte</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['INSTITUCIONAL', 'CONTRATISTA'].map(mode => (
                                        <button key={mode} onClick={() => setCustodyData({...custodyData, transportType: mode})} className={`p-4 rounded-xl border-2 font-bold text-sm transition-all ${custodyData.transportType === mode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{mode}</button>
                                    ))}
                                </div>
                            </div>
                            <Input label="Lugar de Depósito Final" value={custodyData.depositLocation} onChange={e => setCustodyData({...custodyData, depositLocation: e.target.value})} placeholder="Ej: BODEGA CENTRAL DE EVIDENCIAS" />
                            <Input label="Empresa / Entidad" value={custodyData.transportCompany} onChange={e => setCustodyData({...custodyData, transportCompany: e.target.value})} placeholder="Nombre de la empresa" />
                            <Input label="Placa del Vehículo" value={custodyData.transportPlate} onChange={e => setCustodyData({...custodyData, transportPlate: e.target.value})} placeholder="Ej: OBF-123" />
                            <Input label="Conductor Responsable" value={custodyData.driverName} onChange={e => setCustodyData({...custodyData, driverName: e.target.value})} placeholder="Nombre completo" />
                        </div>
                    </Card>

                    <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
                        <Button variant="secondary" onClick={() => setCurrentTab('PRODUCTOS')} className="px-6 h-12">Atrás</Button>
                        <Button onClick={() => setCurrentTab('CIERRE')} className="bg-slate-900 text-white px-8 h-12 shadow-xl hover:bg-slate-800">Confirmar y Cerrar <Icon name="lock" size={18}/></Button>
                    </div>
                </div>
            )}

            {/* 4. CIERRE */}
            {currentTab === 'CIERRE' && (
                <div className="animate-in fade-in zoom-in-95 space-y-8">
                    <div className={`p-8 rounded-2xl shadow-xl border text-center text-white relative overflow-hidden ${score < 60 ? 'bg-gradient-to-br from-red-600 to-red-800 border-red-500' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700'}`}>
                        <div className="relative z-10">
                            <div className="text-xs uppercase tracking-[0.3em] opacity-80 mb-2 font-bold">Concepto Técnico Emitido</div>
                            <div className="text-5xl font-black mb-6 tracking-tight">{concept.replace('_', ' ')}</div>
                            <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden max-w-lg mx-auto backdrop-blur-sm">
                                <div className={`h-full transition-all duration-1000 ${score < 60 ? 'bg-red-300' : 'bg-teal-400'}`} style={{ width: `${score}%` }}></div>
                            </div>
                            <p className="mt-4 text-sm font-bold opacity-90">Índice de Cumplimiento Normativo: {score}%</p>
                        </div>
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
                    </div>

                    <Card title="Narrativa Técnica y Legal" icon="book-open">
                        <div className="space-y-6 p-2">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                    <strong>IMPORTANTE:</strong> Relate cronológicamente los hechos. Describa las condiciones sanitarias encontradas y motive técnica y jurídicamente las decisiones (Art. 35 CPACA).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Relato de los Hechos</label><button onClick={() => toggleListening('narrative', setInspectionNarrative)} className={`p-2 rounded-full transition-all ${isListening==='narrative'?'bg-red-100 text-red-600 animate-pulse':'bg-slate-100 text-slate-500 hover:text-blue-600'}`}><Icon name="mic" size={16}/></button></div>
                                <textarea className="w-full p-4 rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-blue-500 outline-none min-h-[160px] resize-y" placeholder="Describa las condiciones de ingreso, recorrido y hallazgos principales..." value={inspectionNarrative} onChange={(e) => setInspectionNarrative(e.target.value)}/>
                            </div>
                            {hasSeizures && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><label className="text-xs font-bold text-red-600 uppercase tracking-wider">Fundamentos Jurídicos de la Medida</label><button onClick={() => toggleListening('legal', setLegalBasis)} className="text-red-500 hover:text-red-700"><Icon name="mic" size={16}/></button></div>
                                    <textarea className="w-full p-4 rounded-xl border-2 border-red-200 bg-red-50/20 text-sm font-medium focus:border-red-500 outline-none min-h-[100px]" placeholder="Cite las normas infringidas (Ley 9/79, Decreto 677...)" value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)}/>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="Formalización Legal" icon="gavel">
                        <div className="space-y-8 p-2">
                            <div>
                                <div className="flex justify-between items-center mb-2"><div className="flex items-center gap-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observaciones del Vigilado</label><span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-400">DERECHO DE CONTRADICCIÓN</span></div><button onClick={() => toggleListening('citizen', setCitizenObservation)} className="text-blue-600"><Icon name="mic" size={16}/></button></div>
                                <textarea className="w-full p-4 rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-blue-500 outline-none min-h-[100px]" placeholder="Espacio para descargos del atendido..." value={citizenObservation} onChange={(e) => setCitizenObservation(e.target.value)}/>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                                <div className="flex flex-col h-full justify-between gap-4">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Funcionario Responsable (IVC)</p>
                                    <div className="border-2 border-slate-200 rounded-xl flex-1 min-h-[180px] flex flex-col items-center justify-center bg-slate-50/50">
                                        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 mb-3"><Icon name="user-check" size={32}/></div>
                                        <p className="font-black text-slate-700 text-sm">INSPECTOR VIGISALUD</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">Firma Digital Autenticada</p>
                                    </div>
                                </div>

                                <div className="flex flex-col h-full justify-between gap-4">
                                    <div className="flex justify-between items-center"><p className="text-xs font-black text-slate-400 uppercase tracking-widest">{refusalToSign ? 'Firma de Testigo' : `Firma de: ${contextData?.attendedBy?.slice(0,15)}...`}</p><button onClick={() => setRefusalToSign(!refusalToSign)} className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all ${refusalToSign?'bg-red-50 text-red-600 border-red-200':'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500'}`}>{refusalToSign ? 'Cancelar Renuencia' : '¿Se niega a firmar?'}</button></div>
                                    <div className="flex-1 min-h-[180px]">
                                        {!refusalToSign ? (
                                            <SignaturePad onChange={(data) => setSignature(data)} label="Firme aquí dentro del recuadro" />
                                        ) : (
                                            <div className="h-full flex flex-col gap-3 animate-in fade-in">
                                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-xs text-red-700 font-bold text-center flex items-center justify-center gap-2"><Icon name="alert-triangle" size={14}/> Protocolo de Renuencia Activado</div>
                                                <Input label="Nombre Testigo" value={witness.name} onChange={e => setWitness({...witness, name: e.target.value})} />
                                                <Input label="Cédula" value={witness.id} onChange={e => setWitness({...witness, id: e.target.value})} />
                                                <div className="flex-1"><SignaturePad onChange={(data) => setWitness({...witness, signature: data})} label="Firma del Testigo" /></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="flex justify-between mt-12 pt-6 border-t border-slate-200">
                        <Button variant="secondary" onClick={() => setCurrentTab(hasSeizures ? 'CUSTODIA' : 'PRODUCTOS')} className="px-8 h-12">Atrás</Button>
                        <Button onClick={() => handleReviewDraft()} className="bg-slate-900 text-white shadow-xl h-12 px-10 hover:scale-105 transition-transform" disabled={loading}>
                        {loading ? <span className="flex items-center gap-2"><Icon name="loader" className="animate-spin"/> Generando Acta...</span> : <span className="flex items-center gap-2">VISTA PREVIA Y FINALIZAR <Icon name="file-text"/></span>}
                        </Button>
                    </div>
                </div>
            )}
        </div>

      {/* --- MODALES --- */}

      {/* MODAL CUM (PRO SEARCH) */}
      {showCumModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setShowCumModal(false)}></div>
            <div className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
                <div className="bg-slate-900 p-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm"><Icon name="database" size={24}/></div>
                        <div><h3 className="font-black text-lg uppercase tracking-wide">Base de Datos Maestra INVIMA</h3><p className="text-xs opacity-70 font-medium">Motor de Búsqueda Regulatoria v8.2</p></div>
                    </div>
                    <button onClick={() => setShowCumModal(false)} className="hover:bg-white/10 p-3 rounded-full transition-colors"><Icon name="x" size={24}/></button>
                </div>

                <div className="p-6 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="relative group">
                        <input autoFocus className="w-full h-16 pl-14 pr-6 rounded-2xl border-2 border-slate-200 text-xl font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-sm" placeholder="Buscar por Nombre, Principio Activo, Expediente o CUM..." value={cumQuery} onChange={(e) => { setCumQuery(e.target.value); }} />
                        <div className="absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-500 transition-colors"><Icon name="search" size={24}/></div>
                    </div>
                    <div className="flex gap-6 mt-4 text-xs font-bold text-slate-500 px-2">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Vigentes</span>
                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Vencidos</span>
                        <span className="flex items-center gap-2 ml-auto"><Icon name="database" size={12}/> {cumResults.length} Registros encontrados</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-100/50">
                    <div className="space-y-3">
                        {cumResults.map(r => (
                            <button key={r.id} onClick={() => selectFromModal(r)} className="w-full bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all text-left group flex justify-between items-center relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-blue-500 transition-colors"></div>
                                <div className="pl-2">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-black text-base text-slate-800 group-hover:text-blue-700 transition-colors">{r.producto}</h4>
                                        <Badge label={r.estadoregistro} variant={r.estadoregistro === 'Vigente' ? 'success' : 'danger'} className="text-[10px] uppercase tracking-wider"/>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">{r.titular}</p>
                                    <div className="flex gap-4 mt-3">
                                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-600 border border-slate-200">REG: {r.registrosanitario}</span>
                                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-600 border border-slate-200">CUM: {r.expediente}-{r.consecutivocum}</span>
                                        <span className="px-2 py-1 bg-blue-50 rounded-lg text-[10px] font-bold text-blue-700 border border-blue-100">{r.principioactivo}</span>
                                    </div>
                                </div>
                                <div className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all"><Icon name="chevron-right" size={24}/></div>
                            </button>
                        ))}
                        {cumResults.length === 0 && !isSearchingCum && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                                <Icon name="search" size={64} className="mb-6 opacity-10"/>
                                <p className="font-bold text-lg text-slate-500">Buscador Listo</p>
                                <p className="text-sm mt-2 opacity-60">Ingrese cualquier criterio para consultar el catálogo oficial.</p>
                            </div>
                        )}
                        {isSearchingCum && (
                            <div className="h-full flex flex-col items-center justify-center text-blue-500 py-20">
                                <Icon name="loader" size={48} className="mb-6 animate-spin"/>
                                <p className="font-bold text-lg animate-pulse">Consultando Base de Datos...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>, document.body
      )}

      {/* MODAL EVIDENCIA */}
      {showEvidenceModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border-2 border-amber-200 overflow-hidden">
                <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-inner"><Icon name="alert-triangle" size={32}/></div>
                    <div><h3 className="font-black text-amber-900 text-lg uppercase leading-none">Requerimiento Legal</h3><p className="text-xs font-bold text-amber-700/70 mt-1">Ley 9 de 1979 - Art. 576</p></div>
                </div>
                <div className="p-8 space-y-4 text-center">
                    <p className="text-slate-600 font-medium leading-relaxed">Para soportar una medida sanitaria o hallazgo crítico, es <strong>obligatorio</strong> adjuntar evidencia probatoria documental (fotografía).</p>
                    <div className="flex flex-col gap-3 mt-4">
                        <button onClick={handlePhotoClick} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"><Icon name="camera" size={20}/> ACTIVAR CÁMARA</button>
                        <button onClick={() => commitProduct(false)} className="w-full py-4 bg-white text-slate-400 font-bold rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:text-slate-600 transition-all text-xs uppercase tracking-wider">Omitir (Queda como Pendiente)</button>
                    </div>
                </div>
            </div>
        </div>, document.body
      )}

      {/* MODAL BLOQUEO CIERRE */}
      {showBlockModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-900/50 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border-4 border-red-500 overflow-hidden">
                <div className="bg-red-600 p-6 text-white text-center">
                    <div className="mx-auto bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm"><Icon name="lock" size={40}/></div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Cierre Bloqueado</h3>
                    <p className="text-red-100 text-sm font-bold mt-2">Seguridad Jurídica Activada</p>
                </div>
                <div className="p-8 text-center space-y-6">
                    <p className="text-slate-600 font-medium leading-relaxed text-lg">No es posible cerrar el acta porque existen <strong>hallazgos de riesgo sin evidencia probatoria</strong>.</p>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-sm text-red-800 font-bold">Por favor regrese a la pestaña "Evidencia" y adjunte las fotos pendientes marcadas en rojo.</div>
                    <button onClick={() => setShowBlockModal(false)} className="w-full py-4 bg-white text-slate-700 font-black rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm uppercase tracking-wider">Entendido, Volver</button>
                </div>
            </div>
        </div>, document.body
      )}

       {showDraftModal && createPortal(
         <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in">
             <div className="bg-white w-full max-w-6xl h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                 <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
                     <div><h3 className="font-black text-xl tracking-tight">Vista Previa del Acta</h3><p className="text-xs opacity-60 font-medium">Revise cuidadosamente antes de firmar.</p></div>
                     <button onClick={() => setShowDraftModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Icon name="x" size={24}/></button>
                 </div>
                 <div className="flex-1 bg-slate-200 p-4 md:p-8 relative overflow-hidden">
                     {pdfBlobUrl ? (
                         <iframe src={pdfBlobUrl} className="w-full h-full rounded-xl shadow-2xl border border-slate-300 bg-white" title="PDF Preview"></iframe>
                     ) : (
                         <div className="flex items-center justify-center h-full flex-col text-slate-400"><Icon name="loader" size={48} className="animate-spin mb-4"/><p className="font-bold">Generando Documento...</p></div>
                     )}
                 </div>
                 <div className="p-6 border-t border-slate-200 flex justify-end gap-4 bg-white shrink-0">
                     <Button variant="secondary" onClick={() => setShowDraftModal(false)} className="h-12 px-6">Corregir</Button>
                     <Button className="bg-emerald-600 text-white hover:bg-emerald-700 h-12 px-8 shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5 transition-all" onClick={handleFinalizeInspection} disabled={loading}><Icon name="check-circle" size={20}/> {loading ? "Guardando..." : "APROBAR Y FIRMAR"}</Button>
                 </div>
             </div>
         </div>, document.body
       )}

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );
};
