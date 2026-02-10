import React, { useState, useRef } from 'react';
import { db } from '../../db';
import { Icon } from '../../components/ui/Icon';
import { backupHandler } from '../../utils/backupHandler';
import { useToast } from '../../context/ToastContext';
import { PinGuardModal } from '../../components/ui/PinGuardModal';
import { seedDatabase } from '../../utils/seedCensus';
import { excelHandler } from '../../utils/excelHandler';
import ExcelJS from 'exceljs';

// =============================================================================
// LÓGICA DE PARSEO Y DATOS (INTACTA)
// =============================================================================

const cleanString = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase();
};

const sanitizeNumber = (val: any): string => {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
};

const normalizeHeader = (header: string) => {
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeRecord = (raw: any) => {
  const exp = sanitizeNumber(raw['expediente'] || raw['expedientecum']);
  const cons = sanitizeNumber(raw['consecutivo'] || raw['consecutivocum']);
  
  let computedCum = exp;
  if (exp && cons) computedCum = `${exp}-${cons}`;

  return {
    expediente: computedCum,
    producto: cleanString(raw['producto'] || raw['nombreproducto'] || 'DESCONOCIDO'),
    titular: cleanString(raw['titular'] || raw['titularregistro']),
    registrosanitario: cleanString(raw['registrosanitario'] || raw['registro'] || raw['invima']),
    fechaexpedicion: cleanString(raw['fechaexpedicion']),
    fechavencimiento: cleanString(raw['fechavencimiento'] || raw['vencimiento']),
    estadoregistro: cleanString(raw['estadoregistro'] || raw['estado']),
    expedientecum: exp,
    consecutivocum: cons,
    cantidadcum: cleanString(raw['cantidadcum']),
    descripcioncomercial: cleanString(raw['descripcioncomercial'] || raw['presentacion']),
    estadocum: cleanString(raw['estadocum']),
    fechaactivo: cleanString(raw['fechaactivo']),
    fechainactivo: cleanString(raw['fechainactivo']),
    muestramedica: cleanString(raw['muestramedica']),
    unidad: cleanString(raw['unidad']),
    atc: cleanString(raw['atc']),
    descripcionatc: cleanString(raw['descripcionatc']),
    viaadministracion: cleanString(raw['viaadministracion']),
    concentracion: cleanString(raw['concentracion']),
    principioactivo: cleanString(raw['principioactivo'] || raw['principio']),
    unidadmedida: cleanString(raw['unidadmedida']),
    cantidad: cleanString(raw['cantidad']),
    unidadreferencia: cleanString(raw['unidadreferencia']),
    formafarmaceutica: cleanString(raw['formafarmaceutica'] || raw['forma']),
    nombrerol: cleanString(raw['nombrerol']),
    tiporol: cleanString(raw['tiporol']),
    modalidad: cleanString(raw['modalidad']),
    ium: cleanString(raw['ium'])
  };
};

// =============================================================================
// COMPONENTE VISUAL (PIXEL PERFECT RESTORATION)
// =============================================================================

export const MaintenanceCenter = () => {
  const { showToast } = useToast();
  
  type LoadingOperation = 'IDLE' | 'BACKUP' | 'RESTORE' | 'IMPORT_CUM' | 'IMPORT_CENSUS' | 'RESET_CENSUS' | 'RESET_ALL';
  const [loadingOp, setLoadingOp] = useState<LoadingOperation>('IDLE');
  
  const [guardOpen, setGuardOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string, payload?: any } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cumInputRef = useRef<HTMLInputElement>(null);
  const censusInputRef = useRef<HTMLInputElement>(null);

  const isBusy = loadingOp !== 'IDLE';

  // --- HANDLERS ---
  const handleBackup = async () => {
    setLoadingOp('BACKUP');
    try {
      await backupHandler.exportSystemData();
      showToast('Copia de seguridad generada.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al generar respaldo.', 'error');
    } finally {
      setLoadingOp('IDLE');
    }
  };

  const handleRestoreClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingOp('RESTORE');
    try {
      await backupHandler.importSystemData(file);
      showToast('Restauración completada. Reiniciando...', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      showToast('Archivo inválido.', 'error');
      setLoadingOp('IDLE');
    }
    e.target.value = '';
  };

  const handleCumImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoadingOp('IMPORT_CUM');
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const buffer = evt.target?.result as ArrayBuffer;
              const workbook = new ExcelJS.Workbook();
              await workbook.xlsx.load(buffer);
              const worksheet = workbook.getWorksheet(1);
              if (!worksheet) throw new Error("Archivo vacío.");
              await db.cums.clear();
              const batchSize = 1000;
              let batch: any[] = [];
              let count = 0;
              const colMap: Record<number, string> = {};
              worksheet.getRow(1).eachCell((cell, colNumber) => { if (cell.value) colMap[colNumber] = normalizeHeader(cell.value.toString()); });
              if (!Object.values(colMap).includes('expediente')) throw new Error("Falta columna Expediente.");
              
              for (let i = 2; i <= worksheet.rowCount; i++) {
                  const row = worksheet.getRow(i);
                  const rawData: any = {};
                  Object.keys(colMap).forEach((colIdx: any) => {
                      const val = row.getCell(Number(colIdx)).value;
                      rawData[colMap[colIdx]] = (val && typeof val === 'object' && 'text' in val) ? (val as any).text : val;
                  });
                  if (rawData['expediente']) { batch.push(normalizeRecord(rawData)); count++; }
                  if (batch.length >= batchSize) { await db.cums.bulkAdd(batch); batch = []; await new Promise(resolve => setTimeout(resolve, 0)); }
              }
              if (batch.length > 0) await db.cums.bulkAdd(batch);
              showToast(`Importación exitosa: ${count} registros.`, 'success');
          } catch (error) { console.error(error); showToast("Error importando CUM.", 'error'); } 
          finally { setLoadingOp('IDLE'); if (cumInputRef.current) cumInputRef.current.value = ''; }
      };
      reader.readAsArrayBuffer(file);
  };

  const handleCensusImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoadingOp('IMPORT_CENSUS');
      try {
          const establishments = await excelHandler.parseCensusExcel(file);
          if (establishments.length === 0) throw new Error("Sin registros.");
          await db.establishments.clear();
          await db.establishments.bulkAdd(establishments);
          showToast(`Censo actualizado: ${establishments.length} registros.`, 'success');
      } catch (error) { showToast('Error importando censo.', 'error'); } 
      finally { setLoadingOp('IDLE'); if (censusInputRef.current) censusInputRef.current.value = ''; }
  };

  const requestAction = (action: { type: string, payload?: any }) => { setPendingAction(action); setGuardOpen(true); };
  const executePendingAction = async () => {
    if (!pendingAction) return;
    try {
        if (pendingAction.type === 'RESET_CENSUS') { setLoadingOp('RESET_CENSUS'); await db.establishments.clear(); await db.cums.clear(); showToast('Datos eliminados.', 'warning'); } 
        else if (pendingAction.type === 'RESET_ALL') { setLoadingOp('RESET_ALL'); await db.delete(); showToast('Reset de fábrica.', 'warning'); setTimeout(() => window.location.reload(), 1000); }
        else if (pendingAction.type === 'SEED_CENSUS') { setLoadingOp('IMPORT_CENSUS'); await seedDatabase(); showToast('Datos demo cargados.', 'success'); }
        else if (pendingAction.type === 'LOAD_CUM') { cumInputRef.current?.click(); }
        else if (pendingAction.type === 'LOAD_CENSUS') { censusInputRef.current?.click(); }
    } catch (e) { showToast('Error.', 'error'); } 
    finally { if (pendingAction.type !== 'LOAD_CUM' && pendingAction.type !== 'LOAD_CENSUS') setLoadingOp('IDLE'); setGuardOpen(false); setPendingAction(null); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      {/* HEADER: Basado en image_13ffb4.png */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="flex items-center gap-4">
            {/* Ícono grande decorativo (Engranaje) */}
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner border border-slate-200/50">
                <Icon name="settings" size={32}/>
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Mantenimiento</h1>
                <p className="text-slate-500 font-medium">Gestión de datos maestros y seguridad del sistema</p>
            </div>
        </div>
        <div>
             <div className="px-4 py-2 bg-slate-50 text-slate-700 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-2 shadow-sm">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div> Sistema Activo
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: BASES DE DATOS (2/3 ANCHO) */}
        <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="database" size={14}/> BASES DE DATOS MAESTRAS
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TARJETA CUM (AZUL) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full">
                    <div className="p-8 flex-1">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
                            <Icon name="server" size={24}/>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 mb-2">Base de Datos CUM</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Importe el archivo maestro (.xlsx) del INVIMA para habilitar el motor de búsqueda offline.
                        </p>
                    </div>
                    {/* Footer: Estado a la izquierda, Botón a la derecha */}
                    <div className="p-6 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-300 uppercase">ESTADO: DESCONOCIDO</span>
                        <button 
                            onClick={() => requestAction({ type: 'LOAD_CUM' })} 
                            disabled={isBusy}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loadingOp === 'IMPORT_CUM' ? <Icon name="loader" className="animate-spin" size={16}/> : <Icon name="upload-cloud" size={18}/>}
                            {loadingOp === 'IMPORT_CUM' ? 'Procesando...' : 'Cargar CUM'}
                        </button>
                    </div>
                    <input type="file" ref={cumInputRef} className="hidden" accept=".xlsx" onChange={handleCumImport} />
                </div>

                {/* TARJETA CENSO (VERDE) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full">
                    <div className="p-8 flex-1">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
                            <Icon name="map" size={24}/>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 mb-2">Censo de Establecimientos</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Gestione el listado de sujetos de control. Soporta carga masiva o reinicio de datos.
                        </p>
                    </div>
                    {/* Footer: Dos botones a la derecha */}
                    <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                        <button 
                            onClick={() => requestAction({ type: 'SEED_CENSUS' })} 
                            disabled={isBusy}
                            className="px-4 py-3 bg-white border border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-600 text-sm font-bold rounded-lg transition-all"
                        >
                            Cargar Demo
                        </button>
                        <button 
                            onClick={() => requestAction({ type: 'LOAD_CENSUS' })} 
                            disabled={isBusy}
                            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {loadingOp === 'IMPORT_CENSUS' ? <Icon name="loader" className="animate-spin" size={16}/> : <Icon name="file-text" size={18}/>}
                            Importar Excel
                        </button>
                    </div>
                    <input type="file" ref={censusInputRef} className="hidden" accept=".xlsx" onChange={handleCensusImport} />
                </div>
            </div>
        </div>

        {/* COLUMNA DERECHA: SEGURIDAD (1/3 ANCHO) */}
        <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="shield" size={14}/> SEGURIDAD DE DATOS
            </h3>

            {/* PANEL BLANCO DE ACCIONES DE RESPALDO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
                <button 
                    onClick={handleBackup} 
                    disabled={isBusy}
                    className="w-full p-4 hover:bg-slate-50 transition-colors text-left flex items-center gap-4 group disabled:opacity-50 rounded-xl"
                >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                        {loadingOp === 'BACKUP' ? <Icon name="loader" className="animate-spin" size={20}/> : <Icon name="download" size={20}/>}
                    </div>
                    <div>
                        <h5 className="font-bold text-slate-700 text-sm group-hover:text-blue-700">Crear Copia de Seguridad</h5>
                        <p className="text-xs text-slate-400 mt-0.5">Descargar .json encriptado</p>
                    </div>
                </button>

                <div className="h-px bg-slate-100 mx-4 my-1"></div>

                <button 
                    onClick={handleRestoreClick} 
                    disabled={isBusy}
                    className="w-full p-4 hover:bg-slate-50 transition-colors text-left flex items-center gap-4 group disabled:opacity-50 rounded-xl"
                >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                        {loadingOp === 'RESTORE' ? <Icon name="loader" className="animate-spin" size={20}/> : <Icon name="refresh-cw" size={20}/>}
                    </div>
                    <div>
                        <h5 className="font-bold text-slate-700 text-sm group-hover:text-blue-700">Restaurar Sistema</h5>
                        <p className="text-xs text-slate-400 mt-0.5">Desde archivo local</p>
                    </div>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            </div>

            {/* PANEL ROJO DE PELIGRO */}
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                <div className="flex items-center gap-2 mb-3 text-red-700">
                    <Icon name="alert-triangle" size={18}/>
                    <h4 className="text-xs font-black uppercase tracking-wider">ZONA DE PELIGRO</h4>
                </div>
                <p className="text-xs text-red-800/80 mb-6 leading-relaxed">
                    Estas acciones son destructivas. Se requerirá autenticación mediante PIN de seguridad.
                </p>
                <div className="space-y-3">
                    <button 
                        onClick={() => requestAction({ type: 'RESET_CENSUS' })} 
                        disabled={isBusy}
                        className="w-full py-3 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        {loadingOp === 'RESET_CENSUS' ? <Icon name="loader" className="animate-spin" size={16}/> : <Icon name="trash-2" size={16}/>}
                        Limpiar Datos Operativos
                    </button>
                    <button 
                        onClick={() => requestAction({ type: 'RESET_ALL' })} 
                        disabled={isBusy}
                        className="w-full py-3 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {loadingOp === 'RESET_ALL' ? <Icon name="loader" className="animate-spin" size={16}/> : <Icon name="alert-octagon" size={16}/>}
                        Restablecimiento de Fábrica
                    </button>
                </div>
            </div>
        </div>
      </div>

      <PinGuardModal
        isOpen={guardOpen}
        onClose={() => { setGuardOpen(false); setPendingAction(null); }}
        onSuccess={executePendingAction}
        title="Confirmación de Seguridad"
        message="Esta acción es sensible. Ingrese su PIN de seguridad para autorizar."
      />
    </div>
  );
};