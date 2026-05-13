create or replace function public.queue_telegram_notification(
    p_socio_id uuid,
    p_tipo text,
    p_mensaje text,
    p_fecha_programada timestamptz default timezone('utc'::text, now()),
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    caller_socio public.socios%rowtype;
    notification_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesion para enviar notificaciones.';
    end if;

    select *
      into caller_socio
    from public.socios
    where auth_user_id = auth.uid()
       or lower(email) = lower(auth.jwt() ->> 'email')
    limit 1;

    if caller_socio.id is null then
        raise exception 'No se encontro el socio del usuario actual.';
    end if;

    if caller_socio.id <> p_socio_id and coalesce(caller_socio.rol, 'socio') not in ('admin', 'maestro') then
        raise exception 'No tiene permisos para enviar esta notificacion.';
    end if;

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
    values (
        p_socio_id,
        coalesce(nullif(p_tipo, ''), 'manual'),
        p_mensaje,
        coalesce(p_fecha_programada, timezone('utc'::text, now())),
        'pendiente',
        'telegram',
        'telegram',
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into notification_id;

    return notification_id;
end;
$$;

grant execute on function public.queue_telegram_notification(uuid, text, text, timestamptz, jsonb) to authenticated;

comment on function public.queue_telegram_notification(uuid, text, text, timestamptz, jsonb) is
'Encola una notificacion Telegram respetando permisos: socio propio, admin o maestro.';
