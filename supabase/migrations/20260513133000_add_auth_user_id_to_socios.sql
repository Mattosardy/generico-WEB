alter table if exists public.socios
    add column if not exists auth_user_id uuid references auth.users(id);

update public.socios s
set auth_user_id = u.id
from auth.users u
where lower(s.email) = lower(u.email)
  and s.auth_user_id is null;

create unique index if not exists idx_socios_auth_user_id_unique
    on public.socios (auth_user_id)
    where auth_user_id is not null;

comment on column public.socios.auth_user_id is
'Identidad principal del socio en Supabase Auth. Reemplaza gradualmente la dependencia operativa del email.';
