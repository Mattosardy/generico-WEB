alter table public.reservas_mensuales
    add column if not exists producto_id uuid references public.productos(id) on delete set null,
    add column if not exists producto_nombre text,
    add column if not exists admin_confirmed_at timestamptz,
    add column if not exists delivery_confirmed_at timestamptz;

create index if not exists idx_reservas_mensuales_producto_id
    on public.reservas_mensuales(producto_id);

comment on column public.reservas_mensuales.producto_id is
'Variedad/producto pedido por el socio, cuando la reserva se crea desde una ficha de variedad.';

comment on column public.reservas_mensuales.producto_nombre is
'Nombre de variedad congelado para reportes administrativos aunque el producto cambie de nombre.';
