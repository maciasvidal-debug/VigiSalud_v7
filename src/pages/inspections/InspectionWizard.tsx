import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateDistance, generateActId } from '../../utils/geo';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { InspectionForm } from './InspectionForm'; 
import { useToast } from '../../context/ToastContext'; 
import { ConfirmModal } from '../../components/ui/ConfirmModal'; 
import { Input } from '../../components/ui/Input';
import type { ComplaintType } from '../../types';

export const InspectionWizard: React.FC = () => {
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // --- ESTADOS LÓGICOS ---
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gpsState, setGpsState] = useState<'IDLE' | 'CALCULATING' | 'SUCCESS' | 'ERROR' | 'BLOCKED'>('IDLE');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  
  // Estados para búsqueda de personas
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Modales
  const [showContingencyModal, setShowContingencyModal] = useState(false);
  const [showFailedVisitModal, setShowFailedVisitModal] = useState(false);

  // Estado de Actuación (AMPLIADO PARA LÓGICA CONTEXTUAL)
  const [actData, setActData] = useState({
    actId: '',
    motive: 'PROGRAMACION', 
    status: 'ATENDIDA',     
    // Datos Contextuales (Ley 1755)
    radicado: '',
    // Se permite '' inicial para el control del select, pero se saneará al enviar
    complaintType: '' as ComplaintType | '', 
    complaintDesc: '',
    // Datos de Atención
    attendedBy: '',
    attendedId: '',
    attendedRole: '',
    gpsBypass: false 
  });

  const [isManualAttendant, setIsManualAttendant] = useState(false);

  const establishment = useLiveQuery(
    () => db.establishments.get(Number(establishmentId)),
    [establishmentId]
  );

  // --- FUNCIÓN DE INTELIGENCIA: DETECTOR DE PERSONA JURÍDICA ---
  const isCorporateEntity = (name?: string): boolean => {
    if (!name) return false;
    const corporateSignals = /\b(SAS|S\.A\.S|LTDA|LIMITADA|S\.A|INC|CORPORATION|AGENCIA|INVERSIONES|DISTRIBUCIONES|CONSORCIO|UNION TEMPORAL)\b/i;
    return corporateSignals.test(name);
  };

  // --- LÓGICA PREDICTIVA ---
  const handlePersonSearch = async (text: string) => {
    setActData(prev => ({ ...prev, attendedBy: text.toUpperCase() }));
    if (text.length < 3) { setSuggestions([]); return; }
    
    const uniqueNames = new Set<string>();
    const upperText = text.toUpperCase();
    
    await db.establishments
      .filter(est => (est.responsibleName?.includes(upperText) ?? false) || (est.techDirectorName?.includes(upperText) ?? false))
      .each(est => {
        // Filtramos empresas para que no aparezcan como personas que atienden
        if (est.responsibleName?.includes(upperText) && !isCorporateEntity(est.responsibleName)) {
            uniqueNames.add(est.responsibleName);
        }
        if (est.techDirectorName?.includes(upperText)) {
            uniqueNames.add(est.techDirectorName);
        }
      });
      
    setSuggestions(Array.from(uniqueNames).slice(0, 5));
    setShowSuggestions(true);
  };

  const selectSuggestion = (name: string) => {
    setActData(prev => ({ ...prev, attendedBy: name }));
    setShowSuggestions(false);
  };

  const selectKeyActor = (role: string, name: string, id: string) => {
    setActData(prev => ({ ...prev, attendedBy: name, attendedId: id, attendedRole: role }));
    setIsManualAttendant(false);
  };

  const enableManualAttendant = () => {
    setActData(prev => ({ ...prev, attendedBy: '', attendedId: '', attendedRole: '' }));
    setIsManualAttendant(true);
  };

  // --- VALIDACIÓN DE PASO 2 (CONTEXTO LEGAL) ---
  const validateStep2 = () => {
    if (actData.motive === 'QUEJA') {
      if (!actData.radicado) { showToast("⚠️ Debe ingresar el Radicado de la Denuncia/Queja.", "warning"); return false; }
      if (!actData.complaintType) { showToast("⚠️ Debe tipificar el hecho de la denuncia.", "warning"); return false; }
      if (!actData.complaintDesc) { showToast("⚠️ Debe describir brevemente los hechos.", "warning"); return false; }
    }
    if (actData.motive === 'SOLICITUD') {
      if (!actData.radicado) { showToast("⚠️ Debe ingresar el Radicado de la Solicitud.", "warning"); return false; }
    }
    
    if (!actData.attendedBy || !actData.attendedId || !actData.attendedRole) {
      showToast("⚠️ Debe identificar plenamente a quien atiende la visita.", "warning");
      return false;
    }
    return true;
  };

  // --- ALGORITMO DE VALIDACIÓN DE PRESENCIA (GPS) ---
  useEffect(() => {
    if (step === 1 && establishment) {
      setActData(prev => ({ ...prev, actId: generateActId(establishment.daneCode || '00000') }));
      setGpsState('CALCULATING');
      setDistance(null); 
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (establishment.lat && establishment.lng) {
            const dist = calculateDistance(position.coords.latitude, position.coords.longitude, establishment.lat, establishment.lng);
            setDistance(Math.round(dist));
            
            if (dist > 200) {
              setGpsState('ERROR');
              setGpsErrorMsg("ALERTA DE INTEGRIDAD: Ubicación distante del predio registrado.");
            } else {
              setGpsState('SUCCESS');
            }
          } else {
            setDistance(-1); 
            setGpsState('ERROR'); 
            setGpsErrorMsg("SIN REFERENCIA TÉCNICA: El predio no tiene coordenadas. Requiere validación jurada.");
          }
        },
        (error) => {
          if (error.code === 1) { 
            setGpsState('BLOCKED');
            setGpsErrorMsg("GEOLOCALIZACIÓN REQUERIDA: Permiso denegado.");
          } else {
            setGpsState('ERROR');
            setGpsErrorMsg("FALLO DE CERTIFICACIÓN GPS: No se pudo validar presencia.");
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, [step, establishment]);

  const confirmFailedVisit = async () => {
    setShowFailedVisitModal(false);
    showToast(`✅ Constancia generada. Radicado: ${actData.actId}`, 'success');
    navigate('/dashboard/inspections');
  };

  const executeContingency = () => {
    setShowContingencyModal(false);
    setActData(prev => ({ ...prev, gpsBypass: true }));
    showToast("⚠️ ALERTA LEGAL: Excepción de ubicación registrada.", 'warning');
    setStep(2);
  };

  const renderGpsStatus = () => {
    switch (gpsState) {
      case 'CALCULATING': return <div className="flex items-center gap-2 text-teal-600 font-bold uppercase text-xs animate-pulse"><Icon name="loader-2" size={14} className="animate-spin" /> Verificando...</div>;
      case 'SUCCESS': return <span className="text-teal-600 font-black text-xl">{distance} METROS</span>;
      case 'BLOCKED': return <span className="text-red-600 font-black text-sm">ACCESO DENEGADO</span>;
      case 'ERROR': 
        if (distance === -1) return <span className="text-orange-600 font-bold text-sm">SIN DATOS PREVIOS</span>;
        return <span className="text-red-600 font-black text-sm">FUERA DE RANGO ({distance}m)</span>;
      default: return null;
    }
  };

  if (!establishment) return <div className="p-10 text-center font-bold text-slate-400">Cargando expediente...</div>;

  return (
    <>
      {/* MODAL DE DECLARACIÓN JURADA (PORTAL GLASSMORPHISM) */}
      {showContingencyModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xl transition-all duration-500"
            onClick={() => setShowContingencyModal(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.6)]"></div>
            <div className="flex flex-col items-center p-8 pb-4 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.2)] animate-pulse">
                <Icon name="gavel" size={32} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-md">Declaración Jurada</h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Protocolo de Excepción Legal</p>
            </div>
            <div className="px-8 py-4 space-y-6">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-justify text-sm leading-relaxed text-slate-300">
                <p className="mb-4">
                  De conformidad con el <strong className="text-red-400 border-b border-red-500/30 pb-0.5">Artículo 286 del Código Penal Colombiano</strong> (Falsedad Ideológica en Documento Público), el servidor público que consigne una falsedad o calle la verdad incurrirá en prisión.
                </p>
                <p>
                  Al continuar, usted <strong className="text-white">CERTIFICA BAJO LA GRAVEDAD DE JURAMENTO</strong> que se encuentra físicamente presente en las instalaciones del vigilado, subsanando la falta de validación técnica automática.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-black/40 p-4 border border-white/5">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Establecimiento</p>
                  <p className="font-bold text-white uppercase text-sm mt-0.5">{establishment.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">NIT</p>
                  <p className="font-mono text-xs text-slate-300 mt-0.5">{establishment.nit}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-2 bg-black/20">
              <button 
                onClick={() => setShowContingencyModal(false)}
                className="flex-1 rounded-xl border border-white/10 bg-transparent py-4 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-colors uppercase tracking-wide"
              >
                Cancelar
              </button>
              <button 
                onClick={executeContingency}
                className="flex-[1.5] rounded-xl bg-red-600 py-4 text-xs font-black text-white shadow-lg shadow-red-900/30 hover:bg-red-500 transition-all flex items-center justify-center gap-2 uppercase tracking-wide border border-white/10 active:scale-[0.98]"
              >
                <Icon name="shield-check" size={16} /> Asumo Responsabilidad
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={showFailedVisitModal}
        title="Declarar Visita Fallida"
        message="Se generará una constancia administrativa de impedimento. Este documento tiene pleno valor probatorio."
        onConfirm={confirmFailedVisit}
        onCancel={() => setShowFailedVisitModal(false)}
        confirmText="Firmar Constancia"
        type="danger"
      />

      {step === 1 && (
        <div className="max-w-xl mx-auto pt-10 px-4 space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 transition-all duration-500 ${gpsState === 'CALCULATING' ? 'bg-slate-50 border-slate-200' : gpsState === 'SUCCESS' ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-500 scale-110'}`}>
              <Icon name={gpsState === 'BLOCKED' ? 'lock' : 'map-pin'} size={32} className={gpsState === 'CALCULATING' ? "text-slate-400 animate-bounce" : gpsState === 'SUCCESS' ? "text-teal-500" : "text-red-600"} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Validación de Territorio</h1>
            <p className="text-slate-500 font-medium">Protocolo de Seguridad Jurídica (Ley 1437/2011)</p>
          </div>

          <Card className={`border-l-4 shadow-lg transition-all ${gpsState === 'SUCCESS' ? 'border-teal-500' : gpsState === 'CALCULATING' ? 'border-slate-300' : 'border-red-600 ring-2 ring-red-50'}`}>
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Objetivo</span>
                <span className="font-bold text-slate-800 text-sm">{establishment.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Certificación Satelital</span>
                {renderGpsStatus()}
              </div>
              
              {gpsErrorMsg && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm flex gap-3 items-start animate-in slide-in-from-top-2">
                  <div className="bg-red-100 p-2 rounded-full shrink-0 text-red-700 mt-1"><Icon name="alert-octagon" size={20} /></div>
                  <div>
                    <h4 className="font-black text-red-800 text-xs uppercase mb-1">Impedimento Legal Detectado</h4>
                    <p className="text-xs text-red-700 leading-relaxed font-medium mb-2">{gpsErrorMsg}</p>
                    <div className="text-[10px] text-red-600 bg-white/60 p-2 rounded border border-red-100">
                      <strong>Fundamento:</strong> Principio de Integridad y Autenticidad Documental.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-3 pt-4">
            {gpsState === 'SUCCESS' && (
              <Button onClick={() => setStep(2)} className="w-full py-4 shadow-xl shadow-teal-900/10 bg-teal-600 hover:bg-teal-700 text-white">
                Validación Exitosa: Iniciar Actuación <Icon name="arrow-right" />
              </Button>
            )}
            
            {(gpsState === 'BLOCKED' || gpsState === 'ERROR') && (
              <button onClick={() => setShowContingencyModal(true)} className="w-full bg-slate-800 hover:bg-red-900 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-slate-700 hover:border-red-950">
                <Icon name="shield-alert" /> Justificar Excepción (Declaración Jurada)
              </button>
            )}
            
            <Button variant="secondary" onClick={() => navigate(-1)} className="w-full">Cancelar y Regresar</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-xl mx-auto pt-10 px-4 space-y-6 animate-fade-in">
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Protocolo de Apertura</h1>
            <div className="inline-flex items-center gap-2 mt-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase">Radicado:</span>
              <span className="font-mono font-bold text-slate-700">{actData.actId}</span>
            </div>
            {actData.gpsBypass && (
              <div className="mt-3 text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 animate-pulse flex items-center justify-center gap-1 mx-auto w-fit">
                <Icon name="alert-triangle" size={10}/> EXCEPCIÓN ART. 286 C.P. (GPS OFF)
              </div>
            )}
          </div>

          <Card title="1. Estado del Establecimiento">
            <div className="grid grid-cols-3 gap-3">
              {['ATENDIDA', 'CERRADO', 'REHUSADO'].map((st) => (
                <button key={st} onClick={() => setActData({ ...actData, status: st })} className={`p-4 rounded-xl border-2 text-[10px] font-black tracking-wide uppercase transition-all shadow-sm ${actData.status === st ? (st === 'ATENDIDA' ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-teal-100' : 'border-red-500 bg-red-50 text-red-700 shadow-red-100') : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500'}`}>
                  {st}
                </button>
              ))}
            </div>
          </Card>

          {actData.status === 'ATENDIDA' ? (
            <>
              {/* --- 2. MOTIVACIÓN CONTEXTUAL (DISEÑO INTELIGENTE) --- */}
              <Card title="2. Motivación y Contexto Legal">
                <div className="space-y-4">
                  <div className="relative">
                    <select 
                      className="w-full p-4 rounded-xl border-2 border-slate-200 font-bold text-slate-700 outline-none focus:border-teal-500 appearance-none bg-white transition-colors" 
                      value={actData.motive} 
                      onChange={(e) => setActData({
                        ...actData, 
                        motive: e.target.value,
                        // Reset de campos dependientes al cambiar motivo
                        radicado: '',
                        complaintType: '',
                        complaintDesc: ''
                      })}
                    >
                      <option value="PROGRAMACION">📅 VIGILANCIA REGULAR (PROGRAMADA)</option>
                      <option value="QUEJA">⚠️ QUEJA O DENUNCIA CIUDADANA</option>
                      <option value="SOLICITUD">📩 SOLICITUD DE PARTE (TRÁMITE)</option>
                      <option value="EVENTO">🚑 EVENTO DE INTERÉS EN SALUD PÚBLICA</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Icon name="chevron-down" size={20} /></div>
                  </div>

                  {/* FORMULARIO CONDICIONAL: QUEJAS (IVC REACTIVO) */}
                  {actData.motive === 'QUEJA' && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-3 animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-2 border-b border-red-100 pb-2">
                        <Icon name="alert-triangle" size={16} className="text-red-500"/>
                        <span className="text-xs font-black text-red-700 uppercase">Contexto de la Denuncia</span>
                      </div>
                      
                      <Input 
                        label="No. Radicado PQRSD (Obligatorio)" 
                        value={actData.radicado} 
                        onChange={(e) => setActData({...actData, radicado: e.target.value})}
                        placeholder="Ej: 2024-REQ-00123"
                      />
                      
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tipificación del Hecho</label>
                        <select 
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-red-500 text-sm"
                          value={actData.complaintType}
                          onChange={(e) => setActData({...actData, complaintType: e.target.value as any})}
                        >
                          <option value="">Seleccione el motivo principal...</option>
                          <option value="CALIDAD_PRODUCTO">CALIDAD DE PRODUCTO (Vencido, Alterado)</option>
                          <option value="USO_RACIONAL">USO RACIONAL (Venta sin fórmula, Antibióticos)</option>
                          <option value="LEGALIDAD_CONTRABANDO">LEGALIDAD (Contrabando, Institucional)</option>
                          <option value="SERVICIO_TECNICO">SERVICIO FARMACÉUTICO (Mala atención, Errores)</option>
                          <option value="FARMACOVIGILANCIA">FARMACOVIGILANCIA (Reacción Adversa)</option>
                          <option value="OTRO">OTRO MOTIVO</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descripción de los Hechos</label>
                        <textarea 
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-red-500 outline-none min-h-[80px]"
                          placeholder="Resumen breve de la denuncia..."
                          value={actData.complaintDesc}
                          onChange={(e) => setActData({...actData, complaintDesc: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {/* FORMULARIO CONDICIONAL: SOLICITUD */}
                  {actData.motive === 'SOLICITUD' && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                       <Input 
                        label="No. Radicado de Solicitud (Trámite)" 
                        value={actData.radicado} 
                        onChange={(e) => setActData({...actData, radicado: e.target.value})}
                        placeholder="Ej: 2024-SOL-00567"
                      />
                    </div>
                  )}
                </div>
              </Card>

              <Card title="3. ¿Quién atiende la visita?">
                 <div className="space-y-4">
                   <p className="text-xs text-slate-500">Seleccione el actor registrado o identifique al encargado:</p>
                   
                   <div className="grid grid-cols-1 gap-2">
                      {/* LÓGICA DE PROTECCIÓN: SOLO MOSTRAR SI NO ES EMPRESA */}
                      {establishment.responsibleName && !isCorporateEntity(establishment.responsibleName) && (
                        <button 
                          onClick={() => selectKeyActor('REPRESENTANTE LEGAL', establishment.responsibleName, establishment.responsibleId || '')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${actData.attendedBy === establishment.responsibleName ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Representante Legal</span>
                              <span className="font-bold text-slate-800 text-sm">{establishment.responsibleName}</span>
                            </div>
                            {actData.attendedBy === establishment.responsibleName && <Icon name="check-circle" className="text-teal-600"/>}
                          </div>
                        </button>
                      )}

                      {/* ALERTA DISCRETA SI ES EMPRESA */}
                      {establishment.responsibleName && isCorporateEntity(establishment.responsibleName) && (
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-2 items-center text-xs text-amber-800">
                          <Icon name="info" size={14} className="text-amber-600" />
                          <span className="font-medium">El responsable registrado es una Persona Jurídica ({establishment.responsibleName}). Debe identificar manualmente a la persona natural.</span>
                        </div>
                      )}

                      {establishment.techDirectorName && (
                        <button 
                          onClick={() => selectKeyActor('DIRECTOR TÉCNICO', establishment.techDirectorName || '', establishment.techDirectorId || '')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${actData.attendedBy === establishment.techDirectorName ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Director Técnico</span>
                              <span className="font-bold text-slate-800 text-sm">{establishment.techDirectorName}</span>
                            </div>
                            {actData.attendedBy === establishment.techDirectorName && <Icon name="check-circle" className="text-teal-600"/>}
                          </div>
                        </button>
                      )}

                      <button 
                        onClick={enableManualAttendant}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${isManualAttendant ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                          <Icon name="user-plus" size={16}/> Otra Persona / Encargado
                        </div>
                      </button>
                   </div>

                   {isManualAttendant && (
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in slide-in-from-top-2 relative">
                       <div className="relative">
                         <Input 
                           label="Nombre Completo" 
                           value={actData.attendedBy} 
                           onChange={(e) => handlePersonSearch(e.target.value)}
                           onFocus={() => actData.attendedBy.length >= 3 && setShowSuggestions(true)}
                           onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                           placeholder="BUSCAR O ESCRIBIR..."
                         />
                         
                         {showSuggestions && suggestions.length > 0 && (
                           <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 z-50 overflow-hidden">
                             <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Sugerencias de la Base de Datos</div>
                             {suggestions.map((name, idx) => (
                               <div 
                                 key={idx} 
                                 onClick={() => selectSuggestion(name)} 
                                 className="px-4 py-3 hover:bg-teal-50 hover:text-teal-700 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0 transition-colors flex items-center gap-2"
                               >
                                 <Icon name="user" size={14} className="opacity-50"/> {name}
                               </div>
                             ))}
                           </div>
                         )}
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                         <Input 
                           label="Cédula" 
                           value={actData.attendedId} 
                           onChange={(e) => setActData({...actData, attendedId: e.target.value})}
                           placeholder="Ej: 1.140..."
                         />
                         <Input 
                           label="Cargo" 
                           value={actData.attendedRole} 
                           onChange={(e) => setActData({...actData, attendedRole: e.target.value.toUpperCase()})}
                           placeholder="Ej: EMPLEADO"
                         />
                       </div>
                     </div>
                   )}
                 </div>
              </Card>

              <Button 
                onClick={() => {
                  // VALIDACIÓN CENTRALIZADA ANTES DE AVANZAR
                  if (validateStep2()) {
                    setStep(3);
                  }
                }} 
                className="w-full py-4 shadow-xl text-base"
              >
                Iniciar Diligencia <Icon name="arrow-right" />
              </Button>
            </>
          ) : (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-4 shadow-inner">
               <div className="flex items-center gap-3 mb-2">
                 <div className="bg-red-100 p-2 rounded-lg text-red-600"><Icon name="camera-off" size={24} /></div>
                 <h3 className="font-black text-red-800 text-sm uppercase">Protocolo de Visita Fallida</h3>
               </div>
               <p className="text-xs text-slate-600 leading-relaxed">Al no poder realizar la inspección técnica, el sistema generará una <strong>Constancia de Visita Fallida</strong>.</p>
               <Button onClick={() => setShowFailedVisitModal(true)} className="w-full bg-red-600 hover:bg-red-700 text-white border-none py-4 shadow-lg shadow-red-200">Generar Constancia y Salir</Button>
            </div>
          )}
        </div>
      )}

      {step === 3 && <InspectionForm contextData={{
        ...actData,
        // CORRECCIÓN DE TIPO: Saneamiento explícito antes de renderizar el hijo
        complaintType: actData.complaintType === '' ? undefined : actData.complaintType
      }} />}
    </>
  );
};