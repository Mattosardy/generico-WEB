# Cierre de alerta RLS: `socio_dispositivos_verificados`

## Estado

La alerta quedó resuelta durante la reconstrucción de T3-420 DEMO.

La migración `20260624183000_enable_rls_public_tables.sql`:

- habilita RLS en `public.socio_dispositivos_verificados`;
- bloquea el acceso anónimo;
- permite a administradores autenticados gestionar registros;
- permite a cada socio autenticado consultar únicamente sus propios dispositivos.

La migración fue aplicada en el nuevo proyecto y forma parte del historial local alineado con Supabase remoto. Ya no se requiere ejecutar SQL manual para esta alerta.

## Verificación

El Security Advisor no reportó errores bloqueantes después de aplicar la reconstrucción. Las advertencias no bloqueantes restantes se registran en `reconstruccion-t3-420-demo.md` para revisión futura.
