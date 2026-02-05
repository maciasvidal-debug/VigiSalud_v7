import React from 'react';
import ExcelJS from 'exceljs';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/useAuthStore'; // 1. Importar Store de Autenticación

export const ResourceCenter: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore(); // 2. Obtener usuario actual

  // 3. DEFINIR PERMISOS DE GESTIÓN
  // Los Inspectores NO deben ver las herramientas de carga masiva
  const canManageData = user?.role === 'DIRECTOR' || user?.role === 'ADMIN' || user?.role === 'COORDINADOR';

  // --- LÓGICA DE DESCARGA CENSO ---
  const downloadCensusTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plantilla Censo');
      
      sheet.columns = [
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'RAZON SOCIAL', key: 'name', width: 35 },
        { header: 'NOMBRE COMERCIAL', key: 'commercialName', width: 30 },
        { header: 'MUNICIPIO', key: 'city', width: 20 },
        { header: 'DIRECCION', key: 'address', width: 40 },
        { header: 'EMAIL', key: 'email', width: 30 },
        { header: 'TELEFONO', key: 'phone', width: 15 },
        { header: 'ACTIVIDAD', key: 'type', width: 25 },
        { header: 'NOMBRE RESPONSABLE', key: 'responsibleName', width: 30 }
      ];

      sheet.addRow({
        nit: '900123456', name: 'DROGUERÍA LA SALUD SAS', commercialName: 'TU DROGUERÍA AMIGA',
        city: 'BARRANQUILLA', address: 'CALLE 72 # 45 - 10', email: 'contacto@drogueria.com',
        phone: '3001234567', type: 'Droguería', responsibleName: 'JUAN PÉREZ'
      });

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; 

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Plantilla_Carga_Masiva_VigiSalud.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      showToast("Plantilla de Censo descargada.", "success");
    } catch (e) {
      showToast("Error al generar el archivo.", "error");
    }
  };

  // --- LÓGICA DE DESCARGA FUNCIONARIOS ---
  const downloadTeamTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plantilla Funcionarios');
      
      sheet.columns = [
        { header: 'NOMBRE COMPLETO', key: 'name', width: 30 },
        { header: 'CEDULA', key: 'identification', width: 15 },
        { header: 'RH', key: 'rh', width: 8 },
        { header: 'CARGO', key: 'cargo', width: 20 },
        { header: 'PROFESION', key: 'profession', width: 25 },
        { header: 'TARJETA PROFESIONAL', key: 'tp', width: 15 },
        { header: 'TIPO CONTRATO', key: 'contractType', width: 25 },
        { header: 'NO. CONTRATO', key: 'contractNumber', width: 15 },
        { header: 'FIN VIGENCIA (YYYY-MM-DD)', key: 'contractDateEnd', width: 15 },
        { header: 'ROL (ADMIN/INSPECTOR)', key: 'role', width: 20 },
        { header: 'EMAIL INST.', key: 'email', width: 25 },
        { header: 'EMAIL PERSONAL', key: 'personalEmail', width: 25 }, 
        { header: 'TELEFONO', key: 'phone', width: 15 }
      ];

      sheet.addRow({
        name: 'JUAN PEREZ', identification: '12345678', rh: 'O+', 
        cargo: 'Técnico Operativo', profession: 'Saneamiento Ambiental', tp: '12345-T',
        contractType: 'Prestación de Servicios', contractNumber: 'OPS-001', contractDateEnd: '2026-12-31',
        role: 'INSPECTOR', email: 'juan@gobernacion.gov.co', personalEmail: 'juan.perez@gmail.com', phone: '3001234567'
      });

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Plantilla_Funcionarios_VigiSalud.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      showToast("Plantilla de Funcionarios descargada.", "success");
    } catch (e) {
      showToast("Error al generar el archivo.", "error");
    }
  };

  // --- SUB-COMPONENTE WIDGET DE ACCIÓN ---
  const ActionWidget = ({ title, subtitle, icon, colorClass, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-light transition-all cursor-pointer group flex items-center justify-between relative overflow-hidden h-28"
    >
      <div className={`absolute left-0 top-0 w-1.5 h-full ${colorClass}`}></div>
      
      <div className="flex items-center gap-4 z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass.replace('bg-', 'bg-opacity-10 text-')} transition-transform group-hover:scale-110`}>
          <Icon name={icon} size={24} className={colorClass.replace('bg-', 'text-')} />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-sm leading-tight">{title}</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-colors z-10">
        <Icon name="download" size={18} />
      </div>
      
      <div className="absolute right-[-10px] bottom-[-10px] opacity-5 transform rotate-12 pointer-events-none">
        <Icon name={icon} size={80} />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-content-primary tracking-tight">Centro de Recursos</h1>
          <p className="text-content-secondary font-medium mt-1">Herramientas oficiales y documentación técnica.</p>
        </div>
      </header>

      {/* SECCIÓN 1: FORMATOS DE IMPORTACIÓN (SOLO PARA GESTORES) */}
      {canManageData && (
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Icon name="database" size={14} className="text-slate-400"/>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formatos de Carga Masiva (Gestión)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ActionWidget 
              title="Plantilla Censo" 
              subtitle="Para importar establecimientos" 
              icon="store" 
              colorClass="bg-teal-500" 
              onClick={downloadCensusTemplate} 
            />
            <ActionWidget 
              title="Base de Funcionarios" 
              subtitle="Para registrar equipo de trabajo" 
              icon="users" 
              colorClass="bg-blue-500" 
              onClick={downloadTeamTemplate} 
            />
          </div>
        </section>
      )}

      {/* SECCIÓN 2: DOCUMENTACIÓN Y SOPORTE (VISIBLE PARA TODOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <Card title="Base de Conocimiento IVC" icon="book-open" className="h-full">
           <div className="space-y-3">
             <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group flex gap-4 items-start">
               <div className="mt-1 text-teal-600"><Icon name="file-text" size={18}/></div>
               <div className="flex-1">
                 <h4 className="font-bold text-slate-800 text-sm">Manual de Inspección IVC</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Guía sobre el uso del Wizard, protocolos y normativa sanitaria vigente.</p>
               </div>
               <Icon name="arrow-right" size={16} className="text-slate-300 group-hover:text-teal-600 transition-colors self-center"/>
             </div>
             
             <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group flex gap-4 items-start">
               <div className="mt-1 text-blue-600"><Icon name="refresh-cw" size={18}/></div>
               <div className="flex-1">
                 <h4 className="font-bold text-slate-800 text-sm">Sincronización de Datos</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Instrucciones para el modo Offline y carga de actas.</p>
               </div>
               <Icon name="arrow-right" size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors self-center"/>
             </div>
           </div>
        </Card>
        
        <Card title="Canales de Soporte" icon="life-buoy" className="h-full">
           <div className="space-y-3">
             <a href="mailto:admin@vigisalud.gov.co" className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Icon name="mail" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800">Mesa de Ayuda</h4>
                  <p className="text-xs text-slate-500 font-mono truncate">admin@vigisalud.gov.co</p>
                </div>
                <Icon name="external-link" size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors"/>
             </a>

             <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Icon name="phone" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800">Línea de Coordinación</h4>
                  <p className="text-xs text-slate-500">Lun-Vie, 8:00 AM - 5:00 PM</p>
                </div>
             </div>
           </div>
        </Card>

      </div>
    </div>
  );
};