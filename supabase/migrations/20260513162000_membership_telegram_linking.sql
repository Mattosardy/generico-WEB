alter table if exists public.solicitudes_membresia
    add column if not exists telegram_chat_id text,
    add column if not exists telegram_username text,
    add column if not exists telegram_enabled boolean not null default false,
    add column if not exists telegram_link_code text,
    add column if not exists telegram_link_code_expires_at timestamptz,
    add column if not exists telegram_linked_at timestamptz;

create unique index if not exists idx_solicitudes_telegram_link_code_unique
    on public.solicitudes_membresia (telegram_link_code)
    where telegram_link_code is not null;

create or replace function public.set_telegram_link_code(
    p_socio_id uuid,
    p_code text,
    p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesion para vincular Telegram.';
    end if;

    update public.socios
    set
        telegram_link_code = p_code,
        telegram_link_code_expires_at = p_expires_at
    where id = p_socio_id
      and (
        auth_user_id = auth.uid()
        or lower(email) = lower(auth.jwt() ->> 'email')
      );

    if not found then
        raise exception 'No se encontro un socio vinculado al usuario actual.';
    end if;
end;
$$;

create or replace function public.create_membership_request_with_telegram(
    p_nombre text,
    p_apellido text,
    p_cedula text,
    p_telefono text,
    p_email text,
    p_mensaje text,
    p_code text,
    p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    solicitud_id uuid;
begin
    if nullif(trim(coalesce(p_nombre, '')), '') is null then
        raise exception 'El nombre es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_apellido, '')), '') is null then
        raise exception 'El apellido es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_cedula, '')), '') is null then
        raise exception 'La cedula es obligatoria.';
    end if;
    if nullif(trim(coalesce(p_telefono, '')), '') is null then
        raise exception 'El telefono es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_code, '')), '') is null or p_expires_at <= timezone('utc'::text, now()) then
        raise exception 'Codigo de Telegram invalido.';
    end if;

    insert into public.solicitudes_membresia (
        nombre,
        apellido,
        cedula,
        telefono,
        email,
        mensaje,
        estado,
        telegram_link_code,
        telegram_link_code_expires_at
    )
    values (
        trim(p_nombre),
        trim(p_apellido),
        trim(p_cedula),
        trim(p_telefono),
        nullif(trim(coalesce(p_email, '')), ''),
        nullif(trim(coalesce(p_mensaje, '')), ''),
        'pendiente',
        p_code,
        p_expires_at
    )
    returning id into solicitud_id;

    return jsonb_build_object('id', solicitud_id, 'code', p_code, 'expires_at', p_expires_at);
end;
$$;

grant execute on function public.create_membership_request_with_telegram(text, text, text, text, text, text, text, timestamptz) to anon, authenticated;
