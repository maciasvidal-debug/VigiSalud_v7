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
