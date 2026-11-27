# MADRE — Auditoría del estado real de módulos

**Corte:** 26 de noviembre de 2026 (Argentina).  
**Fuentes:** repositorio `gabrielgenri/madre`, rama `main`; documentación técnica y de implementación; proyecto Supabase `madre`; migraciones, tablas, RLS, Storage, Edge Functions y asesores de Supabase.

## Criterio
- **Construido:** existe código, estructura o servicio.
- **Verificado:** hay evidencia de ejecución comprobada.
- **Parcial:** existe una parte, faltan componentes o pruebas.
- **No construido:** no se encontró implementación verificable.
- **Pendiente de prueba:** existe implementación, pero no se ha probado en operación real.

Una pantalla, tabla o función desplegada no certifica por sí sola que el módulo funcione de punta a punta.

## Diagnóstico ejecutivo
MADRE tiene un núcleo editorial de avance intermedio: persistencia Supabase, Magic Link, CRUD de unidades, fuentes, afirmaciones, evidencias, verificaciones, seis formatos editables, versionado, controles estructurales, revisión/aprobación humana, asignaciones y endpoint WordPress.

El ecosistema completo todavía no está construido. La interfaz solo habilita Madre Editorial; Biblioteca Riojana, Editor Crítico, Transcripción, Observatorios y Distribución aparecen como “Próximamente”. La Edge Function del Editor Crítico está desplegada, pero no se encontró una llamada desde la interfaz. WordPress está desplegado como endpoint de borradores, pero no hay envíos reales registrados ni confirmación de secretos externos.

**Estado global: núcleo editorial parcialmente construido; ecosistema modular incompleto; operación productiva integral no demostrada.**

## Inventario técnico
- Frontend: Vite + JavaScript ES Modules; `@supabase/supabase-js`.
- Entrada: `index.html` → `src/app/main.js`.
- Vista principal: `src/modules/madre-editorial/editorial.view.js`.
- Servicio: `src/shared/services/editorial.service.js`.
- Auth: `src/core/auth/auth.service.js`.
- Supabase: proyecto `cxuoaydhmvafsgtklwny`, `ACTIVE_HEALTHY`, región `sa-east-1`.
- 26 migraciones remotas; 17 tablas públicas, todas con RLS.
- Tablas: `profiles`, `user_roles`, `editorial_units`, `editorial_versions`, `sources`, `claims`, `evidences`, `verifications`, `editorial_formats`, `audit_logs`, `editorial_quality_reviews`, `editorial_quality_observations`, `editorial_review_events`, `editorial_work_events`, `editorial_notifications`, `editorial_distribution_events`, `editorial_status_events`.
- Storage: bucket privado `madre-originals`. Extensión `vector` instalada.
- Edge Functions activas con JWT: `generate-editorial-format` v25, `editorial-critical-review` v16, `wordpress-draft` v6.
- `package.json` declara `dev`, `build`, `preview`; no declara script de tests.
- No se encontraron tablas de Biblioteca, Observatorios o Transcripción.

## Datos observados
| Registro | Cantidad |
|---|---:|
| Unidades editoriales (todas borrador) | 9 |
| Versiones editoriales | 18 |
| Fuentes | 2 |
| Afirmaciones | 1 |
| Evidencias | 0 |
| Verificaciones | 1 |
| Formatos guardados | 26 |
| Controles de calidad | 3 |
| Observaciones de calidad | 0 |
| Registros de auditoría | 32 |
| Eventos de trabajo/asignación | 2 |
| Eventos de revisión/aprobación | 0 |
| Eventos de distribución | 0 |
| Usuarios con rol | 1 admin |

Tipos de formato presentes: Web/SEO 8, Reel 5, Podcast 4, Carrusel 3, Newsletter 3 y WhatsApp 3. Esto prueba persistencia de borradores de los seis tipos, no que todas las unidades tengan seis formatos completos.

## Registro por módulo
| ID | Módulo | Estado | Qué existe / funciona | Qué falta |
|---|---|---|---|---|
| M00 | Shell Madre | Parcial | Arranque SPA, pantalla de configuración, login/logout, sesión y vista editorial. | Navegación real a aplicaciones, dashboard modular, estado de conexión dinámico, preferencias y pruebas responsive. |
| M01 | Madre Editorial | Parcial avanzado | CRUD; bandeja y asignaciones; fuentes, claims, evidencias y verificaciones; versionado/restauración; seis formatos editables; generación IA desplegada; control estructural; revisión/aprobación humana. | Ingesta documental completa, extracción/normalización, investigación web y contraste automatizados; evidencias reales; prueba de generación con proveedor; navegador y E2E. |
| M02 | Biblioteca Riojana | No construido | Solo existen infraestructura reutilizable (bucket privado y extensión vector). | Fichas, documentos, relaciones, tablas, interfaz, filtros, búsqueda textual/semántica y conexión a M01. |
| M03 | Editor Crítico | Backend desplegado; UI pendiente | Edge Function activa con JWT y código de análisis asistido. | No se encontró invocación desde interfaz/servicio; no hay historial integrado ni prueba real con OpenAI. El control estructural de M01 no lo reemplaza. |
| M04 | Observatorios | No construido | Sin módulo funcional identificado. | Tablas de variables/indicadores/series, fuentes de datos, territorios, paneles y conectores. |
| M05 | Transcripción | No construido | Sin función ni módulo operativo identificado. | Carga/procesamiento de audio, transcripción, edición, marcas temporales y vínculo con fuentes/unidades. |
| M06 | Distribución | Parcial: WordPress | Endpoint activo; valida JWT, rol editor/admin, revisión, aprobación, versión vigente y fuerza `draft`; historial preparado. | Cero envíos registrados; secretos y envío real no comprobados; no hay canales adicionales demostrados ni aplicación modular habilitada. |
| C01 | Núcleo compartido | Parcial | Cliente Supabase, Auth, servicio editorial, calidad, historial, notificaciones y auditoría. | Centralización completa de permisos, IA, archivos, guía de estilo, errores y persistencia para todos los módulos. |
| B01 | Backend y seguridad | Parcial avanzado | Supabase, RLS, bucket privado, vector y tres Edge Functions activas. | Pruebas negativas, secretos externos, CORS por función y endurecimiento de alertas. No se encontró `ia-proxy`, `transcribir-audio`, `process-document` ni `process-metrics` como funciones separadas. |
| D01 | Modelo de datos | Parcial | Modelo editorial sustantivo. | Entidades de Biblioteca, Observatorios, Transcripción y distribución multicanal completa. |
| UX01 | Diseño/accesibilidad | Parcial, no certificado | Shell y estilos globales. | Auditoría WCAG AA, teclado, lectores de pantalla, contraste, móvil, offline y rendimiento. |
| QA01 | Calidad/despliegue | Pendiente | Pruebas transaccionales y chequeos sintácticos documentados. | Build actual, navegador, E2E, distintos perfiles reales, accesibilidad y validación de producción. |

## Evidencia y límites
**Comprobado directamente:** Supabase activo; 26 migraciones; 17 tablas con RLS; bucket privado; vector; tres funciones Edge activas con JWT; conteos de registros; un único rol admin.

**Documentado previamente, no repetido en esta auditoría:** pruebas transaccionales con ROLLBACK para versionado, guardado/obsolescencia de formatos, calidad, revisión/aprobación y asignaciones. Son evidencia de lógica de base de datos, no sustituyen pruebas de navegador o multiusuario.

**No verificado en ejecución real:** login navegador, build Vite actual, Gemini, OpenAI, WordPress, aislamiento RLS con distintos roles, carga/recuperación de Storage, accesibilidad, móvil, rendimiento y E2E.

## Alertas prioritarias
1. Supabase informa tres funciones `SECURITY DEFINER` ejecutables por `anon` y `authenticated`: `audit_editorial_unit`, `handle_new_user`, `has_role`. Revisar permisos y dependencias antes de revocar; `has_role` participa en políticas.
2. Protección de contraseñas filtradas deshabilitada.
3. Asesor de rendimiento: nueve claves foráneas sin índice y 21 índices sin uso registrado al corte.
4. La función de generación inspeccionada usa CORS comodín; restringir orígenes explícitos antes de producción.
5. Hay nueve unidades, pero solo dos fuentes, una afirmación y cero evidencias; la trazabilidad está modelada, pero poco ejercitada.
6. Solo existe un usuario admin; no se puede certificar el circuito de colaborador/redactor/revisor/editor.
7. Los eventos de revisión y distribución están en cero: reglas implementadas, uso operativo no demostrado.

## Secuencia recomendada
1. Cerrar QA de M01: entorno, build, login, CRUD, fuentes, claims, evidencias, verificaciones, versiones y formatos con perfiles reales.
2. Probar generación Gemini de los seis formatos y validar referencias, fallback, versión y guardado.
3. Integrar M03 en la interfaz y guardar su historial sin permitir aprobación automática.
4. Probar roles/RLS y resolver alertas de seguridad.
5. Confirmar secretos y realizar envío real WordPress como draft.
6. Construir M02 Biblioteca Riojana.
7. Construir M05 Transcripción y vincularla como fuente de M01.
8. Construir M04 Observatorios.
9. Completar M06 con otros canales, siempre con autorización humana.
10. Completar Shell, UX, accesibilidad, monitoreo y E2E.

## Estado que debe figurar en el Mapa Maestro
- M00: Parcial.
- M01: Parcial avanzado; núcleo implementado, operación integral pendiente de prueba.
- M02: No construido.
- M03: Backend desplegado; integración de interfaz pendiente.
- M04: No construido.
- M05: No construido.
- M06: Parcial; WordPress implementado, integración real y otros canales pendientes.
- C01: Parcial.
- B01: Parcial avanzado, con alertas de seguridad.
- D01: Parcial.
- UX01: Parcial, no certificado.
- QA01: Pendiente de validación integral.

**Conclusión:** MADRE ya tiene una base técnica y editorial concreta. No está en cero, pero tampoco es todavía el ecosistema completo del Mapa Maestro. La prioridad es demostrar y estabilizar el circuito de Madre Editorial antes de expandir el resto de los módulos.


---

## 16. Validación complementaria de M01 — 26/27 de noviembre de 2026

Esta sección amplía el corte inicial con comprobaciones realizadas sobre el repositorio y la base Supabase. Las fechas de GitHub Actions aparecen en UTC; corresponden a la noche del 26 de noviembre en Argentina.

### 16.1 Pruebas ejecutadas y aprobadas

Se agregó el workflow `.github/workflows/validate.yml`, commit `4ca080eee74ea243982aaeb7a997b17d0cc788e3`.

Ejecución GitHub Actions: [Validate Madre — run 45918763540](https://github.com/gabrielgenri/madre/actions/runs/45918763540).

| Prueba | Resultado | Evidencia |
|---|---|---|
| Instalación de dependencias | Aprobada | Paso `Install dependencies` |
| Sintaxis de todos los archivos `.js` bajo `src` | Aprobada | `find src ... node --check` |
| Compilación de producción Vite | Aprobada | `npm run build` |
| Pruebas unitarias / integración | No disponibles | `package.json` no define script `test` ni se encontró suite de pruebas |
| Navegador / E2E | No ejecutadas | Requieren entorno de navegador y sesión real |

La ejecución previa de Pages no debe confundirse con esta validación: el workflow preexistente informa pasos de compilación Jekyll. El nuevo workflow comprueba Vite, pero no despliega su carpeta `dist`.

### 16.2 Comprobaciones adicionales en Supabase

- Las 17 tablas públicas consultadas tienen RLS habilitado.
- Ninguna de esas tablas tiene `FORCE ROW LEVEL SECURITY`.
- Se inspeccionaron políticas de unidades, versiones, fuentes, afirmaciones, evidencias, verificaciones, formatos, controles de calidad, eventos de revisión y asignaciones.
- Se verificó que los RPC principales de actualización/versionado, guardado de formatos, asignación, cambio de estado y registro de revisión se ejecutan como funciones invocadoras (`SECURITY INVOKER`), no como `SECURITY DEFINER`.
- Se verificaron disparadores de auditoría, captura de versiones, protección de publicación, protección de asignaciones, reapertura de revisión ante cambios y aplicación de aprobación.
- La función `has_role` sí es `SECURITY DEFINER` y mantiene permiso EXECUTE para `anon` y `authenticated`. Su implementación consulta el rol asociado a `auth.uid()`; para una llamada anónima sin usuario autenticado devuelve falso. Se recomienda igualmente revisar y minimizar su exposición y fijar cuidadosamente su `search_path`; no se revocó para no alterar políticas dependientes.
- El RLS inspeccionado muestra restricciones por autor/asignado y roles de revisión/edición en las operaciones principales. No se ejecutó una prueba negativa con identidades separadas.

### 16.3 Estado de datos actualizado

Conteos observados en la consulta más reciente:

| Registro | Cantidad |
|---|---:|
| Unidades editoriales | 9 |
| Versiones | 19 |
| Fuentes | 2 |
| Afirmaciones | 1 |
| Evidencias | 0 |
| Verificaciones | 1 |
| Formatos | 26 |
| Controles de calidad | 3 |
| Eventos de revisión/aprobación | 0 |
| Eventos de trabajo/asignación | 2 |

El total de versiones pasó de 18 a 19 respecto de la primera auditoría. Se conserva el dato actualizado de 19 como nuevo corte. La ausencia de evidencias y de eventos de revisión impide demostrar un ciclo editorial completo con datos de trabajo reales.

### 16.4 Revisión estática del flujo M01

Se confirmó en el código:
- La interfaz incluye creación y edición de unidades, bandeja de trabajo, asignaciones, historial, investigación, fuentes, afirmaciones, evidencias, verificaciones, versiones, seis formatos, control de calidad, revisión humana y envío WordPress.
- La restauración de una versión reutiliza el mecanismo de actualización con motivo; crea una versión nueva y conserva el historial.
- La aprobación humana se registra contra una versión y un control de calidad; un disparador actualiza el estado a `reviewed` y la base exige aprobación vigente de editor/admin.
- La generación de los seis formatos ocurre secuencialmente y los guarda uno por uno. Si falla un guardado intermedio, puede quedar un lote parcial. La interfaz informa el error y pide revisar los borradores guardados antes de reintentar; falta atomicidad de lote.
- La comparación entre formatos detecta estructura, vínculo de versión y divergencias literales de algunas cifras/fechas, pero deja expresamente la comparación semántica a revisión humana.

### 16.5 Bloqueos para declarar M01 validado integralmente

1. **Despliegue:** el flujo actual de GitHub Pages utiliza Jekyll; el nuevo workflow compila Vite, pero no publica `dist`. No se certificó la carga de la aplicación desplegada. Revisar además la configuración `base` de Vite si se mantiene un sitio de proyecto bajo `/madre/`.
2. **Autenticación real:** falta prueba de Magic Link en navegador, expiración/renovación de sesión y cierre de sesión.
3. **Roles y RLS:** hay un solo usuario admin registrado; faltan identidades de prueba para colaborador, redactor, revisor y editor y pruebas de acceso permitido/denegado.
4. **IA:** falta invocación real al proveedor Gemini con los seis formatos, validación de fallback, errores, referencias y persistencia. No se modificaron secretos.
5. **Circuito editorial:** faltan evidencias reales y eventos de solicitud, devolución y aprobación sobre contenido de prueba.
6. **WordPress:** falta prueba real de extremo a extremo; no se enviaron borradores ni se alteró contenido externo.
7. **Calidad:** falta suite unitaria/integración, E2E, accesibilidad, responsive y pruebas de recuperación de errores.

### 16.6 Higiene de repositorio

- `package.json` no define script de test y no se identificó lockfile npm. La instalación CI se realiza sin lockfile; conviene incorporar uno para builds reproducibles.
- `.env.local` aparece versionado aunque `.gitignore` lo excluye. Su contenido observado coincide con la URL y la publishable key de `.env.example`; no se observó una clave `service_role` en ese archivo. La publishable key está diseñada para uso cliente, pero el archivo local debe dejar de versionarse por higiene operativa.

### 16.7 Dictamen actualizado de M01

**M01 Madre Editorial: PARCIAL AVANZADO — compilación y sintaxis verificadas; integridad de los principales controles de base inspeccionada; operación integral todavía no certificada.**

No declarar M01 terminado ni habilitar producción plena hasta resolver el despliegue Vite, probar autenticación y permisos con roles diferenciados, ejecutar la generación IA real y completar el circuito editorial de punta a punta en datos de prueba.

No se ejecutaron escrituras de prueba en producción, no se cambiaron roles ni secretos, no se aprobó ninguna unidad y no se publicó ni envió contenido a WordPress.


## Actualización posterior — validación M01

La validación técnica de M01 realizada el 26/11/2026 (Argentina) confirmó build y despliegue, y detectó un bloqueo concreto en la integración Gemini: la cuenta de servicio vinculada a la API key está deshabilitada. También registró cobertura incompleta de los seis formatos y pruebas multirol/flujo editorial pendientes.

Informe detallado: [VALIDACION-M01-MADRE-EDITORIAL-2026-11-26.md](VALIDACION-M01-MADRE-EDITORIAL-2026-11-26.md).

**Estado M01 actualizado:** Parcial avanzado. Infraestructura, build y carga del workspace verificados; generación IA bloqueada por credenciales del proveedor; operación editorial integral aún no certificada.
