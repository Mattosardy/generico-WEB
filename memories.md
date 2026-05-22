# Cururu Club - Memorias del proyecto

## Contexto general
- Proyecto SPA web estática con HTML/CSS/JS y backend en Supabase.
- Contiene áreas de usuario (`inicio`, `productos`, `actividades`, `login`, `admin`, `maestro`).
- El panel `admin` utiliza un acordeón por secciones dentro de `#admin .nav-admin-bar`.
- No tocar backend, auth o deploy en esta tarea.

## Objetivo de la corrección
- Asegurar que el menú admin `Herramientas` se muestre como acordeón visual igual a `Variedades/Artículos`.
- Restaurar scroll de mouse en desktop, evitando reglas que bloqueen `overflow-y` o `overscroll-behavior`.
- Documentar el estado del proyecto sin cambiar lógica de negocio.

## Verificación realizada
- `#admin .nav-admin-bar` se renderiza como `display: grid` y usa `grid-template-columns: repeat(2, minmax(0, 1fr))`.
- Los botones `#admin .nav-admin-btn` usan `background-image` con `var(--club-skin-acordeon)`, bordes redondeados y estilos de acordeón.
- La regla global `html, body, body.authenticated, body.password-temporal-required, body.modal-open` define `overflow-y: auto !important` y `overscroll-behavior-y: auto !important` para restaurar el scroll.
- No se detectaron overlays de pantalla completa que bloqueen el scroll.

## Estado actual
- La sección admin ya tiene la estructura de acordeón en `index.html` bajo `#admin`.
- El CSS en `css/style.css` contiene los overrides necesarios para `#admin .nav-admin-bar` y `#admin .nav-admin-btn`.
- El scroll desktop se encuentra activado por las reglas finales de estilo.

## Recomendaciones futuras
- Si el admin no aparece localmente, puede deberse a la autenticación / visibilidad de secciones en `js/main.js` o `js/admin.js`, no a estilos.
- Mantener los overrides específicos de `#admin` cerca del bloque de estilo de la interfaz para evitar conflictos con `.nav-admin-bar` global.
- Seguir usando `aria-expanded` y clases `activa` / `admin-accordion-open` para conservar el comportamiento de acordeón.
