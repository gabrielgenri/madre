# Estado de implementación — núcleo inicial

## Implementado en el repositorio

- Base SPA con Vite y JavaScript ES Modules.
- Cliente Supabase configurado mediante variables de entorno.
- Autenticación por enlace mágico.
- Servicio de datos para crear, listar, consultar y editar unidades editoriales.
- Vista inicial de Madre Editorial.
- Servicio compartido con reglas editoriales operativas.
- Documentación técnica y criterios editoriales iniciales.
- Migración complementaria de seguridad para impedir que un usuario sin rol editor/admin publique una unidad editorial.

## Verificado

- `node --check` sobre los archivos JavaScript del starter original y los archivos modificados.
- El proyecto Supabase `cxuoaydhmvafsgtklwny` está activo y saludable.
- La migración remota fundacional figura en el historial Supabase con versión `20261114034956` y nombre `madre_core_foundation`.
- El esquema remoto contiene diez tablas públicas con RLS habilitado, incluyendo `profiles`, `user_roles`, `editorial_units`, fuentes, afirmaciones, evidencias, verificaciones, formatos y auditoría.
- Las políticas RLS fueron inspeccionadas para `editorial_units` y sus entidades relacionadas.
- Se incorporó y aplicó el guard de publicación `editorial_units_guard_publish`: la transición a `published` requiere rol `editor` o `admin`.
- El proyecto mantiene extensiones `vector`, `pgcrypto` y `uuid-ossp` disponibles.

## Investigación editorial incorporada

- La vista de una unidad permite abrir un espacio de investigación.
- Alta y consulta de fuentes con tipo, URL, autor/organismo, editor, extracto y notas.
- Alta y consulta de afirmaciones con tipo, importancia y contexto.
- Registro de evidencias relacionadas con una afirmación y/o fuente, con localizador y relación (apoya, contradice, contextualiza).
- Consulta del historial de verificaciones y formulario para registrar una revisión humana. La base de datos limita la inserción a roles reviewer/editor/admin; los permisos se validan en RLS.
- La verificación se conserva como historial en `verifications`; la interfaz muestra la última revisión sin sobrescribir directamente el campo de estado de la afirmación, evitando exigir permisos de edición de claims a un revisor.

## Pendiente de verificación

- Instalación de dependencias y `vite build`: el intento anterior de `npm install` no terminó dentro del tiempo disponible; no se declara compilación exitosa.
- Conexión del navegador al proyecto: falta configurar localmente la publishable key.
- Flujo real de autenticación y CRUD con un usuario.
- Pruebas en navegador del flujo fuentes → afirmaciones → evidencias → verificación, incluyendo rechazo de usuarios sin rol de revisor.
- Pruebas de permisos y aislamiento RLS desde un cliente autenticado real.
- Prueba integral de extremo a extremo.
- Incorporación futura de la migración fundacional completa como fuente reproducible del esquema; el archivo remoto `madre_core_foundation` no se puede recuperar byte a byte desde el historial de migraciones mediante las herramientas disponibles.

## Seguridad pendiente

El asesor de Supabase detecta funciones `SECURITY DEFINER` expuestas en el esquema `public` (`audit_editorial_unit`, `handle_new_user`, `has_role`). No se modifica ese diseño automáticamente porque `has_role` participa en las políticas RLS y las otras funciones se utilizan como infraestructura de triggers; queda como tarea explícita de endurecimiento, con pruebas posteriores.

## Decisiones

- El repositorio ya contenía el Prompt Maestro en `README.md` y el registro `supabase.md`; ambos se preservan.
- No se habilita el estado Revisado desde la interfaz inicial: todavía no existen checklist, fuentes y evidencias operativas completas en la UI.
- No se incluye ninguna clave secreta en el repositorio.


## PASO 14 — Versionado editorial y control de cambios

- Se reutiliza la tabla existente `editorial_versions`; no se crea una estructura paralela.
- Un trigger de base de datos registra una instantánea al crear una unidad y ante cambios en título, slug, resumen, contenido madre, estado o metadatos.
- Se incorporó el RPC `update_editorial_unit_with_version`, que actualiza los campos editables permitidos y adjunta el motivo del cambio en la misma transacción.
- La interfaz solicita el motivo de cada modificación y muestra el historial ordenado por número de versión.
- Restaurar una versión recupera título, resumen y contenido madre mediante el mismo flujo de actualización; nunca sobrescribe ni elimina versiones anteriores y genera una nueva entrada.
- Las versiones no admiten UPDATE ni DELETE: un trigger bloquea ambas operaciones, incluso cuando el borrado se intenta por cascada desde la unidad. No hay políticas RLS de modificación sobre el historial.
- Se incorporaron versiones iniciales para las unidades que ya existían al activar el mecanismo.

### Verificación de base de datos

- La migración `editorial_version_history_and_restore` fue aplicada.
- Se comprobó la existencia del RPC, la función de captura y el trigger.
- La consulta de control confirmó dos versiones iniciales y cero unidades sin versión al momento de la comprobación.

### Pendiente de verificación funcional

- Probar una edición autenticada y comprobar el incremento del número de versión.
- Verificar rechazo de usuarios sin permiso de edición mediante RLS.
- Probar restauración desde navegador y confirmar que crea una versión nueva.
- Ejecutar `node --check`, `vite build` y pruebas de extremo a extremo. No se declara compilación ni prueba de navegador como exitosas.


## PASO 15 — Producción y trazabilidad de los seis formatos

Se utiliza la tabla existente `editorial_formats` y se respetan sus seis tipos permitidos: `web_seo`, `video_reel_60`, `podcast_primera_hora`, `instagram_carousel_8`, `newsletter` y `whatsapp`.

- Se incorporó un espacio de trabajo para consultar y editar un borrador por cada formato de una unidad editorial.
- Cada guardado utiliza la RPC `save_editorial_format`, que obtiene la última versión madre vigente y registra su ID en `source_version_id`.
- Guardar una pieza la deja en estado `draft`; no se aprueba ni publica automáticamente.
- Un trigger sobre `editorial_versions` marca como `is_stale = true` los formatos vinculados a versiones anteriores cuando se registra una nueva versión madre.
- Al editar y guardar nuevamente una pieza, se vincula a la versión madre vigente y se limpia la marca de desactualización.
- El guardado se ejecuta con `SECURITY INVOKER`, por lo que conserva la aplicación de RLS existente. La RPC valida autenticación, formato permitido, título y longitud máxima del contenido.

### Límite funcional explícito

Esta entrega implementa persistencia, edición y trazabilidad de borradores para los seis formatos. No integra todavía un proveedor de IA ni genera automáticamente textos terminados. El contenido debe ser redactado y revisado por personas; la automatización de generación asistida será una etapa posterior, sin alterar la regla de aprobación humana.

### Verificación pendiente

- Probar alta y edición de cada uno de los seis formatos con sesión autenticada.
- Confirmar que una nueva versión madre marca los seis formatos anteriores como desactualizados.
- Confirmar que volver a guardar un formato lo vincula a la versión más reciente.
- Probar permisos RLS con perfiles autor, editor y administrador.
- Ejecutar `node --check`, `vite build` y pruebas de navegador. No se declaran como realizadas en este paso.
