alter table public.reservas_mensuales
    drop column if exists plus_items;

delete from public.notificaciones_programadas
where metadata ? 'reserva_id';

delete from public.reservas_mensuales;
