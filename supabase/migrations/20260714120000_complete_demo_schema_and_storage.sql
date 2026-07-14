-- Complete the schema used by the current T3-420 Web frontend.
-- Safe for a new project and idempotent when applied to an existing schema.

alter table if exists public.productos
    add column if not exists tipo_cultivo text,
    add column if not exists indica_sativa text,
    add column if not exists stock_packs integer not null default 0,
    add column if not exists bajo_stock_packs integer not null default 2,
    add column if not exists stock_activo boolean not null default false,
    add column if not exists pack_gramos integer not null default 20;

update public.productos
set tipo_cultivo = 'invernaculo'
where tipo_cultivo is null or trim(tipo_cultivo) = '';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'productos_stock_packs_nonnegative'
          and conrelid = 'public.productos'::regclass
    ) then
        alter table public.productos
            add constraint productos_stock_packs_nonnegative check (stock_packs >= 0);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'productos_bajo_stock_packs_nonnegative'
          and conrelid = 'public.productos'::regclass
    ) then
        alter table public.productos
            add constraint productos_bajo_stock_packs_nonnegative check (bajo_stock_packs >= 0);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'productos_pack_gramos_positive'
          and conrelid = 'public.productos'::regclass
    ) then
        alter table public.productos
            add constraint productos_pack_gramos_positive check (pack_gramos > 0);
    end if;
end $$;

alter table if exists public.reservas_mensuales
    add column if not exists producto_id uuid,
    add column if not exists producto_nombre text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'reservas_mensuales_producto_id_fkey'
          and conrelid = 'public.reservas_mensuales'::regclass
    ) then
        alter table public.reservas_mensuales
            add constraint reservas_mensuales_producto_id_fkey
            foreign key (producto_id) references public.productos(id) on delete set null;
    end if;
end $$;

create index if not exists idx_reservas_producto_id
    on public.reservas_mensuales(producto_id);

-- These are public marketing/catalog assets. Writes remain admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    (
        'productos',
        'productos',
        true,
        20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'noticias',
        'noticias',
        true,
        20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
    )
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'demo_assets_select_public'
    ) then
        create policy demo_assets_select_public
        on storage.objects
        for select
        to anon, authenticated
        using (bucket_id in ('productos', 'noticias'));
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'demo_assets_insert_admin'
    ) then
        create policy demo_assets_insert_admin
        on storage.objects
        for insert
        to authenticated
        with check (
            bucket_id in ('productos', 'noticias')
            and public.current_user_is_admin()
        );
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'demo_assets_update_admin'
    ) then
        create policy demo_assets_update_admin
        on storage.objects
        for update
        to authenticated
        using (
            bucket_id in ('productos', 'noticias')
            and public.current_user_is_admin()
        )
        with check (
            bucket_id in ('productos', 'noticias')
            and public.current_user_is_admin()
        );
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'demo_assets_delete_admin'
    ) then
        create policy demo_assets_delete_admin
        on storage.objects
        for delete
        to authenticated
        using (
            bucket_id in ('productos', 'noticias')
            and public.current_user_is_admin()
        );
    end if;
end $$;
