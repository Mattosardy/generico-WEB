begin;

alter table public.configuracion
    add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

alter table public.configuracion_whatsapp
    add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

alter table public.logs_actividad
    add column if not exists created_at timestamptz not null default timezone('utc'::text, now()),
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.solicitudes_membresia
    add column if not exists created_at timestamptz not null default timezone('utc'::text, now()),
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.actividades
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.calificaciones_productos
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.documentos_socios
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.lotes_cosecha
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.noticias
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.productos
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.productos_imagenes
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.reservas_mensuales
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.sorteos_ganadores
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.sorteos_participantes
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.telegram_mensajes_entrantes
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

drop trigger if exists set_updated_at_actividades on public.actividades;
create trigger set_updated_at_actividades
before update on public.actividades
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_calificaciones_productos on public.calificaciones_productos;
create trigger set_updated_at_calificaciones_productos
before update on public.calificaciones_productos
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_configuracion on public.configuracion;
create trigger set_updated_at_configuracion
before update on public.configuracion
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_configuracion_sistema on public.configuracion_sistema;
create trigger set_updated_at_configuracion_sistema
before update on public.configuracion_sistema
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_configuracion_whatsapp on public.configuracion_whatsapp;
create trigger set_updated_at_configuracion_whatsapp
before update on public.configuracion_whatsapp
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_documentos_socios on public.documentos_socios;
create trigger set_updated_at_documentos_socios
before update on public.documentos_socios
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_logs_actividad on public.logs_actividad;
create trigger set_updated_at_logs_actividad
before update on public.logs_actividad
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_lotes_cosecha on public.lotes_cosecha;
create trigger set_updated_at_lotes_cosecha
before update on public.lotes_cosecha
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_noticias on public.noticias;
create trigger set_updated_at_noticias
before update on public.noticias
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_productos on public.productos;
create trigger set_updated_at_productos
before update on public.productos
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_productos_imagenes on public.productos_imagenes;
create trigger set_updated_at_productos_imagenes
before update on public.productos_imagenes
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_reservas_mensuales on public.reservas_mensuales;
create trigger set_updated_at_reservas_mensuales
before update on public.reservas_mensuales
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_solicitudes_membresia on public.solicitudes_membresia;
create trigger set_updated_at_solicitudes_membresia
before update on public.solicitudes_membresia
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_sorteos on public.sorteos;
create trigger set_updated_at_sorteos
before update on public.sorteos
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_sorteos_ganadores on public.sorteos_ganadores;
create trigger set_updated_at_sorteos_ganadores
before update on public.sorteos_ganadores
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_sorteos_participantes on public.sorteos_participantes;
create trigger set_updated_at_sorteos_participantes
before update on public.sorteos_participantes
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_telegram_mensajes_entrantes on public.telegram_mensajes_entrantes;
create trigger set_updated_at_telegram_mensajes_entrantes
before update on public.telegram_mensajes_entrantes
for each row execute procedure public.set_updated_at();

commit;
