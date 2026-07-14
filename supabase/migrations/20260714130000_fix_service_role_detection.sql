create or replace function public.enforce_socios_role_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(auth.jwt()->>'role', ''),
        current_user
    );
    v_is_service_role boolean := v_request_role = 'service_role';
    v_is_master boolean := public.current_user_is_maestro();
    v_new_role text := coalesce(new.rol, 'socio');
    v_old_role text := 'socio';
    v_new_phone text := public.normalize_phone_uy(new.telefono);
    v_master_phone text;
begin
    select public.normalize_phone_uy(valor)
    into v_master_phone
    from public.configuracion_sistema
    where clave = 'maestro_telefono';

    v_master_phone := coalesce(v_master_phone, '');

    if tg_op = 'UPDATE' then
        v_old_role := coalesce(old.rol, 'socio');
    end if;

    if v_new_role not in ('socio', 'admin', 'maestro') then
        raise exception 'Rol no permitido.';
    end if;

    if v_new_role = 'maestro' then
        if v_master_phone = '' then
            raise exception 'Primero debe configurarse el telefono maestro.';
        end if;

        if v_new_phone <> v_master_phone then
            raise exception 'El rol maestro esta reservado al telefono configurado.';
        end if;

        if tg_op = 'INSERT' then
            if exists (select 1 from public.socios s where s.rol = 'maestro') then
                raise exception 'Ya existe un usuario maestro.';
            end if;
        elsif exists (
            select 1 from public.socios s
            where s.rol = 'maestro' and s.id is distinct from old.id
        ) then
            raise exception 'Ya existe un usuario maestro.';
        end if;
    end if;

    if tg_op = 'INSERT' then
        if v_new_role = 'admin' and not (v_is_service_role or v_is_master) then
            raise exception 'Solo el maestro puede crear administradores.';
        end if;

        if v_new_role = 'maestro' and not v_is_service_role then
            raise exception 'El rol maestro no se puede crear desde el panel.';
        end if;

        return new;
    end if;

    if v_old_role = 'maestro' and v_new_phone <> v_master_phone then
        raise exception 'El telefono del maestro debe coincidir con la configuracion.';
    end if;

    if v_new_role is distinct from v_old_role then
        if v_new_role = 'admin' and not (v_is_service_role or v_is_master) then
            raise exception 'Solo el maestro puede crear administradores.';
        end if;

        if v_new_role = 'maestro' and not (v_is_service_role or v_is_master) then
            raise exception 'Solo el maestro puede asignar el rol maestro.';
        end if;

        if v_old_role in ('admin', 'maestro') and not (v_is_service_role or v_is_master) then
            raise exception 'Solo el maestro puede modificar roles administrativos.';
        end if;
    end if;

    return new;
end;
$$;

grant execute on function public.enforce_socios_role_policy() to authenticated, service_role;
