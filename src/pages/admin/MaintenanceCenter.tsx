import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { backupHandler } from '../../utils/backupHandler';
import { useToast } from '../../context/ToastContext';
import { PinGuardModal } from '../../components/ui/PinGuardModal';
import { seedDatabase } from '../../utils/seedCensus';
import { excelHandler } from '../../utils/excelHandler';
import ExcelJS from 'exceljs';

// =============================================================================
// PARSER INDUSTRIAL DE CUMS (REFACTORIZADO - INGESTA AGRESIVA)
// =============================================================================

const cleanString = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase();
};

const sanitizeNumber = (val: any): string => {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
};

// Convierte "Expediente CUM" -> "expedientecum" para evitar errores de tipeo en Excel
const normalizeHeader = (header: string) => {
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeRecord = (raw: any) => {
  // Extracción segura usando claves normalizadas
  const exp = sanitizeNumber(raw['expediente'] || raw['expedientecum']);
  const cons = sanitizeNumber(raw['consecutivo'] || raw['consecutivocum']);
  
  // Construcción del CUM Compuesto (Clave de Búsqueda)
  let computedCum = exp;
  if (exp && cons) {
      computedCum = `${exp}-${cons}`;
  }

  return {
    expediente: computedCum, // Este es el campo que busca el sistema
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
// COMPONENTE PRINCIPAL
// =============================================================================

export const MaintenanceCenter = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  type LoadingOperation = 'IDLE' | 'BACKUP' | 'RESTORE' | 'IMPORT_CUM' | 'IMPORT_CENSUS' | 'RESET_CENSUS' | 'RESET_ALL';
  const [loadingOp, setLoadingOp] = useState<LoadingOperation>('IDLE');
  
  const [guardOpen, setGuardOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string, payload?: any } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cumInputRef = useRef<HTMLInputElement>(null);
  const censusInputRef = useRef<HTMLInputElement>(null);

  const isBusy = loadingOp !== 'IDLE';

  // --- MANEJADORES DE BACKUP ---
  const handleBackup = async () => {
    setLoadingOp('BACKUP');
    try {
      await backupHandler.exportSystemData();
      showToast('Copia de seguridad descargada', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error creando copia', 'error');
    } finally {
      setLoadingOp('IDLE');
    }
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoadingOp('RESTORE');
    try {
      await backupHandler.importSystemData(file);
      showToast('Base de datos restaurada. Reiniciando...', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error(error);
      showToast('Archivo de respaldo inválido', 'error');
      setLoadingOp('IDLE');
    }
    e.target.value = '';
  };

  // --- MANEJADOR DE IMPORTACIÓN CUM (LOGICA REFORZADA) ---
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
              if (!worksheet) throw new Error("Archivo Excel vacío o sin hojas.");

              // Limpieza de DB
              await db.cums.clear();

              const batchSize = 1000;
              let batch: any[] = [];
              let count = 0;

              // MAPEO INTELIGENTE DE HEADERS
              // Leemos la fila 1 y creamos un mapa: { 1: 'expediente', 2: 'producto'... }
              const colMap: Record<number, string> = {};
              const headerRow = worksheet.getRow(1);
              
              headerRow.eachCell((cell, colNumber) => {
                  const rawHeader = cell.value?.toString() || '';
                  if (rawHeader) {
                      colMap[colNumber] = normalizeHeader(rawHeader);
                  }
              });

              // Si no encontramos columnas clave, abortamos
              if (!Object.values(colMap).includes('expediente') && !Object.values(colMap).includes('producto')) {
                  throw new Error("El archivo no parece tener columnas 'Expediente' o 'Producto' válidas.");
              }

              // PROCESAMIENTO
              for (let i = 2; i <= worksheet.rowCount; i++) {
                  const row = worksheet.getRow(i);
                  const rawData: any = {};
                  
                  // Extraer datos usando el mapa de columnas
                  Object.keys(colMap).forEach((colIdx: any) => {
                      const key = colMap[colIdx];
                      const cell = row.getCell(Number(colIdx));
                      
                      // Manejo de Rich Text de Excel
                      const val = (cell.value && typeof cell.value === 'object' && 'text' in cell.value) 
                          ? (cell.value as any).text 
                          : cell.value;
                          
                      rawData[key] = val;
                  });

                  // Solo procesar si tiene al menos un expediente o producto
                  if (rawData['expediente'] || rawData['producto']) {
                      const cleanRecord = normalizeRecord(rawData);
                      batch.push(cleanRecord);
                      count++;
                  }

                  if (batch.length >= batchSize) {
                      await db.cums.bulkAdd(batch);
                      batch = [];
                      // Yield al navegador
                      await new Promise(resolve => setTimeout(resolve, 0));
                  }
              }

              if (batch.length > 0) {
                  await db.cums.bulkAdd(batch);
              }

              if (count === 0) {
                  showToast("⚠️ Advertencia: No se encontraron registros válidos para importar.", "warning");
              } else {
                  showToast(`✅ Éxito: Se importaron ${count} medicamentos correctamente.`, 'success');
              }

          } catch (error) {
              console.error("Error importando CUM:", error);
              showToast("Error procesando archivo. Verifique el formato.", 'error');
          } finally {
              setLoadingOp('IDLE');
              if (cumInputRef.current) cumInputRef.current.value = '';
          }
      };

      reader.readAsArrayBuffer(file);
  };

  // --- MANEJADOR DE IMPORTACIÓN CENSO ---
  const handleCensusImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoadingOp('IMPORT_CENSUS');
      try {
          const establishments = await excelHandler.parseCensusExcel(file);
          if (establishments.length === 0) throw new Error("No se encontraron registros");
          
          await db.establishments.clear();
          await db.establishments.bulkAdd(establishments);
          
          showToast(`Censo actualizado: ${establishments.length} establecimientos`, 'success');
      } catch (error) {
          console.error(error);
          showToast('Error al importar el censo. Verifique el formato.', 'error');
      } finally {
          setLoadingOp('IDLE');
          if (censusInputRef.current) censusInputRef.current.value = '';
      }
  };

  // --- ACCIONES PROTEGIDAS ---
  const requestAction = (action: { type: string, payload?: any }) => {
    setPendingAction(action);
    setGuardOpen(true);
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    
    try {
        if (pendingAction.type === 'RESET_CENSUS') {
            setLoadingOp('RESET_CENSUS');
            await db.establishments.clear();
            await db.cums.clear(); 
            showToast('Censo y BD CUM eliminados.', 'warning');
        } 
        else if (pendingAction.type === 'RESET_ALL') {
            setLoadingOp('RESET_ALL');
            await db.delete();
            showToast('Sistema reseteado de fábrica.', 'warning');
            setTimeout(() => window.location.reload(), 1000);
        }
        else if (pendingAction.type === 'SEED_CENSUS') {
            setLoadingOp('IMPORT_CENSUS');
            await seedDatabase();
            showToast('Censo de prueba cargado.', 'success');
        }
        else if (pendingAction.type === 'LOAD_CUM') {
            if (cumInputRef.current) cumInputRef.current.click();
        }
        else if (pendingAction.type === 'LOAD_CENSUS') {
            if (censusInputRef.current) censusInputRef.current.click();
        }
    } catch (e) {
        console.error(e);
        showToast('Error ejecutando acción', 'error');
    } finally {
        if (pendingAction.type !== 'LOAD_CUM' && pendingAction.type !== 'LOAD_CENSUS') {
            setLoadingOp('IDLE');
        }
        setGuardOpen(false);
        setPendingAction(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          <Icon name="arrow-left" size={20}/> Volver
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Centro de Mantenimiento</h1>
          <p className="text-slate-500 text-sm">Gestión de datos, copias de seguridad y restablecimiento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BACKUP SECTION */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Respaldo y Recuperación</h3>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="mb-4">
              <h4 className="font-bold text-slate-700">Copia de Seguridad (Backup)</h4>
              <p className="text-xs text-slate-500 mt-1">Descarga un archivo encriptado (.json) con toda la información local.</p>
            </div>
            <button onClick={handleBackup} disabled={isBusy} className="w-full py-3 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {loadingOp === 'BACKUP' ? <Icon name="loader" className="animate-spin"/> : <Icon name="download" size={16}/>} Generar Copia
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="mb-4">
              <h4 className="font-bold text-slate-700">Restaurar Copia</h4>
              <p className="text-xs text-slate-500 mt-1">Importa un archivo de respaldo. <span className="text-red-500 font-bold">Sobrescribirá los datos actuales.</span></p>
            </div>
            <button onClick={handleRestoreClick} disabled={isBusy} className="w-full py-3 bg-white text-slate-700 font-bold text-sm rounded-lg border-2 border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {loadingOp === 'RESTORE' ? <Icon name="loader" className="animate-spin"/> : <Icon name="upload" size={16}/>} Seleccionar Archivo
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
          </div>
        </div>

        {/* DATA SECTION */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Base de Datos Maestra</h3>
          
          <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 bg-blue-100 rounded-bl-xl text-blue-600"><Icon name="database" size={20}/></div>
            <div className="mb-4">
              <h4 className="font-bold text-blue-900">Base de Datos INVIMA (CUM)</h4>
              <p className="text-xs text-blue-700/70 mt-1">Importar archivo maestro (.xlsx) para validación offline.</p>
            </div>
            <button onClick={() => requestAction({ type: 'LOAD_CUM' })} disabled={isBusy} className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {loadingOp === 'IMPORT_CUM' ? <Icon name="loader" className="animate-spin"/> : <Icon name="file-plus" size={16}/>}
                {loadingOp === 'IMPORT_CUM' ? 'Indexando CUM...' : 'Cargar CUM (Excel)'}
            </button>
            <input type="file" ref={cumInputRef} className="hidden" accept=".xlsx" onChange={handleCumImport} />
          </div>

          <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between h-full">
            <div className="mb-4">
              <h4 className="font-bold text-emerald-900">Gestión de Censo</h4>
              <p className="text-xs text-emerald-700/70 mt-1">Cargar base de establecimientos (Real o Prueba).</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => requestAction({ type: 'LOAD_CENSUS' })} disabled={isBusy} className="flex-1 py-3 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-1 disabled:opacity-50">
                    {loadingOp === 'IMPORT_CENSUS' ? <Icon name="loader" className="animate-spin"/> : <Icon name="upload-cloud" size={14}/>} Cargar Excel
                </button>
                <button onClick={() => requestAction({ type: 'SEED_CENSUS' })} disabled={isBusy} className="flex-1 py-3 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1 disabled:opacity-50">
                    <Icon name="database" size={14}/> Demo
                </button>
            </div>
            <input type="file" ref={censusInputRef} className="hidden" accept=".xlsx" onChange={handleCensusImport} />
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-200">
        <h3 className="text-xs font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-2"><Icon name="alert-triangle" size={16}/> Zona de Peligro</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between h-full">
            <div className="mb-4"><h4 className="font-bold text-red-900">Limpiar Base de Datos</h4><p className="text-xs text-red-700/70 mt-1">Elimina establecimientos y base de medicamentos.</p></div>
            <button onClick={() => requestAction({ type: 'RESET_CENSUS' })} disabled={isBusy} className="w-full py-3 bg-red-50 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {loadingOp === 'RESET_CENSUS' ? <Icon name="loader" className="animate-spin"/> : <Icon name="trash-2" size={16}/>} Eliminar Censo
            </button>
          </div>
          <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between h-full">
            <div className="mb-4"><h4 className="font-bold text-red-900">Restablecimiento de Fábrica</h4><p className="text-xs text-red-700/70 mt-1">Elimina TODO excepto los usuarios.</p></div>
            <button onClick={() => requestAction({ type: 'RESET_ALL' })} disabled={isBusy} className="w-full py-3 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {loadingOp === 'RESET_ALL' ? <Icon name="loader" className="animate-spin"/> : <Icon name="refresh-ccw" size={16}/>} Resetear Sistema
            </button>
          </div>
        </div>
      </div>

      <PinGuardModal isOpen={guardOpen} onClose={() => { setGuardOpen(false); setPendingAction(null); }} onSuccess={executePendingAction} title="Confirmación de Seguridad" message="Esta acción es sensible. Por favor ingrese su PIN de seguridad para continuar." />
    </div>
  );
};