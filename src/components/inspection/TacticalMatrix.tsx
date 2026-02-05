import React, { useState, useMemo, useRef } from 'react';
import { Icon } from '../ui/Icon';
import type { InspectionItem, FindingEvidence } from '../../types';

// Definición local para evitar conflictos
export type IconName = string;

// =============================================================================
// CONFIGURACIÓN VISUAL DE BLOQUES (PLAN OMEGA UI)
// =============================================================================
const BLOCK_CONFIG: Record<string, { label: string; icon: IconName; description: string; color: string }> = {
  'TALENTO_HUMANO': { 
    label: '1. Talento Humano y Dirección Técnica', 
    icon: 'users', 
    description: 'Verificación de idoneidad, títulos y contratación.',
    color: 'blue'
  },
  'LEGAL': { 
    label: '2. Legal y Administrativo', 
    icon: 'file-text', 
    description: 'Documentación de funcionamiento y Cámara de Comercio.',
    color: 'slate'
  },
  'INFRAESTRUCTURA': { 
    label: '3. Infraestructura y Áreas', 
    icon: 'home', 
    description: 'Condiciones locativas, pisos, techos y delimitación.',
    color: 'indigo'
  },
  'DOTACION': { 
    label: '4. Dotación y Equipos', 
    icon: 'thermometer', 
    description: 'Termohigrómetros, neveras y mobiliario.',
    color: 'cyan'
  },
  'PROCESOS': { 
    label: '5. Procesos Operativos', 
    icon: 'activity', 
    description: 'Recepción, almacenamiento y dispensación.',
    color: 'violet'
  },
  'SANEAMIENTO': { 
    label: '6. Saneamiento Básico', 
    icon: 'trash-2', 
    description: 'Control de plagas y gestión de residuos.',
    color: 'emerald'
  },
  // FALLBACKS LEGACY (Compatibilidad)
  'SANITARIO': { label: 'Condiciones Sanitarias', icon: 'clipboard', description: 'Evaluación general.', color: 'slate' },
  'LOCATIVO': { label: 'Condiciones Locativas', icon: 'home', description: 'Infraestructura física.', color: 'slate' },
  'PERSONAL': { label: 'Personal', icon: 'user', description: 'Recurso humano.', color: 'slate' },
  'DOCUMENTAL': { label: 'Documentación', icon: 'file', description: 'Requisitos legales.', color: 'slate' },
  'PRODUCTOS': { label: 'Productos', icon: 'package', description: 'Estado de inventario.', color: 'slate' },
  'SEGURIDAD': { label: 'Seguridad', icon: 'shield', description: 'Medidas de protección.', color: 'slate' }
};

interface TacticalMatrixProps {
  items: InspectionItem[];
  responses: Record<string, any>;
  onResponse: (itemId: string, value: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA') => void;
  onEvidence: (itemId: string, evidence: FindingEvidence) => void;
  onObservation: (itemId: string, text: string) => void; // Prop vital para el textarea
}

export const TacticalMatrix: React.FC<TacticalMatrixProps> = ({ 
  items, 
  responses, 
  onResponse, 
  onEvidence,
  onObservation
}) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  
  // --- LÓGICA DE CÁMARA REAL (SIN MOCKS) ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const toggleExpandItem = (id: string) => {
    setExpandedItem(prev => prev === id ? null : id);
  };

  const toggleBlock = (blockName: string) => {
    setCollapsedBlocks(prev => ({ ...prev, [blockName]: !prev[blockName] }));
  };

  // 1. Activar el input oculto del dispositivo
  const triggerCamera = (itemId: string) => {
    setActivePhotoId(itemId);
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset para permitir capturar la misma foto si es necesario
        fileInputRef.current.click();
    }
  };

  // 2. Procesar el archivo real capturado
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoId) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const base64 = event.target?.result as string;
        
        // Crear evidencia real conectada al ítem activo
        const realEvidence: FindingEvidence = {
            id: Date.now().toString(),
            photoUrl: base64,
            timestamp: new Date().toISOString(),
            gps: { lat: 0, lng: 0 }, // Placeholder para futura georeferenciación real
            hash: 'SHA256_PENDING',
            notes: 'Evidencia adjunta'
        };
        
        onEvidence(activePhotoId, realEvidence);
        setActivePhotoId(null);
    };
  };

  // Agrupamiento inteligente por bloques
  const groupedItems = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};
    items.forEach(item => {
      const blockKey = item.block || 'OTROS';
      if (!groups[blockKey]) groups[blockKey] = [];
      groups[blockKey].push(item);
    });
    return groups;
  }, [items]);

  const sortedBlockKeys = useMemo(() => {
    const keys = new Set(items.map(i => i.block || 'OTROS'));
    return Array.from(keys);
  }, [items]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* INPUT OCULTO GLOBAL PARA LA CÁMARA */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        capture="environment" // Intenta forzar cámara trasera en móviles
        className="hidden" 
        onChange={handleFileChange}
      />

      {sortedBlockKeys.map((blockKey) => {
        const blockItems = groupedItems[blockKey];
        const config = BLOCK_CONFIG[blockKey] || { 
            label: blockKey.replace('_', ' '), icon: 'list', description: 'Bloque de inspección', color: 'slate'
        };
        
        // Métricas del bloque
        const totalBlock = blockItems.length;
        const answeredBlock = blockItems.filter(i => responses[i.id]?.status).length;
        const isCollapsed = collapsedBlocks[blockKey];
        const progress = Math.round((answeredBlock / totalBlock) * 100);

        return (
          <div key={blockKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* ENCABEZADO DE BLOQUE (ACORDEÓN) */}
            <div 
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-slate-50 border-b border-slate-100`}
              onClick={() => toggleBlock(blockKey)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${config.color}-50 text-${config.color}-600 border border-${config.color}-100`}>
                  <Icon name={config.icon as any} size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{config.label}</h3>
                  <p className="text-xs text-slate-500 font-medium">{config.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Progreso</span>
                   <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-${config.color}-500 transition-all duration-500`} style={{ width: `${progress}%` }}></div>
                   </div>
                </div>
                <button className="text-slate-400">
                  <Icon name={isCollapsed ? "chevron-down" : "chevron-up"} size={20} />
                </button>
              </div>
            </div>

            {/* CUERPO DEL BLOQUE (ITEMS) */}
            {!isCollapsed && (
              <div className="p-4 space-y-4 bg-slate-50/30">
                {blockItems.map((item) => {
                  const status = responses[item.id]?.status;
                  const isKiller = item.isKiller;
                  const hasEvidence = responses[item.id]?.evidence?.length > 0;
                  
                  // Lógica de visualización del Wizard Oculto
                  const showWizard = item.triggerCondition === 'FAIL' 
                    && status === 'NO_CUMPLE' 
                    && expandedItem === item.id;

                  return (
                    <div 
                      key={item.id} 
                      className={`
                        relative overflow-hidden rounded-xl border-2 transition-all duration-300
                        ${status === 'CUMPLE' ? 'bg-emerald-50/50 border-emerald-200' : 
                          status === 'NO_CUMPLE' ? 'bg-white border-red-500 shadow-md shadow-red-100' : 
                          'bg-white border-slate-200 hover:border-slate-300'}
                      `}
                    >
                      {/* Badge de Criticidad */}
                      {isKiller && (
                        <div className="absolute top-0 right-0 z-10">
                          <div className="bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 shadow-sm">
                            <Icon name="alert-triangle" size={10} /> Crítico
                          </div>
                        </div>
                      )}

                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                          <div className="flex-1 pr-8">
                            <h4 className={`text-sm font-bold leading-snug ${status === 'NO_CUMPLE' ? 'text-red-700' : 'text-slate-800'}`}>
                              {item.text}
                            </h4>
                            
                            {/* Cita Legal (Data Governance) */}
                            {item.legalCitation && (
                              <div className="flex items-center gap-1 mt-2">
                                <Icon name="scale" size={12} className="text-slate-400"/>
                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {item.legalCitation}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Botón Expansión Manual (para editar sub-respuestas) */}
                          {status === 'NO_CUMPLE' && item.childItems && (
                            <button 
                              onClick={() => toggleExpandItem(item.id)}
                              className="self-end sm:self-start p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200"
                              title="Ver detalles del hallazgo"
                            >
                              <Icon name={showWizard ? "chevron-up" : "chevron-down"} size={16} />
                            </button>
                          )}
                        </div>

                        {/* BOTONERA TÁCTIL PRINCIPAL */}
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            onClick={() => onResponse(item.id, 'CUMPLE')}
                            className={`col-span-2 sm:col-span-1 py-3 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5
                              ${status === 'CUMPLE' 
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-100 transform scale-[1.02]' 
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                              }`}
                          >
                            <Icon name="check" size={14} strokeWidth={3} /> CUMPLE
                          </button>

                          <button
                            onClick={() => {
                              onResponse(item.id, 'NO_CUMPLE');
                              if (item.childItems) setExpandedItem(item.id); 
                            }}
                            className={`col-span-2 sm:col-span-1 py-3 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5
                              ${status === 'NO_CUMPLE' 
                                ? 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-100 transform scale-[1.02]' 
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                              }`}
                          >
                            <Icon name="x" size={14} strokeWidth={3} /> NO CUMPLE
                          </button>

                          <button
                            onClick={() => onResponse(item.id, 'NO_APLICA')}
                            className={`col-span-1 sm:col-span-1 py-3 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold
                              ${status === 'NO_APLICA' 
                                ? 'bg-slate-700 text-white shadow-md' 
                                : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
                              }`}
                            title="No Aplica / No Observado"
                          >
                            N/A
                          </button>
                          
                          {/* Botón Cámara Rápida (Top Level) - CONECTADO A TRIGGER */}
                          <button 
                            onClick={() => triggerCamera(item.id)}
                            className={`col-span-1 sm:col-span-1 py-3 rounded-lg flex items-center justify-center transition-all border 
                              ${hasEvidence 
                                ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'
                              }`}
                            title="Capturar Evidencia Rápida"
                          >
                            <Icon name="camera" size={16} />
                            {hasEvidence && <span className="ml-1 text-[9px] font-bold bg-blue-600 text-white px-1 rounded-full">{responses[item.id].evidence.length}</span>}
                          </button>
                        </div>
                      </div>

                      {/* WIZARD DE PROFUNDIZACIÓN (SUB-ITEMS) */}
                      {showWizard && item.childItems && (
                        <div className="bg-red-50/80 border-t border-red-100 p-4 animate-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 mb-3 px-1">
                            <div className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center">
                              <Icon name="zoom-in" size={12} />
                            </div>
                            <h5 className="text-[10px] font-black text-red-800 uppercase tracking-wide">Profundización del Hallazgo (Causa Raíz)</h5>
                          </div>

                          <div className="space-y-3 pl-3 border-l-2 border-red-200 ml-2">
                            {item.childItems.map((subItem) => {
                                const subStatus = responses[subItem.id]?.status;
                                const subHasEvidence = responses[subItem.id]?.evidence?.length > 0;
                                
                                return (
                                  <div key={subItem.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-center gap-3">
                                    <p className="text-xs font-semibold text-slate-700 leading-tight">{subItem.text}</p>
                                    
                                    <div className="flex gap-1 shrink-0">
                                       {/* Botones de respuesta conectados */}
                                       <button 
                                          onClick={() => onResponse(subItem.id, 'CUMPLE')}
                                          className={`h-8 px-3 text-[10px] font-black rounded-l-lg border transition-colors 
                                            ${subStatus === 'CUMPLE' 
                                              ? 'bg-red-700 text-white border-red-700 shadow-sm' 
                                              : 'bg-slate-50 text-slate-400 hover:bg-red-100 hover:text-red-700 border-slate-200'
                                            }`}
                                       >
                                         SI
                                       </button>
                                       <button 
                                          onClick={() => onResponse(subItem.id, 'NO_CUMPLE')}
                                          className={`h-8 px-3 text-[10px] font-black border-y border-r transition-colors 
                                            ${subStatus === 'NO_CUMPLE' 
                                              ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                                              : 'bg-slate-50 text-slate-400 border-slate-200'
                                            }`}
                                       >
                                         NO
                                       </button>
                                       {/* Botón de cámara conectado */}
                                       <button 
                                         onClick={() => triggerCamera(subItem.id)}
                                         className={`h-8 w-8 rounded-r-lg border border-slate-200 flex items-center justify-center transition-colors 
                                           ${subHasEvidence 
                                             ? 'bg-blue-100 text-blue-600 border-blue-200' 
                                             : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                           }`}
                                       >
                                         <Icon name="camera" size={12}/>
                                       </button>
                                    </div>
                                  </div>
                                );
                            })}
                            
                            <div className="pt-2">
                                <label className="text-[10px] font-bold text-red-700 uppercase mb-1 block">Observación Adicional</label>
                                <textarea 
                                    className="w-full text-xs p-2 rounded-lg border border-red-200 focus:border-red-400 outline-none bg-white h-16 resize-none placeholder:text-red-200"
                                    placeholder="Describa el hallazgo..."
                                    value={responses[item.id]?.observation || ''}
                                    onChange={(e) => onObservation(item.id, e.target.value)}
                                ></textarea>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};