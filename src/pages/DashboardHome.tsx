import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

// CORRECCIÓN 1: Rutas ajustadas para estar en src/pages/
import { useAuthStore } from '../store/useAuthStore';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { db } from '../db';
// Importamos el tipo Report para corregir los errores de "implicit any"
import type { Report } from '../types';

// Componente Interno StatCard
const StatCard = ({ label, value, icon, color }: { label: string, value: string, icon: any, color: string }) => {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600'
  };
  
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between h-full">
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-3xl font-black text-slate-800">{value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color] || 'bg-slate-50 text-slate-600'}`}>
        <Icon name={icon} size={24} />
      </div>
    </div>
  );
};

// Estilos Semánticos para el Radar
const getRiskStyles = (score: number) => {
  if (score >= 90) {
    return {
      label: 'BAJO RIESGO',
      textClass: 'text-emerald-700',
      barColor: 'bg-emerald-500',
      bgIcon: 'bg-emerald-50 text-emerald-600'
    };
  } else if (score >= 60) {
    return {
      label: 'ALERTA MEDIA',
      textClass: 'text-amber-700',
      barColor: 'bg-amber-500',
      bgIcon: 'bg-amber-50 text-amber-600'
    };
  } else {
    return {
      label: 'CRÍTICO',
      textClass: 'text-red-700',
      barColor: 'bg-red-600',
      bgIcon: 'bg-red-50 text-red-600'
    };
  }
};

// --- VISTA DEL DIRECTOR ---
const AdminView: React.FC = () => {
  const navigate = useNavigate();

  // Consultas seguras
  const censusCount = useLiveQuery(() => db.establishments?.count()) ?? 0;
  const reportCount = useLiveQuery(() => db.inspections?.count()) ?? 0;
  
  // QUERY INTELIGENTE
  const recentReports = useLiveQuery(async () => {
    if (!db.inspections || !db.establishments) return [];

    const reports = await db.inspections.orderBy('id').reverse().limit(5).toArray();
    
    // CORRECCIÓN 2: Tipado explícito de 'r' como Report
    const enriched = await Promise.all(reports.map(async (r: Report) => {
      let censusData = null;
      if (r.establishment_id) {
         // Intento 1: ID Numérico
         censusData = await db.establishments.get(Number(r.establishment_id));
         // Intento 2: Si no encuentra, buscar por NIT
         if (!censusData) {
            censusData = await db.establishments.where('nit').equals(r.establishment_id).first();
         }
      }
      
      return {
        ...r,
        displayName: censusData?.name || r.est,
        displayCity: censusData?.city || 'Atlántico', 
        displayType: censusData?.type || 'Comercio'
      };
    }));
    
    return enriched;
  }) ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32">
           <StatCard label="Total Vigilados" value={censusCount.toString()} icon="map-pin" color="teal" />
        </div>
        <div className="h-32">
           <StatCard label="Actuaciones Totales" value={reportCount.toString()} icon="bar-chart-2" color="blue" />
        </div>
        <div className="h-32">
           <StatCard label="Hallazgos Críticos" value="0" icon="alert-triangle" color="red" />
        </div>
      </div>

      {/* RADAR DE ACTIVIDAD */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Radar de Actividad (Tiempo Real)</h3>
          <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => navigate('/dashboard/inspections')}>Ver Todo</Button>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {recentReports.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium">No hay actividad reciente registrada.</div>
          ) : (
            <div className="flex flex-col">
              {/* CORRECCIÓN 3: Tipado 'any' para permitir campos enriquecidos (displayName) */}
              {recentReports.map((report: any) => {
                const style = getRiskStyles(report.riskScore);
                return (
                  <div key={report.id} className="group flex flex-col md:flex-row items-stretch border-b border-slate-100 last:border-0 hover:shadow-md transition-all relative z-0">
                    
                    {/* ZONA IZQUIERDA */}
                    <div className="flex-1 p-5 bg-white flex items-center gap-5 relative z-10">
                      <div className={`p-3.5 rounded-2xl border border-slate-100 ${style.bgIcon} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                         <Icon name="store" size={24} strokeWidth={2} />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                         <h4 className="text-sm font-black text-slate-800 truncate mb-1.5 leading-tight">
                           {report.displayName}
                         </h4>
                         
                         <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              {report.displayCity}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Icon name="calendar" size={10}/> {report.date}
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-slate-400 truncate hidden sm:inline">{report.func}</span>
                         </div>
                      </div>
                    </div>

                    {/* ZONA DERECHA */}
                    <div className="md:w-72 p-5 bg-slate-50 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200">
                       <div className="flex justify-between items-end mb-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Diagnóstico</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${style.textClass}`}>
                               {style.label}
                            </span>
                          </div>
                          <div className="text-right">
                             <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Cumplimiento</span>
                             <span className="text-2xl font-black text-slate-800 leading-none">{report.riskScore}%</span>
                          </div>
                       </div>
                       
                       <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full ${style.barColor} transition-all duration-1000 ease-out`} 
                            style={{ width: `${report.riskScore}%` }}
                          />
                       </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- VISTA DEL INSPECTOR ---
const InspectorView: React.FC<{ userName: string }> = ({ userName }) => {
  const navigate = useNavigate();
  
  const myReportsCount = useLiveQuery(async () => {
    if (!db.inspections) return 0;
    // CORRECCIÓN 4: Tipado explícito de 'report' como Report
    return await db.inspections.filter((report: Report) => report.func === 'INSPECTOR VIGISALUD').count(); 
  }) ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Bienvenido, {userName}</h1>
        <p className="text-lg text-slate-500 font-medium">¿Qué actividad deseas realizar hoy en el territorio?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div onClick={() => navigate('/dashboard/census')} className="group relative bg-teal-600 rounded-[2rem] p-8 shadow-2xl shadow-teal-900/20 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-teal-900/30 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-colors"></div>
          <div className="relative z-10 h-full flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-6 border border-white/20">
                <Icon name="map" size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 leading-tight">Iniciar Diligencia</h2>
              <p className="text-teal-100 font-medium">Buscar establecimiento, realizar inspección o barrido de zona.</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-white font-bold uppercase tracking-widest text-xs">
              <span>Ir al Censo</span><Icon name="chevron-right" size={16} />
            </div>
          </div>
        </div>

        <div className="group bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 cursor-pointer transition-all hover:border-slate-300 hover:shadow-2xl relative overflow-hidden">
          <div className="relative z-10 h-full flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <Icon name="user" size={32} className="text-slate-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2 leading-tight">Mi Gestión</h2>
              <p className="text-slate-500 font-medium">Revisar mis métricas, historial de visitas y datos de perfil.</p>
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-xl flex items-center justify-between">
               <div><span className="block text-[10px] font-black text-slate-400 uppercase">Visitas Realizadas</span><span className="text-2xl font-black text-slate-700">{myReportsCount}</span></div>
               <div className="text-right"><span className="block text-[10px] font-black text-slate-400 uppercase">Rendimiento</span><span className="text-sm font-bold text-emerald-600">Activo</span></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-12 text-center">
         <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-2"><Icon name="shield" size={12} />Sistema VigiSalud v7.4 • Departamento del Atlántico</p>
      </div>
    </div>
  );
};

export const DashboardHome: React.FC = () => {
  const { user } = useAuthStore();
  const isDirector = user?.role === 'DIRECTOR' || user?.role === 'ADMIN';
  const firstName = user?.name?.split(' ')[0] || 'Funcionario';

  return (
    <div className="h-full">
      {isDirector && (
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Sala Situacional</h1>
            <p className="text-slate-500 font-medium text-lg mt-1">Visión Estratégica IVC</p>
          </div>
          <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-700 font-bold text-sm flex items-center gap-2">
            <Icon name="briefcase" size={18} />Vista Director
          </div>
        </header>
      )}
      {isDirector ? <AdminView /> : <InspectorView userName={firstName} />}
    </div>
  );
};