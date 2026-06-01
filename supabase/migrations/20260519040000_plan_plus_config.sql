-- Plan Plus is a commercial feature flag controlled by the provider deploy
-- through window.GENERICO_PLAN in js/config.js. The club database may only
-- provide optional display text; it must not activate commercial modules.
insert into public.configuracion_sistema (clave, valor)
values
    ('plan_plus_titulo', 'Artículos destacados')
on conflict (clave) do nothing;
