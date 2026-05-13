update public.socios
set telefono = '099957102'
where lower(email) = 'admin@cururu.com';

update auth.users as u
set
    phone = public.normalize_uy_phone('099957102'),
    phone_confirmed_at = coalesce(u.phone_confirmed_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
from public.socios as s
where s.auth_user_id = u.id
  and lower(s.email) = 'admin@cururu.com'
  and not exists (
      select 1
      from auth.users as other
      where other.id <> u.id
        and other.phone = public.normalize_uy_phone('099957102')
  );
