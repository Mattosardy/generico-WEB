create or replace function public.current_user_is_maestro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.socios s
        where (s.auth_user_id = auth.uid()
            or lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', '')))
          and s.rol = 'maestro'
          and public.normalize_phone_uy(s.telefono) = '+59891950107'
          and coalesce(s.estado, 'activo') = 'activo'
    );
$$;

create unique index if not exists socios_unico_maestro_idx
on public.socios ((rol))
where rol = 'maestro';

create or replace function public.enforce_socios_role_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
    v_is_service_role boolean := v_request_role = 'service_role';
    v_is_master boolean := public.current_user_is_maestro();
    v_new_role text := coalesce(new.rol, 'socio');
    v_old_role text := 'socio';
    v_new_phone text := public.normalize_phone_uy(new.telefono);
begin
    if tg_op = 'UPDATE' then
        v_old_role := coalesce(old.rol, 'socio');
    end if;

    if v_new_role not in ('socio', 'admin', 'maestro') then
        raise exception 'Rol no permitido.';
    end if;

    if v_new_role = 'maestro' then
        if v_new_phone <> '+59891950107' then
            raise exception 'El unico maestro permitido es el telefono 091950107.';
        end if;

        if tg_op = 'INSERT' then
            if exists (select 1 from public.socios s where s.rol = 'maestro') then
                raise exception 'Ya existe un usuario maestro.';
            end if;
        else
            if exists (
                select 1
                from public.socios s
                where s.rol = 'maestro'
                  and s.id is distinct from old.id
            ) then
                raise exception 'Ya existe un usuario maestro.';
            end if;
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

    if v_old_role = 'maestro' and v_new_phone <> '+59891950107' then
        raise exception 'El telefono del maestro debe ser 091950107.';
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

drop trigger if exists trg_enforce_socios_role_policy on public.socios;
create trigger trg_enforce_socios_role_policy
before insert or update on public.socios
for each row
execute function public.enforce_socios_role_policy();

grant execute on function public.current_user_is_maestro() to authenticated, service_role;
grant execute on function public.enforce_socios_role_policy() to authenticated, service_role;
