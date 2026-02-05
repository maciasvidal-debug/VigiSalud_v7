import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import type { Report, ProductFinding, ProductType, InspectionItem, FindingEvidence, RiskFactor, SeizureType, ComplaintType, CustodyChain, ProductSubtype, SeizureLogistics, ExtendedCumRecord } from '../../types';

// =============================================================================
// 1. TIPOS LOCALES Y UTILIDADES
// =============================================================================

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

interface LocalProductFinding extends ProductFinding {
    hasEvidence?: boolean;
    containerId?: string; 
    // Auditoría de integridad de datos (ALCOA+)
    originalCumData?: Partial<ProductFinding>;
    originalInput?: { packs: number; loose: number };
}

interface EvidenceContainer {
    id: string;
    type: 'BOLSA_SEGURIDAD' | 'CAJA_SELLADA' | 'NEVERA_PORTATIL' | 'SOBRE_MANILA';
    code: string; 
    items: string[]; 
}

// Helper de Formato
const formatEnum = (text: string | undefined) => text ? text.replace(/_/g, ' ') : '';

// Helper de Grilla 12 Columnas (Estricto según Manual)
const getColSpanClass = (field: FieldConfig) => {
    const colSpans: Record<number, string> = {
        1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3',
        4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6',
        7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9',
        10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
    };
    // Por defecto 12 si no está definido, para evitar colapsos
    const spanClass = field.colSpan ? colSpans[field.colSpan] : 'md:col-span-12';
    return `col-span-12 ${spanClass}`;
};

// =============================================================================
// 2. COMPONENTE PRINCIPAL (CORE LOGIC)
// =============================================================================

export const InspectionForm: React.FC<InspectionFormProps> = ({ contextData }) => {
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADOS DE FLUJO ---
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'DIAGNOSTICO' | 'PRODUCTOS' | 'CUSTODIA' | 'CIERRE'>('DIAGNOSTICO');
  
  // --- ESTADOS DE DIAGNÓSTICO (MATRIZ) ---
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number>(100);
  const [concept, setConcept] = useState<'FAVORABLE' | 'DESFAVORABLE' | 'PENDIENTE'>('FAVORABLE');
  
  // --- ESTADOS DE CIERRE ---
  const [signature, setSignature] = useState<string | null>(null);
  const [citizenObservation, setCitizenObservation] = useState('');
  const [inspectionNarrative, setInspectionNarrative] = useState(''); 
  const [legalBasis, setLegalBasis] = useState(''); 
  const [isListening, setIsListening] = useState<string | null>(null); 
  const [refusalToSign, setRefusalToSign] = useState(false);
  const [witness, setWitness] = useState({ name: '', id: '', signature: null as string | null });
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | undefined>(undefined);
  const [pendingReportData, setPendingReportData] = useState<Partial<Report> | null>(null);

  // --- ESTADOS DE PRODUCTOS E INVENTARIO ---
  const [products, setProducts] = useState<LocalProductFinding[]>([]);
  const [containers, setContainers] = useState<EvidenceContainer[]>([]); 
  const [newContainer, setNewContainer] = useState<{type: string, code: string}>({ type: 'BOLSA_SEGURIDAD', code: '' }); 
  const [formError, setFormError] = useState<string | null>(null); 
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [evidenceTemp, setEvidenceTemp] = useState(false); 
  
  // --- GESTIÓN DE CANTIDADES (SPLIT INPUT) ---
  const [packsInput, setPacksInput] = useState<number>(0);
  const [looseInput, setLooseInput] = useState<number>(0);
  
  // --- ESTADOS DE BÚSQUEDA CUM (INTEGRACIÓN DB) ---
  const [isSearchingCum, setIsSearchingCum] = useState(false);
  const [cumSearchStatus, setCumSearchStatus] = useState<'IDLE' | 'FOUND' | 'NOT_FOUND'>('IDLE');
  const [cumValidationState, setCumValidationState] = useState<'VALID' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | null>(null);
  const [cumQuery, setCumQuery] = useState('');
  const [cumResults, setCumResults] = useState<ExtendedCumRecord[]>([]);
  const [showCumModal, setShowCumModal] = useState(false);
  
  // --- ESTADOS MODALES DE ALERTA ---
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [pendingEvidenceId, setPendingEvidenceId] = useState<string | null>(null);
  
  // --- OBJETO PRODUCTO (ESTADO TRANSACCIONAL) ---
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
  }>({
    type: 'MEDICAMENTO', 
    subtype: 'SINTESIS_QUIMICA', 
    name: '', manufacturer: '', riskFactor: 'NINGUNO', seizureType: 'NINGUNO', quantity: 0, 
    cum: '', invimaReg: '', lot: '', serial: '', storageTemp: '', coldChainStatus: '', presentation: '',
    pharmaceuticalForm: '', activePrinciple: '', concentration: '', viaAdministration: '', atcCode: '',
    packLabel: '', logistics: undefined
  });

  const [interpretedQty, setInterpretedQty] = useState<string>('');

  const [custodyData, setCustodyData] = useState<Partial<CustodyChain> & { transportType?: string }>({
    depositLocation: '', transportType: 'INSTITUCIONAL', transportCompany: '', transportPlate: '', driverName: ''
  });

  // --- QUERIES DE BASE DE DATOS ---
  const establishment = useLiveQuery(() => (establishmentId ? db.establishments.get(Number(establishmentId)) : undefined), [establishmentId]);
  const hasSeizures = products.some(p => p.seizureType !== 'NINGUNO');
  
  const INSPECTION_STEPS: StepItem[] = [
      { id: 'DIAGNOSTICO', label: 'Condiciones', icon: 'clipboard', description: 'Matriz IVC' }, 
      { id: 'PRODUCTOS', label: 'Evidencia', icon: 'search', description: 'Inventario' }, 
      { id: 'CUSTODIA', label: 'Logística', icon: 'shield', description: 'Custodia', disabled: !hasSeizures }, 
      { id: 'CIERRE', label: 'Cierre', icon: 'pen-tool', description: 'Acta Final' }
  ];

  // ===========================================================================
  // 3. LOGICA DE NEGOCIO (HANDLERS)
  // ===========================================================================

  // --- VOICE TO TEXT (STUB OBLIGATORIO) ---
  const toggleListening = (fieldId: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (isListening === fieldId) { setIsListening(null); return; }
    // En producción aquí va la API de WebSpeech
    showToast("Micrófono activado (Simulación)", 'info');
    setIsListening(fieldId);
    setTimeout(() => setIsListening(null), 3000);
  };

  // --- GESTIÓN DE CUSTODIA (PACKING) ---
  const addContainer = () => { 
      if (!newContainer.code) { showToast("Debe ingresar el código del precinto.", 'warning'); return; } 
      const newId = crypto.randomUUID(); 
      setContainers([...containers, { id: newId, type: newContainer.type as any, code: newContainer.code, items: [] }]); 
      setNewContainer({ ...newContainer, code: '' }); 
  };
  
  const removeContainer = (containerId: string) => { 
      setProducts(prev => prev.map(p => p.containerId === containerId ? { ...p, containerId: undefined } : p)); 
      setContainers(prev => prev.filter(c => c.id !== containerId)); 
  };
  
  const assignItemToContainer = (productId: string, containerId: string) => { 
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, containerId } : p)); 
  };
  
  const unassignItem = (productId: string) => { 
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, containerId: undefined } : p)); 
  };
  
  // --- GESTIÓN DE FOTOS Y EVIDENCIA ---
  const handlePhotoClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (e.target.files && e.target.files[0]) { 
          const fakeUrl = URL.createObjectURL(e.target.files[0]); 
          if (pendingEvidenceId) { 
              setProducts(prev => prev.map(p => p.id === pendingEvidenceId ? { ...p, hasEvidence: true, photoUrl: fakeUrl } : p)); 
              setPendingEvidenceId(null); 
              showToast("Evidencia vinculada exitosamente", 'success'); 
          } else { 
              setEvidenceTemp(true); 
              if (showEvidenceModal) setShowEvidenceModal(false); 
          } 
          e.target.value = ''; 
      } 
  };
  
  const triggerEvidenceCheck = (id: string) => { 
      setPendingEvidenceId(id); 
      if (fileInputRef.current) fileInputRef.current.click(); 
  };

  // --- CALCULADORA DE VOLUMEN (DECOMISO) ---
  const handleCalculatorUpdate = useCallback((total: number, label: string, logistics: SeizureLogistics) => {
      setNewProduct(prev => {
          if (prev.quantity === total && prev.packLabel === label) return prev; 
          return { ...prev, quantity: total, packLabel: label, logistics };
      });
  }, []);

  // --- CORE: AGREGAR PRODUCTO AL ACTA ---
  const commitProduct = (overrideEvidence: boolean) => {
      const finalRisk = newProduct.riskFactor || 'NINGUNO';
      
      // Lógica de Negocio: Cálculo de Cantidad Total
      let finalQuantity = 0;
      let smartLabel = '';
      let currentLogistics = newProduct.logistics;

      if (!isReportingIssue && newProduct.presentation && newProduct.pharmaceuticalForm) {
          const model = parsePresentation(newProduct.pharmaceuticalForm, newProduct.presentation);
          
          // Fórmula: (Cajas * Factor) + Unidades Sueltas
          finalQuantity = (packsInput * model.packFactor) + looseInput;
          
          // Etiqueta Inteligente para el Acta
          if (packsInput > 0 && looseInput > 0) {
              smartLabel = `${packsInput} ${model.packType}s + ${looseInput} ${model.containerType}s (${finalQuantity} Total)`;
          } else if (packsInput > 0) {
              smartLabel = `${packsInput} ${model.packType}s (${finalQuantity} ${model.containerType}s)`;
          } else {
              smartLabel = `${looseInput} ${model.containerType}s Sueltos`;
          }

          // Generar Logística (Backoffice)
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
          // Modo Manual o Decomiso
          finalQuantity = newProduct.quantity || 0;
          smartLabel = newProduct.packLabel || `${finalQuantity} Unidades`;
      }

      if (finalQuantity === 0) {
          setFormError("La cantidad total no puede ser cero.");
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
      
      // Limpieza de Formulario
      setNewProduct({ 
        type: newProduct.type, subtype: newProduct.subtype,
        name: '', manufacturer: '', riskFactor: 'NINGUNO', seizureType: 'NINGUNO', quantity: 0,
        cum: '', invimaReg: '', lot: '', serial: '', storageTemp: '', coldChainStatus: '', presentation: '', 
        pharmaceuticalForm: '', activePrinciple: '', concentration: '', viaAdministration: '', atcCode: '',
        packLabel: '', logistics: undefined, originalCumData: undefined
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
    if (!newProduct.name) { setFormError("El nombre del producto es obligatorio."); return; }
    
    // Semáforo Regulatorio
    if (isConform && (cumValidationState === 'EXPIRED' || cumValidationState === 'SUSPENDED' || cumValidationState === 'REVOKED')) {
        setFormError("⛔ BLOQUEO: Este producto tiene Registro Vencido. Debe reportarlo como Hallazgo.");
        return;
    }

    const finalRisk = isConform ? 'NINGUNO' : (newProduct.riskFactor || 'NINGUNO');
    if (isConform && finalRisk !== 'NINGUNO') { setFormError("Inconsistencia: No puede marcar 'Conforme' si seleccionó un riesgo."); return; }
    
    // Obligatoriedad de Evidencia en Hallazgos
    if (!isConform && finalRisk !== 'NINGUNO' && !evidenceTemp) { 
        setShowEvidenceModal(true); 
        return; 
    }
    commitProduct(evidenceTemp || finalRisk === 'NINGUNO');
  };

  const removeProduct = (id: string) => setProducts(products.filter(p => p.id !== id));

  // --- GENERACIÓN DE DOCUMENTOS (PDF) ---
  const handleReviewDraft = async () => {
    if (!establishment || !establishmentId) return;
    if (!inspectionNarrative) { showToast("⚠️ Falta la narrativa de los hechos.", 'error'); return; }
    
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
        showToast("Error crítico generando el PDF.", 'error'); 
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
          showToast(`✅ Acta cerrada y firmada digitalmente.`, 'success');
          navigate('/dashboard/inspections');
      } catch (e) { 
          console.error(e); 
          showToast("Error guardando en base de datos local.", 'error'); 
      } finally { 
          setLoading(false); 
          setShowDraftModal(false); 
      }
  };

  // --- BÚSQUEDA CUM AVANZADA (MODO HÍBRIDO) ---
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

          // Lógica de detección de tipo de búsqueda
          if (/^\d+/.test(cleanQuery)) {
              // Si inicia con números -> Buscar por EXPEDIENTE (Indexado)
              results = await db.cums
                  .where('expediente')
                  .startsWith(cleanQuery)
                  .limit(20)
                  .toArray() as unknown as ExtendedCumRecord[];
          } else {
              // Si son letras -> Buscar por PRODUCTO o PRINCIPIO ACTIVO (Paralelo)
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

              // Merge y Deduplicación
              const combined = [...byProduct, ...byActive];
              const unique = new Map();
              combined.forEach(item => unique.set(item.expediente, item));
              results = Array.from(unique.values()) as unknown as ExtendedCumRecord[];
          }
      } catch (e) {
          console.error("Error CUM Search:", e);
      }

      setCumResults(results);
      setIsSearchingCum(false);
  };

  // Debounce (Solo busca automáticamente si escribes rápido en el modal)
  useEffect(() => {
      const timer = setTimeout(() => {
          if (cumQuery.length > 2) {
              searchCum(cumQuery);
          }
      }, 500); 
      return () => clearTimeout(timer);
  }, [cumQuery]);

  const selectFromModal = (record: ExtendedCumRecord) => {
      // Semáforo de Vigencia
      let validation: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' = 'VALID';
      const status = record.estadoregistro ? record.estadoregistro.toUpperCase() : '';
      
      if (status.includes('VENCID') || status.includes('CANCELAD')) {
          validation = 'EXPIRED';
      } else if (record.fechavencimiento) {
          const expiration = new Date(record.fechavencimiento);
          if (expiration < new Date()) validation = 'EXPIRED';
      }
      
      setCumValidationState(validation);
      if (validation !== 'VALID') {
          setIsReportingIssue(true);
          showToast("⚠️ ALERTA: El registro seleccionado no está vigente.", "warning");
      }

      // MAPEO DE DATOS (BD -> Formulario)
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
          // Si está vencido, pre-seleccionamos el riesgo VENCIDO
          riskFactor: validation !== 'VALID' ? (validation === 'EXPIRED' ? 'VENCIDO' : 'SIN_REGISTRO') : 'NINGUNO'
      };

      setNewProduct(prev => ({ ...prev, ...mappedProduct, originalCumData: mappedProduct }));
      setShowCumModal(false);
      setCumQuery('');
  };

  // --- MANEJADORES DE MATRIZ ---
  const handleMatrixResponse = (itemId: string, value: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA') => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], status: value } })); 
  };
  const handleEvidence = (itemId: string, evidence: FindingEvidence) => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], evidence: [...(prev[itemId]?.evidence || []), evidence] } })); 
  };
  const handleObservation = (itemId: string, observation: string) => { 
      setChecklistResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], observation } })); 
  };

  // --- EFECTOS DE INICIALIZACIÓN ---
  useEffect(() => { 
      if (establishment) setInspectionItems(inspectionEngine.generate(establishment)); 
  }, [establishment]);
  
  useEffect(() => { 
      if (inspectionItems.length === 0) return; 
      const simpleResponses: Record<string, string> = {}; 
      Object.keys(checklistResponses).forEach(key => simpleResponses[key] = checklistResponses[key].status); 
      const engineScore = inspectionEngine.calculateRisk(inspectionItems, simpleResponses); 
      const finalScore = Math.min(engineScore, products.some(p => p.riskFactor !== 'NINGUNO') ? 59 : 100); 
      setScore(finalScore); 
      setConcept(finalScore < 60 ? 'DESFAVORABLE' : 'FAVORABLE'); 
  }, [checklistResponses, products, inspectionItems]);
  
  // Parser de Texto para Cantidad (Feedback visual)
  useEffect(() => {
      if (newProduct.presentation && newProduct.pharmaceuticalForm && (packsInput > 0 || looseInput > 0) && !isReportingIssue) {
          const model = parsePresentation(newProduct.pharmaceuticalForm, newProduct.presentation);
          const totalUnits = (packsInput * model.packFactor) + looseInput;
          if (packsInput > 0) {
              setInterpretedQty(`Total Legal: ${totalUnits} ${model.containerType}s (${packsInput} ${model.packType}s x ${model.packFactor})`);
          } else {
              setInterpretedQty(`Total: ${totalUnits} ${model.containerType}s Sueltos`);
          }
      } else {
          setInterpretedQty('');
      }
  }, [newProduct.presentation, newProduct.pharmaceuticalForm, packsInput, looseInput, isReportingIssue]);


  // ===========================================================================
  // 4. RENDERIZADO DINÁMICO DE CAMPOS
  // ===========================================================================

  const renderField = (field: FieldConfig) => {
      if (field.key === 'quantity' && isReportingIssue && newProduct.seizureType !== 'NINGUNO') return null;
      
      const colClass = getColSpanClass(field);
      const isColdChainError = field.section === 'COLD_CHAIN' && newProduct.coldChainStatus?.includes('INCUMPLE');
      
      const originalValue = newProduct.originalCumData ? newProduct.originalCumData[field.key as keyof ProductFinding] : undefined;
      const currentValue = newProduct[field.key as keyof ProductFinding];
      const isDiscrepant = originalValue && currentValue && originalValue !== currentValue;

      // CAMPO CUM: Input libre + Botón de Búsqueda
      if (field.key === 'cum') {
          return (
              <div className={colClass} key={field.key}>
                  <label className="text-xs font-bold text-slate-500 mb-1 flex justify-between">
                      {field.label}
                      {newProduct.originalCumData && <span className="text-emerald-600 bg-emerald-50 px-1 rounded text-[9px] border border-emerald-200">✓ BD INVIMA</span>}
                  </label>
                  <div className="relative flex shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 ring-blue-100 transition-all">
                      <input 
                          className="w-full h-11 pl-3 pr-3 text-sm font-bold text-slate-700 outline-none bg-white placeholder-slate-400"
                          value={newProduct.cum || ''} 
                          onChange={e => setNewProduct({...newProduct, cum: e.target.value})} 
                          placeholder={field.placeholder || "Digite CUM..."}
                          // 🛑 FIX CRÍTICO: Eliminado el onClick que bloqueaba la escritura
                      />
                      <button 
                          type="button" 
                          onClick={() => { setCumQuery(newProduct.cum || ''); setShowCumModal(true); }} 
                          className="px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
                          title="Abrir Buscador Maestro (F2)"
                      >
                          <Icon name="database" size={16}/> AVANZADO
                      </button>
                  </div>
                  {field.hint && <p className="text-[10px] text-slate-400 mt-1 italic flex items-center gap-1"><Icon name="info" size={10}/> {field.hint}</p>}
              </div>
          );
      }

      // CAMPO CANTIDAD: Split Input (Cajas vs Unidades)
      if (field.key === 'quantity') {
          return (
              <div className={colClass} key={field.key}>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="text-xs font-bold text-slate-600 mb-2 block border-b border-slate-200 pb-1">INVENTARIO FÍSICO (REG-Q022)</label>
                      <div className="flex gap-2 items-end">
                          <div className="flex-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase mb-1 block">Empaques Completos</label>
                              <div className="relative">
                                  <input 
                                      type="number" 
                                      className="w-full h-10 pl-3 pr-2 rounded-lg border border-slate-300 font-bold text-slate-700 outline-none focus:border-blue-500"
                                      value={packsInput || ''}
                                      onChange={e => setPacksInput(parseInt(e.target.value) || 0)}
                                      placeholder="Cajas..."
                                  />
                                  <div className="absolute right-2 top-2.5 text-slate-300 pointer-events-none"><Icon name="box" size={14}/></div>
                              </div>
                          </div>
                          <div className="pb-2 text-slate-300 font-black">+</div>
                          <div className="flex-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase mb-1 block">Unidades Sueltas</label>
                              <div className="relative">
                                  <input 
                                      type="number" 
                                      className="w-full h-10 pl-3 pr-2 rounded-lg border border-slate-300 font-bold text-slate-700 outline-none focus:border-blue-500"
                                      value={looseInput || ''}
                                      onChange={e => setLooseInput(parseInt(e.target.value) || 0)}
                                      placeholder="Unid..."
                                  />
                                  <div className="absolute right-2 top-2.5 text-slate-300 pointer-events-none"><Icon name="grid" size={14}/></div>
                              </div>
                          </div>
                      </div>
                      {interpretedQty && !isReportingIssue && (
                          <div className="mt-2 text-right">
                              <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200">
                                  <Icon name="check" size={10} className="inline mr-1"/> {interpretedQty}
                              </span>
                          </div>
                      )}
                  </div>
              </div>
          );
      }

      // RESTO DE CAMPOS (Standard)
      return (
          <div className={colClass} key={field.key}>
              <div className="flex justify-between items-center mb-1">
                  <label className={`text-xs font-bold text-slate-500 ${isColdChainError ? 'text-red-500' : ''}`}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {isDiscrepant && <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded font-bold border border-amber-100">! Modificado</span>}
              </div>
              
              {field.type === 'select' ? (
                  <div className="relative">
                      <select 
                          className={`w-full h-12 px-4 bg-white border rounded-xl text-slate-700 font-medium outline-none transition-all text-sm appearance-none cursor-pointer ${isDiscrepant ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200 focus:border-teal-500'}`}
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
                      className={isDiscrepant ? 'border-amber-300 bg-amber-50/20' : ''}
                  />
              )}
              {field.hint && <p className="text-[9px] text-slate-400 mt-1 italic">{field.hint}</p>}
          </div>
      );
  };

  if (!establishment) return <div className="p-10 text-center font-bold text-slate-400">Cargando expediente...</div>;

  const currentSchema = PRODUCT_SCHEMAS[newProduct.type as string] || PRODUCT_SCHEMAS['OTRO'];
  const needsColdChain = newProduct.type === 'MEDICAMENTO' && ['BIOLOGICO', 'BIOTECNOLOGICO', 'REACTIVO_INVITRO'].includes(newProduct.subtype as string);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-24 relative">
        {/* HEADER */}
        <header className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div><div className="flex items-center gap-2 mb-1"><Badge label={establishment.category} variant="neutral" /><Badge label={establishment.type} variant="neutral" />{hasSeizures && <Badge label="MEDIDA SANITARIA" className="bg-red-600 text-white" />}</div><h1 className="text-xl font-black text-slate-800 uppercase">{establishment.name}</h1><p className="text-xs text-slate-500 font-bold">{establishment.address} • NIT: {establishment.nit}</p></div>
            <div className={`px-4 py-2 rounded-lg border-2 font-black text-xl ${score < 60 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-teal-50 border-teal-100 text-teal-700'}`}>{score}%</div>
        </header>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <WizardStepper steps={INSPECTION_STEPS} currentStep={currentTab} onStepClick={setCurrentTab} />
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="grid grid-cols-1 gap-8">
            
            {/* 1. DIAGNÓSTICO */}
            {currentTab === 'DIAGNOSTICO' && (
                <div className="animate-in fade-in">
                    <TacticalMatrix 
                        items={inspectionItems} 
                        responses={checklistResponses} 
                        onResponse={handleMatrixResponse} 
                        onEvidence={handleEvidence} 
                        onObservation={handleObservation} 
                    />
                    <div className="flex justify-end mt-6">
                        <Button onClick={() => setCurrentTab('PRODUCTOS')}>Continuar <Icon name="arrow-right"/></Button>
                    </div>
                </div>
            )}

            {/* 2. PRODUCTOS */}
            {currentTab === 'PRODUCTOS' && (
            <div className="animate-in fade-in space-y-6">
                <div className="bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    
                    {cumValidationState === 'EXPIRED' && (
                        <div className="bg-red-100 p-3 border-b border-red-200 flex items-center gap-3 animate-pulse">
                            <Icon name="alert-triangle" className="text-red-600" size={20}/>
                            <p className="text-xs font-black text-red-800 uppercase">ALERTA REGULATORIA: El Registro Sanitario seleccionado figura como VENCIDO o CANCELADO.</p>
                        </div>
                    )}

                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Categoría del Producto</label><div className="relative"><select className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value as ProductType, subtype: PRODUCT_SCHEMAS[e.target.value]?.subtypes[0] || 'GENERAL', cum: '', name: ''})}>{Object.keys(PRODUCT_SCHEMAS).map(t => <option key={t} value={t}>{formatEnum(t)}</option>)}</select><div className="absolute left-3 top-3 text-slate-400 pointer-events-none"><Icon name="package" size={18} /></div><div className="absolute right-3 top-3 text-slate-400 pointer-events-none"><Icon name="chevron-down" size={16} /></div></div></div>
                            <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Línea / Subtipo</label><div className="relative"><select className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer" value={newProduct.subtype} onChange={e => setNewProduct({...newProduct, subtype: e.target.value as ProductSubtype})}>{PRODUCT_SCHEMAS[newProduct.type as ProductType]?.subtypes.map(st => <option key={st} value={st}>{formatEnum(st)}</option>)}</select><div className="absolute left-3 top-3 text-slate-400 pointer-events-none"><Icon name="tag" size={18} /></div><div className="absolute right-3 top-3 text-slate-400 pointer-events-none"><Icon name="chevron-down" size={16} /></div></div></div>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-12 gap-x-4 gap-y-6">
                            {currentSchema.fields.filter((f: FieldConfig) => ['HEADER', 'TECHNICAL', 'LOGISTICS'].includes(f.section || '')).map(renderField)}
                            {needsColdChain && (<><div className="col-span-12 flex items-center gap-2 pb-2 border-b border-sky-100 mt-2 mb-[-5px] bg-sky-50/50 p-2 rounded-t-lg -mx-2"><Icon name="snowflake" size={14} className="text-sky-500"/><span className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Cadena de Frío (Dec. 1782)</span></div>{currentSchema.fields.filter((f: FieldConfig) => f.section === 'COLD_CHAIN').map(renderField)}</>)}
                        </div>
                        
                        {formError && <div className="mt-6 p-3 bg-red-100 text-red-800 rounded-lg text-sm font-bold text-center border border-red-200 flex items-center justify-center gap-2"><Icon name="alert-circle"/> {formError}</div>}
                        
                        <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-slate-100">
                            {!isReportingIssue ? (
                                <>
                                    <button tabIndex={3} onClick={() => setIsReportingIssue(true)} className="px-5 py-2.5 rounded-lg border-2 border-slate-200 text-slate-500 font-bold hover:text-red-600 hover:bg-red-50 transition-all flex items-center gap-2 text-sm"><Icon name="alert-triangle" size={16}/> Reportar Riesgo</button>
                                    <button 
                                        tabIndex={2} 
                                        onClick={() => handleAddProduct(true)} 
                                        disabled={cumValidationState === 'EXPIRED'}
                                        className={`px-8 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2 text-sm transition-all ${cumValidationState === 'EXPIRED' ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                    >
                                        <Icon name="check" size={18}/> REGISTRAR CONFORME
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 bg-red-50 p-4 rounded-xl border border-red-100 animate-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-[10px] font-black text-red-800 uppercase mb-1">MOTIVO DE LA MEDIDA</label><select className="w-full h-9 rounded border-red-200 text-red-900 text-sm font-bold bg-white" value={newProduct.riskFactor} onChange={e=>setNewProduct({...newProduct, riskFactor: e.target.value as RiskFactor})}><option value="NINGUNO">Seleccione...</option><option value="VENCIDO">VENCIDO</option><option value="USO_INSTITUCIONAL">USO INSTITUCIONAL</option><option value="SIN_REGISTRO">SIN REGISTRO / CONTRABANDO</option><option value="FRAUDULENTO">FRAUDULENTO (FALSIFICADO)</option><option value="ALTERADO">ALTERADO (FÍSICO-QUÍMICO)</option><option value="MAL_ALMACENAMIENTO">MAL ALMACENAMIENTO (Temp/Humedad)</option><option value="MUESTRA_MEDICA">MUESTRA MÉDICA (PROHIBIDA VENTA)</option></select></div>
                                        <div><label className="block text-[10px] font-black text-red-800 uppercase mb-1">MEDIDA SANITARIA</label><select className="w-full h-9 rounded border-red-200 text-red-900 text-sm font-bold bg-white" value={newProduct.seizureType} onChange={e=>setNewProduct({...newProduct, seizureType: e.target.value as SeizureType})}><option value="NINGUNO">Seleccione...</option><option value="CONGELAMIENTO">CONGELAMIENTO (RETENCIÓN PREVENTIVA)</option><option value="DECOMISO">DECOMISO (INCAUTACIÓN)</option><option value="DESNATURALIZACION">DESTRUCCIÓN / DESNATURALIZACIÓN</option></select></div>
                                    </div>
                                    
                                    {newProduct.seizureType !== 'NINGUNO' && (
                                        <div className="mb-4">
                                            <SeizureCalculator 
                                                onCalculate={handleCalculatorUpdate}
                                                cum={newProduct.cum}
                                                presentation={newProduct.presentation}
                                                pharmaceuticalForm={newProduct.pharmaceuticalForm} 
                                                isVerified={cumSearchStatus === 'FOUND'} 
                                            />
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <div className={`p-3 border rounded-lg flex items-center justify-between transition-colors ${evidenceTemp ? 'bg-green-50 border-green-200' : 'bg-white/60 border-red-100'}`}>
                                            <div><h5 className={`text-[10px] font-black uppercase ${evidenceTemp ? 'text-green-800' : 'text-red-900'}`}>{evidenceTemp ? 'EVIDENCIA ADJUNTA CORRECTAMENTE' : 'EVIDENCIA PROBATORIA (OBLIGATORIO)'}</h5><p className={`text-[9px] ${evidenceTemp ? 'text-green-700' : 'text-red-700'}`}>{evidenceTemp ? 'Prueba fotográfica vinculada.' : 'Requerimiento Legal (Ley 9/79).'}</p></div>
                                            <button onClick={handlePhotoClick} className={`px-3 py-1.5 border rounded font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${evidenceTemp ? 'bg-white text-green-700 border-green-200 hover:bg-green-50' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}><Icon name={evidenceTemp ? "check" : "camera"} size={14}/> {evidenceTemp ? "Ver/Cambiar Foto" : "Adjuntar Foto"}</button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 mt-4"><button onClick={() => setIsReportingIssue(false)} className="text-slate-500 font-bold text-xs underline">Cancelar</button><button onClick={() => handleAddProduct(false)} className="px-6 py-2 rounded-lg bg-red-600 text-white font-bold text-sm shadow-md">CONFIRMAR HALLAZGO</button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* LISTA DE PRODUCTOS */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Historial Reciente</h4>
                    {products.length === 0 && <div className="text-center p-6 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl text-sm">No hay productos registrados en esta visita.</div>}
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-3"><div className={`w-2 h-10 rounded-full ${p.riskFactor === 'NINGUNO' ? 'bg-emerald-400' : 'bg-red-500'}`}></div><div><div className="font-bold text-slate-700 text-sm">{p.name}</div><div className="text-[10px] text-slate-500 font-mono uppercase">LOTE: {p.lot || 'N/A'} • {p.subtype?.replace('_', ' ')}</div></div></div>
                            <div className="flex items-center gap-4">
                                {p.riskFactor !== 'NINGUNO' && !p.hasEvidence && (<button onClick={() => triggerEvidenceCheck(p.id)} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-red-100"><Icon name="camera" size={12}/> Falta Foto</button>)}
                                <div className="text-right">
                                    <span className="font-black text-slate-800 text-sm block">{p.packLabel}</span>
                                    {p.logistics?.totals?.logisticVolume && (p.logistics.totals.logisticVolume > 0) ? (
                                        <span className="text-[10px] font-bold text-blue-600 block bg-blue-50 px-1 rounded">
                                            Total: {p.logistics.totals.logisticVolume} {p.logistics.totals.logisticUnit}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] text-slate-400 italic block">
                                            (Inventario Manual)
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => removeProduct(p.id)} className="text-slate-300 hover:text-red-500 p-2"><Icon name="trash" size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
                    <Button variant="secondary" onClick={() => setCurrentTab('DIAGNOSTICO')}>Atrás</Button>
                    {hasSeizures ? <Button className="bg-orange-600 text-white" onClick={() => setCurrentTab('CUSTODIA')}>Ir a Custodia <Icon name="shield"/></Button> : <Button className="bg-slate-900 text-white" onClick={() => setCurrentTab('CIERRE')}>Finalizar <Icon name="check"/></Button>}
                </div>
            </div>
            )}

            {/* 3. CUSTODIA (LOGÍSTICA) */}
            {currentTab === 'CUSTODIA' && hasSeizures && (
                <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm flex gap-3"><div className="bg-orange-100 p-2 rounded-full text-orange-600 h-fit"><Icon name="shield-alert" size={24}/></div><div><h3 className="font-black text-orange-900 uppercase">Protocolo de Cadena de Custodia</h3><p className="text-sm text-orange-800 mt-1">Se han generado medidas sanitarias. Diligencie la logística.</p></div></div>
                    
                    <Card title="1. Estación de Embalaje (Individualización)" icon="box">
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-3 items-end">
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Embalaje</label><select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-bold" value={newContainer.type} onChange={e => setNewContainer({...newContainer, type: e.target.value})}><option value="BOLSA_SEGURIDAD">BOLSA DE SEGURIDAD</option><option value="CAJA_SELLADA">CAJA DE CARTÓN SELLADA</option><option value="NEVERA_PORTATIL">NEVERA / CONTENEDOR FRÍO</option><option value="SOBRE_MANILA">SOBRE DE MANILA (Documentos)</option></select></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Código / Precinto</label><input className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-bold" placeholder="Ej: B-10293..." value={newContainer.code} onChange={e => setNewContainer({...newContainer, code: e.target.value})} /></div>
                                <button onClick={addContainer} className="h-10 px-4 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 flex items-center gap-2"><Icon name="plus" size={16}/> Crear</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-black text-red-600 uppercase mb-3 flex items-center gap-2"><Icon name="alert-circle" size={14}/> Por Empacar</h4>
                                    <div className="space-y-2">
                                        {products.filter(p => p.seizureType !== 'NINGUNO' && !p.containerId).map(p => (
                                            <div key={p.id} className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                                                <p className="font-bold text-red-800">{p.name}</p>
                                                <div className="flex justify-between items-end mt-1">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-red-700">{p.packLabel || `${p.quantity} Und.`}</p>
                                                        {p.logistics?.totals?.logisticVolume && (
                                                            <p className="text-[9px] text-red-500 font-mono">Vol: {p.logistics.totals.logisticVolume} {p.logistics.totals.logisticUnit}</p>
                                                        )}
                                                        <p className="text-[9px] text-red-400 italic mt-0.5">{p.seizureType}</p>
                                                    </div>
                                                    {containers.length > 0 ? (
                                                        <select className="w-24 h-7 px-1 rounded border border-red-200 text-[9px] font-bold text-slate-600" onChange={(e) => assignItemToContainer(p.id, e.target.value)} defaultValue="">
                                                            <option value="" disabled>Empacar...</option>
                                                            {containers.map(c => <option key={c.id} value={c.id}>{c.code.slice(-4)}</option>)}
                                                        </select>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                        {products.filter(p => p.seizureType !== 'NINGUNO' && !p.containerId).length === 0 && <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">Todos items asignados ✅</div>}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-teal-600 uppercase mb-3 flex items-center gap-2"><Icon name="package" size={14}/> Embalaje Listo</h4>
                                    <div className="space-y-3">
                                        {containers.map(c => (
                                            <div key={c.id} className="p-3 bg-teal-50 border border-teal-200 rounded-lg relative group">
                                                <button onClick={() => removeContainer(c.id)} className="absolute top-2 right-2 text-teal-300 hover:text-red-500"><Icon name="x" size={14}/></button>
                                                <div className="flex items-center gap-2 mb-2"><Icon name="archive" size={16} className="text-teal-600"/><div><p className="font-bold text-teal-900 text-xs">{c.type.replace('_', ' ')}</p><p className="font-mono text-[10px] text-teal-700 font-bold bg-white px-1.5 rounded inline-block border border-teal-100">{c.code}</p></div></div>
                                                <div className="space-y-1 pl-6 border-l-2 border-teal-200">
                                                    {products.filter(p => p.containerId === c.id).map(p => (
                                                        <div key={p.id} className="flex justify-between items-center text-[10px]">
                                                            <span className="text-teal-800 truncate w-3/4">{p.quantity}x {p.name}</span>
                                                            <button onClick={() => unassignItem(p.id)} className="text-teal-400 hover:text-red-500"><Icon name="minus-circle" size={12}/></button>
                                                        </div>
                                                    ))}
                                                    {products.filter(p => p.containerId === c.id).length === 0 && <span className="text-[9px] text-teal-400 italic">Vacío</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {containers.length === 0 && <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">No hay contenedores creados</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card title="2. Logística de Transporte" icon="truck">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Modalidad de Transporte</label><select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-bold bg-white" value={custodyData.transportType} onChange={e => setCustodyData({...custodyData, transportType: e.target.value})}><option value="INSTITUCIONAL">VEHÍCULO OFICIAL (Entidad)</option><option value="CONTRATISTA">LOGÍSTICA CONTRATADA</option><option value="TERCERO">EMPRESA DE TRANSPORTE (Guía)</option></select></div>
                            <Input label="Lugar de Depósito Final" value={custodyData.depositLocation} onChange={e => setCustodyData({...custodyData, depositLocation: e.target.value})} placeholder="Ej: BODEGA CENTRAL DE EVIDENCIAS" />
                            {custodyData.transportType !== 'INSTITUCIONAL' && (<Input label="Empresa Transportadora" value={custodyData.transportCompany} onChange={e => setCustodyData({...custodyData, transportCompany: e.target.value})} placeholder="Nombre de la empresa" />)}
                            <Input label="Placa del Vehículo" value={custodyData.transportPlate} onChange={e => setCustodyData({...custodyData, transportPlate: e.target.value})} placeholder="Ej: OBF-123" />
                            <Input label="Nombre del Conductor / Responsable" value={custodyData.driverName} onChange={e => setCustodyData({...custodyData, driverName: e.target.value})} placeholder="Nombre completo" />
                        </div>
                    </Card>

                    <div className="flex justify-between mt-6">
                        <Button variant="secondary" onClick={() => setCurrentTab('PRODUCTOS')}>Atrás</Button>
                        <Button onClick={() => setCurrentTab('CIERRE')} className="bg-slate-900 text-white">Confirmar Custodia y Cerrar <Icon name="lock"/></Button>
                    </div>
                </div>
            )}

            {/* 4. CIERRE */}
            {currentTab === 'CIERRE' && (
                <div className="animate-in fade-in zoom-in-95 space-y-6">
                    <div className={`p-6 rounded-2xl shadow-xl border border-white/10 text-center ${concept === 'FAVORABLE' ? 'bg-slate-800 text-white' : 'bg-red-800 text-white'}`}>
                        <div className="text-xs uppercase tracking-[0.3em] opacity-80 mb-2">Concepto Técnico Emitido</div>
                        <div className="text-4xl font-black mb-4">{concept.replace('_', ' ')}</div>
                        <div className="w-full bg-black/30 h-4 rounded-full overflow-hidden max-w-md mx-auto">
                        <div className={`h-full transition-all duration-1000 ${score < 60 ? 'bg-red-400' : 'bg-teal-400'}`} style={{ width: `${score}%` }}></div>
                        </div>
                        <p className="mt-2 text-sm font-bold opacity-80">Cumplimiento Normativo: {score}%</p>
                    </div>

                    <Card title="Narrativa Técnica y Legal de la Actuación" icon="book-open">
                        <div className="space-y-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                <p className="text-xs text-blue-800 leading-relaxed text-justify">
                                    <strong>INSTRUCCIÓN:</strong> El inspector debe relatar de manera cronológica y detallada los hechos ocurridos durante la visita, describiendo las condiciones sanitarias encontradas y motivando técnica y jurídicamente las decisiones tomadas (Art. 35 CPACA).
                                </p>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Relato de los Hechos (Descripción Detallada)</label>
                                    <button onClick={() => toggleListening('narrative', setInspectionNarrative)} className={`p-1 rounded-full transition-colors ${isListening === 'narrative' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-blue-600'}`} title="Dictar por voz"><Icon name="mic" size={14}/></button>
                                </div>
                                <textarea 
                                    className="w-full p-3 rounded-lg border-2 border-slate-200 text-sm font-medium focus:border-blue-500 outline-none min-h-[150px]"
                                    placeholder="Describa: Condiciones de ingreso, recorrido, hallazgos principales, actitud del vigilado..."
                                    value={inspectionNarrative}
                                    onChange={(e) => setInspectionNarrative(e.target.value)}
                                />
                            </div>
                            {hasSeizures && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">2. Fundamentos Jurídicos de la Medida Sanitaria</label>
                                        <button onClick={() => toggleListening('legal', setLegalBasis)} className={`p-1 rounded-full transition-colors ${isListening === 'legal' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-blue-600'}`} title="Dictar por voz"><Icon name="mic" size={14}/></button>
                                    </div>
                                    <textarea 
                                        className="w-full p-3 rounded-lg border-2 border-red-200 bg-red-50/30 text-sm font-medium focus:border-red-500 outline-none min-h-[100px]"
                                        placeholder="Cite las normas específicas infringidas (Ley 9/79, Decreto 677/95...) que sustentan la medida..."
                                        value={legalBasis}
                                        onChange={(e) => setLegalBasis(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="Formalización Legal" icon="gavel">
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones del Vigilado (Derecho de Contradicción)</label>
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Art. 29 CPACA</span>
                                    </div>
                                    <button onClick={() => toggleListening('citizen', setCitizenObservation)} className={`p-1 rounded-full transition-colors ${isListening === 'citizen' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-blue-600'}`} title="Dictar por voz"><Icon name="mic" size={14}/></button>
                                </div>
                                <textarea 
                                    className="w-full p-4 rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-blue-500 outline-none min-h-[100px]"
                                    placeholder="Espacio para que el atendido consigne sus descargos o inconformidades frente a la diligencia..."
                                    value={citizenObservation}
                                    onChange={(e) => setCitizenObservation(e.target.value)}
                                />
                            </div>

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-justify">
                                <h4 className="text-xs font-black text-slate-700 uppercase mb-2 text-center">Declaración de Cierre</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Siendo la hora registrada en el sistema, se da por terminada la presente diligencia de Inspección, Vigilancia y Control. 
                                    Se deja constancia de que se ha garantizado el debido proceso, informando al interesado sobre los hallazgos encontrados y las medidas sanitarias aplicadas (si las hubiere).
                                    <br/><br/>
                                    <strong>NOTIFICACIÓN:</strong> La presente acta se entiende notificada en estrados al finalizar la diligencia. Contra el concepto técnico emitido proceden los recursos de ley conforme al Código de Procedimiento Administrativo y de lo Contencioso Administrativo (CPACA).
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                                <div className="flex flex-col h-full justify-between">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Funcionario Responsable (IVC)</p>
                                    <div className="border-2 border-slate-200 rounded-xl flex-1 min-h-[160px] flex flex-col items-center justify-center bg-slate-50">
                                        <Icon name="user-check" size={32} className="text-teal-600 mb-2"/>
                                        <p className="font-black text-slate-700 text-sm">INSPECTOR VIGISALUD</p>
                                        <p className="text-[10px] text-slate-400 font-bold">Firma Digital Autenticada</p>
                                    </div>
                                </div>

                                <div className="flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{refusalToSign ? 'Firma de Testigo' : `Firma de: ${contextData?.attendedBy?.slice(0,15)}...`}</p>
                                        <button 
                                            onClick={() => setRefusalToSign(!refusalToSign)}
                                            className={`text-[9px] font-bold px-2 py-1 rounded border transition-colors ${refusalToSign ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-600'}`}
                                        >
                                            {refusalToSign ? 'Cancelar Renuencia' : '¿Se niega a firmar?'}
                                        </button>
                                    </div>

                                    <div className="flex-1 min-h-[160px]">
                                        {!refusalToSign ? (
                                            <SignaturePad onChange={(data) => setSignature(data)} label="Firma en pantalla" />
                                        ) : (
                                            <div className="h-full flex flex-col gap-3 animate-in fade-in">
                                                <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-[10px] text-red-700 font-bold text-center">
                                                    Protocolo de Renuencia: Firma de testigo requerida.
                                                </div>
                                                <Input label="Nombre Testigo" value={witness.name} onChange={e => setWitness({...witness, name: e.target.value})} placeholder="Nombre completo" />
                                                <Input label="Cédula Testigo" value={witness.id} onChange={e => setWitness({...witness, id: e.target.value})} placeholder="No. Documento" />
                                                <div className="flex-1">
                                                        <SignaturePad onChange={(data) => setWitness({...witness, signature: data})} label="Firma del Testigo" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="flex justify-between mt-6">
                        <Button variant="secondary" onClick={() => setCurrentTab(hasSeizures ? 'CUSTODIA' : 'PRODUCTOS')}>Atrás</Button>
                        <Button onClick={() => handleReviewDraft()} className="bg-slate-900 text-white shadow-xl" disabled={loading}>
                        {loading ? "Generando Borrador..." : "REVISAR Y FINALIZAR ACTA"}
                        </Button>
                    </div>
                </div>
            )}
        </div>

      {/* --- MODALES --- */}

      {showCumModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setShowCumModal(false)}></div>
            <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
                <div className="bg-slate-900 p-4 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Icon name="database" size={20}/></div>
                        <div>
                            <h3 className="font-bold text-sm uppercase tracking-wide">Base de Datos Maestra INVIMA</h3>
                            <p className="text-[10px] opacity-70">Consulta en tiempo real</p>
                        </div>
                    </div>
                    <button onClick={() => setShowCumModal(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><Icon name="x" size={20}/></button>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="relative">
                        <input 
                            autoFocus 
                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 text-lg font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none" 
                            placeholder="Buscar por Nombre, Principio Activo, Expediente o CUM..." 
                            value={cumQuery} 
                            onChange={(e) => { setCumQuery(e.target.value); }}
                        />
                        <div className="absolute left-4 top-3.5 text-slate-400"><Icon name="search" size={20}/></div>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Icon name="check" size={12}/> Búsqueda Inteligente</span>
                        <span className="flex items-center gap-1"><Icon name="database" size={12}/> {cumResults.length} Resultados encontrados</span>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-100 p-4 min-h-[300px]">
                    <div className="space-y-2">
                        {cumResults.map(r => (
                            <button key={r.id} onClick={() => selectFromModal(r)} className="w-full bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all text-left group flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-black text-sm text-slate-800 group-hover:text-blue-700">{r.producto}</h4>
                                        <Badge label={r.estadoregistro} variant={r.estadoregistro === 'Vigente' ? 'success' : 'danger'} className="text-[10px]"/>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">{r.titular} • <span className="font-mono bg-slate-100 px-1 rounded">{r.registrosanitario}</span></p>
                                    <div className="mt-2 flex gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                        <span>Principio: {r.principioactivo}</span>
                                        <span>CUM: {r.expediente}-{r.consecutivocum}</span>
                                    </div>
                                </div>
                                <div className="text-slate-300 group-hover:text-blue-500"><Icon name="chevron-right" size={20}/></div>
                            </button>
                        ))}
                        {cumResults.length === 0 && !isSearchingCum && (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                                <Icon name="search" size={48} className="mb-4 opacity-20"/>
                                <p className="font-medium">Ingrese términos para buscar en el catálogo oficial.</p>
                                <p className="text-xs mt-1">Puede buscar por nombre comercial, principio activo o código CUM.</p>
                            </div>
                        )}
                        {isSearchingCum && (
                            <div className="h-64 flex flex-col items-center justify-center text-blue-500">
                                <Icon name="loader" size={48} className="mb-4 animate-spin"/>
                                <p className="font-bold animate-pulse">Consultando Base de Datos...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>, document.body
      )}

      {showEvidenceModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-amber-200 overflow-hidden">
                <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full text-amber-600"><Icon name="alert-triangle" size={24}/></div>
                    <div>
                        <h3 className="font-black text-amber-900 uppercase leading-none">Requerimiento Legal</h3>
                        <p className="text-[10px] font-bold text-amber-700 mt-1">Ley 9 de 1979 - Art. 576</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 font-medium">Para soportar la medida sanitaria se requiere <strong>evidencia probatoria documental</strong>.</p>
                    <p className="text-sm text-slate-600">¿Desea adjuntar la fotografía del hallazgo ahora?</p>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                    <button onClick={handlePhotoClick} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">
                        <Icon name="camera" size={18}/> Sí, abrir cámara ahora
                    </button>
                    <button onClick={() => commitProduct(false)} className="w-full py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-xs">
                        No, agregar como PENDIENTE (Bloquea cierre)
                    </button>
                </div>
            </div>
        </div>, document.body
      )}

      {showBlockModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden">
                <div className="bg-red-500 p-6 text-white text-center">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4"><Icon name="lock" size={32}/></div>
                    <h3 className="text-xl font-black uppercase">Cierre Bloqueado</h3>
                    <p className="text-red-100 text-sm font-bold mt-1">Seguridad Jurídica Activada</p>
                </div>
                <div className="p-6 text-center space-y-4">
                    <p className="text-slate-600 font-medium">No puede cerrar el acta porque existen <strong>hallazgos con medida sanitaria SIN evidencia probatoria</strong>.</p>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-red-800 font-bold">Por favor revise la lista de productos y adjunte las fotos pendientes (Botones Rojos).</div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button onClick={() => setShowBlockModal(false)} className="w-full py-3 bg-white text-slate-700 font-bold rounded-xl border-2 border-slate-200 hover:border-slate-300">Entendido, volver a la lista</button>
                </div>
            </div>
        </div>, document.body
      )}

       {showDraftModal && createPortal(
         <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                 <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                     <div>
                         <h3 className="font-bold text-lg">Vista Previa del Acta (Borrador)</h3>
                         <p className="text-xs text-slate-400">Revise cuidadosamente antes de firmar y cerrar. Esta acción es irreversible.</p>
                     </div>
                     <button onClick={() => setShowDraftModal(false)}><Icon name="x" size={24}/></button>
                 </div>
                 
                 <div className="flex-1 bg-slate-200 p-4 relative">
                     {pdfBlobUrl ? (
                         <iframe src={pdfBlobUrl ?? undefined} className="w-full h-full rounded shadow-lg border border-slate-300" title="PDF Preview"></iframe>
                     ) : (
                         <div className="flex items-center justify-center h-full">Generando PDF...</div>
                     )}
                 </div>

                 <div className="p-4 border-t border-slate-200 flex justify-end gap-4 bg-white">
                     <Button variant="secondary" onClick={() => setShowDraftModal(false)}>
                         <Icon name="edit-2" size={18}/> Corregir / Volver
                     </Button>
                     <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleFinalizeInspection} disabled={loading}>
                         <Icon name="check-circle" size={18}/> {loading ? "Guardando..." : "APROBAR Y FINALIZAR"}
                     </Button>
                 </div>
             </div>
         </div>, document.body
       )}

      {/* INPUT FILE OCULTO - CRÍTICO PARA FUNCIONAMIENTO DE FOTOS */}
      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange}
      />

    </div>
  );
};