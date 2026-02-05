import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

export const CensusProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY'>('INFO');

  const canInspect = user?.role === 'INSPECTOR';

  // 1. CORRECCIÓN: db.establishments
  const establishment = useLiveQuery(() => db.establishments?.get(Number(id)), [id]);
  
  // 2. CORRECCIÓN: db.inspections
  const history = useLiveQuery(async () => {
    if (!id || !db.inspections) return [];
    const allReports = await db.inspections.toArray();
    return allReports
      .filter(r => r.establishment_id === String(id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [id]);

  if (!establishment) return <div className="p-10 text-center text-slate-400">Cargando expediente...</div>;

  const lastVisit = history?.[0]?.date || 'Sin visitas previas';
  const riskColor = !history?.length ? 'bg-slate-100 text-slate-500' : 
                    history[0].riskScore < 60 ? 'bg-green-100 text-green-700' :
                    history[0].riskScore < 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* ENCABEZADO TIPO "EXPEDIENTE" */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand to-teal-400"></div>
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 pt-2">
          
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-ground flex items-center justify-center text-brand border border-surface-border shadow-inner">
              <Icon name="store" size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge label={establishment.status} variant={establishment.status === 'ACTIVO' ? 'success' : 'danger'} />
                <span className="text-xs font-bold text-slate-400 tracking-wider">NIT: {establishment.nit}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">{establishment.name}</h1>
              {establishment.commercialName && (
                <p className="text-sm text-slate-500 font-medium">"{establishment.commercialName}"</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
             <button onClick={() => navigate('/dashboard/census')} className="btn-secondary">
               <Icon name="arrow-left" size={16}/> Volver
             </button>
             {canInspect && (
               <button className="btn-primary" onClick={() => navigate(`/dashboard/inspections/new/${establishment.id}`)}>
                 <Icon name="play" size={16}/> Nueva Inspección
               </button>
             )}
          </div>
        </div>

        <div className="flex gap-6 mt-8 border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('INFO')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'INFO' ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Información General
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Historial Sanitario
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{history?.length || 0}</span>
          </button>
        </div>
      </div>

      {activeTab === 'INFO' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card title="Detalles del Establecimiento" icon="info">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoField label="Actividad Económica" value={establishment.type} />
                <InfoField label="Categoría" value={establishment.category} />
                <InfoField label="Municipio" value={establishment.city} />
                <InfoField label="Dirección Física" value={establishment.address} />
                <InfoField label="Teléfono" value={establishment.phone} />
                <InfoField label="Email Notificaciones" value={establishment.emailJudicial} />
              </div>
            </Card>

            <Card title="Representación Legal" icon="users">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoField label="Representante Legal" value={establishment.responsibleName} />
                <InfoField label="Documento ID" value={establishment.responsibleId || 'No registrado'} />
                {establishment.techDirectorName && (
                  <>
                    <div className="col-span-2 border-t border-slate-100 my-2"></div>
                    <InfoField label="Director Técnico" value={establishment.techDirectorName} />
                    <InfoField label="Tarjeta Profesional" value={establishment.techDirectorTp || 'N/A'} />
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Perfil de Riesgo</h3>
              <div className={`p-4 rounded-xl mb-4 text-center ${riskColor}`}>
                 <div className="text-3xl font-black">{history?.[0]?.riskScore ?? '-'}%</div>
                 <div className="text-xs font-bold opacity-80">Último Puntaje IVC</div>
              </div>
              <div className="space-y-3">
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Última Visita:</span>
                   <span className="font-medium text-slate-800">{lastVisit}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Total Visitas:</span>
                   <span className="font-medium text-slate-800">{history?.length || 0}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history?.map((rep) => (
            <div key={rep.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-light transition-all flex flex-col md:flex-row items-center gap-4 group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                rep.concept === 'FAVORABLE' ? 'bg-green-100 text-green-700' :
                rep.concept === 'DESFAVORABLE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {Math.round(rep.riskScore)}%
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h4 className="font-bold text-slate-800">{rep.concept}</h4>
                <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><Icon name="calendar" size={12}/> {rep.date}</span>
                  <span>•</span>
                  <span className="uppercase">{rep.func || 'Inspector'}</span>
                </div>
              </div>

              <Button variant="secondary" className="text-xs" onClick={() => navigate(`/dashboard/inspections/view/${rep.id}`)}>
                <Icon name="file-text" size={14} /> Ver Acta
              </Button>
            </div>
          ))}

          {history?.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Icon name="clipboard" size={40} className="text-slate-300 mx-auto mb-3"/>
              <p className="text-slate-500 font-medium">No hay inspecciones registradas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper
const InfoField = ({ label, value }: { label: string, value: string | undefined }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</label>
    <p className="text-sm font-bold text-slate-800 break-words">{value || '---'}</p>
  </div>
);