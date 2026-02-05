// src/utils/backupHandler.ts
import { db } from '../db';

/**
 * Servicio de Salvaguarda de Información - VigiSalud
 * Gestiona la exportación e importación de la base de datos Dexie.
 */
export const backupHandler = {
  /**
   * Exporta las tablas maestras a un archivo JSON descargable
   */
  exportSystemData: async () => {
    try {
      const census = await db.census.toArray();
      const officials = await db.officials.toArray();
      const reports = await db.reports.toArray();

      const backup = {
        app: "VigiSalud",
        version: "7.0",
        generatedAt: new Date().toISOString(),
        data: { census, officials, reports }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VigiSalud_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Fallo en exportación:", error);
      throw error;
    }
  },

  /**
   * Restaura la base de datos desde un archivo JSON
   */
  importSystemData: async (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const backup = JSON.parse(content);

          if (backup.app !== "VigiSalud") throw new Error("Formato no válido");

          await db.transaction('rw', [db.census, db.officials, db.reports], async () => {
            await db.census.clear();
            await db.officials.clear();
            await db.reports.clear();
            
            await db.census.bulkAdd(backup.data.census);
            await db.officials.bulkAdd(backup.data.officials);
            await db.reports.bulkAdd(backup.data.reports);
          });
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  }
};