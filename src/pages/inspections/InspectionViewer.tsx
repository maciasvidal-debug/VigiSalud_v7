import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { jsPDF } from 'jspdf';

export const InspectionViewer: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const report = useLiveQuery(
    () => db.reports.get(Number(id)),
    [id]
  );

  const establishment = useLiveQuery(
    async () => {
      if (!report?.establishment_id) return undefined;
      return await db.census.get(Number(report.establishment_id));
    },
    [report]
  );

  const handleExportPDF = () => {
    if (!report || !establishment) return;

    const doc = new jsPDF();
    
    // Encabezado Institucional
    doc.setFillColor(13, 148, 136); // Teal-600
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('VigiSalud - Acta de Inspección', 20, 25);
    
    // Datos Técnicos
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFontSize(12);
    doc.text(`NIT: ${establishment.nit}`, 20, 60);
    doc.text(`Establecimiento: ${establishment.name}`, 20, 70);
    doc.text(`Dirección: ${establishment.address}`, 20, 80);
    
    doc.text(`Concepto: ${report.concept}`, 20, 100);
    doc.text(`Score de Riesgo: ${report.riskScore}%`, 20, 110);
    doc.text(`Inspector: ${report.func}`, 20, 120);
    doc.text(`Fecha: ${report.date}`, 20, 130);

    // Renderizar Firma en PDF si existe
    if (report.signature) {
        doc.text('Firma del Responsable:', 20, 150);
        doc.addImage(report.signature, 'PNG', 20, 155, 60, 30);
    }

    // Pie de página de Seguridad (Hash)
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('Huella Digital de Seguridad (SHA-256):', 20, 270);
    doc.setFont("courier", "normal");
    doc.text(report.verificationHash || 'PENDIENTE DE SELLADO', 20, 275);
    
    doc.save(`ACTA_${establishment.nit}_${report.date}.pdf`);
  };

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Icon name="loader-2" className="animate-spin mb-4" size={32} />
        <p className="font-bold">Cargando acta oficial...</p>
      </div>
    );
  }

  const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1";
  const valueStyle = "text-slate-700 font-bold text-base bg-slate-50 p-3 rounded-xl border border-slate-100";

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Consulta de Acta</h1>
          <p className="text-slate-500 font-medium mt-1">Evidencia digital inmutable (Solo Lectura).</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="secondary" onClick={() => navigate('/dashboard/inspections')} className="flex-1 md:flex-none">
            Cerrar
          </Button>
          <Button onClick={handleExportPDF} className="flex-1 md:flex-none">
            <Icon name="download" size={18} />
            Exportar PDF
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bloque 1: Información */}
        <Card title="Datos del Establecimiento" icon="store" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className={labelStyle}>Razón Social</p>
              <div className={valueStyle}>{establishment?.name || 'Cargando...'}</div>
            </div>
            <div>
              <p className={labelStyle}>NIT / Identificación</p>
              <div className={valueStyle}>{establishment?.nit || '---'}</div>
            </div>
            <div className="md:col-span-2">
              <p className={labelStyle}>Concepto Técnico</p>
              <div className="flex items-center gap-4">
                <Badge 
                  label={report.concept} 
                  variant={report.concept === 'FAVORABLE' ? 'success' : 'danger'} 
                  className="px-4 py-2 text-sm"
                />
                <span className="text-sm font-bold text-slate-400 uppercase">
                  Riesgo: {report.riskScore}%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Bloque 2: Trazabilidad */}
        <Card title="Metadatos" icon="calendar">
          <div className="space-y-6">
            <div>
              <p className={labelStyle}>Fecha de Cierre</p>
              <div className={valueStyle}>{report.date}</div>
            </div>
            <div>
              <p className={labelStyle}>Funcionario IVC</p>
              <div className={valueStyle}>{report.func}</div>
            </div>
            <div>
              <p className={labelStyle}>ID Interno</p>
              <div className="font-mono text-teal-600 font-bold bg-teal-50 p-3 rounded-xl border border-teal-100">
                #{report.id?.toString().padStart(6, '0')}
              </div>
            </div>
          </div>
        </Card>

        {/* Bloque 3: Validación Legal (NUEVO) */}
        <Card title="Validación Legal" icon="shield-check" className="lg:col-span-3 border-l-4 border-l-teal-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Firma Digitalizada */}
            <div>
               <p className={labelStyle}>Firma del Atendido</p>
               {report.signature ? (
                 <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white">
                   <img src={report.signature} alt="Firma Responsable" className="h-24 mx-auto opacity-90" />
                 </div>
               ) : (
                 <div className="h-24 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-sm italic">
                   Sin firma digital registrada
                 </div>
               )}
            </div>

            {/* Hash Criptográfico */}
            <div>
              <p className={labelStyle}>Sello de Integridad (SHA-256)</p>
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs break-all shadow-inner">
                {report.verificationHash || 'ERROR: ACTA NO SELLADA - INTEGRIDAD COMPROMETIDA'}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                * Este código garantiza que los datos no han sido alterados desde su creación. 
                Cualquier discrepancia invalida legalmente este documento.
              </p>
            </div>

          </div>
        </Card>
      </div>
    </div>
  );
};