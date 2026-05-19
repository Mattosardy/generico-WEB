alter table public.productos
  add column if not exists stock_packs integer not null default 0,
  add column if not exists bajo_stock_packs integer not null default 2,
  add column if not exists stock_activo boolean not null default true,
  add column if not exists pack_gramos integer not null default 20;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_stock_packs_nonnegative'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_stock_packs_nonnegative
      check (stock_packs >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_bajo_stock_packs_nonnegative'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_bajo_stock_packs_nonnegative
      check (bajo_stock_packs >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_pack_gramos_positive'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_pack_gramos_positive
      check (pack_gramos > 0);
  end if;
end $$;
