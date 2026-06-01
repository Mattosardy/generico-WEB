create table if not exists public.telegram_mensajes_entrantes (
    id uuid primary key default gen_random_uuid(),
    telegram_update_id bigint,
    message_id bigint,
    socio_id uuid references public.socios(id) on delete set null,
    chat_id text not null,
    telegram_user_id text,
    username text,
    first_name text,
    last_name text,
    display_name text,
    text text,
    message_date timestamptz not null default timezone('utc'::text, now()),
    raw_update jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.telegram_mensajes_entrantes enable row level security;

create index if not exists idx_telegram_mensajes_entrantes_created_at
    on public.telegram_mensajes_entrantes(created_at desc);

create index if not exists idx_telegram_mensajes_entrantes_chat_id
    on public.telegram_mensajes_entrantes(chat_id);

create index if not exists idx_telegram_mensajes_entrantes_socio_id
    on public.telegram_mensajes_entrantes(socio_id);

comment on table public.telegram_mensajes_entrantes is
    'Mensajes entrantes recibidos por el webhook de Telegram del worker Nombre del Club.';

comment on column public.telegram_mensajes_entrantes.raw_update is
    'Payload completo recibido desde Telegram para depuracion y trazabilidad.';
