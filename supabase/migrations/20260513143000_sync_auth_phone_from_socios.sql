create or replace function public.normalize_uy_phone(input text)
returns text
language sql
immutable
as $$
    with cleaned as (
        select regexp_replace(coalesce(input, ''), '[^\d+]', '', 'g') as value
    ),
    digits as (
        select regexp_replace(value, '[^\d]', '', 'g') as value, cleaned.value as raw_value
        from cleaned
    )
    select case
        when raw_value like '+598%' then raw_value
        when value like '598%' and length(value) = 11 then '+' || value
        when value like '09%' and length(value) = 9 then '+598' || substring(value from 2)
        when value like '9%' and length(value) = 8 then '+598' || value
        else null
    end
    from digits;
$$;

with normalized_socios as (
    select
        s.auth_user_id,
        public.normalize_uy_phone(s.telefono) as phone
    from public.socios s
    where s.auth_user_id is not null
      and nullif(trim(coalesce(s.telefono, '')), '') is not null
),
unique_phones as (
    select phone
    from normalized_socios
    where phone is not null
    group by phone
    having count(*) = 1
)
update auth.users u
set
    phone = ns.phone,
    phone_confirmed_at = coalesce(u.phone_confirmed_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
from normalized_socios ns
join unique_phones up on up.phone = ns.phone
where u.id = ns.auth_user_id
  and ns.phone is not null
  and u.phone is distinct from ns.phone
  and not exists (
      select 1
      from auth.users other
      where other.id <> u.id
        and other.phone = ns.phone
  );

comment on function public.normalize_uy_phone(text) is
'Normaliza telefonos Uruguay a formato E.164 para Supabase Auth.';
