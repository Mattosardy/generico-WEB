begin;

alter table public.socios
  add column if not exists debe_cambiar_password boolean not null default false,
  add column if not exists password_temporal boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists password_temporal_issued_at timestamptz,
  add column if not exists alta_manual_admin_id uuid,
  add column if not exists email_tecnico_generado boolean not null default false;

create or replace function public.generate_technical_email(p_phone text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  normalized_phone text;
  phone_digits text;
begin
  normalized_phone := public.normalize_uy_phone(p_phone);
  phone_digits := regexp_replace(coalesce(normalized_phone, p_phone, ''), '[^0-9]', '', 'g');

  if nullif(phone_digits, '') is null then
    raise exception 'El telefono es obligatorio para generar email tecnico.';
  end if;

  return 'socio_' || phone_digits || '@nombre-del-club.local';
end;
$$;

create or replace function public.mark_password_changed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_socio_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  v_socio_id := public.current_socio_id();

  if v_socio_id is null then
    raise exception 'No se encontro el socio actual.';
  end if;

  update public.socios
     set debe_cambiar_password = false,
         password_temporal = false,
         password_changed_at = timezone('utc'::text, now())
   where id = v_socio_id;

  return jsonb_build_object('success', true, 'socio_id', v_socio_id);
end;
$$;

revoke all on function public.generate_technical_email(text) from public;
revoke all on function public.mark_password_changed() from public;
grant execute on function public.generate_technical_email(text) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;

comment on column public.socios.debe_cambiar_password is
'Indica que el socio debe cambiar una clave temporal antes de operar normalmente.';
comment on column public.socios.password_temporal is
'Marca operativa para indicar que la clave actual fue emitida como temporal.';
comment on column public.socios.password_changed_at is
'Fecha en que el socio cambio su clave temporal por una propia.';
comment on column public.socios.password_temporal_issued_at is
'Fecha en que se emitio la clave temporal para alta manual.';
comment on column public.socios.alta_manual_admin_id is
'Usuario Auth del admin que gestiono el alta manual, cuando aplica.';
comment on column public.socios.email_tecnico_generado is
'Indica que el email se genero automaticamente para Auth y no forma parte del flujo visible del socio.';
comment on function public.generate_technical_email(text) is
'Genera un email tecnico interno a partir del telefono normalizado. No debe mostrarse al socio.';
comment on function public.mark_password_changed() is
'Marca al socio actual como usuario con contrasena propia luego de actualizarla en Supabase Auth.';

commit;
