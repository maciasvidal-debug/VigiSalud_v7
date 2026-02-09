import React, { useState, useRef } from 'react';
import { db } from '../../db';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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

const normalizeHeader = (header: string) => {
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeRecord = (raw: any) => {
  const exp = sanitizeNumber(raw['expediente'] || raw['expedientecum']);
  const cons = sanitizeNumber(raw['consecutivo'] || raw['consecutivocum']);
  
  let computedCum = exp;
  if (exp && cons) {
      computedCum = `${exp}-${cons}`;
  }

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
// COMPONENTE PRINCIPAL
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

  // --- MANEJADORES ---
  const handleBackup = async () => {
    setLoadingOp('BACKUP');
    try {
      await backupHandler.exportSystemData();
      showToast('Copia de respaldo descargada exitosamente.', 'success');
    } catch (e) {
      console.error(e);
      showToast('No se pudo crear la copia de respaldo.', 'error');
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
      showToast('Sistema restaurado correctamente. Reiniciando...', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error(error);
      showToast('El archivo de respaldo no es válido.', 'error');
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
              if (!worksheet) throw new Error("El archivo Excel está vacío o no tiene hojas.");

              await db.cums.clear();

              const batchSize = 1000;
              let batch: any[] = [];
              let count = 0;

              const colMap: Record<number, string> = {};
              const headerRow = worksheet.getRow(1);
              
              headerRow.eachCell((cell, colNumber) => {
                  const rawHeader = cell.value?.toString() || '';
                  if (rawHeader) {
                      colMap[colNumber] = normalizeHeader(rawHeader);
                  }
              });

              if (!Object.values(colMap).includes('expediente') && !Object.values(colMap).includes('producto')) {
                  throw new Error("El archivo no tiene las columnas requeridas ('Expediente' o 'Producto').");
              }

              for (let i = 2; i <= worksheet.rowCount; i++) {
                  const row = worksheet.getRow(i);
                  const rawData: any = {};
                  
                  Object.keys(colMap).forEach((colIdx: any) => {
                      const key = colMap[colIdx];
                      const cell = row.getCell(Number(colIdx));
                      const val = (cell.value && typeof cell.value === 'object' && 'text' in cell.value) 
                          ? (cell.value as any).text 
                          : cell.value;
                      rawData[key] = val;
                  });

                  if (rawData['expediente'] || rawData['producto']) {
                      const cleanRecord = normalizeRecord(rawData);
                      batch.push(cleanRecord);
                      count++;
                  }

                  if (batch.length >= batchSize) {
                      await db.cums.bulkAdd(batch);
                      batch = [];
                      await new Promise(resolve => setTimeout(resolve, 0));
                  }
              }

              if (batch.length > 0) {
                  await db.cums.bulkAdd(batch);
              }

              if (count === 0) {
                  showToast("⚠️ Advertencia: No se encontraron registros válidos para importar.", "warning");
              } else {
                  showToast(`✅ Proceso Exitoso: Se importaron ${count} medicamentos.`, 'success');
              }

          } catch (error) {
              console.error("Error importando CUM:", error);
              showToast("Error al procesar el archivo. Verifique el formato.", 'error');
          } finally {
              setLoadingOp('IDLE');
              if (cumInputRef.current) cumInputRef.current.value = '';
          }
      };

      reader.readAsArrayBuffer(file);
  };

  const handleCensusImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoadingOp('IMPORT_CENSUS');
      try {
          const establishments = await excelHandler.parseCensusExcel(file);
          if (establishments.length === 0) throw new Error("No se encontraron registros");
          
          await db.establishments.clear();
          await db.establishments.bulkAdd(establishments);
          
          showToast(`Directorio actualizado: ${establishments.length} establecimientos cargados.`, 'success');
      } catch (error) {
          console.error(error);
          showToast('Error al importar el archivo. Verifique el formato.', 'error');
      } finally {
          setLoadingOp('IDLE');
          if (censusInputRef.current) censusInputRef.current.value = '';
      }
  };

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
            showToast('Catálogos y Directorio eliminados correctamente.', 'warning');
        } 
        else if (pendingAction.type === 'RESET_ALL') {
            setLoadingOp('RESET_ALL');
            await db.delete();
            showToast('Sistema restaurado a estado de fábrica.', 'warning');
            setTimeout(() => window.location.reload(), 1000);
        }
        else if (pendingAction.type === 'SEED_CENSUS') {
            setLoadingOp('IMPORT_CENSUS');
            await seedDatabase();
            showToast('Datos de prueba cargados correctamente.', 'success');
        }
        else if (pendingAction.type === 'LOAD_CUM') {
            if (cumInputRef.current) cumInputRef.current.click();
        }
        else if (pendingAction.type === 'LOAD_CENSUS') {
            if (censusInputRef.current) censusInputRef.current.click();
        }
    } catch (e) {
        console.error(e);
        showToast('Ocurrió un error al ejecutar la acción.', 'error');
    } finally {
        if (pendingAction.type !== 'LOAD_CUM' && pendingAction.type !== 'LOAD_CENSUS') {
            setLoadingOp('IDLE');
        }
        setGuardOpen(false);
        setPendingAction(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* HEADER COMPACTO */}
      <div className="flex flex-col gap-1 mb-4">
          <h1 className="text-xl font-black text-slate-800">Centro de Mantenimiento</h1>
          <p className="text-slate-500 text-sm">Herramientas para la gestión de datos, respaldos y configuración del sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* TARJETA 1: GESTIÓN DE DATOS (RESPALDO) */}
        <Card title="Respaldo de Información" icon="save">
            <div className="space-y-4 p-1">
              {/* Opción Backup */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><Icon name="download" size={18}/></div>
                      <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-700">Crear Copia de Seguridad</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">Guarde una copia completa de su trabajo actual en un archivo seguro.</p>
                          <Button onClick={handleBackup} disabled={isBusy} variant="primary" className="w-full h-9 text-xs shadow-sm">
                              {loadingOp === 'BACKUP' ? <Icon name="loader" className="animate-spin"/> : <Icon name="save" size={14}/>}
                              Descargar Copia
                          </Button>
                      </div>
                  </div>
              </div>

              {/* Opción Restaurar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm"><Icon name="upload" size={18}/></div>
                      <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-700">Restaurar Información</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">Recupere sus datos usando un archivo de copia de seguridad previo.</p>
                          <Button onClick={handleRestoreClick} disabled={isBusy} variant="secondary" className="w-full h-9 text-xs bg-white border-slate-300">
                              {loadingOp === 'RESTORE' ? <Icon name="loader" className="animate-spin"/> : <Icon name="refresh-cw" size={14}/>}
                              Cargar Archivo
                          </Button>
                          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                      </div>
                  </div>
              </div>
            </div>
        </Card>

        {/* TARJETA 2: CATÁLOGOS Y DIRECTORIOS */}
        <Card title="Catálogos del Sistema" icon="database">
            <div className="space-y-4 p-1">
              {/* Opción CUM */}
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm"><Icon name="search" size={18}/></div>
                      <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-700">Maestro de Medicamentos (CUM)</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">Actualice el listado oficial de medicamentos aprobados por el INVIMA.</p>
                          <Button onClick={() => requestAction({ type: 'LOAD_CUM' })} disabled={isBusy} className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200">
                              {loadingOp === 'IMPORT_CUM' ? <Icon name="loader" className="animate-spin"/> : <Icon name="file-plus" size={14}/>}
                              Importar Excel CUM
                          </Button>
                          <input type="file" ref={cumInputRef} className="hidden" accept=".xlsx" onChange={handleCumImport} />
                      </div>
                  </div>
              </div>

              {/* Opción Censo */}
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm"><Icon name="map-pin" size={18}/></div>
                      <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-700">Directorio de Establecimientos</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">Gestione el listado de lugares sujetos a vigilancia y control.</p>
                          <div className="flex gap-2">
                              <Button onClick={() => requestAction({ type: 'LOAD_CENSUS' })} disabled={isBusy} variant="secondary" className="flex-1 h-9 text-xs bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                  <Icon name="upload" size={14}/> Importar
                              </Button>
                              <Button onClick={() => requestAction({ type: 'SEED_CENSUS' })} disabled={isBusy} variant="ghost" className="flex-1 h-9 text-xs text-slate-400 hover:text-indigo-600">
                                  <Icon name="database" size={14}/> Ejemplo
                              </Button>
                          </div>
                          <input type="file" ref={censusInputRef} className="hidden" accept=".xlsx" onChange={handleCensusImport} />
                      </div>
                  </div>
              </div>
            </div>
        </Card>

        {/* TARJETA 3: ACCIONES CRÍTICAS (FULL WIDTH) */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-red-100 bg-red-50/30 overflow-hidden">
             <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <Icon name="alert-triangle" size={16} className="text-red-500"/>
                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest">Zona de Operaciones Sensibles</h3>
             </div>

             <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-xl shadow-sm">
                     <div className="mr-4">
                         <h4 className="text-sm font-bold text-slate-700">Limpiar Catálogos</h4>
                         <p className="text-[10px] text-slate-400 mt-0.5">Borra CUM y Directorio. No toca inspecciones.</p>
                     </div>
                     <Button onClick={() => requestAction({ type: 'RESET_CENSUS' })} disabled={isBusy} variant="secondary" className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50">
                        {loadingOp === 'RESET_CENSUS' ? <Icon name="loader" className="animate-spin"/> : <Icon name="trash" size={14}/>}
                        Limpiar
                     </Button>
                 </div>

                 <div className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-xl shadow-sm">
                     <div className="mr-4">
                         <h4 className="text-sm font-bold text-slate-700">Restablecer Todo</h4>
                         <p className="text-[10px] text-slate-400 mt-0.5">Borra TODA la información y reinicia la app.</p>
                     </div>
                     <Button onClick={() => requestAction({ type: 'RESET_ALL' })} disabled={isBusy} className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200">
                        {loadingOp === 'RESET_ALL' ? <Icon name="loader" className="animate-spin"/> : <Icon name="alert-octagon" size={14}/>}
                        Borrar Todo
                     </Button>
                 </div>
             </div>
          </div>
        </div>

      </div>

      <PinGuardModal isOpen={guardOpen} onClose={() => { setGuardOpen(false); setPendingAction(null); }} onSuccess={executePendingAction} title="Autorización Requerida" message="Esta operación es sensible. Por favor ingrese su PIN de seguridad para continuar." />
    </div>
  );
};
