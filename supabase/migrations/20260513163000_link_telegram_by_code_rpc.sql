create or replace function public.link_telegram_by_code(
    p_code text,
    p_chat_id text,
    p_username text default null,
    p_first_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    target_socio_id uuid;
    target_solicitud_id uuid;
begin
    if nullif(trim(coalesce(p_code, '')), '') is null then
        return jsonb_build_object('linked', false, 'reason', 'invalid_code');
    end if;

    if nullif(trim(coalesce(p_chat_id, '')), '') is null then
        return jsonb_build_object('linked', false, 'reason', 'missing_chat_id');
    end if;

    if exists (
        select 1
        from public.socios
        where telegram_chat_id = p_chat_id
          and telegram_enabled is true
    ) then
        return jsonb_build_object('linked', false, 'reason', 'chat_already_linked');
    end if;

    select id
      into target_socio_id
    from public.socios
    where telegram_link_code = p_code
      and telegram_link_code_expires_at > timezone('utc'::text, now())
    limit 1;

    if target_socio_id is not null then
        update public.socios
        set
            telegram_chat_id = p_chat_id,
            telegram_username = nullif(trim(coalesce(p_username, '')), ''),
            telegram_enabled = true,
            telegram_linked_at = timezone('utc'::text, now()),
            telegram_link_code = null,
            telegram_link_code_expires_at = null
        where id = target_socio_id;

        return jsonb_build_object('linked', true, 'target', 'socio', 'id', target_socio_id);
    end if;

    select id
      into target_solicitud_id
    from public.solicitudes_membresia
    where telegram_link_code = p_code
      and telegram_link_code_expires_at > timezone('utc'::text, now())
    limit 1;

    if target_solicitud_id is not null then
        update public.solicitudes_membresia
        set
            telegram_chat_id = p_chat_id,
            telegram_username = nullif(trim(coalesce(p_username, '')), ''),
            telegram_enabled = true,
            telegram_linked_at = timezone('utc'::text, now()),
            telegram_link_code = null,
            telegram_link_code_expires_at = null
        where id = target_solicitud_id;

        return jsonb_build_object('linked', true, 'target', 'solicitud', 'id', target_solicitud_id);
    end if;

    return jsonb_build_object('linked', false, 'reason', 'invalid_or_expired_code');
end;
$$;

grant execute on function public.link_telegram_by_code(text, text, text, text) to anon, authenticated;
