create or replace function public.claim_pending_telegram_notifications(p_limit integer default 50)
returns table(
    notification_id uuid,
    socio_id uuid,
    chat_id text,
    message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with pending as (
        select
            np.id,
            np.socio_id,
            s.telegram_chat_id,
            np.mensaje
        from public.notificaciones_programadas np
        join public.socios s on s.id = np.socio_id
        where np.estado = 'pendiente'
          and np.canal = 'telegram'
          and np.fecha_programada <= timezone('utc'::text, now())
          and s.telegram_enabled is true
          and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
        order by np.fecha_programada asc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        for update skip locked
    ),
    updated as (
        update public.notificaciones_programadas np
        set
            estado = 'procesando',
            provider = 'telegram',
            error_detalle = null,
            updated_at = timezone('utc'::text, now())
        from pending p
        where np.id = p.id
        returning np.id, np.socio_id, p.telegram_chat_id, np.mensaje
    )
    select
        u.id,
        u.socio_id,
        u.telegram_chat_id,
        u.mensaje
    from updated u;
end;
$$;

create or replace function public.mark_telegram_notification_sent(
    p_notification_id uuid,
    p_provider_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.notificaciones_programadas
    set
        estado = 'enviado',
        provider = 'telegram',
        provider_message_sid = p_provider_message_id,
        fecha_envio = timezone('utc'::text, now()),
        error_detalle = null,
        updated_at = timezone('utc'::text, now())
    where id = p_notification_id;
end;
$$;

create or replace function public.mark_telegram_notification_error(
    p_notification_id uuid,
    p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.notificaciones_programadas
    set
        estado = 'error',
        provider = 'telegram',
        error_detalle = left(coalesce(p_error, 'Error desconocido'), 500),
        updated_at = timezone('utc'::text, now())
    where id = p_notification_id;
end;
$$;

grant execute on function public.claim_pending_telegram_notifications(integer) to anon, authenticated;
grant execute on function public.mark_telegram_notification_sent(uuid, text) to anon, authenticated;
grant execute on function public.mark_telegram_notification_error(uuid, text) to anon, authenticated;
