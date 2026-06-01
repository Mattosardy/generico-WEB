# generico_WEB

Plantilla base para clonar paginas de clubes.

## Objetivo
- Mantener la estructura de frontend, Supabase y Workers lista para reutilizar.
- Usar placeholders neutros hasta que cada club cargue su identidad y datos propios.
- Evitar datos reales, secretos o contenido institucional de proyectos anteriores.

## Stack
- Vite
- Vanilla JS
- Supabase
- Cloudflare Workers

## Datos
La plantilla no incluye socios, variedades, articulos, novedades, publicaciones ni multimedia real. Para una nueva instalacion, cargar solo datos propios del club destino desde el panel o desde seeds especificos del nuevo proyecto.

## Supabase
La estructura limpia vive en `generico_schema_migration.sql`. Las credenciales secretas, como `service_role`, no deben guardarse en el repositorio.