import ExcelJS from 'exceljs';
import type { Establishment } from '../types';

export const excelHandler = {
  /**
   * EXPORTACIÓN: Genera el reporte XLSX para auditoría.
   */
  exportCensusToExcel: async (data: Establishment[]): Promise<void> => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Censo VigiSalud Master');

      worksheet.columns = [
        { header: 'CATEGORÍA', key: 'category', width: 15 },
        { header: 'TIPO DOC', key: 'idType', width: 12 },
        { header: 'NÚMERO ID', key: 'nit', width: 20 },
        { header: 'RAZÓN SOCIAL / NOMBRE', key: 'name', width: 35 },
        { header: 'ID COMERCIAL / PUESTO', key: 'commercialName', width: 30 },
        { header: 'ACTIVIDAD', key: 'type', width: 20 },
        { header: 'MUNICIPIO', key: 'city', width: 20 },
        { header: 'CÓDIGO DANE', key: 'daneCode', width: 12 },
        { header: 'LATITUD', key: 'lat', width: 15 },
        { header: 'LONGITUD', key: 'lng', width: 15 },
        { header: 'UBICACIÓN / SECTOR', key: 'address', width: 40 },
        { header: 'RESPONSABLE', key: 'responsibleName', width: 25 },
        { header: 'ID RESPONSABLE', key: 'responsibleId', width: 15 },
        { header: 'TELÉFONO', key: 'phone', width: 15 },
        { header: 'EMAIL JUDICIAL', key: 'emailJudicial', width: 25 },
        { header: 'DIR. TÉCNICO', key: 'techDirectorName', width: 25 },
        { header: 'ID DIR. TÉCNICO', key: 'techDirectorId', width: 15 },
        { header: 'TARJETA PROF.', key: 'techDirectorTp', width: 15 },
        { header: 'ESTADO', key: 'status', width: 12 },
        { header: 'FECHA REGISTRO', key: 'createdAt', width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E293B' }
      };

      data.forEach(est => {
        worksheet.addRow(est);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `VigiSalud_Censo_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error exportando Excel:", error);
      throw new Error("Fallo en la generación del reporte XLSX");
    }
  },

  /**
   * IMPORTACIÓN (NUEVO): Recupera la capacidad de cargar censo real.
   * Soluciona el problema de "(m)" forzando tipos numéricos en GPS.
   */
  parseCensusExcel: async (file: File): Promise<Establishment[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) throw new Error("Hoja de cálculo no encontrada");

    const establishments: Establishment[] = [];

    // Asumimos que la fila 1 es header, empezamos en 2
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getVal = (idx: number) => {
        const val = row.getCell(idx).value;
        return val ? val.toString().trim().toUpperCase() : '';
      };

      // Extracción robusta de coordenadas para evitar NaN
      const rawLat = row.getCell(9).value;
      const rawLng = row.getCell(10).value;
      const lat = parseFloat(rawLat ? rawLat.toString() : '0');
      const lng = parseFloat(rawLng ? rawLng.toString() : '0');

      establishments.push({
        category: (getVal(1) as any) || 'FORMAL',
        idType: (getVal(2) as any) || 'NIT',
        nit: getVal(3),
        name: getVal(4) || 'SIN NOMBRE',
        commercialName: getVal(5),
        type: getVal(6) || 'OTROS',
        city: getVal(7) || 'BARRANQUILLA',
        daneCode: getVal(8),
        lat: isNaN(lat) ? 0 : lat, // Protección contra NaN
        lng: isNaN(lng) ? 0 : lng, // Protección contra NaN
        address: getVal(11),
        responsibleName: getVal(12),
        responsibleId: getVal(13),
        phone: getVal(14),
        emailJudicial: getVal(15).toLowerCase(),
        techDirectorName: getVal(16),
        techDirectorId: getVal(17),
        techDirectorTp: getVal(18),
        status: (getVal(19) as any) || 'ACTIVO',
        createdAt: new Date().toISOString()
      });
    });

    return establishments;
  }
};