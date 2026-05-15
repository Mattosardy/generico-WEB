create or replace function public.fecha_entrega_configurada(
    p_clave text,
    p_target_date date,
    p_fallback date
)
returns date
language sql
stable
set search_path = public
as $$
    select coalesce(
        (
            select valor::date
            from public.configuracion_sistema
            where clave =
                'entrega_' ||
                to_char(date_trunc('month', p_target_date), 'YYYY_MM') ||
                case when p_clave = 'fecha_entrega_primer' then '_1_fecha' else '_2_fecha' end
              and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              and date_trunc('month', valor::date) = date_trunc('month', p_target_date)
            limit 1
        ),
        (
            select valor::date
            from public.configuracion_sistema
            where clave = p_clave
              and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              and date_trunc('month', valor::date) = date_trunc('month', p_target_date)
            limit 1
        ),
        p_fallback
    );
$$;

create or replace function public.configuracion_entero(
    p_clave text,
    p_default integer
)
returns integer
language sql
stable
set search_path = public
as $$
    select coalesce(
        (
            select valor::integer
            from public.configuracion_sistema
            where clave = p_clave
              and valor ~ '^[0-9]+$'
            limit 1
        ),
        p_default
    );
$$;

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
    limite_reserva timestamptz;
    fecha_aviso_reserva date;
    fecha_aviso_entrega date;
begin
    for entrega in
        with meses as (
            select date_trunc('month', target_date)::date as mes
            union
            select date_trunc('month', target_date + interval '1 month')::date as mes
        )
        select
            'primer'::text as clave,
            'Primera entrega'::text as etiqueta,
            'recordatorio_primer_jueves'::text as tipo_reserva,
            'recordatorio_entrega_primer'::text as tipo_entrega,
            public.fecha_entrega_configurada('fecha_entrega_primer', mes, public.primer_jueves_del_mes(mes)) as fecha_entrega,
            interval '48 hours' as plazo_reserva
        from meses
        union all
        select
            'ultimo'::text as clave,
            'Ultima entrega'::text as etiqueta,
            'recordatorio_ultimo_jueves'::text as tipo_reserva,
            'recordatorio_entrega_ultimo'::text as tipo_entrega,
            public.fecha_entrega_configurada('fecha_entrega_ultimo', mes, public.ultimo_jueves_del_mes(mes)) as fecha_entrega,
            interval '48 hours' as plazo_reserva
        from meses
    loop
        limite_reserva := ((entrega.fecha_entrega::timestamp - entrega.plazo_reserva) at time zone 'America/Montevideo');
        fecha_aviso_reserva := (limite_reserva at time zone 'America/Montevideo')::date;
        fecha_aviso_entrega := (entrega.fecha_entrega - interval '1 day')::date;

        if target_date = fecha_aviso_reserva then
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
                'Cururu Club' || chr(10) ||
                'Tenes hasta 48 horas antes de la fecha de entrega para realizar tu reserva.' || chr(10) ||
                'Retiro: ' || lower(entrega.etiqueta) || ', ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || chr(10) ||
                'Tenes tiempo hasta ' || to_char(limite_reserva at time zone 'America/Montevideo', 'DD/MM/YYYY HH24:MI') || ' para confirmar tu retiro.',
                timezone('utc'::text, now()),
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'deadline_at', limite_reserva,
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
                    and np.metadata ->> 'delivery_date' = entrega.fecha_entrega::text
              );

            get diagnostics inserted_count = row_count;
            scheduled_count := scheduled_count + inserted_count;
        end if;

        if target_date = fecha_aviso_entrega then
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
                'Cururu Club' || chr(10) ||
                coalesce(nullif(trim(cfg.valor), ''), nullif(trim(cfg_legacy.valor), ''), 'Recordatorio de entrega.') || chr(10) ||
                'Tu retiro esta coordinado para ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || chr(10) ||
                'Cantidad: ' || coalesce(r.cantidad_gramos::text, '-') || 'g' ||
                case when nullif(trim(coalesce(r.producto_nombre, '')), '') is not null
                    then chr(10) || 'Variedad: ' || r.producto_nombre
                    else ''
                end,
                timezone('utc'::text, now()),
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'reserva_id', r.id,
                    'template_key', entrega.tipo_entrega
                )
            from public.reservas_mensuales r
            join public.socios s on s.id = r.socio_id
            left join public.configuracion_sistema cfg
              on cfg.clave =
                'entrega_' ||
                to_char(date_trunc('month', entrega.fecha_entrega), 'YYYY_MM') ||
                case when entrega.clave = 'primer' then '_1_mensaje' else '_2_mensaje' end
            left join public.configuracion_sistema cfg_legacy
              on cfg_legacy.clave = case
                  when entrega.clave = 'primer' then 'mensaje_entrega_primer'
                  else 'mensaje_entrega_ultimo'
              end
            where r.fecha_retiro::date = entrega.fecha_entrega
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

grant execute on function public.fecha_entrega_configurada(text, date, date) to anon, authenticated;
grant execute on function public.configuracion_entero(text, integer) to anon, authenticated;
grant execute on function public.queue_monthly_telegram_reservation_reminders(date) to anon, authenticated;

comment on function public.fecha_entrega_configurada(text, date, date) is
'Devuelve una fecha de entrega configurada para el mes objetivo o una fecha calculada por defecto.';

comment on function public.queue_monthly_telegram_reservation_reminders(date) is
'Genera avisos Telegram automaticos segun las dos fechas mensuales de entrega configuradas por el admin.';
