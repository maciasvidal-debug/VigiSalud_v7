import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs'; 
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/useAuthStore'; // Auth Store
import { PinGuardModal } from '../../components/ui/PinGuardModal';
import { useToast } from '../../context/ToastContext';

export const CensusList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore(); // Obtener usuario
  const { showToast } = useToast(); 
  const [search, setSearch] = useState("");
  
  const [guardOpen, setGuardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // PERMISOS: Definimos quién puede gestionar (Admin/Director/Coord)
  const canManage = user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'COORDINADOR';
  const isInspector = user?.role === 'INSPECTOR';

  const establishments = useLiveQuery(async () => {
    if (!db.establishments) return [];

    let collection = db.establishments.orderBy('id').reverse();
    if (search) {
      return await collection.filter(est => 
        est.name.toLowerCase().includes(search.toLowerCase()) || 
        est.nit.includes(search)
      ).toArray();
    }
    return await collection.limit(50).toArray();
  }, [search]) ?? [];

  // --- LÓGICA DE IMPORTACIÓN (Solo ejecutada si tiene permisos) ---
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManage) return; 
    
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
        
        const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        const headerRow = worksheet.getRow(1);
        const colMap: Record<string, number> = {};

        headerRow.eachCell((cell, colNumber) => {
          const text = normalize(cell.text);
          if (text.includes('nit') || text.includes('identificacion')) colMap['nit'] = colNumber;
          else if (text.includes('comercial')) colMap['commercialName'] = colNumber;
          else if (text.includes('razon') || text.includes('nombre')) colMap['name'] = colNumber;
          else if (text.includes('municipio') || text.includes('ciudad')) colMap['city'] = colNumber;
          else if (text.includes('direccion') || text.includes('ubicacion')) colMap['address'] = colNumber;
          else if (text.includes('email') || text.includes('correo')) colMap['email'] = colNumber;
          else if (text.includes('telefono')) colMap['phone'] = colNumber;
          else if (text.includes('actividad')) colMap['type'] = colNumber;
          else if (text.includes('responsable')) colMap['responsibleName'] = colNumber;
        });

        if (!colMap['name'] && !colMap['nit']) {
          showToast("⚠️ No pudimos identificar columnas clave (NIT o Nombre).", 'warning');
          return;
        }

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const getVal = (field: string) => {
            const idx = colMap[field];
            if (!idx) return '';
            const val = row.getCell(idx).text;
            return val ? val.trim() : '';
          };

          const name = getVal('name');
          const nit = getVal('nit');

          if (name || nit) {
             const mappedItem = {
                nit: nit || 'SIN-NIT',
                name: name || 'SIN NOMBRE',
                commercialName: getVal('commercialName'),
                city: getVal('city') || 'BARRANQUILLA',
                address: getVal('address') || 'PENDIENTE',
                emailJudicial: getVal('email') || 'NO_INFORMA',
                phone: getVal('phone'),
                type: getVal('type') || 'Otro',
                responsibleName: getVal('responsibleName'),
                status: 'ACTIVO',
                category: 'FORMAL'
             };
             jsonData.push(mappedItem);
          }
        });

        if (jsonData.length > 0) {
          await db.establishments.bulkPut(jsonData);
          showToast(`✅ Importación completada: ${jsonData.length} registros.`, 'success');
        } else {
          showToast("⚠️ El archivo parece estar vacío.", 'warning');
        }
      } catch (error) {
        showToast("❌ Error al leer el archivo.", 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; 
  };

  const handleExport = async () => {
    try {
      const allData = await db.establishments.toArray();
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Censo VigiSalud');

      if (allData.length > 0) {
        const keys = Object.keys(allData[0]);
        sheet.columns = keys.map(key => ({ header: key.toUpperCase(), key: key, width: 20 }));
        sheet.addRows(allData);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Censo_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      showToast("Base de datos exportada.", 'success');
    } catch (err) {
      showToast("Error al exportar.", 'error');
    }
  };

  const handleDeleteRequest = (id: number) => { 
    if (!canManage) return;
    setSelectedId(id); 
    setGuardOpen(true); 
  };
  
  const executeDelete = async () => {
    if (selectedId) {
      await db.establishments.delete(selectedId);
      setGuardOpen(false);
      setSelectedId(null);
      showToast("Establecimiento eliminado.", 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="card-base p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-content-primary tracking-tight">Padrón de Vigilados</h1>
          <p className="text-content-secondary font-medium text-sm">Gestión del censo sanitario departamental.</p>
        </div>
        
        {/* BLINDAJE: Solo Managers ven botones de gestión */}
        {canManage && (
          <div className="flex flex-wrap gap-2">
             <button onClick={handleExport} className="btn-secondary"><Icon name="download" size={16} /> Exportar</button>
             <label className="btn-secondary cursor-pointer">
               <Icon name="upload" size={16} /> Importar Excel
               <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
             </label>
             <button onClick={() => navigate('/dashboard/census/new')} className="btn-primary"><Icon name="plus" size={16} /> Nuevo Vigilado</button>
          </div>
        )}
      </div>

      <div className="card-base p-2">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-content-tertiary"><Icon name="search" size={20} /></div>
          <input 
            type="text" 
            placeholder="Buscar por NIT, Razón Social o Nombre Comercial..." 
            className="w-full pl-12 pr-4 py-3 rounded-xl outline-none text-content-primary font-medium placeholder:text-content-tertiary bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {establishments.map((est) => (
          <div key={est.id} className="card-base p-6 hover:shadow-lg hover:border-brand-light transition-all group">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge label={est.category} variant="neutral" />
                  <span className="text-xs font-bold text-content-tertiary font-mono tracking-wide">NIT: {est.nit}</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-content-primary leading-tight group-hover:text-brand transition-colors">{est.name}</h3>
                  {est.commercialName && est.commercialName !== est.name && <p className="text-sm text-content-secondary font-medium mt-1">"{est.commercialName}"</p>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-content-secondary font-medium pt-2">
                  <div className="flex items-center gap-1.5 text-content-primary bg-surface-ground px-3 py-1 rounded-full border border-surface-border">
                    <Icon name="map-pin" size={14} className="text-brand" /> <span className="uppercase font-bold text-xs">{est.city}</span>
                  </div>
                  {est.responsibleName && <div className="flex items-center gap-1.5 text-xs"><span className="text-content-tertiary">|</span> <Icon name="user" size={14} /> {est.responsibleName}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3 self-end lg:self-center">
                {isInspector ? (
                  <button onClick={() => navigate(`/dashboard/inspections/new/${est.id}`)} className="btn-primary"><Icon name="play" size={18} fill="currentColor" /> Inspeccionar</button>
                ) : (
                  <button onClick={() => navigate(`/dashboard/census/${est.id}`)} className="btn-secondary"><Icon name="file-text" size={18} /> Ver Expediente</button>
                )}
                
                {/* BLINDAJE: Solo Managers pueden eliminar */}
                {canManage && (
                  <button onClick={() => handleDeleteRequest(est.id!)} className="p-3 text-content-tertiary hover:text-status-error hover:bg-status-errorBg rounded-xl transition-colors"><Icon name="trash-2" size={18} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
        {establishments.length === 0 && (
          <div className="text-center py-20 bg-surface-ground rounded-3xl border-2 border-dashed border-surface-border">
            <div className="text-content-tertiary mb-4 flex justify-center"><Icon name="store" size={48} /></div>
            <h3 className="text-lg font-bold text-content-secondary">Lista vacía</h3>
          </div>
        )}
      </div>

      <PinGuardModal 
        isOpen={guardOpen} 
        onClose={() => setGuardOpen(false)}
        onSuccess={executeDelete}
        title="Eliminar Vigilado"
        message="Esta acción eliminará el establecimiento permanentemente."
      />
    </div>
  );
};