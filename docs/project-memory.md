<<<<<<< HEAD
# Bitácora del Arquitecto - VigiSalud v7

Registro histórico de decisiones técnicas y evoluciones del proyecto.

## Historial de Cambios

### Sprint 7: Refactorización UX & Lógica de Negocio v2
**Fecha:** [Fecha Actual]
**Responsable:** Jules Pro

**Hito Principal:**
Refactorización profunda del módulo de inspección para mejorar la usabilidad y la integridad de los datos.

**Detalles Técnicos:**
1.  **Refactorización de UX (Divulgación Progresiva):** Se rediseñó `InspectionForm.tsx` para ocultar complejidad innecesaria. Se introdujo el concepto de "Tarjeta de Producto" para ítems CUM validados, mejorando la legibilidad con un modo oscuro de alto contraste.
2.  **Motor de Validación v2:** Se implementó `src/utils/specializedValidators.ts` para desacoplar las reglas de validación técnica (cadena de frío, fechas, uso institucional) del componente de vista.
3.  **Búsqueda Omnicanal:** Se optimizó el algoritmo de búsqueda de productos para soportar consultas paralelas por Registro Sanitario, Nombre y Principio Activo.
4.  **Parser Inteligente:** Actualización de `PharmaParser.ts` para limpiar descripciones "sucias" y detectar agrupaciones lógicas de empaques.

**Decisiones Arquitectónicas:**
*   **Migración de Documentación:** Se decidió migrar toda la documentación técnica (mapas de dependencia, resúmenes, memoria) a la carpeta `docs/` en la raíz del proyecto. Esto reduce el ruido en el directorio raíz y centraliza el conocimiento institucional.
*   **Eliminación de Firebase:** Confirmación de la arquitectura "Local-First" basada exclusivamente en Dexie.js.

### Sprint 6: [Histórico]
...
=======
# 🧠 Memoria del Proyecto VigiSalud

Este archivo actúa como la memoria central y persistente del proyecto. Documenta la arquitectura, decisiones técnicas y reglas de negocio para asegurar la coherencia en el desarrollo futuro.

---

## 🏛️ Arquitectura del Sistema

### 1. Stack Tecnológico
- **Frontend:** React 18 + TypeScript + Vite.
- **Estilos:** Tailwind CSS con configuración semántica (`tailwind.config.js`).
- **Persistencia Local (Offline-First):** Dexie.js (Wrapper de IndexedDB).
- **Estado Global:** Zustand (con persistencia en `localStorage`) para Auth; React Context para UI (Toasts).
- **Iconografía:** Lucide React.
- **Generación de Documentos:** jsPDF (Client-side rendering).

### 2. Principios de Diseño
- **Offline-First:** La aplicación debe ser totalmente funcional sin conexión a internet. Los datos viven en el navegador (IndexedDB).
- **Client-Side Processing:** Toda la lógica de negocio (validación, cálculo de riesgos, generación de PDF, parsing de CUM) ocurre en el cliente.
- **Seguridad Local:** Las contraseñas (PINs) se hashean (SHA-256 + Salt) antes de guardarse en IndexedDB.
- **Integridad de Datos:** Uso de Hashes SHA-256 en las actas para detectar manipulaciones post-firma.

---

## 🗄️ Modelo de Datos (Dexie / IndexedDB)

La base de datos se llama `VigiSaludDB`.

### Tablas Principales (`src/db.ts`)
1.  **`establishments` (Censo):**
    *   **Propósito:** Registro de lugares vigilados.
    *   **Claves:** `++id`, `nit`, `category`, `status`.
    *   **Notas:** Contiene datos de ubicación, responsable y dirección técnica.

2.  **`inspections` (Reportes):**
    *   **Propósito:** Actas de visita generadas.
    *   **Claves:** `++id`, `date`, `establishment_id`, `[date+establishment_id]`.
    *   **Estructura:** Objeto complejo `Report` que incluye `data` (contexto), `findings` (checklist), `products` (inventario) y `seizure` (medidas).
    *   **Migración V4:** Campo `riskFactor` (string) migrado a `riskFactors` (array).

3.  **`officials` (Usuarios):**
    *   **Propósito:** Funcionarios con acceso al sistema.
    *   **Claves:** `++id`, `username`, `identification`.
    *   **Seguridad:** El campo `pin` almacena `salt:hash`.

4.  **`cums` (Maestro Medicamentos):**
    *   **Propósito:** Catálogo oficial INVIMA para búsqueda offline.
    *   **Claves:** `id`, `expediente`, `producto`.
    *   **Optimización:** Datos normalizados en mayúsculas al insertar.

5.  **`seizures` (Cadena de Custodia):**
    *   **Propósito:** Trazabilidad de decomisos.
    *   **Claves:** `id`.

---

## 🔐 Autenticación y Seguridad

### Estructura (`useAuthStore.ts`)
- **Mecanismo:** Autenticación local contra la tabla `officials`.
- **Credenciales:** `username` (público) + `pin` (privado, 4 dígitos numéricos).
- **Persistencia:** Sesión guardada en `localStorage` (Zustand persist).
- **Roles (RBAC):**
    - `DIRECTOR` / `ADMIN`: Acceso total (Gestión de equipo, Borrado de BD, Configuración).
    - `COORDINADOR`: Gestión operativa.
    - `INSPECTOR`: Solo operativo (Realizar visitas, Ver historial).

### Medidas de Protección
- **PinGuardModal:** Componente que exige re-ingreso del PIN para acciones destructivas (Borrar usuario, Resetear BD).
- **Validación de Contratos:** El login bloquea usuarios cuya fecha de contrato (`contractDateEnd`) ha vencido.
- **Hashing:** Implementado en `src/utils/security.ts` usando Web Crypto API.

---

## 🧩 Patrones de UI/UX (React + Tailwind)

### Sistema de Diseño (`tailwind.config.js`)
- **Colores Semánticos:**
    - `brand`: Teal (Identidad corporativa).
    - `surface`: Slate (Fondos, tarjetas).
    - `status`: Emerald (Éxito), Amber (Alerta), Red (Peligro/Error), Blue (Info).
- **Componentes Base (`src/components/ui`):**
    - `Card`: Contenedor estándar.
    - `Input`: Campos de texto estilizados.
    - `Button`: Variantes semánticas (Primary, Secondary, Danger).
    - `Icon`: Abstracción de Lucide.
    - **Portales:** Usados para Modals (`PinGuardModal`, `DigitalIDCard`) para asegurar superposición correcta (`z-index`).

### Flujos de Usuario
- **Wizard Pattern:** Usado en `InspectionWizard` y `TeamForm` para procesos complejos por pasos.
- **Dashboard Layout:** Sidebar fijo + Header + Content Area.

---

## ⚙️ Motores de Lógica de Negocio

### 1. Motor de Inspección (`src/utils/inspectionEngine.ts`)
- **Generación Dinámica:** Crea checklists filtrados por `category` (FORMAL/INFORMAL) y `tags` (DROGUERIA, ALIMENTOS).
- **Cálculo de Riesgo:** Algoritmo ponderado. Items críticos (`isKiller`) penalizan fuertemente o fuerzan concepto desfavorable.
- **Asistente Legal:** Genera narrativa jurídica automática cruzando hallazgos de la matriz y del inventario con `MANUAL_RULES`.

### 2. Parser Farmacéutico (`src/utils/PharmaParser.ts`)
- **Propósito:** Interpretar texto libre (ej: "CAJA X 30 TAB") para estructurar datos.
- **Lógica:**
    - Detecta `mode`: DISCRETE (Sólidos/Viales) vs VOLUMETRIC (Líquidos) vs MASS_BASED (Cremas).
    - **Regla Especial:** "LIOFILIZADO" o "POLVO PARA RECONSTITUIR" fuerza `DISCRETE/VIAL`.
    - Extrae factores multiplicadores (Cajas x Unidades).

### 3. Generador PDF (`src/utils/PdfGenerator.ts`)
- **Tecnología:** `jspdf` (dibujo manual por coordenadas para control total).
- **Características:**
    - Paginación inteligente para narrativas largas.
    - Renderizado de tablas polimórficas (columnas cambian según tipo de producto).
    - Inclusión de firmas base64 e imágenes.

### 4. Backup & Restore (`src/utils/backupHandler.ts`)
- **Formato:** JSON.
- **Alcance:** Exporta tablas `census`, `officials`, `reports`.
- **Uso:** Migración manual de datos entre dispositivos (Air Gap).

---

## ⚠️ Reglas de Desarrollo (Do's and Don'ts)

1.  **NO usar dependencias de servidor:** Todo debe correr en el navegador.
2.  **Base de Datos:** Siempre acceder a través de la instancia `db` (`src/db.ts`). Usar `useLiveQuery` para reactividad en componentes.
3.  **Fechas:** Usar ISO 8601 Strings.
4.  **Textos:** Normalizar a MAYÚSCULAS para nombres, direcciones y datos de búsqueda.
5.  **Manejo de Errores:** Usar `ToastContext` para feedback al usuario.
6.  **Tipado:** Mantener estricto uso de TypeScript. No usar `any` en lógica de negocio crítica.
>>>>>>> 262520164d3350cc3825eaf394ac5eda3c23f3ca
