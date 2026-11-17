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
