alter table public.reservas_mensuales
    add column if not exists plus_items jsonb not null default '[]'::jsonb;

comment on column public.reservas_mensuales.plus_items is
    'Lista de plus agregados por variedad dentro del pedido mensual.';
