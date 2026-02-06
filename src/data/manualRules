export interface ManualRule {
  id: string;
  description: string;
  action_true?: string[];
  action_false?: string[];
  norm?: string;
  riskLevel?: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  type: 'LEGAL' | 'DOCUMENTAL' | 'CUANTITATIVA' | 'TECNICA' | 'OPERATIVA' | 'RIESGO' | 'TRANSVERSAL';
}

export const MANUAL_RULES: ManualRule[] = [
  // --- 3.1 Validaciones legales (REG-L) ---
  {
    id: "REG-L001",
    description: "El producto debe contar con Registro Sanitario vigente expedido por INVIMA.",
    action_false: ["generar_alerta", "medida_sanitaria_decomiso"],
    norm: "Decreto 677 de 1995",
    riskLevel: "CRITICO",
    type: "LEGAL"
  },
  {
    id: "REG-L006",
    description: "No se permite comercialización sin RS o con RS vencido.",
    action_false: ["decomiso_inmediato"],
    riskLevel: "CRITICO",
    type: "LEGAL"
  },
  {
    id: "REG-L011",
    description: "Productos de control especial deben tener permisos FRE.",
    action_false: ["decomiso", "reporte_fondo_nacional"],
    riskLevel: "CRITICO",
    type: "LEGAL"
  },
  {
    id: "REG-L024",
    description: "Los medicamentos termolábiles deben tener certificación de cadena de frío.",
    action_false: ["medida_sanitaria"],
    riskLevel: "ALTO",
    type: "LEGAL"
  },
  // --- 3.3 Validaciones de cantidades (REG-Q) ---
  {
    id: "REG-Q003",
    description: "No puede haber inconsistencia entre cantidad y volumen total.",
    action_false: ["bloquear_registro", "alerta_cuantitativa"],
    riskLevel: "ALTO",
    type: "CUANTITATIVA"
  },
  {
    id: "REG-Q010",
    description: "Todo cálculo debe convertirse a SI (mL, L).",
    action_false: ["error_calculo"],
    type: "CUANTITATIVA"
  },
  {
    id: "REG-Q050",
    description: "Inconsistencias severas decomiso inmediato.",
    action_false: ["decomiso_inmediato"],
    riskLevel: "CRITICO",
    type: "CUANTITATIVA"
  },
  // --- 3.4 Validaciones técnicas (REG-T) ---
  {
    id: "REG-T002",
    description: "Termolábiles validar cadena de frío.",
    action_false: ["decomiso_por_seguridad"],
    riskLevel: "CRITICO",
    type: "TECNICA"
  },
  {
    id: "REG-T015",
    description: "Todo producto vencido decomiso.",
    action_false: ["decomiso_obligatorio"],
    riskLevel: "CRITICO",
    type: "TECNICA"
  }
];
