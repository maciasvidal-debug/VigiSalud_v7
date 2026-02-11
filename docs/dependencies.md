# Mapa de Dependencias del Proyecto VigiSalud v7

Este documento rastrea las importaciones críticas y las relaciones entre módulos para asegurar la integridad arquitectónica.

## Módulos Críticos

### `src/pages/inspections/InspectionForm.tsx`
El componente central de inspección. Implementa la lógica de "Focus Flow UX".

**Dependencias Internas (Utils):**
*   `src/utils/specializedValidators.ts`: **[NUEVO]** Motor de validación técnica (Cadena de frío, Vencimientos, Institucional).
*   `src/utils/inspectionEngine.ts`: Motor de reglas de inspección y generación de conceptos.
*   `src/utils/PharmaParser.ts`: Parser semántico para descripciones de medicamentos.
*   `src/utils/PdfGenerator.ts`: Generador de actas PDF.
*   `src/utils/productSchemas.ts`: Esquemas de formularios de productos.
*   `src/utils/crypto.ts`: Generación de hashes de verificación.

**Dependencias de Base de Datos:**
*   `src/db.ts`: Instancia de Dexie.js para almacenamiento offline.

**Componentes UI:**
*   `src/components/inspection/TacticalMatrix.tsx`
*   `src/components/seizure/SeizureCalculator.tsx`
*   `src/components/ui/*`: Biblioteca de componentes base (Card, Button, Badge, Icon, Input, WizardStepper, SignaturePad).

**Contextos:**
*   `src/context/ToastContext.tsx`: Notificaciones al usuario.

### `src/utils/specializedValidators.ts`
Módulo de funciones puras para validación de lógica de negocio farmacéutica.

**Dependencias:**
*   `src/types/index.ts`: Tipos compartidos (`ProductFinding`).

---

## Notas de Auditoría
*   **firebase.ts**: No se detectó en el árbol de archivos actual. El proyecto opera con arquitectura "Local-First" (Dexie.js).
*   **specializedValidators.ts**: Integrado exitosamente en el flujo de `handleAddProduct` dentro de `InspectionForm.tsx`.
