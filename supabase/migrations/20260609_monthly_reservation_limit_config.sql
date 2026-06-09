insert into public.configuracion_sistema (clave, valor)
values ('cupo_mensual_gramos', '40')
on conflict (clave) do nothing;
