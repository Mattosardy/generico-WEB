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
    ultimo_jueves date := public.ultimo_jueves_del_mes(target_date);
    primer_jueves date := public.primer_jueves_del_mes(target_date);
    fecha_recordatorio_ultimo date := (public.ultimo_jueves_del_mes(target_date) - interval '7 days')::date;
    fecha_recordatorio_primer date := (public.primer_jueves_del_mes(target_date) - interval '2 days')::date;
    limite_ultimo timestamptz := ((ultimo_jueves::timestamp - interval '72 hours') at time zone 'America/Montevideo');
    limite_primer timestamptz := ((primer_jueves::timestamp - interval '48 hours') at time zone 'America/Montevideo');
begin
    if target_date = fecha_recordatorio_ultimo then
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
            'recordatorio_ultimo_jueves',
            'Cururu Club' || chr(10) ||
            'Recordatorio de reserva.' || chr(10) ||
            'Retiro: ultimo jueves, ' || to_char(ultimo_jueves, 'DD/MM/YYYY') || chr(10) ||
            'Tenes tiempo hasta ' || to_char(limite_ultimo at time zone 'America/Montevideo', 'DD/MM/YYYY HH24:MI') || ' para confirmar tu retiro.',
            timezone('utc'::text, now()),
            'pendiente',
            'telegram',
            'telegram',
            jsonb_build_object(
                'target_month', to_char(target_date, 'YYYY-MM'),
                'delivery_date', ultimo_jueves,
                'deadline_at', limite_ultimo,
                'template_key', 'recordatorio_ultimo_jueves'
            )
        from public.socios s
        where s.estado = 'activo'
          and s.telegram_enabled is true
          and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
          and not exists (
              select 1
              from public.notificaciones_programadas np
              where np.socio_id = s.id
                and np.tipo = 'recordatorio_ultimo_jueves'
                and np.canal = 'telegram'
                and np.metadata ->> 'target_month' = to_char(target_date, 'YYYY-MM')
          );

        get diagnostics inserted_count = row_count;
        scheduled_count := scheduled_count + inserted_count;
    end if;

    if target_date = fecha_recordatorio_primer then
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
            'recordatorio_primer_jueves',
            'Cururu Club' || chr(10) ||
            'Recordatorio de reserva.' || chr(10) ||
            'Retiro: primer jueves, ' || to_char(primer_jueves, 'DD/MM/YYYY') || chr(10) ||
            'Tenes tiempo hasta ' || to_char(limite_primer at time zone 'America/Montevideo', 'DD/MM/YYYY HH24:MI') || ' para confirmar tu retiro.',
            timezone('utc'::text, now()),
            'pendiente',
            'telegram',
            'telegram',
            jsonb_build_object(
                'target_month', to_char(target_date, 'YYYY-MM'),
                'delivery_date', primer_jueves,
                'deadline_at', limite_primer,
                'template_key', 'recordatorio_primer_jueves'
            )
        from public.socios s
        where s.estado = 'activo'
          and s.telegram_enabled is true
          and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
          and not exists (
              select 1
              from public.notificaciones_programadas np
              where np.socio_id = s.id
                and np.tipo = 'recordatorio_primer_jueves'
                and np.canal = 'telegram'
                and np.metadata ->> 'target_month' = to_char(target_date, 'YYYY-MM')
          );

        get diagnostics inserted_count = row_count;
        scheduled_count := scheduled_count + inserted_count;
    end if;

    return scheduled_count;
end;
$$;

grant execute on function public.queue_monthly_telegram_reservation_reminders(date) to anon, authenticated;

comment on function public.queue_monthly_telegram_reservation_reminders(date) is
'Genera recordatorios Telegram para socios activos con Telegram vinculado, sin duplicar por mes.';
