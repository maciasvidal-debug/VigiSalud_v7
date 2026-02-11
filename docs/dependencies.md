<<<<<<< HEAD
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
=======
# Mapa de Dependencias del Proyecto VigiSalud

Este documento detalla las relaciones de importación entre los módulos del sistema, basado en el análisis del código fuente.

## 📁 Core & Configuración

### `src/main.tsx`
- **Importa:** `react`, `react-dom`, `App`, `db`, `index.css`
- **Es usado por:** (Entry Point - Vite)
- **Rol en el sistema:** Punto de entrada. Inicializa React y la conexión a base de datos.

### `src/App.tsx`
- **Importa:** `react-router-dom`, `Login`, `DashboardLayout`, `DashboardHome`, `CensusList`, `CensusForm`, `CensusProfile`, `InspectionList`, `InspectionViewer`, `InspectionWizard`, `TeamList`, `TeamForm`, `MaintenanceCenter`, `ResourceCenter`, `useAuthStore`, `ToastContext`
- **Es usado por:** `src/main.tsx`
- **Rol en el sistema:** Enrutador principal y orquestador de vistas.

### `src/db.ts`
- **Importa:** `dexie`, `types`
- **Es usado por:** `main.tsx`, `useAuthStore.ts`, `backupHandler.ts`, `seedCensus.ts`, `analyticsService.ts`, `MaintenanceCenter.tsx`, `InspectionForm.tsx`, `InspectionList.tsx`, `InspectionViewer.tsx`, `InspectionWizard.tsx`, `CensusList.tsx`, `CensusForm.tsx`, `CensusProfile.tsx`, `TeamList.tsx`, `TeamForm.tsx`, `DashboardHome.tsx`, `PinGuardModal.tsx`
- **Rol en el sistema:** Capa de acceso a datos (IndexedDB). Módulo más crítico del sistema.

### `src/types.ts`
- **Importa:** (Sin dependencias)
- **Es usado por:** `db.ts`, `useAuthStore.ts`, `inspectionEngine.ts`, `PdfGenerator.ts`, `PharmaParser.ts`, `productSchemas.ts`, `InspectionForm.tsx`, `InspectionWizard.tsx`, `InspectionList.tsx`, `TeamList.tsx`, `TeamForm.tsx`, `CensusForm.tsx`, `DigitalIDCard.tsx`
- **Rol en el sistema:** Definiciones de tipos TypeScript transversales.

---

## 📁 Lógica de Negocio (Utils & Services)

### `src/store/useAuthStore.ts`
- **Importa:** `zustand`, `db`, `types`, `security`
- **Es usado por:** `App.tsx`, `Login.tsx`, `Header.tsx`, `Sidebar.tsx`, `DashboardHome.tsx`, `ResourceCenter.tsx`, `CensusList.tsx`, `CensusProfile.tsx`, `TeamList.tsx`, `PinGuardModal.tsx`
- **Rol en el sistema:** Gestión de estado global de sesión y permisos.

### `src/utils/inspectionEngine.ts`
- **Importa:** `types`
- **Es usado por:** `InspectionForm.tsx`
- **Rol en el sistema:** Motor de reglas de inspección y generador de textos legales.

### `src/utils/PdfGenerator.ts`
- **Importa:** `jspdf`, `types`
- **Es usado por:** `InspectionForm.tsx`, `InspectionList.tsx`
- **Rol en el sistema:** Generación de documentos PDF oficiales.

### `src/utils/PharmaParser.ts`
- **Importa:** `types`
- **Es usado por:** `InspectionForm.tsx`, `SeizureCalculator.tsx`
- **Rol en el sistema:** Análisis de strings de medicamentos para extracción de datos.

### `src/utils/security.ts`
- **Importa:** (Web Crypto API)
- **Es usado por:** `useAuthStore.ts`, `PinGuardModal.tsx`, `TeamForm.tsx`
- **Rol en el sistema:** Hashing y verificación de PINs.

### `src/utils/geo.ts`
- **Importa:** (Math)
- **Es usado por:** `InspectionWizard.tsx`
- **Rol en el sistema:** Cálculos de distancia GPS.

### `src/services/analyticsService.ts`
- **Importa:** `db`
- **Es usado por:** `InspectionList.tsx`, `DashboardHome.tsx`
- **Rol en el sistema:** Agregación de datos para KPIs y gráficas.

### `src/utils/specializedValidators.ts`
- **Importa:** `types`
- **Es usado por:** `InspectionForm.tsx`
- **Rol en el sistema:** Motor de validación técnica especializado (Cadena de Frío, Vencimientos, Uso Institucional). Contiene lógica pura de negocio.

---

## 📁 Componentes UI (Reutilizables)

### `src/components/ui/Icon.tsx`
- **Importa:** `lucide-react`
- **Es usado por:** Casi todos los componentes visuales (`Card`, `Button`, `Layout`, `Pages`...)
- **Rol en el sistema:** Abstracción de iconos.

### `src/components/ui/Card.tsx`
- **Importa:** `Icon`
- **Es usado por:** `DashboardHome`, `InspectionForm`, `CensusForm`, `TeamForm`, etc.
- **Rol en el sistema:** Contenedor estándar de secciones.

### `src/components/ui/Input.tsx`
- **Importa:** `React`
- **Es usado por:** `Login`, `InspectionForm`, `CensusForm`, `TeamForm`
- **Rol en el sistema:** Campo de entrada estandarizado.

### `src/components/ui/WizardStepper.tsx`
- **Importa:** `Icon`
- **Es usado por:** `InspectionForm.tsx`, `TeamForm.tsx`
- **Rol en el sistema:** Navegación por pasos.

### `src/components/ui/PinGuardModal.tsx`
- **Importa:** `useAuthStore`, `db`, `security`, `Icon`, `createPortal`
- **Es usado por:** `MaintenanceCenter.tsx`, `TeamList.tsx`, `CensusList.tsx`
- **Rol en el sistema:** Protección de acciones destructivas/sensibles.

---

## 📁 Módulos de Página (Vistas Principales)

### `src/pages/inspections/InspectionForm.tsx`
- **Importa:** `db`, `inspectionEngine`, `PdfGenerator`, `PharmaParser`, `specializedValidators`, `TacticalMatrix`, `SeizureCalculator`, `components/ui/*`
- **Es usado por:** `InspectionWizard.tsx`
- **Rol en el sistema:** Núcleo operativo. Formulario de captura de datos de inspección con validación en tiempo real.

### `src/pages/inspections/InspectionWizard.tsx`
- **Importa:** `db`, `geo`, `InspectionForm`, `components/ui/*`
- **Es usado por:** `App.tsx`
- **Rol en el sistema:** Flujo previo a la inspección (Validación GPS).

### `src/pages/admin/MaintenanceCenter.tsx`
- **Importa:** `db`, `backupHandler`, `excelHandler`, `seedCensus`, `PinGuardModal`
- **Es usado por:** `App.tsx`
- **Rol en el sistema:** Panel de administración de datos.

### `src/pages/Login.tsx`
- **Importa:** `useAuthStore`, `components/ui/*`
- **Es usado por:** `App.tsx`
- **Rol en el sistema:** Autenticación de usuarios.
>>>>>>> 262520164d3350cc3825eaf394ac5eda3c23f3ca
