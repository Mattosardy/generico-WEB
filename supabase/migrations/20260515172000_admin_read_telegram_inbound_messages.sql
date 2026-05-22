drop policy if exists "Admins can read telegram inbound messages" on public.telegram_mensajes_entrantes;

create policy "Admins can read telegram inbound messages"
on public.telegram_mensajes_entrantes
for select
to authenticated
using (
    exists (
        select 1
        from public.socios s
        where (s.auth_user_id = auth.uid() or lower(s.email) = lower(auth.jwt() ->> 'email'))
          and coalesce(s.rol, 'socio') in ('admin', 'maestro')
    )
);
