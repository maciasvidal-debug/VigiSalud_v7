<<<<<<< HEAD
# Catálogo de Archivos - VigiSalud v7

Resumen técnico de los módulos principales del sistema.

## `src/utils/`

### `specializedValidators.ts`
**Tipo:** Motor de Lógica / Validadores Puros
**Descripción:** Contiene funciones de validación aisladas para reglas de negocio críticas de productos farmacéuticos.
**Funciones Principales:**
1.  `validateColdChain(product)`: Verifica si productos biológicos/refrigerados cumplen el rango estricto de 2°C a 8°C.
2.  `validateExpiration(product)`: Compara la fecha de vencimiento con la fecha actual para detectar productos vencidos.
3.  `validateInstitucional(product)`: Analiza el texto de presentación y empaque para detectar marcas de "Uso Institucional" prohibidas en venta comercial.

### `PharmaParser.ts`
**Tipo:** Motor Semántico / Parser
**Descripción:** Interpreta descripciones técnicas de medicamentos (ej: "CAJA PLEGADIZA...") para convertirlas en texto legible y estructurado. Implementa detección de "Stop Words" y agrupación inteligente (Total vs Sub-empaques).

---

## `src/pages/inspections/`

### `InspectionForm.tsx`
**Tipo:** Controlador de Vista / Formulario Maestro
**Descripción:** Componente monolítico que orquesta todo el flujo de inspección.
**Cambios Recientes (Sprint 7):**
*   **Focus Flow UX:** Implementación de "Divulgación Progresiva". Los campos complejos se ocultan hasta que son necesarios.
*   **Tarjeta de Producto CUM:** Nueva visualización de alto contraste (Dark Mode) para productos cargados desde la base de datos maestra.
*   **Validación Defensiva:** Integración con `specializedValidators` para impedir el registro de productos no conformes sin la debida tipificación del riesgo.
*   **Idempotencia:** Blindaje contra doble envío en botones de acción crítica.
=======
# Resumen del Proyecto VigiSalud

Este documento contiene un resumen estructurado de todos los archivos del proyecto para auditoría arquitectónica.

## 📁 Configuración Raíz

### 📄 package.json
- **Ruta:** ./package.json
- **Propósito:** Define las dependencias, scripts de ejecución y metadatos del proyecto Node.js/Vite.
- **Exporta:** N/A (Configuración)
- **Importa:** Dependencias como React, Dexie, Tailwind, TypeScript, Vite, etc.
- **Dependencias internas:** N/A
- **Notas:** Usa Vite como bundler, Dexie para IndexedDB, y Tailwind para estilos. Scripts estándar de `dev`, `build`, `lint`.

### 📄 tsconfig.json
- **Ruta:** ./tsconfig.json
- **Propósito:** Configuración principal del compilador TypeScript.
- **Exporta:** N/A
- **Importa:** Referencias a `tsconfig.app.json` y `tsconfig.node.json`.
- **Dependencias internas:** N/A
- **Notas:** Estructura de proyecto monorepo-like o referencias de proyecto TS modernas.

### 📄 vite.config.ts
- **Ruta:** ./vite.config.ts
- **Propósito:** Configuración del servidor de desarrollo y empaquetador Vite.
- **Exporta:** Configuración por defecto de Vite.
- **Importa:** `defineConfig`, `@vitejs/plugin-react`.
- **Dependencias internas:** N/A
- **Notas:** Configuración mínima con plugin de React.

### 📄 tailwind.config.js
- **Ruta:** ./tailwind.config.js
- **Propósito:** Configuración de Tailwind CSS, define el tema, colores y fuentes personalizadas.
- **Exporta:** Objeto de configuración.
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Define una paleta semántica (`brand`, `surface`, `content`, `status`) y sombras personalizadas.

### 📄 postcss.config.js
- **Ruta:** ./postcss.config.js
- **Propósito:** Configuración de PostCSS para procesar CSS.
- **Exporta:** Configuración con plugins.
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Incluye `tailwindcss` y `autoprefixer`.

### 📄 eslint.config.js
- **Ruta:** ./eslint.config.js
- **Propósito:** Reglas de linter para calidad de código.
- **Exporta:** Configuración plana de ESLint.
- **Importa:** `@eslint/js`, `typescript-eslint`, plugins de react.
- **Dependencias internas:** N/A
- **Notas:** Configuración moderna (Flat Config) para TypeScript y React.

---

## 📁 Código Fuente (src/)

### 📄 src/main.tsx
- **Ruta:** src/main.tsx
- **Propósito:** Punto de entrada de la aplicación React. Inicializa la BD y monta el DOM.
- **Exporta:** N/A
- **Importa:** `React`, `ReactDOM`, `App`, `db`.
- **Dependencias internas:** `src/App.tsx`, `src/db.ts`.
- **Notas:** Incluye lógica "Génesis" para crear el usuario ADMIN por defecto si no existe.

### 📄 src/App.tsx
- **Ruta:** src/App.tsx
- **Propósito:** Enrutador principal de la aplicación. Define las rutas públicas y protegidas.
- **Exporta:** Componente `App`.
- **Importa:** `react-router-dom`, páginas, layouts, store, contexto.
- **Dependencias internas:** `src/pages/*`, `src/components/layout/DashboardLayout`, `src/store/useAuthStore`, `src/context/ToastContext`.
- **Notas:** Usa `react-router-dom` v6+. Implementa `ProtectedRoute` basado en `useAuthStore`.

### 📄 src/db.ts
- **Ruta:** src/db.ts
- **Propósito:** Definición del esquema de base de datos local (IndexedDB) usando Dexie.
- **Exporta:** Clase `VigiSaludDB`, instancia `db`, interfaz `CumRecord`.
- **Importa:** `dexie`.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Maneja versiones de esquema (migraciones 1 a 4). Incluye hooks para sanitización de datos (uppercase, trim) en inserción/actualización.

### 📄 src/types.ts
- **Ruta:** src/types.ts
- **Propósito:** Definiciones de tipos TypeScript globales para el dominio de la aplicación.
- **Exporta:** Interfaces (`Establishment`, `Report`, `User`, `ProductFinding`, etc.) y Tipos (`CategoryType`, `RiskFactor`, etc.).
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Define el modelo de datos central. Incluye estructuras complejas para hallazgos y logística.

### 📄 src/constants.ts
- **Ruta:** src/constants.ts
- **Propósito:** Constantes globales estáticas.
- **Exporta:** `DANE_ATLANTICO`, `ESTABLISHMENT_TYPES`.
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Lista de municipios del Atlántico con códigos DANE.

### 📄 src/vite-env.d.ts
- **Ruta:** src/vite-env.d.ts
- **Propósito:** Declaraciones de tipos para Vite.
- **Exporta:** N/A
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Archivo estándar de Vite.

---

## 📁 Contexto y Estado (src/context, src/store)

### 📄 src/context/ToastContext.tsx
- **Ruta:** src/context/ToastContext.tsx
- **Propósito:** Proveedor de contexto para mostrar notificaciones (Toasts) globales.
- **Exporta:** `ToastProvider`, hook `useToast`.
- **Importa:** `React`, `createContext`, `useState`.
- **Dependencias internas:** `src/components/ui/Toast.tsx`.
- **Notas:** Patrón Provider/Consumer para feedback visual.

### 📄 src/store/useAuthStore.ts
- **Ruta:** src/store/useAuthStore.ts
- **Propósito:** Gestión del estado de sesión y autenticación con persistencia local.
- **Exporta:** Hook `useAuthStore`.
- **Importa:** `zustand`, `dexie`.
- **Dependencias internas:** `src/db.ts`, `src/utils/security.ts`.
- **Notas:** Usa `zustand` con middleware `persist`. Incluye lógica de negocio para validación de contratos y bloqueo de usuarios.

---

## 📁 Utilidades y Servicios (src/utils, src/services)

### 📄 src/services/analyticsService.ts
- **Ruta:** src/services/analyticsService.ts
- **Propósito:** Calcula métricas de negocio para el dashboard (IPO, riesgo, efectividad).
- **Exporta:** Objeto `analyticsService`, interfaz `AnalyticsMetrics`.
- **Importa:** `db`.
- **Dependencias internas:** `src/db.ts`.
- **Notas:** Realiza agregaciones sobre la BD local.

### 📄 src/utils/PdfGenerator.ts
- **Ruta:** src/utils/PdfGenerator.ts
- **Propósito:** Genera el archivo PDF del acta de inspección.
- **Exporta:** Función `generateInspectionPDF`.
- **Importa:** `jspdf`.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Renderizado manual con `jspdf` (no usa html2canvas). Maneja paginación, tablas dinámicas y firmas.

### 📄 src/utils/PharmaParser.ts
- **Ruta:** src/utils/PharmaParser.ts
- **Propósito:** Analiza descripciones de productos para extraer presentación comercial, modo y factores.
- **Exporta:** Función `parsePresentation`.
- **Importa:** Tipos.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Lógica heurística y RegEx para interpretar textos como "CAJA X 30 TAB" o "POLVO LIOFILIZADO".

### 📄 src/utils/backupHandler.ts
- **Ruta:** src/utils/backupHandler.ts
- **Propósito:** Exportación e importación completa de la base de datos (Backup JSON).
- **Exporta:** Objeto `backupHandler`.
- **Importa:** `db`.
- **Dependencias internas:** `src/db.ts`.
- **Notas:** Permite migrar datos entre dispositivos mediante archivos JSON.

### 📄 src/utils/crypto.ts
- **Ruta:** src/utils/crypto.ts
- **Propósito:** Generación de hash criptográfico para integridad de actas.
- **Exporta:** Función `generateInspectionHash`.
- **Importa:** API Web Crypto.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Genera SHA-256 de los datos críticos del reporte.

### 📄 src/utils/excelHandler.ts
- **Ruta:** src/utils/excelHandler.ts
- **Propósito:** Manejo de importación/exportación de archivos Excel (Censo).
- **Exporta:** Objeto `excelHandler`.
- **Importa:** `exceljs`.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Parsea excels de censo y exporta datos a XLSX.

### 📄 src/utils/geo.ts
- **Ruta:** src/utils/geo.ts
- **Propósito:** Utilidades geográficas y generadores de ID.
- **Exporta:** `calculateDistance`, `generateActId`.
- **Importa:** Math.
- **Dependencias internas:** N/A
- **Notas:** Implementa fórmula de Haversine para distancia GPS.

### 📄 src/utils/inspectionEngine.ts
- **Ruta:** src/utils/inspectionEngine.ts
- **Propósito:** Motor lógico central. Genera checklists, calcula riesgos, valida productos y redacta textos legales.
- **Exporta:** Objeto `inspectionEngine`.
- **Importa:** Tipos.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Contiene el catálogo maestro de preguntas (`MASTER_CATALOG`) y reglas de producto (`PRODUCT_RULES`).

### 📄 src/utils/productSchemas.ts
- **Ruta:** src/utils/productSchemas.ts
- **Propósito:** Definición de esquemas de formularios para diferentes tipos de productos.
- **Exporta:** `PRODUCT_SCHEMAS`, interfaces.
- **Importa:** Tipos.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Configura campos dinámicos para el formulario de productos.

### 📄 src/utils/security.ts
- **Ruta:** src/utils/security.ts
- **Propósito:** Funciones de seguridad para PINs (Hashing y Verificación).
- **Exporta:** `hashPin`, `verifyPin`.
- **Importa:** API Web Crypto.
- **Dependencias internas:** N/A
- **Notas:** Usa SHA-256 con Salt para guardar PINs de firma.

### 📄 src/utils/seedCensus.ts
- **Ruta:** src/utils/seedCensus.ts
- **Propósito:** Generador de datos de prueba (Seed).
- **Exporta:** Función `seedDatabase`.
- **Importa:** `db`.
- **Dependencias internas:** `src/db.ts`, `src/types.ts`.
- **Notas:** Crea establecimientos ficticios para pruebas.

---

## 📁 Datos Estáticos (src/data)

### 📄 src/data/checklists.ts
- **Ruta:** src/data/checklists.ts
- **Propósito:** Definiciones estáticas de checklists (Parece ser una versión antigua o simplificada, `inspectionEngine` tiene el catálogo maestro).
- **Exporta:** `CHECKLISTS`.
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Define preguntas por categoría (FORMAL, INFORMAL, AMBULANTE).

### 📄 src/data/manualRules.ts
- **Ruta:** src/data/manualRules.ts
- **Propósito:** Catálogo de reglas manuales y normatividad.
- **Exporta:** `MANUAL_RULES`.
- **Importa:** N/A
- **Dependencias internas:** N/A
- **Notas:** Lista extensa de reglas con descripción, riesgo y norma asociada.

---

## 📁 Componentes UI (src/components/ui)

### 📄 src/components/ui/Input.tsx
- **Ruta:** src/components/ui/Input.tsx
- **Propósito:** Componente base de entrada de texto.
- **Exporta:** Componente `Input`.
- **Importa:** `React`.
- **Dependencias internas:** N/A
- **Notas:** Input estilizado con Tailwind, soporta refs y estados de error.

### 📄 src/components/ui/Icon.tsx
- **Ruta:** src/components/ui/Icon.tsx
- **Propósito:** Wrapper para iconos de `lucide-react`.
- **Exporta:** Componente `Icon`.
- **Importa:** `lucide-react`.
- **Dependencias internas:** N/A
- **Notas:** Carga iconos dinámicamente por nombre de string.

### 📄 src/components/ui/Badge.tsx
- **Ruta:** src/components/ui/Badge.tsx
- **Propósito:** Etiqueta visual para estados o categorías.
- **Exporta:** Componente `Badge`.
- **Importa:** `React`.
- **Dependencias internas:** N/A
- **Notas:** Variantes de color semánticas (success, warning, etc.).

### 📄 src/components/ui/Card.tsx
- **Ruta:** src/components/ui/Card.tsx
- **Propósito:** Contenedor genérico con título opcional.
- **Exporta:** Componente `Card`.
- **Importa:** `React`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`.
- **Notas:** Estructura base para paneles y secciones.

### 📄 src/components/ui/WizardStepper.tsx
- **Ruta:** src/components/ui/WizardStepper.tsx
- **Propósito:** Barra de progreso para formularios de pasos.
- **Exporta:** Componente `WizardStepper`.
- **Importa:** `React`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`.
- **Notas:** Visualiza el flujo de pasos.

### 📄 src/components/ui/SignaturePad.tsx
- **Ruta:** src/components/ui/SignaturePad.tsx
- **Propósito:** Área de captura de firma manuscrita (Canvas).
- **Exporta:** Componente `SignaturePad`.
- **Importa:** `React`.
- **Dependencias internas:** N/A
- **Notas:** Permite dibujar y exportar a imagen Base64. Soporta touch.

### 📄 src/components/ui/DigitalIDCard.tsx
- **Ruta:** src/components/ui/DigitalIDCard.tsx
- **Propósito:** Carnet digital interactivo del funcionario.
- **Exporta:** Componente `DigitalIDCard`.
- **Importa:** `React`, `createPortal`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`, `src/types.ts`.
- **Notas:** Efecto 3D CSS y Portal para modal full-screen.

### 📄 src/components/ui/PinGuardModal.tsx
- **Ruta:** src/components/ui/PinGuardModal.tsx
- **Propósito:** Modal de seguridad para solicitar PIN antes de acciones críticas.
- **Exporta:** Componente `PinGuardModal`.
- **Importa:** `React`, `createPortal`.
- **Dependencias internas:** `src/store/useAuthStore`, `src/db.ts`, `src/utils/security.ts`.
- **Notas:** Valida el PIN contra el hash en BD.

### 📄 src/components/ui/Toast.tsx
- **Ruta:** src/components/ui/Toast.tsx
- **Propósito:** Notificación flotante temporal.
- **Exporta:** Componente `Toast`.
- **Importa:** `React`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`.
- **Notas:** Se auto-cierra después de 4 segundos.

### 📄 src/components/ui/Button.tsx
- **Ruta:** src/components/ui/Button.tsx
- **Propósito:** Botón base estilizado.
- **Exporta:** Componente `Button`.
- **Importa:** `React`, `lucide-react`.
- **Dependencias internas:** N/A
- **Notas:** Variantes de estilo y estado de carga.

### 📄 src/components/ui/ConfirmModal.tsx
- **Ruta:** src/components/ui/ConfirmModal.tsx
- **Propósito:** Modal de confirmación genérico.
- **Exporta:** Componente `ConfirmModal`.
- **Importa:** `React`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`.
- **Notas:** Para confirmar acciones destructivas.

---

## 📁 Componentes de Dominio (src/components/layout, inspection, etc.)

### 📄 src/components/layout/DashboardLayout.tsx
- **Ruta:** src/components/layout/DashboardLayout.tsx
- **Propósito:** Estructura principal del dashboard (Sidebar + Header + Content).
- **Exporta:** Componente `DashboardLayout`.
- **Importa:** `react-router-dom`.
- **Dependencias internas:** `./Sidebar`, `./Header`.
- **Notas:** Usa `Outlet` para renderizar rutas hijas.

### 📄 src/components/layout/Header.tsx
- **Ruta:** src/components/layout/Header.tsx
- **Propósito:** Barra superior con información de usuario y logout.
- **Exporta:** Componente `Header`.
- **Importa:** `useAuthStore`.
- **Dependencias internas:** `src/store/useAuthStore`, `src/components/ui/Icon.tsx`.
- **Notas:** Muestra usuario y rol.

### 📄 src/components/layout/Sidebar.tsx
- **Ruta:** src/components/layout/Sidebar.tsx
- **Propósito:** Menú de navegación lateral.
- **Exporta:** Componente `Sidebar`.
- **Importa:** `react-router-dom`, `useAuthStore`.
- **Dependencias internas:** `src/components/ui/Icon.tsx`.
- **Notas:** Filtra ítems de menú según el rol del usuario.

### 📄 src/components/dashboard/StatCard.tsx
- **Ruta:** src/components/dashboard/StatCard.tsx
- **Propósito:** Tarjeta de estadísticas para el dashboard.
- **Exporta:** Componente `StatCard`.
- **Importa:** `React`.
- **Dependencias internas:** `src/components/ui/Card.tsx`, `src/components/ui/Icon.tsx`.
- **Notas:** Muestra valor, etiqueta e icono con código de color.

### 📄 src/components/seizure/SeizureCalculator.tsx
- **Ruta:** src/components/seizure/SeizureCalculator.tsx
- **Propósito:** Calculadora para conversiones de unidades en decomisos (Cajas -> Unidades -> Volumen).
- **Exporta:** Componente `SeizureCalculator`.
- **Importa:** `React`.
- **Dependencias internas:** `src/utils/PharmaParser.ts`.
- **Notas:** Lógica dinámica para mostrar/ocultar volumen según si es DISCRETE o VOLUMETRIC.

### 📄 src/components/inspection/TacticalMatrix.tsx
- **Ruta:** src/components/inspection/TacticalMatrix.tsx
- **Propósito:** Renderiza la lista de chequeo de inspección agrupada por bloques.
- **Exporta:** Componente `TacticalMatrix`.
- **Importa:** `React`.
- **Dependencias internas:** `src/types.ts`, `src/components/ui/Icon.tsx`.
- **Notas:** Maneja expansión de items, captura de fotos (input file) y respuestas (CUMPLE/NO CUMPLE).

---

## 📁 Páginas (src/pages)

### 📄 src/pages/DashboardHome.tsx
- **Ruta:** src/pages/DashboardHome.tsx
- **Propósito:** Página principal del dashboard. Muestra métricas para directores o accesos rápidos para inspectores.
- **Exporta:** Componente `DashboardHome`.
- **Importa:** `dexie-react-hooks`.
- **Dependencias internas:** `src/store/useAuthStore`, `src/services/analyticsService`, `src/db.ts`.
- **Notas:** Renderizado condicional basado en rol (Vista Director vs Inspector).

### 📄 src/pages/Login.tsx
- **Ruta:** src/pages/Login.tsx
- **Propósito:** Pantalla de inicio de sesión.
- **Exporta:** Componente `Login`.
- **Importa:** `useAuthStore`, `react-router-dom`.
- **Dependencias internas:** `src/store/useAuthStore`, `src/components/ui/*`.
- **Notas:** Autenticación contra BD local. Maneja "Remember Me".

### 📄 src/pages/admin/MaintenanceCenter.tsx
- **Ruta:** src/pages/admin/MaintenanceCenter.tsx
- **Propósito:** Panel de administración de datos (Backup, Restore, Importación Masiva).
- **Exporta:** Componente `MaintenanceCenter`.
- **Importa:** `exceljs`.
- **Dependencias internas:** `src/utils/backupHandler.ts`, `src/utils/excelHandler.ts`, `src/db.ts`.
- **Notas:** Herramientas críticas protegidas por `PinGuardModal`. Lógica de importación de CUMs y Censo desde Excel.

### 📄 src/pages/resources/ResourceCenter.tsx
- **Ruta:** src/pages/resources/ResourceCenter.tsx
- **Propósito:** Página de descarga de plantillas y documentación.
- **Exporta:** Componente `ResourceCenter`.
- **Importa:** `exceljs`.
- **Dependencias internas:** `src/store/useAuthStore`.
- **Notas:** Genera archivos Excel de plantilla en el cliente.

### 📄 src/pages/census/CensusList.tsx
- **Ruta:** src/pages/census/CensusList.tsx
- **Propósito:** Listado de establecimientos vigilados.
- **Exporta:** Componente `CensusList`.
- **Importa:** `dexie-react-hooks`.
- **Dependencias internas:** `src/db.ts`, `src/components/ui/*`.
- **Notas:** Búsqueda, filtrado y opciones de gestión (Importar/Exportar).

### 📄 src/pages/census/CensusForm.tsx
- **Ruta:** src/pages/census/CensusForm.tsx
- **Propósito:** Formulario para crear/editar establecimientos.
- **Exporta:** Componente `CensusForm`.
- **Importa:** `db`.
- **Dependencias internas:** `src/types.ts`.
- **Notas:** Validación de datos, georeferenciación básica por municipio.

### 📄 src/pages/census/CensusProfile.tsx
- **Ruta:** src/pages/census/CensusProfile.tsx
- **Propósito:** Vista de detalle de un establecimiento (Hoja de Vida).
- **Exporta:** Componente `CensusProfile`.
- **Importa:** `dexie-react-hooks`.
- **Dependencias internas:** `src/db.ts`.
- **Notas:** Muestra información general e historial de inspecciones.

### 📄 src/pages/team/TeamList.tsx
- **Ruta:** src/pages/team/TeamList.tsx
- **Propósito:** Gestión de funcionarios (Usuarios).
- **Exporta:** Componente `TeamList`.
- **Importa:** `dexie-react-hooks`.
- **Dependencias internas:** `src/db.ts`, `src/components/ui/DigitalIDCard.tsx`.
- **Notas:** ABM de usuarios, generación de carnet digital.

### 📄 src/pages/team/TeamForm.tsx
- **Ruta:** src/pages/team/TeamForm.tsx
- **Propósito:** Formulario de registro/edición de funcionarios.
- **Exporta:** Componente `TeamForm`.
- **Importa:** `db`.
- **Dependencias internas:** `src/utils/security.ts`.
- **Notas:** Wizard de 3 pasos. Hashea el PIN antes de guardar.

### 📄 src/pages/inspections/InspectionList.tsx
- **Ruta:** src/pages/inspections/InspectionList.tsx
- **Propósito:** Historial global de inspecciones realizadas.
- **Exporta:** Componente `InspectionList`.
- **Importa:** `dexie-react-hooks`.
- **Dependencias internas:** `src/db.ts`, `src/services/analyticsService`, `src/utils/PdfGenerator.ts`.
- **Notas:** Tabla de actuaciones con opción de descargar PDF.

### 📄 src/pages/inspections/InspectionWizard.tsx
- **Ruta:** src/pages/inspections/InspectionWizard.tsx
- **Propósito:** Flujo previo a la inspección (Validación GPS, Protocolo de Apertura).
- **Exporta:** Componente `InspectionWizard`.
- **Importa:** `geo`.
- **Dependencias internas:** `src/pages/inspections/InspectionForm.tsx`.
- **Notas:** Valida ubicación GPS vs Coordenadas del establecimiento. Maneja excepciones (Art 286 CP).

### 📄 src/pages/inspections/InspectionForm.tsx
- **Ruta:** src/pages/inspections/InspectionForm.tsx
- **Propósito:** Formulario principal de la inspección (Checklist, Productos, Cierre).
- **Exporta:** Componente `InspectionForm`.
- **Importa:** `inspectionEngine`, `PharmaParser`.
- **Dependencias internas:** `src/components/inspection/TacticalMatrix`, `src/components/seizure/SeizureCalculator`.
- **Notas:** Componente monolítico complejo. Gestiona lógica de evaluación, inventario, medidas sanitarias y generación de acta.

### 📄 src/pages/inspections/InspectionViewer.tsx
- **Ruta:** src/pages/inspections/InspectionViewer.tsx
- **Propósito:** Visor de actas cerradas (Solo lectura).
- **Exporta:** Componente `InspectionViewer`.
- **Importa:** `jspdf`.
- **Dependencias internas:** `src/db.ts`.
- **Notas:** Muestra el resumen del acta y permite regenerar el PDF. Valida Hash de integridad.
>>>>>>> 262520164d3350cc3825eaf394ac5eda3c23f3ca
