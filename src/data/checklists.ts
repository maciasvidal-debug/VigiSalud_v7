// src/data/checklists.ts
export interface ChecklistItem {
  id: string;
  question: string;
  legalBase?: string;
  critical: boolean;
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export const CHECKLISTS: Record<string, ChecklistSection[]> = {
  FORMAL: [
    {
      title: "1. Infraestructura Física (Res. 1403/07 - Num 2.1)",
      items: [
        { id: "f_loc", question: "Pisos, paredes y techos impermeables y resistentes.", legalBase: "Res 1403 Num 2.1.2", critical: false },
        { id: "f_areas", question: "Áreas señalizadas e independientes (Recepción, Almacén, Cuarentena).", legalBase: "Res 1403 Num 2.1.5", critical: true },
        { id: "f_amb", question: "Iluminación y ventilación adecuadas.", legalBase: "Res 1403 Num 2.1.3", critical: true },
      ]
    },
    {
      title: "2. Dotación y Condiciones Ambientales",
      items: [
        { id: "f_termo", question: "Termohigrómetro calibrado con registros al día.", legalBase: "Dec 780/2016", critical: true },
        { id: "f_cadenafrio", question: "Cadena de frío garantizada (Si aplica).", legalBase: "Res 1403 Num 2.2.1", critical: true },
      ]
    },
    {
      title: "3. Recurso Humano",
      items: [
        { id: "f_dt", question: "Presencia del Director Técnico (8 horas mínimo).", legalBase: "Dec 780 Art 2.5.3", critical: true },
      ]
    }
  ],
  INFORMAL: [
    {
      title: "1. Saneamiento Básico (Res. 2674/13)",
      items: [
        { id: "i_agua", question: "Suministro de agua potable constante.", legalBase: "Res 2674 Art 6", critical: true },
        { id: "i_plagas", question: "Ausencia de plagas o suciedad visible.", legalBase: "Res 2674 Art 26", critical: true },
      ]
    },
    {
      title: "2. Almacenamiento",
      items: [
        { id: "i_sep", question: "Separación de alimentos y químicos.", legalBase: "Res 2674 Art 28", critical: true },
        { id: "i_frio", question: "Refrigeración adecuada (Neveras funcionando).", legalBase: "Res 2674 Art 28", critical: true },
      ]
    }
  ],
  AMBULANTE: [
    {
      title: "1. Espacio Público y Ocupación",
      items: [
        { id: "a_ubic", question: "No obstruye el tránsito peatonal ni vehicular.", legalBase: "Ley 1801 Art 140", critical: true },
        { id: "a_limp", question: "El puesto se encuentra limpio y ordenado.", legalBase: "Res 2674", critical: false },
      ]
    }
  ]
};