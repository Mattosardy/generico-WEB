alter table if exists public.solicitudes_membresia
    add column if not exists tipo_registro text;

comment on column public.solicitudes_membresia.tipo_registro
    is 'Origen del registro declarado al solicitar membresia: autocultivo, farmacias o ninguno.';
