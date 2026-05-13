create or replace function public.get_login_email_by_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_input text;
    matched_email text;
begin
    normalized_input := public.normalize_uy_phone(p_phone);

    if normalized_input is null then
        return null;
    end if;

    select s.email
      into matched_email
    from public.socios s
    where public.normalize_uy_phone(s.telefono) = normalized_input
      and s.email is not null
      and coalesce(s.estado, 'activo') = 'activo'
    order by s.created_at desc
    limit 1;

    return matched_email;
end;
$$;

revoke all on function public.get_login_email_by_phone(text) from public;
grant execute on function public.get_login_email_by_phone(text) to anon, authenticated;

comment on function public.get_login_email_by_phone(text) is
'Resuelve el email tecnico de Auth a partir del telefono del socio para permitir login visible por telefono sin activar Phone Auth/SMS.';
