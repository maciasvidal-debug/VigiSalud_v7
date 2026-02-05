import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { Icon } from '../../components/ui/Icon';
import { PinGuardModal } from '../../components/ui/PinGuardModal';
import { DigitalIDCard } from '../../components/ui/DigitalIDCard'; 
import { useToast } from '../../context/ToastContext';
import type { User } from '../../types';

export const TeamList: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // ESTADO PARA EL PIN GUARD
  const [guardOpen, setGuardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ESTADO PARA EL CARNET
  const [selectedUserForId, setSelectedUserForId] = useState<User | null>(null);

  const officials = useLiveQuery(() => db.officials.toArray()) ?? [];

  // --- IMPORTACIÓN Y EXPORTACIÓN ---
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const workbook = new ExcelJS.Workbook();
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        const jsonData: any[] = [];
        
        const headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text.toLowerCase().trim().replace(/\s+/g, ' ');
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: any = {};
          let hasData = false;
          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber];
            if (key) { rowData[key] = cell.text; hasData = true; }
          });

          if (hasData) {
             const mappedItem = {
                name: rowData['nombre completo'] || rowData['nombre'] || rowData['funcionario'] || 'SIN NOMBRE',
                identification: String(rowData['cedula'] || rowData['identificacion'] || ''),
                cargo: rowData['cargo'] || 'Inspector',
                role: (rowData['rol'] || 'INSPECTOR').toUpperCase(),
                email: rowData['email'] || rowData['email inst.'] || '', // Institucional
                personalEmail: rowData['email personal'] || rowData['correo personal'] || '', // NUEVA COLUMNA
                phone: String(rowData['telefono'] || ''),
                status: 'ACTIVO',
                pin: '1234',
                // Mapeo básico de nuevos campos por si vienen en el Excel
                rh: rowData['rh'] || 'O+',
                contractNumber: rowData['no. contrato'] || '',
                contractDateEnd: rowData['fin vigencia'] || ''
             };
             if (mappedItem.name && mappedItem.identification) jsonData.push(mappedItem);
          }
        });

        if (jsonData.length > 0) {
          await db.officials.bulkPut(jsonData);
          showToast(`✅ Se cargaron ${jsonData.length} funcionarios exitosamente.`, 'success');
        } else {
          showToast("⚠️ El archivo no contiene datos válidos.", 'warning');
        }
      } catch (error) {
        showToast("❌ Error al procesar el archivo Excel.", 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
        const data = await db.officials.toArray();
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Equipo VigiSalud');
        if (data.length > 0) {
          sheet.columns = [
            { header: 'NOMBRE', key: 'name', width: 30 },
            { header: 'IDENTIFICACIÓN', key: 'identification', width: 15 },
            { header: 'RH', key: 'rh', width: 8 },
            { header: 'CARGO', key: 'cargo', width: 20 },
            { header: 'ROL SISTEMA', key: 'role', width: 15 },
            { header: 'CONTRATO', key: 'contractNumber', width: 15 },
            { header: 'FIN VIGENCIA', key: 'contractDateEnd', width: 15 },
            { header: 'EMAIL INST.', key: 'email', width: 25 },
            { header: 'EMAIL PERSONAL', key: 'personalEmail', width: 25 }, // NUEVA COLUMNA
            { header: 'TELÉFONO', key: 'phone', width: 15 },
            { header: 'ESTADO', key: 'status', width: 10 },
          ];
          sheet.addRows(data);
          sheet.getRow(1).font = { bold: true };
        }
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Equipo_VigiSalud.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
        showToast("Lista de equipo exportada.", 'success');
    } catch(err) {
        showToast("Error al exportar.", 'error');
    }
  };

  // --- SOLICITUD DE ELIMINACIÓN PROTEGIDA ---
  const handleDeleteRequest = (id: number) => { 
    setSelectedId(id); 
    setGuardOpen(true); 
  };
  
  const executeDelete = async () => {
    if (selectedId) {
      await db.officials.delete(selectedId);
      setGuardOpen(false);
      setSelectedId(null);
      showToast("Funcionario eliminado y acceso revocado.", 'info');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* ENCABEZADO */}
      <div className="card-base p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-content-primary tracking-tight">Gestión de Equipo</h1>
          <p className="text-content-secondary font-medium text-sm">Administración de funcionarios y permisos de acceso.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
           <button onClick={handleExport} className="btn-secondary">
             <Icon name="download" size={16} /> <span className="hidden sm:inline">Exportar</span>
           </button>
           <label className="btn-secondary cursor-pointer">
             <Icon name="upload" size={16} /> <span className="hidden sm:inline">Importar</span>
             <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
           </label>
           <button onClick={() => navigate('/dashboard/team/new')} className="btn-primary">
             <Icon name="user-plus" size={16} /> <span className="hidden sm:inline">Nuevo Funcionario</span>
           </button>
        </div>
      </div>

      {/* GRID DE TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officials.map((official) => (
          <div key={official.id} className="card-base p-6 hover:shadow-lg hover:border-brand-light transition-all relative overflow-hidden group">
            
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
              official.role === 'DIRECTOR' ? 'bg-purple-500' :
              official.role === 'ADMIN' ? 'bg-content-primary' : 'bg-brand'
            }`}></div>

            <div className="flex items-start justify-between mb-4 pl-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-ground flex items-center justify-center text-content-tertiary font-bold text-lg border border-surface-border">
                  {official.photo ? (
                    <img src={official.photo} alt={official.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Icon name="user" size={24} />
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-content-primary leading-tight">{official.name}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block border ${
                    official.role === 'DIRECTOR' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                    official.role === 'ADMIN' ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-teal-50 text-brand-dark border-teal-100'
                  }`}>
                    {official.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="pl-3 space-y-2 mb-6 border-t border-surface-border pt-4 mt-4">
               <div className="flex items-center gap-2 text-xs text-content-secondary font-medium">
                 <Icon name="briefcase" size={14} className="text-content-tertiary"/> 
                 <span className="uppercase">{official.cargo || 'Sin cargo definido'}</span>
               </div>
               <div className="flex items-center gap-2 text-xs text-content-secondary font-medium">
                 <Icon name="fingerprint" size={14} className="text-content-tertiary"/> 
                 ID: {official.identification}
               </div>
               {/* Dato Legal de Vigencia */}
               <div className={`flex items-center gap-2 text-xs font-medium ${official.contractDateEnd ? 'text-blue-600' : 'text-content-secondary'}`}>
                 <Icon name="calendar" size={14} className="text-content-tertiary"/> 
                 Vence: {official.contractDateEnd || 'Indefinido'}
               </div>
            </div>

            <div className="flex gap-2 pl-3">
               {/* BOTÓN CARNET (NUEVO) */}
               <button 
                 onClick={() => setSelectedUserForId(official)}
                 className="flex-1 btn-secondary py-2 text-xs h-9 flex items-center justify-center gap-1"
                 title="Ver Carnet Digital"
               >
                 <Icon name="credit-card" size={14} /> Carnet
               </button>
               
               <button 
                 onClick={() => navigate(`/dashboard/team/edit/${official.id}`)}
                 className="flex-1 btn-secondary py-2 text-xs h-9 flex items-center justify-center gap-1"
               >
                 <Icon name="edit-2" size={14} /> Editar
               </button>
               
               <button 
                 onClick={() => handleDeleteRequest(official.id!)}
                 className="flex items-center justify-center w-9 h-9 rounded-xl border border-surface-border text-content-tertiary hover:bg-status-errorBg hover:border-status-error hover:text-status-error transition-all"
                 title="Revocar Acceso"
               >
                 <Icon name="trash-2" size={16} />
               </button>
            </div>
          </div>
        ))}
      </div>

      {officials.length === 0 && (
        <div className="text-center py-20 bg-surface-ground rounded-3xl border-2 border-dashed border-surface-border">
          <div className="text-content-tertiary mb-4 flex justify-center"><Icon name="users" size={48}/></div>
          <h3 className="text-lg font-bold text-content-secondary">No hay funcionarios registrados</h3>
          <p className="text-content-tertiary text-sm">Visite la sección de <strong>Ayuda</strong> para obtener la plantilla de carga.</p>
        </div>
      )}

      {/* IMPLEMENTACIÓN DEL PIN GUARD */}
      <PinGuardModal 
        isOpen={guardOpen} 
        onClose={() => setGuardOpen(false)}
        onSuccess={executeDelete}
        title="Revocar Acceso"
        message="Esta acción eliminará la cuenta del funcionario y le impedirá el acceso al sistema inmediatamente. ¿Autoriza la baja?"
      />

      {/* IMPLEMENTACIÓN DEL CARNET DIGITAL */}
      {selectedUserForId && (
        <DigitalIDCard 
          user={selectedUserForId} 
          onClose={() => setSelectedUserForId(null)} 
        />
      )}
    </div>
  );
};