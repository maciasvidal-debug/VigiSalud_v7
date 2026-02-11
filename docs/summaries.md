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
