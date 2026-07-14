create extension if not exists pgcrypto;

alter table if exists public.socios
    add column if not exists auth_user_id uuid unique,
    add column if not exists debe_cambiar_password boolean not null default false,
    add column if not exists password_temporal boolean not null default false,
    add column if not exists password_changed_at timestamptz,
    add column if not exists telegram_chat_id text,
    add column if not exists telegram_username text,
    add column if not exists telegram_enabled boolean not null default false,
    add column if not exists telegram_linked_at timestamptz,
    add column if not exists telegram_link_code text,
    add column if not exists telegram_link_code_expires_at timestamptz,
    add column if not exists telegram_login_code text,
    add column if not exists telegram_login_code_expires_at timestamptz,
    add column if not exists telegram_login_verified boolean not null default false,
    add column if not exists telegram_login_verified_at timestamptz,
    add column if not exists telegram_require_device_verification boolean not null default true;

alter table if exists public.solicitudes_membresia
    add column if not exists telegram_chat_id text,
    add column if not exists telegram_username text,
    add column if not exists telegram_enabled boolean not null default false,
    add column if not exists telegram_linked_at timestamptz,
    add column if not exists telegram_link_code text,
    add column if not exists telegram_link_code_expires_at timestamptz;

alter table if exists public.notificaciones_programadas
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists provider text,
    add column if not exists error_detalle text;

create table if not exists public.socio_dispositivos_verificados (
    id uuid primary key default gen_random_uuid(),
    socio_id uuid not null references public.socios(id) on delete cascade,
    device_id text not null,
    device_name text,
    verified_at timestamptz not null default timezone('utc'::text, now()),
    last_used_at timestamptz not null default timezone('utc'::text, now()),
    unique (socio_id, device_id)
);

create index if not exists idx_socios_auth_user_id on public.socios(auth_user_id);
create index if not exists idx_socios_telefono_login on public.socios(telefono);
create index if not exists idx_socios_telegram_link_code on public.socios(telegram_link_code);
create index if not exists idx_solicitudes_telegram_link_code on public.solicitudes_membresia(telegram_link_code);

drop function if exists public.is_current_device_telegram_verified(text);
drop function if exists public.request_telegram_login_code(text, text);
drop function if exists public.verify_telegram_login_code(text, text, text);
drop function if exists public.create_membership_request_with_telegram(text, text, text, text, text, text, text, timestamptz);
drop function if exists public.set_telegram_link_code(uuid, text, timestamptz);
drop function if exists public.queue_telegram_notification(uuid, text, text, timestamptz, jsonb);
drop function if exists public.mark_password_changed();

create or replace function public.normalize_phone_uy(value text)
returns text
language sql
immutable
as $$
    with cleaned as (
        select regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g') as phone
    ),
    digits as (
        select regexp_replace(phone, '[^0-9]', '', 'g') as value, phone
        from cleaned
    )
    select case
        when phone like '+598%' then phone
        when value like '598%' and length(value) = 11 then '+' || value
        when value like '09%' and length(value) = 9 then '+598' || right(value, 8)
        when value like '9%' and length(value) = 8 then '+598' || value
        else phone
    end
    from digits;
$$;

create or replace function public.get_login_email_by_phone(p_phone text)
returns text
language sql
security definer
set search_path = public
as $$
    select s.email
    from public.socios s
    where public.normalize_phone_uy(s.telefono) = public.normalize_phone_uy(p_phone)
      and coalesce(s.estado, 'activo') = 'activo'
      and s.email is not null
      and coalesce(s.has_password, false) = true
    order by s.created_at desc
    limit 1;
$$;

create or replace function public.current_socio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select s.id
    from public.socios s
    where s.auth_user_id = auth.uid()
       or lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    order by s.created_at desc
    limit 1;
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.socios s
        where (s.auth_user_id = auth.uid()
            or lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', '')))
          and s.rol in ('admin', 'maestro')
          and coalesce(s.estado, 'activo') = 'activo'
    );
$$;

create or replace function public.mark_password_changed()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_socio_id uuid := public.current_socio_id();
begin
    if v_socio_id is null then
        raise exception 'Debe iniciar sesion.';
    end if;

    update public.socios
    set debe_cambiar_password = false,
        password_temporal = false,
        password_changed_at = timezone('utc'::text, now()),
        updated_at = coalesce(updated_at, now())
    where id = v_socio_id;

    return true;
end;
$$;

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
    v_id uuid;
begin
    if p_socio_id is null or coalesce(trim(p_mensaje), '') = '' then
        raise exception 'Notificacion invalida.';
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
        coalesce(nullif(trim(p_tipo), ''), 'telegram'),
        p_mensaje,
        p_fecha_programada,
        'pendiente',
        'telegram',
        'telegram',
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_id;

    return v_id;
end;
$$;

create or replace function public.set_telegram_link_code(
    p_socio_id uuid,
    p_code text,
    p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_socio_id is null or coalesce(trim(p_code), '') = '' then
        raise exception 'Codigo invalido.';
    end if;

    if public.current_socio_id() is distinct from p_socio_id and not public.current_user_is_admin() then
        raise exception 'Debe iniciar sesion para vincular Telegram.';
    end if;

    update public.socios
    set telegram_link_code = p_code,
        telegram_link_code_expires_at = p_expires_at,
        updated_at = coalesce(updated_at, now())
    where id = p_socio_id;

    return true;
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
    v_id uuid;
begin
    insert into public.solicitudes_membresia (
        nombre,
        apellido,
        cedula,
        telefono,
        email,
        mensaje,
        telegram_link_code,
        telegram_link_code_expires_at,
        estado
    )
    values (
        trim(p_nombre),
        trim(p_apellido),
        trim(p_cedula),
        public.normalize_phone_uy(p_telefono),
        nullif(trim(p_email), ''),
        nullif(trim(p_mensaje), ''),
        p_code,
        p_expires_at,
        'pendiente'
    )
    returning id into v_id;

    return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.is_current_device_telegram_verified(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_socio_id uuid := public.current_socio_id();
    v_verified boolean;
begin
    if v_socio_id is null then
        return jsonb_build_object('verified', false);
    end if;

    select exists (
        select 1
        from public.socio_dispositivos_verificados d
        where d.socio_id = v_socio_id
          and d.device_id = p_device_id
    ) into v_verified;

    if v_verified then
        update public.socio_dispositivos_verificados
        set last_used_at = timezone('utc'::text, now())
        where socio_id = v_socio_id and device_id = p_device_id;
    end if;

    return jsonb_build_object('verified', v_verified);
end;
$$;

create or replace function public.request_telegram_login_code(
    p_device_id text,
    p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_socio_id uuid := public.current_socio_id();
    v_socio public.socios%rowtype;
    v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
    v_expires_at timestamptz := timezone('utc'::text, now()) + interval '24 hours';
begin
    if v_socio_id is null then
        raise exception 'Debe iniciar sesion.';
    end if;

    select * into v_socio from public.socios where id = v_socio_id;
    if not coalesce(v_socio.telegram_enabled, false) or coalesce(v_socio.telegram_chat_id, '') = '' then
        raise exception 'Primero debe activar Telegram.';
    end if;

    if exists (
        select 1 from public.socio_dispositivos_verificados
        where socio_id = v_socio_id and device_id = p_device_id
    ) then
        return jsonb_build_object('already_verified', true, 'expires_at', null);
    end if;

    update public.socios
    set telegram_login_code = v_code,
        telegram_login_code_expires_at = v_expires_at,
        telegram_login_verified = false,
        updated_at = coalesce(updated_at, now())
    where id = v_socio_id;

    perform public.queue_telegram_notification(
        v_socio_id,
        'codigo_seguridad',
        'Codigo de seguridad para cambiar tu contrasena: ' || v_code || '. Es valido por 24 horas.',
        timezone('utc'::text, now()),
        jsonb_build_object('device_id', p_device_id, 'device_name', p_device_name)
    );

    return jsonb_build_object('already_verified', false, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.verify_telegram_login_code(
    p_code text,
    p_device_id text,
    p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_socio_id uuid := public.current_socio_id();
    v_socio public.socios%rowtype;
begin
    if v_socio_id is null then
        raise exception 'Debe iniciar sesion.';
    end if;

    select * into v_socio from public.socios where id = v_socio_id;
    if coalesce(v_socio.telegram_login_code, '') = '' then
        return jsonb_build_object('verified', false, 'reason', 'missing_code');
    end if;
    if v_socio.telegram_login_code_expires_at < timezone('utc'::text, now()) then
        return jsonb_build_object('verified', false, 'reason', 'expired');
    end if;
    if v_socio.telegram_login_code <> trim(p_code) then
        return jsonb_build_object('verified', false, 'reason', 'invalid');
    end if;

    insert into public.socio_dispositivos_verificados (socio_id, device_id, device_name)
    values (v_socio_id, p_device_id, nullif(trim(p_device_name), ''))
    on conflict (socio_id, device_id) do update
    set device_name = excluded.device_name,
        verified_at = timezone('utc'::text, now()),
        last_used_at = timezone('utc'::text, now());

    update public.socios
    set telegram_login_code = null,
        telegram_login_code_expires_at = null,
        telegram_login_verified = true,
        telegram_login_verified_at = timezone('utc'::text, now()),
        updated_at = coalesce(updated_at, now())
    where id = v_socio_id;

    return jsonb_build_object('verified', true);
end;
$$;

grant execute on function public.normalize_phone_uy(text) to anon, authenticated, service_role;
grant execute on function public.get_login_email_by_phone(text) to anon, authenticated, service_role;
grant execute on function public.current_socio_id() to authenticated, service_role;
grant execute on function public.current_user_is_admin() to authenticated, service_role;
grant execute on function public.mark_password_changed() to authenticated, service_role;
grant execute on function public.queue_telegram_notification(uuid, text, text, timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.set_telegram_link_code(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.create_membership_request_with_telegram(text, text, text, text, text, text, text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.is_current_device_telegram_verified(text) to authenticated, service_role;
grant execute on function public.request_telegram_login_code(text, text) to authenticated, service_role;
grant execute on function public.verify_telegram_login_code(text, text, text) to authenticated, service_role;
