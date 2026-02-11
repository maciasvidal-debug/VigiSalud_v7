import Dexie, { type Table } from 'dexie';
import type { Establishment, Report, User, CustodyChain } from './types';

export interface CumRecord {
  id?: number; 
  expediente: string;
  producto: string;
  titular: string;
  registrosanitario: string;
  fechaexpedicion: string;
  fechavencimiento: string;
  estadoregistro: string;
  expedientecum: string;
  consecutivocum: string;
  cantidadcum: string; 
  descripcioncomercial: string;
  estadocum: string;
  fechaactivo: string;
  fechainactivo: string;
  muestramedica: string;
  unidad: string;
  atc: string;
  descripcionatc: string;
  viaadministracion: string;
  concentracion: string;
  principioactivo: string;
  unidadmedida: string;
  cantidad: string;
  unidadreferencia: string;
  formafarmaceutica: string; 
  nombrerol: string;
  tiporol: string;
  modalidad: string;
  ium: string;
}

export class VigiSaludDB extends Dexie {
  establishments!: Table<Establishment, number>;
  inspections!: Table<Report, number>;
  officials!: Table<User, number>;
  seizures!: Table<CustodyChain, string>; 
  cums!: Table<CumRecord, number>; 

  constructor() {
    super('VigiSaludDB');
    
    this.version(1).stores({
      establishments: '++id, category, nit, name, status, city',
      inspections: '++id, date, establishment_id, concept, riskLevel, [date+establishment_id]',
      officials: '++id, identification, role, status, username',
      seizures: 'id, visitId, status, seizedBy',
      cums: 'id, cum, product, reg, activePrinciple' 
    });

    this.version(2).stores({ cums: null });

    this.version(3).stores({
      establishments: '++id, category, nit, name, status, city',
      inspections: '++id, date, establishment_id, concept, riskLevel, [date+establishment_id]',
      officials: '++id, identification, role, status, username',
      seizures: 'id, visitId, status, seizedBy',
      cums: '++id, expediente, producto, principioactivo, registrosanitario, atc' 
    });

    // Version 4: Migración de RiskFactor (string) a RiskFactors (array)
    this.version(4).stores({
      establishments: '++id, category, nit, name, status, city',
      inspections: '++id, date, establishment_id, concept, riskLevel, [date+establishment_id]',
      officials: '++id, identification, role, status, username',
      seizures: 'id, visitId, status, seizedBy',
      cums: '++id, expediente, producto, principioactivo, registrosanitario, atc' 
    }).upgrade(trans => {
        return trans.table("inspections").toCollection().modify(report => {
            if (report.products) {
                report.products.forEach((p: any) => {
                    if (typeof p.riskFactor === 'string') {
                        // Migrar legacy string a array
                        p.riskFactors = p.riskFactor === 'NINGUNO' ? [] : [p.riskFactor];
                        delete p.riskFactor; // Limpiar legacy
                    } else if (!p.riskFactors) {
                        p.riskFactors = []; // Inicializar si no existe
                    }
                });
            }
        });
    });

    // CORRECCIÓN DE TIPO: Forzamos (obj as CumRecord) para que TS no reclame
    this.cums.hook('creating', (_primKey, obj) => {
        const record = obj as CumRecord; // <--- Casting explícito
        if (record.producto) record.producto = record.producto.toString().toUpperCase().trim();
        if (record.principioactivo) record.principioactivo = record.principioactivo.toString().toUpperCase().trim();
        if (record.expediente) record.expediente = record.expediente.toString().trim();
        if (record.registrosanitario) record.registrosanitario = record.registrosanitario.toString().trim().toUpperCase();
    });
    
    this.cums.hook('updating', (mods, _primKey, _obj) => {
        // En updating, 'mods' es Partial<CumRecord>
        const updates = mods as Partial<CumRecord>; 
        if (updates.producto) updates.producto = updates.producto.toString().toUpperCase().trim();
        if (updates.expediente) updates.expediente = updates.expediente.toString().trim();
        return updates; // Retornamos las modificaciones tipadas
    });
  }
}

export const db = new VigiSaludDB();