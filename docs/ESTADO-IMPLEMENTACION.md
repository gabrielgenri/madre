# Estado de implementación — primer incremento

## Implementado en el repositorio

- Base SPA con Vite y JavaScript ES Modules.
- Cliente Supabase configurado mediante variables de entorno.
- Autenticación por enlace mágico.
- Servicio de datos para crear, listar, consultar y editar unidades editoriales.
- Vista inicial de Madre Editorial.
- Servicio compartido con reglas editoriales operativas.
- Documentación técnica y criterios editoriales iniciales. La migración SQL reconstruida permanece pendiente de incorporación al repositorio.

## Verificado

- `node --check` sobre los archivos JavaScript del starter original y los archivos modificados.
- La migración remota figura en el historial Supabase con versión `20261114034956` y nombre `madre_core_foundation`. El SQL local es una reconstrucción del esquema observado, no una copia byte a byte del original; todavía no está incorporado al repositorio.
- Se consultó el esquema remoto: diez tablas públicas, políticas RLS, funciones y triggers, y bucket privado `madre-originals`.

## Pendiente de verificación

- Instalación de dependencias y `vite build`: el intento de `npm install` no terminó dentro del tiempo disponible; no se declara compilación exitosa.
- Conexión del navegador al proyecto: falta configurar localmente la publishable key.
- Flujo real de autenticación y CRUD con un usuario.
- Pruebas de permisos y aislamiento RLS.
- Prueba integral de extremo a extremo.

## Decisiones

- El repositorio ya contenía el Prompt Maestro en `README.md` y el registro `supabase.md`; ambos se preservan.
- No se habilita el estado Revisado desde la interfaz inicial: todavía no existen checklist, fuentes y evidencias operativas.
- No se incluye ninguna clave secreta en el repositorio.
