alter table if exists public.socios
    add column if not exists telegram_chat_id text,
    add column if not exists telegram_username text,
    add column if not exists telegram_enabled boolean not null default false,
    add column if not exists telegram_link_code text,
    add column if not exists telegram_link_code_expires_at timestamptz,
    add column if not exists telegram_linked_at timestamptz;

create unique index if not exists idx_socios_telegram_chat_id_unique
    on public.socios (telegram_chat_id)
    where telegram_chat_id is not null;

create unique index if not exists idx_socios_telegram_link_code_unique
    on public.socios (telegram_link_code)
    where telegram_link_code is not null;

create index if not exists idx_socios_telegram_link_code_valid
    on public.socios (telegram_link_code, telegram_link_code_expires_at)
    where telegram_link_code is not null;

alter table if exists public.notificaciones_programadas
    add column if not exists provider text,
    add column if not exists provider_message_sid text,
    add column if not exists error_detalle text,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

create index if not exists idx_notificaciones_programadas_telegram_pendientes
    on public.notificaciones_programadas (estado, canal, fecha_programada)
    where canal = 'telegram';

comment on column public.socios.telegram_chat_id is
'Chat ID privado de Telegram. Se guarda desde el worker al procesar /start CODIGO.';

comment on column public.socios.telegram_link_code is
'Codigo temporal de vinculacion generado desde la web. Vence segun telegram_link_code_expires_at.';

comment on column public.socios.telegram_link_code_expires_at is
'Vencimiento del codigo temporal de vinculacion de Telegram.';

comment on column public.socios.telegram_linked_at is
'Fecha en que el Worker vinculo correctamente el chat de Telegram.';

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
      and lower(email) = lower(auth.jwt() ->> 'email');

    if not found then
        raise exception 'No se encontro un socio vinculado al usuario actual.';
    end if;
end;
$$;

grant execute on function public.set_telegram_link_code(uuid, text, timestamptz) to authenticated;

comment on function public.set_telegram_link_code(uuid, text, timestamptz) is
'Permite al socio autenticado generar un codigo temporal de vinculacion Telegram para su propia cuenta.';
