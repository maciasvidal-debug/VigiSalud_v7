import type { Report } from '../types';

/**
 * Genera una huella digital criptográfica (SHA-256) para un reporte de inspección.
 * * PROPÓSITO LEGAL:
 * Garantizar la integridad e inmutabilidad del acta. Si cualquier dato crítico
 * (Establecimiento, Fecha, Concepto, Riesgo o Funcionario) es alterado post-firma,
 * este hash no coincidirá al recalcularse.
 */
export const generateInspectionHash = async (report: Partial<Report>): Promise<string> => {
  try {
    // 1. Extraer Datos Críticos (Signos Vitales del Acta)
    // Usamos '|| ""' para asegurar que nunca sea undefined, lo que rompería el hash.
    const criticalData = [
      report.establishment_id?.toString() || "NO_ID",
      report.date || new Date().toISOString().split('T')[0], // Fallback a hoy si no hay fecha
      report.concept || "PENDIENTE",
      report.riskScore?.toString() || "0",
      report.func || "SISTEMA",
      // SEGURIDAD MEJORADA: Incluimos los datos operativos para evitar manipulación de hallazgos
      JSON.stringify(report.findings || {}),
      JSON.stringify(report.products || []),
      JSON.stringify(report.seizure || {})
    ].join('|'); // Usamos pipe como separador para evitar colisiones

    // 2. Codificar a Uint8Array
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(criticalData);

    // 3. Generar Hash SHA-256 usando la API nativa del navegador (Web Crypto API)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);

    // 4. Convertir ArrayBuffer a String Hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.toUpperCase(); // Retornamos en mayúsculas por estándar
    
  } catch (error) {
    console.error("Error crítico generando hash de seguridad:", error);
    // En caso de fallo criptográfico, retornamos un string de error para alertar en UI
    return "ERROR_HASH_GENERATION";
  }
};
