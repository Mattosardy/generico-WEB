-- Nombre del Club - Storage buckets and policies
-- Creates the public buckets used by the frontend and restricts writes to admin/maestro users.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    (
        'productos',
        'productos',
        true,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp']
    ),
    (
        'noticias',
        'noticias',
        true,
        104857600,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
    )
on conflict (id) do update
set
    name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_buckets_public_select_generico on storage.buckets;
drop policy if exists storage_objects_public_select_generico on storage.objects;
drop policy if exists storage_objects_admin_insert_generico on storage.objects;
drop policy if exists storage_objects_admin_update_generico on storage.objects;
drop policy if exists storage_objects_admin_delete_generico on storage.objects;

create policy storage_buckets_public_select_generico
on storage.buckets
for select
to anon, authenticated
using (id in ('productos', 'noticias'));

create policy storage_objects_public_select_generico
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('productos', 'noticias'));

create policy storage_objects_admin_insert_generico
on storage.objects
for insert
to authenticated
with check (
    bucket_id in ('productos', 'noticias')
    and public.is_admin_or_maestro()
);

create policy storage_objects_admin_update_generico
on storage.objects
for update
to authenticated
using (
    bucket_id in ('productos', 'noticias')
    and public.is_admin_or_maestro()
)
with check (
    bucket_id in ('productos', 'noticias')
    and public.is_admin_or_maestro()
);

create policy storage_objects_admin_delete_generico
on storage.objects
for delete
to authenticated
using (
    bucket_id in ('productos', 'noticias')
    and public.is_admin_or_maestro()
);
