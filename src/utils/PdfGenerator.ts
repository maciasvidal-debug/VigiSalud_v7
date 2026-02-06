import { jsPDF } from "jspdf";
import type { Report, ProductFinding, ProductType } from '../types';

// =============================================================================
// 1. CONFIGURACIÓN VISUAL Y UTILIDADES
// =============================================================================

const COLORS = {
  header: [30, 41, 59] as [number, number, number], // Slate 800
  text: [30, 41, 59] as [number, number, number],
  watermark: [230, 230, 230] as [number, number, number],
  tableHeader: [241, 245, 249] as [number, number, number], // Slate 100
  tableLine: [203, 213, 225] as [number, number, number], // Slate 300
  success: [22, 163, 74] as [number, number, number], // Green 600
  danger: [220, 38, 38] as [number, number, number], // Red 600
  warning: [234, 88, 12] as [number, number, number], // Orange 600
};

const FORMATS = { margin: 14, headerHeight: 35 };

const formatDate = (isoString: string | undefined) => {
  if (!isoString) return '---';
  return new Date(isoString).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatEnum = (text: string) => text ? text.replace(/_/g, ' ') : '';

// Mapeo local de reglas para traducción en PDF (Mirror de inspectionEngine)
const RULE_DESCRIPTIONS: Record<string, string> = {
    'REG-L001': 'Dec 677/95: Producto sin Registro Sanitario vigente.',
    'REG-L006': 'Dec 677/95: Prohibición de comercialización (Sin RS/Vencido).',
    'REG-L020': 'Ley 9/79: Evidencia de falsificación o fraude.',
    'REG-Q001': 'Error de inventario (Cant <= 0).',
    'REG-T015': 'Res 1403/07: Producto VENCIDO prohibido de venta.',
    'REG-T001': 'Dec 1782/14: Ruptura de Cadena de Frío / Mal Almacenamiento.',
    'REG-D006': 'Dec 4725/05: Dispositivo Médico sin manual de uso.',
    'REG-T012': 'Dec 4725/05: Equipo biomédico sin calibración vigente.',
    'REG-D008': 'Res 333/11: Suplemento sin tabla nutricional.'
};

const getFindingDescription = (product: ProductFinding) => {
    if (product.regRuleRef && RULE_DESCRIPTIONS[product.regRuleRef]) {
        return RULE_DESCRIPTIONS[product.regRuleRef];
    }
    if (product.riskFactor !== 'NINGUNO') {
        return `Riesgo Detectado: ${product.riskFactor.replace('_', ' ')}`;
    }
    if (product.observations) {
        return `Obs: ${product.observations}`;
    }
    return 'CUMPLE NORMATIVIDAD';
};

// --- CONFIGURACIÓN DE COLUMNAS POLIMÓRFICAS ---
const getColumnsForType = (type: ProductType) => {
    switch (type) {
        case 'MEDICAMENTO':
            return [
                { header: 'PRODUCTO / IDENTIFICACIÓN', width: 70 }, // Nombre + Conc + Forma
                { header: 'LOTE / VENCE', width: 35 },
                { header: 'CANTIDAD', width: 25 },
                { header: 'HALLAZGOS Y OBSERVACIONES', width: 60 }
            ];
        case 'DISPOSITIVO_MEDICO':
            return [
                { header: 'DISPOSITIVO / MARCA', width: 70 },
                { header: 'SERIE / MODELO', width: 35 },
                { header: 'CANTIDAD', width: 25 },
                { header: 'ESTADO / CALIBRACIÓN', width: 60 }
            ];
        default:
            return [
                { header: 'PRODUCTO', width: 70 },
                { header: 'IDENTIFICACIÓN', width: 35 },
                { header: 'CANTIDAD', width: 25 },
                { header: 'CONCEPTO', width: 60 }
            ];
    }
};

// =============================================================================
// 2. GENERADOR PRINCIPAL (PDF ENGINE)
// =============================================================================

export const generateInspectionPDF = async (report: Report, isDraft: boolean = false): Promise<Blob> => {
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = FORMATS.margin; 

  // --- UTILIDADES DE RENDERIZADO ---
  const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > height - FORMATS.margin) {
          doc.addPage();
          paintBackground();
          y = FORMATS.headerHeight + 10;
          return true;
      }
      return false;
  };

  const paintBackground = () => {
      // Header Background
      doc.setFillColor(COLORS.header[0], COLORS.header[1], COLORS.header[2]);
      doc.rect(0, 0, width, FORMATS.headerHeight, 'F');
      
      // Logos y Títulos
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ACTA DE INSPECCIÓN, VIGILANCIA Y CONTROL SANITARIO", width / 2, 12, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("SECRETARÍA DE SALUD - SISTEMA INTEGRADO DE GESTIÓN VIGISALUD", width / 2, 17, { align: 'center' });
      
      doc.setFont("courier", "bold");
      const folio = isDraft ? "BORRADOR PRELIMINAR" : (report.data.actId || "S/N");
      doc.text(`ACTA No. ${folio}  |  FECHA: ${formatDate(report.date)}`, width / 2, 23, { align: 'center' });

      // Marca de Agua
      if (isDraft) {
          doc.saveGraphicsState();
          doc.setTextColor(COLORS.watermark[0], COLORS.watermark[1], COLORS.watermark[2]);
          doc.setFontSize(60);
          doc.setFont("helvetica", "bold");
          doc.text("BORRADOR", width / 2, height / 2, { align: 'center', angle: 45 });
          doc.restoreGraphicsState();
      }
  };

  // Inicializar Documento
  paintBackground();
  y = FORMATS.headerHeight + 15;

  // --- SECCIÓN 1: ENCABEZADO Y GENERALIDADES ---
  doc.setFillColor(245, 247, 250);
  doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 35, 'F');
  doc.setDrawColor(200);
  doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 35);

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0);
  doc.text("1. IDENTIFICACIÓN DEL ESTABLECIMIENTO", FORMATS.margin + 5, y + 6);

  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  let headerY = y + 12;

  // Fila 1
  doc.setFont("helvetica", "bold"); doc.text("Razón Social:", FORMATS.margin + 5, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.est, FORMATS.margin + 30, headerY);

  doc.setFont("helvetica", "bold"); doc.text("NIT/CC:", width / 2, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.nit || '---', (width / 2) + 15, headerY);

  headerY += 6;
  // Fila 2
  doc.setFont("helvetica", "bold"); doc.text("Dirección:", FORMATS.margin + 5, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.address || '---', FORMATS.margin + 30, headerY);

  doc.setFont("helvetica", "bold"); doc.text("Ciudad:", width / 2, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.data.city || '---', (width / 2) + 15, headerY);

  headerY += 6;
  // Fila 3
  doc.setFont("helvetica", "bold"); doc.text("Rep. Legal:", FORMATS.margin + 5, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.data.attendedBy || '---', FORMATS.margin + 30, headerY);

  doc.setFont("helvetica", "bold"); doc.text("Dir. Técnico:", width / 2, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.data.techDirector || '---', (width / 2) + 20, headerY);

  headerY += 6;
  // Fila 4 (Motivo)
  doc.setFont("helvetica", "bold"); doc.text("Objeto Visita:", FORMATS.margin + 5, headerY);
  doc.setFont("helvetica", "normal"); doc.text(report.data.motive || 'INSPECCIÓN REGULAR', FORMATS.margin + 30, headerY);

  y += 40;

  // --- SECCIÓN 2: CONCEPTO TÉCNICO Y CALIFICACIÓN ---
  const conceptColor = report.concept === 'FAVORABLE' ? COLORS.success :
                       report.concept === 'DESFAVORABLE' ? COLORS.danger : COLORS.warning;

  doc.setFillColor(conceptColor[0], conceptColor[1], conceptColor[2]);
  doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 14, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`CONCEPTO SANITARIO: ${report.concept.replace(/_/g, ' ')}`, FORMATS.margin + 5, y + 9);

  doc.setFontSize(10);
  doc.text(`CUMPLIMIENTO: ${report.riskScore}%`, width - FORMATS.margin - 5, y + 9, { align: 'right' });

  y += 20;

  // --- SECCIÓN 3: RELACIÓN DE PRODUCTOS ---
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0);
  doc.text("3. RELACIÓN DE PRODUCTOS Y HALLAZGOS", FORMATS.margin, y);
  y += 6;

  const products = report.products || [];
  const groups = products.reduce((acc, p) => {
      if (!acc[p.type]) acc[p.type] = [];
      acc[p.type].push(p);
      return acc;
  }, {} as Record<string, ProductFinding[]>);

  if (products.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No se verificaron productos específicos en esta visita.", FORMATS.margin, y + 5);
      y += 10;
  }

  for (const [type, items] of Object.entries(groups)) {
      checkPageBreak(40);
      
      // Subtítulo de Grupo
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
      doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 6, 'F');
      doc.setTextColor(COLORS.header[0], COLORS.header[1], COLORS.header[2]);
      doc.text(`CATEGORÍA: ${formatEnum(type)} (${items.length})`, FORMATS.margin + 2, y + 4);
      y += 8;

      // Encabezados de Tabla
      const cols = getColumnsForType(type as ProductType);
      let x = FORMATS.margin;
      doc.setFontSize(7);
      cols.forEach(col => {
          doc.text(col.header, x, y);
          x += col.width;
      });
      y += 2;
      doc.setDrawColor(COLORS.tableLine[0], COLORS.tableLine[1], COLORS.tableLine[2]);
      doc.line(FORMATS.margin, y, width - FORMATS.margin, y);
      y += 4;

      // Filas
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      
      items.forEach(p => {
          // Cálculo de altura dinámica para descripción
          const descText = getFindingDescription(p);
          const splitDesc = doc.splitTextToSize(descText, cols[3].width - 2);
          const rowHeight = Math.max(10, splitDesc.length * 3 + 4);

          checkPageBreak(rowHeight);
          x = FORMATS.margin;
          
          // Col 1: Identificación Robusta
          let idText = p.name;
          if (p.concentration) idText += ` ${p.concentration} ${p.unit || ''}`;
          if (p.pharmaceuticalForm) idText += ` - ${p.pharmaceuticalForm}`;

          doc.text(doc.splitTextToSize(idText, cols[0].width - 2), x, y);
          x += cols[0].width;

          // Col 2: Lote/Vence
          const dateText = p.expirationDate ? p.expirationDate.substring(0, 10) : '---';
          doc.text(`Lote: ${p.lot || '--'}\nVence: ${dateText}`, x, y);
          x += cols[1].width;

          // Col 3: Cantidad
          let qtyText = String(p.quantity);
          if (p.logistics) {
              qtyText = `${p.logistics.totals.legalUnits} ${p.logistics.presentation.containerType}s`;
          }
          doc.text(qtyText, x, y);
          x += cols[2].width;

          // Col 4: Hallazgo (Split Text)
          const isRisk = p.riskFactor !== 'NINGUNO';
          if (isRisk) doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
          doc.text(splitDesc, x, y);
          doc.setTextColor(0);
          
          y += rowHeight;
          doc.setDrawColor(245); // Línea sutil
          doc.line(FORMATS.margin, y - 2, width - FORMATS.margin, y - 2);
      });
      y += 5;
  }

  // --- SECCIÓN 4: MEDIDAS SANITARIAS (SI APLICA) ---
  if (report.seizure && report.seizure.items.length > 0) {
      checkPageBreak(50);
      y += 5;

      doc.setFillColor(254, 242, 242); // Red 50
      doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 40, 'F');
      doc.setDrawColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
      doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 40);

      doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("4. ACTA DE MEDIDA SANITARIA DE SEGURIDAD", FORMATS.margin + 5, y + 8);

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Con fundamento en la Ley 9 de 1979 y Res. 1229/2013, se aplica medida consistente en:", FORMATS.margin + 5, y + 14);

      doc.setFont("helvetica", "normal");
      doc.text(`• Tipo de Medida: DECOMISO / CONGELAMIENTO`, FORMATS.margin + 10, y + 20);
      doc.text(`• Total Productos Afectados: ${report.seizure.items.length} ítems.`, FORMATS.margin + 10, y + 25);

      doc.text(`• Custodia / Transporte: ${report.seizure.transportCompany || 'Vehículo Oficial'} - Placa: ${report.seizure.transportPlate || 'N/A'}`, FORMATS.margin + 10, y + 30);
      doc.text(`• Lugar de Depósito: ${report.seizure.depositLocation || 'Bodega de Evidencias'}`, FORMATS.margin + 10, y + 35);

      y += 45;
  }

  // --- SECCIÓN 5: NARRATIVA TÉCNICA (Smart Pagination) ---
  checkPageBreak(60);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0);
  doc.text("5. NARRATIVA DE HECHOS Y FUNDAMENTOS JURÍDICOS", FORMATS.margin, y);
  y += 6;

  const renderLongText = (title: string, text: string) => {
      if (!text) return;

      checkPageBreak(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title, FORMATS.margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(text, width - (FORMATS.margin * 2));

      // Imprimir línea por línea controlando el salto de página
      splitText.forEach((line: string) => {
          if (checkPageBreak(5)) {
              doc.setFont("helvetica", "normal"); // Restaurar fuente tras salto
              doc.setFontSize(9);
          }
          doc.text(line, FORMATS.margin, y);
          y += 4;
      });
      y += 5;
  };

  renderLongText("5.1 Relato de los Hechos (Hallazgos y Evidencias):", report.data.inspectionNarrative || "Sin observaciones registradas.");
  renderLongText("5.2 Fundamentación Jurídica:", report.data.legalBasis || "Normatividad sanitaria vigente aplicable.");
  renderLongText("5.3 Descargos / Observaciones del Atendido:", report.citizenFeedback?.text || "El atendido no manifiesta observaciones.");

  // --- SECCIÓN 6: FIRMAS ---
  checkPageBreak(50);
  y = Math.max(y + 10, height - 60);

  const col1Sign = FORMATS.margin;
  const col2Sign = (width / 2) + 10;

  doc.setDrawColor(0);
  doc.line(col1Sign, y, col1Sign + 70, y);
  doc.line(col2Sign, y, col2Sign + 70, y);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FUNCIONARIO IVC (Inspector)", col1Sign, y + 4);
  
  if (report.data.refusalToSign) {
      doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
      doc.text("SE FIRMA CON TESTIGO (RENUENCIA)", col2Sign, y + 4);
      doc.setFontSize(7);
      doc.text(`Testigo: ${report.data.witness?.name || '---'}`, col2Sign, y + 8);
      doc.text(`CC: ${report.data.witness?.id || '---'}`, col2Sign, y + 12);
      if (report.data.witness?.signature) {
          try {
              doc.addImage(report.data.witness.signature, 'PNG', col2Sign, y - 25, 40, 20);
          } catch(e) {}
      }
  } else {
      doc.text("ATENDIDO / REPRESENTANTE", col2Sign, y + 4);
      doc.setFontSize(7);
      doc.text(`CC: ${report.data.attendedId || '---'}`, col2Sign, y + 8);
      if (report.signature) {
          try {
              doc.addImage(report.signature, 'PNG', col2Sign, y - 25, 40, 20);
          } catch(e) {}
      }
  }

  // Hash Final
  y = height - 10;
  doc.setTextColor(150);
  doc.setFont("courier", "normal");
  doc.setFontSize(6);
  doc.text(`Documento generado electrónicamente. HASH SHA-256: ${report.verificationHash || 'PENDIENTE'}`, FORMATS.margin, y);

  return doc.output('blob');
};
