insert into public.configuracion_sistema (clave, valor)
values
  ('portada_activa', 'true'),
  ('portada_titulo', 'Club privado para socios'),
  ('portada_subtitulo', 'Pedidos mensuales, entregas claras y novedades en un solo lugar.'),
  ('portada_descripcion', 'Cururu Club centraliza el catálogo, el cupo mensual, las fechas de retiro, las novedades y la comunicación interna para que cada socio tenga una experiencia simple, ordenada y segura.')
on conflict (clave) do nothing;
