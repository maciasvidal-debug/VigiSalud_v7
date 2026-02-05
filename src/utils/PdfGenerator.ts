import { jsPDF } from "jspdf";
import type { Report, ProductFinding, ProductType } from '../types';

const COLORS = {
  header: [30, 41, 59] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  watermark: [230, 230, 230] as [number, number, number],
  tableHeader: [241, 245, 249] as [number, number, number],
  tableLine: [203, 213, 225] as [number, number, number],
};

const FORMATS = { margin: 14, headerHeight: 32 };

const formatDate = (isoString: string | undefined) => {
  if (!isoString) return '---';
  return new Date(isoString).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatEnum = (text: string) => text ? text.replace(/_/g, ' ') : '';

// --- CONFIGURACIÓN DE COLUMNAS POLIMÓRFICAS (REG-X001) ---
const getColumnsForType = (type: ProductType) => {
    switch (type) {
        case 'MEDICAMENTO':
        case 'REACTIVO_DIAGNOSTICO':
        case 'ALIMENTO':
        case 'SUPLEMENTO':
            return [
                { header: 'PRODUCTO / TITULAR', width: 60 },
                { header: 'ID (Reg/Lote)', width: 45 },
                { header: 'CANT. LEGAL', width: 25 }, // "5 Frascos"
                { header: 'LOGÍSTICA', width: 25 },    // "0.6 L"
                { header: 'HALLAZGO', width: 35 }
            ];
        case 'DISPOSITIVO_MEDICO':
            return [
                { header: 'DISPOSITIVO / MARCA', width: 60 },
                { header: 'ID (Reg/Serie)', width: 45 },
                { header: 'MODELO', width: 25 },
                { header: 'CANTIDAD', width: 25 },
                { header: 'HALLAZGO', width: 35 }
            ];
        default:
            return [
                { header: 'PRODUCTO', width: 65 },
                { header: 'IDENTIFICACIÓN', width: 45 },
                { header: 'ESTADO', width: 25 },
                { header: 'CANT.', width: 20 },
                { header: 'CONCEPTO', width: 35 }
            ];
    }
};

export const generateInspectionPDF = async (report: Report, isDraft: boolean = false): Promise<Blob> => {
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = FORMATS.margin; 

  // --- CAPA 0: FONDO Y MARCA DE AGUA (Base Layer) ---
  const paintBackground = () => {
      if (isDraft) {
          doc.saveGraphicsState();
          doc.setTextColor(COLORS.watermark[0], COLORS.watermark[1], COLORS.watermark[2]);
          doc.setFontSize(60);
          doc.setFont("helvetica", "bold");
          doc.text("BORRADOR", width / 2, height / 2, { align: 'center', angle: 45 });
          doc.setFontSize(20);
          doc.text("SIN VALIDEZ JURÍDICA", width / 2, (height / 2) + 15, { align: 'center', angle: 45 });
          doc.restoreGraphicsState();
      }

      doc.setFillColor(COLORS.header[0], COLORS.header[1], COLORS.header[2]);
      doc.rect(0, 0, width, FORMATS.headerHeight, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ACTA DE INSPECCIÓN, VIGILANCIA Y CONTROL", FORMATS.margin, 12);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("SECRETARÍA DE SALUD DEPARTAMENTAL - SISTEMA VIGISALUD", FORMATS.margin, 19);
      
      const folio = isDraft ? "PRELIMINAR" : (report.id?.toString() || report.data.actId || "S/N");
      doc.text(`ACTA No: ${folio} | FECHA: ${formatDate(report.date)}`, FORMATS.margin, 24);
  };

  const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > height - FORMATS.margin) {
          doc.addPage();
          paintBackground();
          y = FORMATS.headerHeight + 10;
          return true;
      }
      return false;
  };

  paintBackground();
  y = FORMATS.headerHeight + 15;

  // --- SECCIONES 1-3 (Resumidas por brevedad pero funcionales) ---
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0);
  doc.text("1. IDENTIFICACIÓN DEL ESTABLECIMIENTO", FORMATS.margin, y);
  y += 5;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`Razón Social: ${report.est} - NIT: ${report.nit || '--'}`, FORMATS.margin, y);
  y += 15;

  // --- 4. RELACIÓN DE PRODUCTOS (POLIMÓRFICA) ---
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("4. RELACIÓN DE PRODUCTOS Y EVIDENCIAS", FORMATS.margin, y);
  y += 8;

  const products = report.products || [];
  const groups = products.reduce((acc, p) => {
      if (!acc[p.type]) acc[p.type] = [];
      acc[p.type].push(p);
      return acc;
  }, {} as Record<string, ProductFinding[]>);

  for (const [type, items] of Object.entries(groups)) {
      checkPageBreak(40);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
      doc.rect(FORMATS.margin, y, width - (FORMATS.margin * 2), 6, 'F');
      doc.setTextColor(COLORS.header[0], COLORS.header[1], COLORS.header[2]);
      doc.text(`>>> ${formatEnum(type)} (${items.length})`, FORMATS.margin + 2, y + 4);
      y += 8;

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

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      
      items.forEach(p => {
          checkPageBreak(15);
          x = FORMATS.margin;
          
          // Col 1: Nombre
          doc.text(doc.splitTextToSize(p.name, cols[0].width - 2), x, y);
          x += cols[0].width;

          // Col 2: ID
          doc.text(`Reg: ${p.invimaReg}\nLot: ${p.lot || '--'}`, x, y);
          x += cols[1].width;

          // Col 3: Cantidad Legal (Polimórfica)
          let qtyText = String(p.quantity);
          if (p.logistics) {
              qtyText = `${p.logistics.totals.legalUnits} ${p.logistics.presentation.containerType}s`;
          }
          doc.text(qtyText, x, y);
          x += cols[2].width;

          // Col 4: Logística (Volumen/Peso)
          if (type === 'DISPOSITIVO_MEDICO') {
              doc.text(p.model || '---', x, y);
          } else {
              let logText = '---';
              if (p.logistics?.totals.logisticVolume) {
                  logText = `${p.logistics.totals.logisticVolume} ${p.logistics.totals.logisticUnit}`;
              }
              doc.text(logText, x, y);
          }
          x += cols[3].width;

          // Col 5: Hallazgo
          const riskColor = p.riskFactor === 'NINGUNO' ? [0, 100, 0] : [200, 0, 0];
          doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
          doc.text(p.riskFactor, x, y);
          doc.setTextColor(0);
          
          y += 10; // Espaciado fijo para filas
          doc.setDrawColor(240);
          doc.line(FORMATS.margin, y-2, width - FORMATS.margin, y-2);
      });
      y += 5;
  }

  // --- FIRMAS Y CIERRE ---
  if (y > height - 60) { doc.addPage(); paintBackground(); y = 40; }
  else { y = Math.max(y + 20, height - 70); }

  const col1Sign = FORMATS.margin;
  const col2Sign = width / 2 + 10;

  doc.setDrawColor(0);
  doc.line(col1Sign, y, col1Sign + 70, y);
  doc.line(col2Sign, y, col2Sign + 70, y);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("INSPECTOR IVC", col1Sign, y + 4);
  doc.text("ATENDIDO / REPRESENTANTE", col2Sign, y + 4);
  
  if (report.signature) {
      try {
          doc.addImage(report.signature, 'PNG', col2Sign, y - 25, 40, 20);
      } catch (e) {
          doc.setTextColor(150);
          doc.text("[Firma Digital Capturada]", col2Sign, y - 10);
          doc.setTextColor(0);
      }
  }

  y = height - 20;
  doc.setFontSize(7);
  doc.setTextColor(100);
  
  if (isDraft) {
      doc.setFont("courier", "bold");
      doc.text("|| DOCUMENTO PRELIMINAR - HASH PENDIENTE DE CIERRE ||", FORMATS.margin, y);
  } else {
      doc.setFont("courier", "normal");
      doc.text(`HASH SHA-256: ${report.verificationHash || 'ERROR'}`, FORMATS.margin, y);
  }

  return doc.output('blob');
};