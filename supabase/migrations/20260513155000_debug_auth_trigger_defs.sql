create or replace function public.debug_auth_trigger_defs()
returns table(trigger_name text, function_definition text)
language sql
security definer
set search_path = public, auth, extensions
as $$
    select
        t.tgname::text as trigger_name,
        pg_get_functiondef(t.tgfoid)::text as function_definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal;
$$;

grant execute on function public.debug_auth_trigger_defs() to anon, authenticated;
