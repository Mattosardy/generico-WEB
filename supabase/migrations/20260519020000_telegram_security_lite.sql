create extension if not exists pgcrypto;

alter table public.socios
  add column if not exists telegram_login_verified boolean not null default false,
  add column if not exists telegram_login_code_hash text,
  add column if not exists telegram_login_code_expires_at timestamptz,
  add column if not exists telegram_login_verified_at timestamptz,
  add column if not exists telegram_require_device_verification boolean not null default true;

create table if not exists public.socio_dispositivos_verificados (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios(id) on delete cascade,
  device_id text not null,
  device_name text,
  verified_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (socio_id, device_id)
);

alter table public.socio_dispositivos_verificados enable row level security;

drop policy if exists socio_dispositivos_select_own_or_admin on public.socio_dispositivos_verificados;
create policy socio_dispositivos_select_own_or_admin
on public.socio_dispositivos_verificados
for select to authenticated
using (
  public.is_admin_or_maestro()
  or socio_id = public.current_socio_id()
);

drop policy if exists socio_dispositivos_delete_own_or_admin on public.socio_dispositivos_verificados;
create policy socio_dispositivos_delete_own_or_admin
on public.socio_dispositivos_verificados
for delete to authenticated
using (
  public.is_admin_or_maestro()
  or socio_id = public.current_socio_id()
);

create index if not exists idx_socios_telegram_security_pending
  on public.socios (telegram_login_code_expires_at)
  where telegram_login_code_hash is not null;

create index if not exists idx_socio_dispositivos_socio_seen
  on public.socio_dispositivos_verificados (socio_id, last_seen_at desc);

create or replace function public.generate_telegram_security_code()
returns text
language sql
volatile
as $$
  select lpad(
    ((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))::bit(32)::bigint % 1000000))::text,
    6,
    '0'
  )
$$;

create or replace function public.is_current_device_telegram_verified(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_socio_id uuid;
  v_device_id text;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_socio_id := public.current_socio_id();
  v_device_id := left(nullif(trim(coalesce(p_device_id, '')), ''), 180);

  if v_socio_id is null or v_device_id is null then
    return false;
  end if;

  update public.socio_dispositivos_verificados
  set last_seen_at = timezone('utc'::text, now())
  where socio_id = v_socio_id
    and device_id = v_device_id;

  return found;
end;
$$;

create or replace function public.request_telegram_login_code(
  p_device_id text default null,
  p_device_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_socio_id uuid;
  v_device_id text;
  v_code text;
  v_expires_at timestamptz;
  v_message text;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesion.';
  end if;

  v_socio_id := public.current_socio_id();
  v_device_id := left(nullif(trim(coalesce(p_device_id, '')), ''), 180);

  if v_socio_id is null then
    raise exception 'No se encontro el socio actual.';
  end if;

  if v_device_id is null then
    raise exception 'No se pudo identificar el dispositivo.';
  end if;

  if exists (
    select 1
    from public.socio_dispositivos_verificados
    where socio_id = v_socio_id
      and device_id = v_device_id
  ) then
    return jsonb_build_object('sent', false, 'already_verified', true);
  end if;

  if not exists (
    select 1
    from public.socios
    where id = v_socio_id
      and telegram_enabled is true
      and nullif(trim(coalesce(telegram_chat_id, '')), '') is not null
  ) then
    raise exception 'Primero debe vincular Telegram.';
  end if;

  v_code := public.generate_telegram_security_code();
  v_expires_at := timezone('utc'::text, now()) + interval '24 hours';
  v_message := 'Codigo de seguridad Cururu Club: ' || v_code ||
               E'\n\nValido por 24 horas.\nNo compartas este codigo.';

  perform set_config('app.telegram_security_rpc', 'on', true);

  update public.socios
  set telegram_login_verified = false,
      telegram_login_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf')),
      telegram_login_code_expires_at = v_expires_at
  where id = v_socio_id;

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
    v_socio_id,
    'telegram_security_code',
    v_message,
    timezone('utc'::text, now()),
    'pendiente',
    'telegram',
    'telegram',
    jsonb_build_object(
      'device_id_present', true,
      'device_name', left(coalesce(p_device_name, ''), 120)
    )
  );

  return jsonb_build_object('sent', true, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.verify_telegram_login_code(
  p_code text,
  p_device_id text,
  p_device_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_socio public.socios%rowtype;
  v_device_id text;
  v_device_name text;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesion.';
  end if;

  v_device_id := left(nullif(trim(coalesce(p_device_id, '')), ''), 180);
  v_device_name := left(nullif(trim(coalesce(p_device_name, '')), ''), 120);

  if v_device_id is null then
    raise exception 'No se pudo identificar el dispositivo.';
  end if;

  select *
    into v_socio
  from public.socios
  where id = public.current_socio_id()
  limit 1;

  if v_socio.id is null then
    raise exception 'No se encontro el socio actual.';
  end if;

  if v_socio.telegram_login_code_hash is null then
    return jsonb_build_object('verified', false, 'reason', 'missing_code');
  end if;

  if v_socio.telegram_login_code_expires_at <= timezone('utc'::text, now()) then
    return jsonb_build_object('verified', false, 'reason', 'expired');
  end if;

  if extensions.crypt(coalesce(p_code, ''), v_socio.telegram_login_code_hash) <> v_socio.telegram_login_code_hash then
    return jsonb_build_object('verified', false, 'reason', 'invalid');
  end if;

  perform set_config('app.telegram_security_rpc', 'on', true);

  update public.socios
  set telegram_login_verified = true,
      telegram_login_verified_at = timezone('utc'::text, now()),
      telegram_login_code_hash = null,
      telegram_login_code_expires_at = null
  where id = v_socio.id;

  insert into public.socio_dispositivos_verificados (
    socio_id,
    device_id,
    device_name,
    verified_at,
    last_seen_at
  )
  values (
    v_socio.id,
    v_device_id,
    v_device_name,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (socio_id, device_id)
  do update set
    device_name = excluded.device_name,
    verified_at = timezone('utc'::text, now()),
    last_seen_at = timezone('utc'::text, now());

  return jsonb_build_object('verified', true);
end;
$$;

create or replace function public.prevent_direct_telegram_security_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_maestro() then
    return new;
  end if;

  if current_setting('app.telegram_security_rpc', true) = 'on' then
    return new;
  end if;

  if old.telegram_login_verified is distinct from new.telegram_login_verified
    or old.telegram_login_code_hash is distinct from new.telegram_login_code_hash
    or old.telegram_login_code_expires_at is distinct from new.telegram_login_code_expires_at
    or old.telegram_login_verified_at is distinct from new.telegram_login_verified_at
    or old.telegram_require_device_verification is distinct from new.telegram_require_device_verification
  then
    raise exception 'Los campos de seguridad Telegram solo se actualizan mediante verificacion.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_telegram_security_fields on public.socios;
create trigger protect_telegram_security_fields
before update on public.socios
for each row
execute function public.prevent_direct_telegram_security_update();

revoke all on function public.generate_telegram_security_code() from public;
revoke all on function public.is_current_device_telegram_verified(text) from public;
revoke all on function public.request_telegram_login_code(text, text) from public;
revoke all on function public.verify_telegram_login_code(text, text, text) from public;

grant execute on function public.is_current_device_telegram_verified(text) to authenticated;
grant execute on function public.request_telegram_login_code(text, text) to authenticated;
grant execute on function public.verify_telegram_login_code(text, text, text) to authenticated;

comment on table public.socio_dispositivos_verificados is
'Dispositivos verificados por socio para Telegram Security Lite.';

comment on function public.request_telegram_login_code(text, text) is
'Genera un codigo Telegram de seguridad de un solo uso para verificar el dispositivo actual.';

comment on function public.verify_telegram_login_code(text, text, text) is
'Valida el codigo Telegram de seguridad y registra el dispositivo actual como verificado.';
