import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { db } from '../../db'; // Asegúrate que esta ruta es correcta en tu proyecto
import { generateInspectionPDF } from '../../utils/PdfGenerator'; // NUEVO IMPORT
import type { Report } from '../../types';

export const InspectionList: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('Este Mes');

  // --- CEREBRO DE BI (LÓGICA ORIGINAL) ---
  const data = useLiveQuery(async () => {
    return await analyticsService.getMetrics();
  });

  // Consulta directa para la tabla (Mejor práctica para listas largas)
  const inspectionsList = useLiveQuery(() => 
    db.inspections.orderBy('date').reverse().toArray()
  );

  // Datos por defecto (Tu estructura original)
  const analytics = data || { 
    totalReports: 0, 
    favorable: 0, 
    withReq: 0, 
    critical: 0, 
    avgScore: 0, 
    recent: [],
    ipo: 0,
    criticalRate: 0,
    localizationEffectiveness: 0
  };

  // --- NUEVA FUNCIÓN: MANEJO DE PDF ---
  const handleViewPdf = async (report: Report, action: 'VIEW' | 'DOWNLOAD') => {
      try {
          const blob = await generateInspectionPDF(report);
          const url = URL.createObjectURL(blob);
          
          if (action === 'VIEW') {
              window.open(url, '_blank');
          } else {
              const link = document.createElement('a');
              link.href = url;
              link.download = `ACTA_${report.id}_${report.est.replace(/\s+/g, '_')}.pdf`;
              link.click();
          }
      } catch (e) {
          console.error("Error PDF", e);
          alert("Error generando el documento.");
      }
  };

  // Componente interno original
  const ProgressBar = ({ value, colorClass, label }: { value: number, colorClass: string, label: string }) => (
    <div className="mt-4">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-content-secondary">{label}</span>
        <span className="font-bold text-content-primary">{value}%</span>
      </div>
      <div className="w-full bg-surface-ground rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* HEADER: TÍTULO Y FILTROS (ORIGINAL) */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-surface-border pb-6">
        <div>
          <h1 className="text-3xl font-black text-content-primary tracking-tight">
            Gestión de Actuaciones
          </h1>
          <p className="text-content-secondary font-medium text-lg mt-1">
            Inteligencia sanitaria y seguimiento de control
          </p>
        </div>
        
        <div className="flex items-center gap-1 bg-white border border-surface-border rounded-xl p-1 shadow-sm">
          {['Hoy', 'Este Mes', 'Este Año'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                period === p 
                  ? 'bg-content-primary text-white shadow-md' 
                  : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {/* SECCIÓN 1: KPIS (ESTRUCTURA ORIGINAL RESTAURADA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-base p-5 border-l-4 border-l-status-info shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">Productividad (IPO)</p>
              <h3 className="text-3xl font-black text-content-primary mt-1">{analytics.ipo}%</h3>
            </div>
            <div className="p-2.5 bg-status-infoBg text-status-info rounded-xl">
              <Icon name="activity" size={20} />
            </div>
          </div>
        </div>

        <div className="card-base p-5 border-l-4 border-l-status-success shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">Índice Sanitario</p>
              <h3 className="text-3xl font-black text-content-primary mt-1">{analytics.avgScore}%</h3>
            </div>
            <div className="p-2.5 bg-status-successBg text-status-success rounded-xl">
              <Icon name="check-circle" size={20} />
            </div>
          </div>
        </div>

        <div className="card-base p-5 border-l-4 border-l-status-error shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">Tasa Crítica</p>
              <h3 className="text-3xl font-black text-content-primary mt-1">{analytics.criticalRate}%</h3>
            </div>
            <div className="p-2.5 bg-status-errorBg text-status-error rounded-xl">
              <Icon name="alert-triangle" size={20} />
            </div>
          </div>
        </div>

        <div className="card-base p-5 border-l-4 border-l-status-warning shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">Total Actuaciones</p>
              <h3 className="text-3xl font-black text-content-primary mt-1">{analytics.totalReports}</h3>
            </div>
            <div className="p-2.5 bg-status-warningBg text-status-warning rounded-xl">
              <Icon name="clipboard" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: GRÁFICOS Y TABLA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* COLUMNA IZQUIERDA: GRÁFICOS (ORIGINAL) */}
        <div className="card-base p-6 lg:col-span-1 h-full flex flex-col">
          <h3 className="font-bold text-content-primary mb-6 flex items-center gap-2 text-sm uppercase tracking-wide">
            <Icon name="pie-chart" size={16} />
            Distribución de Riesgo
          </h3>
          
          <div className="space-y-6 flex-1">
            <ProgressBar 
              label="Favorables" 
              value={analytics.totalReports ? Math.round((analytics.favorable / analytics.totalReports) * 100) : 0} 
              colorClass="bg-status-success" 
            />
            <ProgressBar 
              label="Con Requerimientos" 
              value={analytics.totalReports ? Math.round((analytics.withReq / analytics.totalReports) * 100) : 0} 
              colorClass="bg-status-warning" 
            />
            <ProgressBar 
              label="Desfavorables" 
              value={analytics.totalReports ? Math.round((analytics.critical / analytics.totalReports) * 100) : 0} 
              colorClass="bg-status-error" 
            />
          </div>

          <div className="mt-8 p-4 bg-surface-ground rounded-xl border border-surface-border">
            <div className="text-[10px] text-content-tertiary mb-1 font-bold uppercase">Insight Automático</div>
            <p className="text-xs text-content-secondary leading-relaxed">
              Efectividad de Localización: <span className="font-bold text-content-primary">{analytics.localizationEffectiveness}%</span>. 
              Se recomienda priorizar visitas de seguimiento a los {analytics.withReq} establecimientos con hallazgos pendientes.
            </p>
          </div>
        </div>

        {/* COLUMNA DERECHA: TABLA (ACTUALIZADA) */}
        <div className="card-base p-0 overflow-hidden lg:col-span-2 flex flex-col h-full">
          <div className="p-4 border-b border-surface-border flex justify-between items-center bg-surface-ground/50">
            <h3 className="font-black text-content-primary text-xs uppercase tracking-widest flex items-center gap-2">
              <Icon name="list" size={16} />
              Últimas Actuaciones
            </h3>
            <span className="text-[10px] font-bold text-content-tertiary bg-white px-2 py-1 rounded border border-surface-border">
              TIEMPO REAL
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-content-secondary uppercase bg-surface-ground/80 border-b border-surface-border">
                <tr>
                  <th className="px-6 py-3 font-bold">Fecha</th>
                  <th className="px-6 py-3 font-bold">Establecimiento</th>
                  <th className="px-6 py-3 font-bold">Resultado</th>
                  <th className="px-6 py-3 font-bold text-right">Score</th>
                  <th className="px-6 py-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {/* Usamos 'inspectionsList' para tener acceso a todos los campos del Report */}
                {inspectionsList?.map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-3 font-medium text-content-secondary whitespace-nowrap text-xs">
                      {item.date?.split('T')[0] || '---'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-bold text-content-primary text-xs">{item.est}</div>
                      <div className="text-[10px] text-content-tertiary mt-0.5">{item.address}</div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge 
                         label={item.concept === 'FAVORABLE_CON_REQUERIMIENTOS' ? 'CON HALLAZGOS' : item.concept}
                         variant={
                            item.concept === 'FAVORABLE' ? 'success' :
                            item.concept?.includes('REQUERIMIENTOS') ? 'warning' : 'danger'
                         }
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-mono font-bold text-xs ${
                        item.riskScore >= 90 ? 'text-status-success' : 
                        item.riskScore >= 60 ? 'text-status-warning' : 'text-status-error'
                      }`}>
                        {item.riskScore}%
                      </span>
                    </td>
                    {/* AQUÍ ESTÁ LA ACTUALIZACIÓN CLAVE */}
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => handleViewPdf(item as Report, 'VIEW')}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded" 
                            title="Ver PDF"
                        >
                            <Icon name="file-text" size={16} />
                        </button>
                        <button 
                            onClick={() => handleViewPdf(item as Report, 'DOWNLOAD')}
                            className="p-2 text-slate-400 hover:text-emerald-600 rounded" 
                            title="Descargar"
                        >
                            <Icon name="download" size={16} />
                        </button>
                        <button 
                            onClick={() => navigate(`/dashboard/inspections/view/${item.id}`)}
                            className="btn-secondary p-2 w-auto h-auto rounded-lg"
                        >
                            <Icon name="eye" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {(!inspectionsList || inspectionsList.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-content-tertiary">
                      <div className="flex flex-col items-center gap-2">
                        <Icon name="bar-chart-2" size={24} className="opacity-30"/>
                        <p className="text-xs">No hay inspecciones registradas aún.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};