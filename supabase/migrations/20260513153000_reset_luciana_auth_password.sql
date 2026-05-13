update auth.users as u
set
    encrypted_password = extensions.crypt('Luciana1826', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(u.email_confirmed_at, timezone('utc'::text, now())),
    phone_confirmed_at = coalesce(u.phone_confirmed_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
from public.socios as s
where s.auth_user_id = u.id
  and lower(s.email) = 'luciana.trindade1826@gmail.com';
