begin;

create or replace function public.current_socio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select s.id
    from public.socios s
    where s.auth_user_id = auth.uid()
       or lower(s.email) = lower(auth.jwt() ->> 'email')
    order by case when s.auth_user_id = auth.uid() then 0 else 1 end
    limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(s.rol, 'socio')
    from public.socios s
    where s.id = public.current_socio_id()
    limit 1
$$;

create or replace function public.is_admin_or_maestro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_user_role(), '') in ('admin', 'maestro')
$$;

revoke all on function public.current_socio_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin_or_maestro() from public;
grant execute on function public.current_socio_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin_or_maestro() to authenticated;

alter table public.configuracion enable row level security;
alter table public.documentos_socios enable row level security;
alter table public.lotes_cosecha enable row level security;
alter table public.sorteos enable row level security;
alter table public.sorteos_ganadores enable row level security;
alter table public.sorteos_participantes enable row level security;
alter table public.whatsapp_templates enable row level security;

drop policy if exists actividades_delete_auth on public.actividades;
drop policy if exists actividades_insert_auth on public.actividades;
drop policy if exists actividades_select_all on public.actividades;
drop policy if exists actividades_update_auth on public.actividades;
create policy actividades_select_public on public.actividades for select to anon, authenticated using (true);
create policy actividades_admin_write on public.actividades for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists noticias_delete_auth on public.noticias;
drop policy if exists noticias_insert_auth on public.noticias;
drop policy if exists noticias_select_all on public.noticias;
drop policy if exists noticias_update_auth on public.noticias;
create policy noticias_select_public on public.noticias for select to anon, authenticated using (true);
create policy noticias_admin_write on public.noticias for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists productos_delete_auth on public.productos;
drop policy if exists productos_insert_auth on public.productos;
drop policy if exists productos_select_all on public.productos;
drop policy if exists productos_update_auth on public.productos;
create policy productos_select_public on public.productos for select to anon, authenticated using (true);
create policy productos_admin_write on public.productos for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists config_insert_auth on public.configuracion_sistema;
drop policy if exists config_select_auth on public.configuracion_sistema;
drop policy if exists config_update_auth on public.configuracion_sistema;
create policy configuracion_sistema_select_public on public.configuracion_sistema for select to anon, authenticated using (true);
create policy configuracion_sistema_admin_write on public.configuracion_sistema for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists whatsapp_insert_auth on public.configuracion_whatsapp;
drop policy if exists whatsapp_select_auth on public.configuracion_whatsapp;
drop policy if exists whatsapp_update_auth on public.configuracion_whatsapp;
create policy configuracion_whatsapp_admin_all on public.configuracion_whatsapp for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists reservas_delete_auth on public.reservas_mensuales;
drop policy if exists reservas_insert_auth on public.reservas_mensuales;
drop policy if exists reservas_select_auth on public.reservas_mensuales;
drop policy if exists reservas_update_auth on public.reservas_mensuales;
create policy reservas_select_own_or_admin on public.reservas_mensuales for select to authenticated using (public.is_admin_or_maestro() or socio_id = public.current_socio_id());
create policy reservas_insert_own_or_admin on public.reservas_mensuales for insert to authenticated with check (public.is_admin_or_maestro() or socio_id = public.current_socio_id());
create policy reservas_update_own_or_admin on public.reservas_mensuales for update to authenticated using (public.is_admin_or_maestro() or socio_id = public.current_socio_id()) with check (public.is_admin_or_maestro() or socio_id = public.current_socio_id());
create policy reservas_delete_admin on public.reservas_mensuales for delete to authenticated using (public.is_admin_or_maestro());

drop policy if exists socios_insert_auth on public.socios;
drop policy if exists socios_select_auth on public.socios;
drop policy if exists socios_update_auth on public.socios;
create policy socios_select_own_or_admin on public.socios for select to authenticated using (public.is_admin_or_maestro() or id = public.current_socio_id());
create policy socios_insert_admin on public.socios for insert to authenticated with check (public.is_admin_or_maestro());
create policy socios_update_own_or_admin on public.socios for update to authenticated using (public.is_admin_or_maestro() or id = public.current_socio_id()) with check (public.is_admin_or_maestro() or id = public.current_socio_id());

drop policy if exists solicitudes_insert_all on public.solicitudes_membresia;
drop policy if exists solicitudes_select_auth on public.solicitudes_membresia;
drop policy if exists solicitudes_update_auth on public.solicitudes_membresia;
create policy solicitudes_insert_public on public.solicitudes_membresia for insert to anon, authenticated with check (true);
create policy solicitudes_admin_select on public.solicitudes_membresia for select to authenticated using (public.is_admin_or_maestro());
create policy solicitudes_admin_update on public.solicitudes_membresia for update to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists logs_insert_all on public.logs_actividad;
drop policy if exists logs_select_auth on public.logs_actividad;
create policy logs_insert_authenticated on public.logs_actividad for insert to authenticated with check (true);
create policy logs_select_admin on public.logs_actividad for select to authenticated using (public.is_admin_or_maestro());

drop policy if exists notificaciones_admin_select on public.notificaciones_programadas;
create policy notificaciones_admin_select on public.notificaciones_programadas for select to authenticated using (public.is_admin_or_maestro());

drop policy if exists configuracion_admin_all on public.configuracion;
create policy configuracion_admin_all on public.configuracion for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists documentos_socios_admin_all on public.documentos_socios;
drop policy if exists documentos_socios_select_own on public.documentos_socios;
create policy documentos_socios_admin_all on public.documentos_socios for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());
create policy documentos_socios_select_own on public.documentos_socios for select to authenticated using (socio_id = public.current_socio_id());

drop policy if exists lotes_cosecha_admin_all on public.lotes_cosecha;
create policy lotes_cosecha_admin_all on public.lotes_cosecha for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists sorteos_admin_all on public.sorteos;
drop policy if exists sorteos_select_auth on public.sorteos;
create policy sorteos_select_auth on public.sorteos for select to authenticated using (true);
create policy sorteos_admin_all on public.sorteos for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

drop policy if exists sorteos_ganadores_admin_all on public.sorteos_ganadores;
drop policy if exists sorteos_ganadores_select_own on public.sorteos_ganadores;
create policy sorteos_ganadores_admin_all on public.sorteos_ganadores for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());
create policy sorteos_ganadores_select_own on public.sorteos_ganadores for select to authenticated using (socio_id = public.current_socio_id());

drop policy if exists sorteos_participantes_admin_all on public.sorteos_participantes;
drop policy if exists sorteos_participantes_own on public.sorteos_participantes;
create policy sorteos_participantes_admin_all on public.sorteos_participantes for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());
create policy sorteos_participantes_own on public.sorteos_participantes for all to authenticated using (socio_id = public.current_socio_id()) with check (socio_id = public.current_socio_id());

drop policy if exists whatsapp_templates_admin_all on public.whatsapp_templates;
create policy whatsapp_templates_admin_all on public.whatsapp_templates for all to authenticated using (public.is_admin_or_maestro()) with check (public.is_admin_or_maestro());

alter table public.notificaciones_programadas
    drop constraint if exists notificaciones_mensaje_length;

alter table public.notificaciones_programadas
    add constraint notificaciones_mensaje_length
    check (char_length(coalesce(mensaje, '')) <= 4096) not valid;

alter table public.telegram_mensajes_entrantes
    drop constraint if exists telegram_inbound_text_length;

alter table public.telegram_mensajes_entrantes
    add constraint telegram_inbound_text_length
    check (char_length(coalesce(text, '')) <= 4096) not valid;

alter table public.notificaciones_programadas validate constraint notificaciones_mensaje_length;
alter table public.telegram_mensajes_entrantes validate constraint telegram_inbound_text_length;

commit;
