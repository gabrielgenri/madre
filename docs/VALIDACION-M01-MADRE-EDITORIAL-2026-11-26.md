# MADRE — Validación técnica de M01 Madre Editorial

**Fecha de validación:** 26 de noviembre de 2026 (Argentina; registros de infraestructura entre 23:45 y 00:50 UTC del 27/11).  
**Repositorio:** `gabrielgenri/madre`, rama `main`.  
**Commit validado:** `4ca080eee74ea243982aaeb7a997b17d0cc788e3`.  
**Supabase:** proyecto `madre` (`cxuoaydhmvafsgtklwny`), región `sa-east-1`.  
**Estado final:** **PARCIAL AVANZADO — NO CERTIFICADO PARA OPERACIÓN EDITORIAL INTEGRAL.**

## 1. Criterio de validación

M01 se considera validado únicamente cuando se comprueban en conjunto:

1. Arranque y autenticación.
2. Lectura y escritura persistente de unidades editoriales.
3. Trazabilidad de fuentes, afirmaciones, evidencias y verificaciones.
4. Versionado inmutable y restauración.
5. Generación y guardado de los seis formatos ligados a una versión madre.
6. Control de calidad y revisión/aprobación humana.
7. Autorización por roles y aislamiento mediante RLS.
8. Integración de distribución sin publicación automática.

Se distinguen las pruebas ejecutadas de las inspecciones estáticas y de las pruebas pendientes. No se modificaron ni borraron registros productivos durante esta ronda.

## 2. Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| Instalación de dependencias | APROBADA | GitHub Actions, paso “Install dependencies”, ejecución 45918763540 |
| Sintaxis JavaScript | APROBADA | GitHub Actions, paso “Check JavaScript syntax” |
| Build Vite | APROBADA | GitHub Actions, paso “Build Vite application” |
| Despliegue Vercel | APROBADO | Estado del commit 4ca080e: “Deployment has completed” |
| Supabase activo | APROBADA | Proyecto en estado `ACTIVE_HEALTHY` |
| Sesión autenticada en aplicación desplegada | APROBADA | Navegador conectado mostró el espacio de trabajo con sesión vigente |
| Carga de unidades | APROBADA | La aplicación cargó 9 unidades editoriales |
| Carga de bandeja de trabajo | APROBADA | La bandeja mostró unidades, prioridades, asignaciones y vencimientos |
| Apertura de detalle editorial | APROBADA | Se cargaron campos de unidad, historial de versiones, revisión, asignación y distribución |
| Lectura de formatos e investigación | APROBADA | Se visualizaron formatos, fuentes, afirmaciones, evidencias y verificaciones de la unidad abierta |
| Generación Gemini | FALLIDA | La función respondió 503; los registros internos identifican respuestas 401 de Google |
| CRUD con nueva escritura | PENDIENTE | No se crearon ni modificaron registros productivos |
| Prueba multirol/RLS negativa | PENDIENTE | Solo hay un usuario con rol admin |
| Aprobación humana real | PENDIENTE | No hay eventos de revisión/aprobación registrados |
| Envío real a WordPress | PENDIENTE | No se ejecutó un envío |

**Ejecución CI:**  
https://github.com/gabrielgenri/madre/actions/runs/45918763540

**Aplicación desplegada:**  
https://madre-madre3.vercel.app/

## 3. Estado actual de la base

Supabase se encuentra activo y saludable. Se verificaron 17 tablas públicas y las 17 tienen RLS habilitado. Ninguna tiene `FORCE ROW LEVEL SECURITY`; esto no desactiva las políticas para los roles API, pero debe considerarse en el modelo de amenazas y en las pruebas con credenciales reales.

| Registro | Cantidad actual |
|---|---:|
| Unidades editoriales | 9 |
| Versiones | 19 |
| Fuentes | 2 |
| Afirmaciones | 1 |
| Evidencias | 0 |
| Verificaciones | 1 |
| Formatos | 26 |
| Controles de calidad | 3 |
| Observaciones de calidad | 0 |
| Eventos de revisión/aprobación | 0 |
| Eventos de trabajo/asignación | 2 |
| Registros de auditoría | 33 |
| Usuarios con rol | 1 admin |

Las tres revisiones de calidad registradas tienen estado `needs_attention`. Las nueve unidades siguen en estado `draft`.

### Cobertura de los seis formatos

| Unidad | Formatos completos | Vigentes | Desactualizados |
|---|---:|---:|---:|
| 121 | 6 | 6 | 0 |
| Diarios | 6 | 0 | 6 |
| MCP | 1 | 1 | 0 |
| sdd | 1 | 1 | 0 |
| Servidores MCP | 3 | 0 | 3 |
| UNLaR y CONICET | 1 | 1 | 0 |
| Uno | 6 | 6 | 0 |
| Vercel (unidad 1) | 2 | 2 | 0 |
| Vercel (unidad 2) | 0 | 0 | 0 |

Solo **2 de las 9 unidades** tienen los seis formatos completos y vinculados a la versión madre vigente. Dos unidades conservan formatos desactualizados. La existencia de 26 registros demuestra persistencia de borradores, pero no cobertura integral por unidad.

## 4. Hallazgo bloqueante: generación con Gemini

La Edge Function `generate-editorial-format` está activa en versión 25 y exige JWT. Se inspeccionaron registros de ejecución entre 23:45 y 00:55 UTC.

Se observaron solicitudes `POST` que terminaron en HTTP 503. Los registros internos muestran que los cuatro modelos configurados respondieron HTTP 401 con el motivo:

`ACCOUNT_STATE_INVALID`

Google informa que **la cuenta de servicio vinculada a la API key está eliminada o deshabilitada**. Por lo tanto, no es un problema de saturación temporal ni de disponibilidad de los modelos.

La función actualmente transforma el agotamiento de los modelos en el código genérico `all_models_unavailable` y devuelve un mensaje de “modelos ocupados”. El cliente ya contempla el código `provider_auth_error`, pero el backend no lo emite en este caso. La interfaz muestra así un diagnóstico incorrecto.

### Acción necesaria para desbloquear

1. Revisar en Google AI Studio / Google Cloud el proyecto y la cuenta de servicio vinculada a la clave Gemini.
2. Reactivar una cuenta de servicio válida o generar una nueva API key desde un proyecto activo.
3. Actualizar el secreto `GEMINI_API_KEY` en Supabase.
4. Reintentar primero un único formato.
5. Si funciona, ejecutar los seis formatos y comprobar que queden guardados contra la misma versión madre.

### Corrección técnica recomendada

Modificar `generate-editorial-format` para detectar respuestas 401/403 de proveedor y devolver `code: "provider_auth_error"`, con un mensaje claro. Mantener la clasificación de saturación para 429 y errores temporales 5xx. Esta corrección no fue desplegada en esta validación.

## 5. Integridad editorial y revisión humana

La inspección de funciones y triggers de PostgreSQL confirma que existen controles para:

- Crear una versión al modificar el contenido editorial.
- Mantener las versiones históricas inmutables.
- Marcar como desactualizados los formatos que no correspondan a la versión madre actual.
- Guardar formatos solo dentro de los seis tipos definidos.
- Exigir seis formatos completos y vigentes antes de registrar una decisión de revisión.
- Rechazar decisiones cuando existen hallazgos críticos.
- Exigir solicitud de revisión vigente para correcciones o aprobación.
- Restringir la aprobación a editor/admin y el registro de verificaciones a reviewer/editor/admin.
- Exigir aprobación humana vigente antes de pasar a Revisado o Publicado.
- Registrar cambios de estado y decisiones editoriales.

Estos controles se verificaron por inspección de definiciones SQL y políticas activas. **No equivalen a una prueba funcional de cada camino con usuarios reales.** No hay eventos de revisión ni aprobación en los datos actuales.

## 6. Seguridad y rendimiento

El asesor de seguridad de Supabase mantiene estas alertas:

- Tres funciones `SECURITY DEFINER` ejecutables por `anon` y `authenticated`: `audit_editorial_unit`, `handle_new_user` y `has_role`.
- Protección de contraseñas filtradas deshabilitada.

No revocar permisos indiscriminadamente: `has_role` participa de las políticas RLS y de funciones del flujo editorial. Las funciones de trigger deben revisarse por separado y limitar su exposición sin romper su ejecución.

El asesor de rendimiento informó nueve claves foráneas sin índice de cobertura y veinte índices sin uso observado. Son recomendaciones de optimización, no fallas funcionales demostradas. No se eliminaron índices.

## 7. Matriz de cierre de M01

| Área | Estado |
|---|---|
| Arranque, sesión y lectura de workspace | VERIFICADO |
| Build y despliegue | VERIFICADO |
| Persistencia existente y lectura de unidades | VERIFICADO |
| CRUD completo en sesión de prueba | PENDIENTE |
| Fuentes, afirmaciones, evidencias y verificaciones | IMPLEMENTADO; escritura real pendiente |
| Versionado y restauración | IMPLEMENTADO; prueba de navegador pendiente |
| Seis formatos | IMPLEMENTADO; cobertura real parcial |
| Generación Gemini | BLOQUEADA por cuenta de servicio deshabilitada |
| Control de calidad | IMPLEMENTADO; tres controles existentes requieren atención |
| Revisión/aprobación humana | REGLAS IMPLEMENTADAS; circuito real sin probar |
| Roles y RLS multiusuario | POLÍTICAS PRESENTES; prueba multirol pendiente |
| WordPress | ENDPOINT DISPONIBLE; envío real pendiente |
| Accesibilidad y responsive | NO CERTIFICADO |
| Pruebas E2E automatizadas | NO IMPLEMENTADAS |

## 8. Próximos pasos para certificar M01

1. Corregir la cuenta de servicio/API key Gemini y actualizar `GEMINI_API_KEY`.
2. Corregir el diagnóstico de errores del backend para distinguir autenticación de saturación.
3. Ejecutar generación de un formato y luego de los seis; verificar versión, referencias y persistencia.
4. Preparar dos cuentas de prueba con roles distintos (por ejemplo writer y reviewer/editor) y comprobar permisos positivos y negativos.
5. Ejecutar un ciclo completo en una unidad de prueba: crear, editar, agregar fuente, afirmación, evidencia, verificación, generar formatos, control de calidad, solicitar revisión, pedir correcciones, nueva versión y aprobación.
6. Probar restauración de versión y comprobar que los formatos previos queden desactualizados.
7. Verificar el envío WordPress como borrador, sin publicar.
8. Incorporar pruebas E2E y auditoría de accesibilidad/uso móvil.

## Conclusión

M01 ya cuenta con una aplicación desplegada, una base activa, modelo editorial, persistencia, versionado, formatos, controles y reglas de revisión. La compilación y el despliegue están aprobados y la aplicación carga con una sesión autenticada.

Sin embargo, la generación de contenidos está bloqueada por la cuenta de servicio vinculada a Gemini; la cobertura de formatos es incompleta; no hay evidencias ni eventos de aprobación registrados; y no se pudo certificar el aislamiento entre roles ni el circuito editorial completo.

**Estado que debe figurar en el Mapa Maestro: M01 — Parcial avanzado. Infraestructura y build verificados; operación integral pendiente de desbloqueo IA y pruebas funcionales multirol.**
