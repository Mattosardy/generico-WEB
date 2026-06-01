create or replace function public.queue_monthly_telegram_reservation_reminders(
    target_date date default ((timezone('America/Montevideo'::text, now()))::date)
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    scheduled_count integer := 0;
    inserted_count integer := 0;
    entrega record;
begin
    for entrega in
        with meses as (
            select
                date_trunc('month', target_date)::date as mes,
                to_char(date_trunc('month', target_date), 'YYYY_MM') as mes_clave
            union
            select
                date_trunc('month', target_date + interval '1 month')::date as mes,
                to_char(date_trunc('month', target_date + interval '1 month'), 'YYYY_MM') as mes_clave
        ),
        slots as (
            select
                1::integer as indice,
                'primer'::text as clave,
                'Primera entrega'::text as etiqueta,
                'recordatorio_primer_jueves'::text as tipo_reserva,
                'recordatorio_entrega_primer'::text as tipo_entrega,
                'primer_jueves'::text as tipo_reserva_db
            union all
            select
                2::integer,
                'ultimo'::text,
                'Ultima entrega'::text,
                'recordatorio_ultimo_jueves'::text,
                'recordatorio_entrega_ultimo'::text,
                'ultimo_jueves'::text
        ),
        configuradas as (
            select
                s.indice,
                s.clave,
                s.etiqueta,
                s.tipo_reserva,
                s.tipo_entrega,
                s.tipo_reserva_db,
                f.valor::date as fecha_entrega,
                case
                    when h.valor ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then h.valor::time
                    else time '18:00'
                end as hora_entrega,
                coalesce(nullif(trim(m.valor), ''), '') as mensaje,
                coalesce(nullif(trim(l.valor), ''), nullif(trim(ld.valor), ''), 'Lugar de Siempre') as lugar
            from meses me
            cross join slots s
            join public.configuracion_sistema f
              on f.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_fecha'
             and f.valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
             and date_trunc('month', f.valor::date) = me.mes
            left join public.configuracion_sistema h
              on h.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_hora'
            left join public.configuracion_sistema m
              on m.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_mensaje'
            left join public.configuracion_sistema l
              on l.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_lugar'
            left join public.configuracion_sistema ld
              on ld.clave = 'lugar_entrega'
        )
        select
            *,
            (fecha_entrega + hora_entrega) as entrega_local_at,
            ((fecha_entrega + hora_entrega) at time zone 'America/Montevideo') as entrega_at,
            (fecha_entrega + hora_entrega - interval '48 hours') as aviso_reserva_local_at,
            ((fecha_entrega + hora_entrega - interval '48 hours') at time zone 'America/Montevideo') as aviso_reserva_at,
            (fecha_entrega + hora_entrega - interval '24 hours') as aviso_entrega_local_at,
            ((fecha_entrega + hora_entrega - interval '24 hours') at time zone 'America/Montevideo') as aviso_entrega_at
        from configuradas
    loop
        if now() >= entrega.aviso_reserva_at and now() < entrega.entrega_at then
            insert into public.notificaciones_programadas (
                socio_id,
                tipo,
                mensaje,
                fecha_programada,
                estado,
                canal,
                provider,
                metadata
            )
            select
                s.id,
                entrega.tipo_reserva,
                'Nombre del Club' || chr(10) ||
                'Tenes hasta 48 horas antes de la fecha de entrega para realizar tu reserva.' || chr(10) ||
                'Retiro: ' || lower(entrega.etiqueta) || ', ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || ' de ' ||
                to_char(entrega.hora_entrega, 'HH24:MI') || ' a ' ||
                to_char(entrega.hora_entrega + interval '120 minutes', 'HH24:MI') || chr(10) ||
                'Lugar: ' || entrega.lugar || chr(10) ||
                'Tenes tiempo hasta ' || to_char(entrega.aviso_reserva_local_at, 'DD/MM/YYYY HH24:MI') || ' para confirmar tu retiro.',
                entrega.aviso_reserva_at,
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'delivery_time', to_char(entrega.hora_entrega, 'HH24:MI'),
                    'deadline_at', entrega.aviso_reserva_at,
                    'template_key', entrega.tipo_reserva
                )
            from public.socios s
            where s.estado = 'activo'
              and s.telegram_enabled is true
              and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
              and not exists (
                  select 1
                  from public.notificaciones_programadas np
                  where np.socio_id = s.id
                    and np.tipo = entrega.tipo_reserva
                    and np.canal = 'telegram'
                    and np.metadata ->> 'delivery_slot' = entrega.clave
                    and np.metadata ->> 'delivery_date' = entrega.fecha_entrega::text
              );

            get diagnostics inserted_count = row_count;
            scheduled_count := scheduled_count + inserted_count;
        end if;

        if now() >= entrega.aviso_entrega_at and now() < entrega.entrega_at then
            insert into public.notificaciones_programadas (
                socio_id,
                tipo,
                mensaje,
                fecha_programada,
                estado,
                canal,
                provider,
                metadata
            )
            select
                r.socio_id,
                entrega.tipo_entrega,
                'Nombre del Club' || chr(10) ||
                coalesce(nullif(trim(entrega.mensaje), ''), 'Recordatorio de entrega.') || chr(10) ||
                'Tu retiro esta coordinado para ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || ' de ' ||
                to_char(entrega.hora_entrega, 'HH24:MI') || ' a ' ||
                to_char(entrega.hora_entrega + interval '120 minutes', 'HH24:MI') || chr(10) ||
                'Lugar: ' || entrega.lugar || chr(10) ||
                'Cantidad: ' || coalesce(r.cantidad_gramos::text, '-') || 'g' ||
                case when nullif(trim(coalesce(r.producto_nombre, '')), '') is not null
                    then chr(10) || 'Variedad: ' || r.producto_nombre
                    else ''
                end,
                entrega.aviso_entrega_at,
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'delivery_time', to_char(entrega.hora_entrega, 'HH24:MI'),
                    'reserva_id', r.id,
                    'template_key', entrega.tipo_entrega
                )
            from public.reservas_mensuales r
            join public.socios s on s.id = r.socio_id
            where r.fecha_retiro::date = entrega.fecha_entrega
              and (nullif(trim(coalesce(r.tipo_entrega, '')), '') is null or r.tipo_entrega = entrega.tipo_reserva_db)
              and coalesce(r.estado, 'pendiente') not in ('cancelado', 'entregado', 'retirado')
              and s.estado = 'activo'
              and s.telegram_enabled is true
              and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
              and not exists (
                  select 1
                  from public.notificaciones_programadas np
                  where np.socio_id = r.socio_id
                    and np.tipo = entrega.tipo_entrega
                    and np.canal = 'telegram'
                    and np.metadata ->> 'reserva_id' = r.id::text
              );

            get diagnostics inserted_count = row_count;
            scheduled_count := scheduled_count + inserted_count;
        end if;
    end loop;

    return scheduled_count;
end;
$$;

grant execute on function public.queue_monthly_telegram_reservation_reminders(date) to anon, authenticated;

comment on function public.queue_monthly_telegram_reservation_reminders(date) is
'Genera avisos Telegram automaticos solo para fechas de entrega configuradas por el admin y usando la hora visible para el limite de 48 horas.';
