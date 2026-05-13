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

do $$
declare
    luciana_email text := 'luciana.trindade1826@gmail.com';
    luciana_phone text := public.normalize_uy_phone('092456838');
    luciana_password text := 'Luciana1826';
    luciana_user_id uuid;
    luciana_socio_id uuid;
    identity_id_type text;
begin
    select id
      into luciana_socio_id
    from public.socios
    where lower(email) = luciana_email
    order by created_at asc
    limit 1;

    select id
      into luciana_user_id
    from auth.users
    where lower(email) = luciana_email
    limit 1;

    if luciana_user_id is null then
        luciana_user_id := extensions.gen_random_uuid();

        insert into auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            phone,
            phone_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        values (
            '00000000-0000-0000-0000-000000000000',
            luciana_user_id,
            'authenticated',
            'authenticated',
            luciana_email,
            extensions.crypt(luciana_password, extensions.gen_salt('bf')),
            timezone('utc'::text, now()),
            luciana_phone,
            timezone('utc'::text, now()),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'nombre', 'Luciana',
                'apellido', 'Trindade',
                'cedula', '45937626',
                'telefono', '092456838',
                'rol', 'socio'
            ),
            timezone('utc'::text, now()),
            timezone('utc'::text, now()),
            '',
            '',
            '',
            ''
        );
    else
        update auth.users
        set
            encrypted_password = extensions.crypt(luciana_password, extensions.gen_salt('bf')),
            email_confirmed_at = coalesce(email_confirmed_at, timezone('utc'::text, now())),
            phone = coalesce(phone, luciana_phone),
            phone_confirmed_at = coalesce(phone_confirmed_at, timezone('utc'::text, now())),
            raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
            updated_at = timezone('utc'::text, now())
        where id = luciana_user_id;
    end if;

    select udt_name
      into identity_id_type
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'id'
    limit 1;

    if not exists (
        select 1
        from auth.identities
        where user_id = luciana_user_id
          and provider = 'email'
    ) then
        if identity_id_type = 'uuid' then
            insert into auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            )
            values (
                luciana_user_id,
                luciana_user_id,
                luciana_user_id::text,
                jsonb_build_object('sub', luciana_user_id::text, 'email', luciana_email, 'email_verified', true, 'phone_verified', true),
                'email',
                timezone('utc'::text, now()),
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            );
        else
            insert into auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            )
            values (
                luciana_user_id::text,
                luciana_user_id,
                luciana_user_id::text,
                jsonb_build_object('sub', luciana_user_id::text, 'email', luciana_email, 'email_verified', true, 'phone_verified', true),
                'email',
                timezone('utc'::text, now()),
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            );
        end if;
    end if;

    if luciana_socio_id is not null then
        update public.socios
        set
            auth_user_id = luciana_user_id,
            nombre = 'Luciana',
            apellido = 'Trindade',
            cedula = '45937626',
            telefono = '092456838',
            estado = 'activo'
        where id = luciana_socio_id;

        delete from public.socios
        where lower(email) = luciana_email
          and id is distinct from luciana_socio_id
          and auth_user_id = luciana_user_id;
    end if;
end;
$$;

drop function if exists public.debug_auth_trigger_defs();
