update auth.users as u
set
    encrypted_password = extensions.crypt('Luciana1826', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(u.email_confirmed_at, timezone('utc'::text, now())),
    phone = coalesce(u.phone, public.normalize_uy_phone('092456838')),
    phone_confirmed_at = coalesce(u.phone_confirmed_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
where lower(u.email) = 'luciana.trindade1826@gmail.com';

update public.socios as s
set auth_user_id = u.id
from auth.users as u
where lower(s.email) = 'luciana.trindade1826@gmail.com'
  and lower(u.email) = 'luciana.trindade1826@gmail.com'
  and s.auth_user_id is distinct from u.id;
