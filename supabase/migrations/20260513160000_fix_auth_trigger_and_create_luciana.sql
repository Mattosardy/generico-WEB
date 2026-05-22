create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.socios (
        auth_user_id,
        email,
        nombre,
        apellido,
        cedula,
        telefono,
        estado,
        rol
    )
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data ->> 'apellido', ''),
        coalesce(nullif(new.raw_user_meta_data ->> 'cedula', ''), 'SIN-CEDULA-' || left(new.id::text, 8)),
        coalesce(nullif(new.raw_user_meta_data ->> 'telefono', ''), new.phone),
        'activo',
        coalesce(nullif(new.raw_user_meta_data ->> 'rol', ''), 'socio')
    )
    on conflict (cedula) do update
    set
        auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        nombre = excluded.nombre,
        apellido = excluded.apellido,
        telefono = coalesce(excluded.telefono, public.socios.telefono),
        estado = 'activo',
        rol = coalesce(public.socios.rol, excluded.rol);

    return new;
end;
$$;

-- Removed the previous one-off user creation/reset block because it stored a
-- real password in source control. Create or reset users through Supabase Auth.

drop function if exists public.debug_auth_trigger_defs();
