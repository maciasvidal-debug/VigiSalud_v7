import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // --- MANEJADORES ---
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
                  throw new Error("El archivo no parece tener columnas 'Expediente' o 'Producto' válidas.");
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
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="secondary" onClick={() => navigate('/dashboard')} className="h-10 px-4">
          <Icon name="arrow-left" size={18}/> Volver
        </Button>
        <div>
          <h1 className="text-2xl font-black text-content-primary">Centro de Mantenimiento</h1>
          <p className="text-content-secondary text-sm">Gestión de datos, copias de seguridad y restablecimiento del sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUMNA 1: RESPALDO Y DATOS */}
        <div className="space-y-6">
          
          <Card title="Seguridad de Datos" icon="shield">
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="font-bold text-content-primary text-sm">Copia de Seguridad</h4>
                  <p className="text-xs text-content-secondary mt-1 leading-relaxed">
                    Descargue un archivo encriptado (.json) con toda la información local del dispositivo. Ideal para migrar datos.
                  </p>
                </div>
                <Button onClick={handleBackup} disabled={isBusy} variant="primary" className="w-full">
                    {loadingOp === 'BACKUP' ? <Icon name="loader" className="animate-spin"/> : <Icon name="download" size={18}/>}
                    Generar Backup
                </Button>
              </div>

              <div className="h-px bg-surface-border w-full"></div>

              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="font-bold text-content-primary text-sm">Restaurar Sistema</h4>
                  <p className="text-xs text-content-secondary mt-1 leading-relaxed">
                    Recupere el estado del sistema desde una copia previa. <span className="text-status-warning font-bold">Esta acción sobrescribe los datos actuales.</span>
                  </p>
                </div>
                <Button onClick={handleRestoreClick} disabled={isBusy} variant="secondary" className="w-full">
                    {loadingOp === 'RESTORE' ? <Icon name="loader" className="animate-spin"/> : <Icon name="upload" size={18}/>}
                    Cargar Archivo .JSON
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
              </div>
            </div>
          </Card>

          <Card title="Bases de Datos Maestras" icon="database">
            <div className="space-y-6">
              {/* CUM INVIMA */}
              <div className="p-4 bg-brand-light/30 rounded-xl border border-brand-light flex gap-4 items-start">
                <div className="p-2 bg-brand-light text-brand-deep rounded-lg shrink-0">
                  <Icon name="file-text" size={24}/>
                </div>
                <div className="w-full">
                  <h4 className="font-bold text-brand-deep text-sm">Maestro CUM (INVIMA)</h4>
                  <p className="text-xs text-brand-deep/70 mt-1 mb-3">
                    Importe el archivo oficial (.xlsx) para habilitar el motor de búsqueda y validación offline de medicamentos.
                  </p>
                  <Button onClick={() => requestAction({ type: 'LOAD_CUM' })} disabled={isBusy} variant="primary" className="w-full h-10 text-xs">
                      {loadingOp === 'IMPORT_CUM' ? <Icon name="loader" className="animate-spin"/> : <Icon name="plus-circle" size={16}/>}
                      {loadingOp === 'IMPORT_CUM' ? 'Procesando...' : 'Cargar Excel CUM'}
                  </Button>
                  <input type="file" ref={cumInputRef} className="hidden" accept=".xlsx" onChange={handleCumImport} />
                </div>
              </div>

              {/* CENSO */}
              <div className="p-4 bg-surface-hover rounded-xl border border-surface-border flex gap-4 items-start">
                <div className="p-2 bg-white text-content-secondary rounded-lg shrink-0 border border-surface-border">
                  <Icon name="map" size={24}/>
                </div>
                <div className="w-full">
                  <h4 className="font-bold text-content-primary text-sm">Censo de Establecimientos</h4>
                  <p className="text-xs text-content-secondary mt-1 mb-3">
                    Actualice el listado de sujetos de control mediante archivo plano.
                  </p>
                  <div className="flex gap-2">
                      <Button onClick={() => requestAction({ type: 'LOAD_CENSUS' })} disabled={isBusy} variant="secondary" className="flex-1 h-10 text-xs">
                          <Icon name="upload-cloud" size={14}/> Cargar
                      </Button>
                      <Button onClick={() => requestAction({ type: 'SEED_CENSUS' })} disabled={isBusy} variant="ghost" className="flex-1 h-10 text-xs">
                          <Icon name="database" size={14}/> Demo
                      </Button>
                  </div>
                  <input type="file" ref={censusInputRef} className="hidden" accept=".xlsx" onChange={handleCensusImport} />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUMNA 2: ZONA DE PELIGRO */}
        <div>
          <div className="bg-status-errorBg/30 rounded-2xl border border-status-error/20 overflow-hidden">
            <div className="px-6 py-4 bg-status-errorBg border-b border-status-error/10 flex items-center gap-3">
              <div className="p-2 bg-status-error/10 text-status-error rounded-lg">
                <Icon name="alert-triangle" size={20} strokeWidth={2.5}/>
              </div>
              <div>
                <h3 className="font-black text-status-error text-xs uppercase tracking-widest">Zona de Peligro</h3>
                <p className="text-[10px] font-bold text-status-error/70">Acciones destructivas e irreversibles</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex gap-4 items-start">
                <div className="mt-1"><Icon name="trash-2" className="text-content-tertiary" size={20}/></div>
                <div className="w-full">
                  <h4 className="font-bold text-content-primary text-sm">Depuración de Datos Operativos</h4>
                  <p className="text-xs text-content-secondary mt-1 mb-3">
                    Elimina únicamente la base de datos de establecimientos y el catálogo CUM. No afecta usuarios ni reportes históricos.
                  </p>
                  <Button onClick={() => requestAction({ type: 'RESET_CENSUS' })} disabled={isBusy} variant="secondary" className="w-full border-status-error/30 text-status-error hover:bg-status-errorBg hover:border-status-error">
                      {loadingOp === 'RESET_CENSUS' ? <Icon name="loader" className="animate-spin"/> : <Icon name="trash" size={16}/>}
                      Limpiar Censo y Maestros
                  </Button>
                </div>
              </div>

              <div className="h-px bg-status-error/10 w-full"></div>

              <div className="flex gap-4 items-start">
                <div className="mt-1"><Icon name="refresh-ccw" className="text-status-error" size={20}/></div>
                <div className="w-full">
                  <h4 className="font-bold text-content-primary text-sm">Restablecimiento de Fábrica</h4>
                  <p className="text-xs text-content-secondary mt-1 mb-3">
                    Elimina <strong className="text-status-error">TODOS</strong> los datos locales: inspecciones, censo, configuraciones y usuarios. La aplicación quedará como recién instalada.
                  </p>
                  <Button onClick={() => requestAction({ type: 'RESET_ALL' })} disabled={isBusy} variant="danger" className="w-full shadow-status-error/20">
                      {loadingOp === 'RESET_ALL' ? <Icon name="loader" className="animate-spin"/> : <Icon name="alert-octagon" size={16}/>}
                      Resetear Sistema Completo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PinGuardModal isOpen={guardOpen} onClose={() => { setGuardOpen(false); setPendingAction(null); }} onSuccess={executePendingAction} title="Confirmación de Seguridad" message="Esta acción es sensible y requiere autorización. Por favor ingrese su PIN de seguridad para confirmar la operación." />
    </div>
  );
};
