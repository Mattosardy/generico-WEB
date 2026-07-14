-- Resolve Supabase "RLS disabled in public" findings without changing data.
-- This migration only enables RLS and adds minimal explicit policies for tables
-- that were created in public without row level security in earlier migrations.

-- Administrative/configuration table. No anonymous access.
alter table if exists public.configuracion enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'configuracion'
          and policyname = 'configuracion_admin_all'
    ) then
        create policy configuracion_admin_all
        on public.configuracion
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;
end $$;

comment on table public.configuracion is
'RLS enabled. Administrative configuration: anon is blocked; authenticated admins can manage rows.';

-- Member documents can contain sensitive files and verification data.
alter table if exists public.documentos_socios enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'documentos_socios'
          and policyname = 'documentos_socios_admin_all'
    ) then
        create policy documentos_socios_admin_all
        on public.documentos_socios
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'documentos_socios'
          and policyname = 'documentos_socios_select_own'
    ) then
        create policy documentos_socios_select_own
        on public.documentos_socios
        for select
        to authenticated
        using (socio_id = public.current_socio_id());
    end if;
end $$;

comment on table public.documentos_socios is
'RLS enabled. Sensitive member documents: anon is blocked; members can read their own rows; admins can manage rows.';

-- Harvest/lab batch data is operational inventory. Keep it non-public unless a
-- future product flow requires a narrower read policy.
alter table if exists public.lotes_cosecha enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'lotes_cosecha'
          and policyname = 'lotes_cosecha_admin_all'
    ) then
        create policy lotes_cosecha_admin_all
        on public.lotes_cosecha
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;
end $$;

comment on table public.lotes_cosecha is
'RLS enabled. Operational batch/inventory data: anon is blocked; admins can manage rows.';

-- Raffles are displayed as public content, but writes stay administrative.
alter table if exists public.sorteos enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos'
          and policyname = 'sorteos_select_public_active'
    ) then
        create policy sorteos_select_public_active
        on public.sorteos
        for select
        to anon, authenticated
        using (estado = 'activo');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos'
          and policyname = 'sorteos_admin_all'
    ) then
        create policy sorteos_admin_all
        on public.sorteos
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;
end $$;

comment on table public.sorteos is
'RLS enabled. Active raffles are public read-only content; admins can manage rows.';

-- Winner rows reference socios, so they are not anonymous public data.
alter table if exists public.sorteos_ganadores enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos_ganadores'
          and policyname = 'sorteos_ganadores_admin_all'
    ) then
        create policy sorteos_ganadores_admin_all
        on public.sorteos_ganadores
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos_ganadores'
          and policyname = 'sorteos_ganadores_select_own'
    ) then
        create policy sorteos_ganadores_select_own
        on public.sorteos_ganadores
        for select
        to authenticated
        using (socio_id = public.current_socio_id());
    end if;
end $$;

comment on table public.sorteos_ganadores is
'RLS enabled. Winner rows are blocked for anon; admins can manage rows and members can read their own winner rows.';

-- Participation rows reference socios, so they are member/admin only.
alter table if exists public.sorteos_participantes enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos_participantes'
          and policyname = 'sorteos_participantes_admin_all'
    ) then
        create policy sorteos_participantes_admin_all
        on public.sorteos_participantes
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'sorteos_participantes'
          and policyname = 'sorteos_participantes_select_own'
    ) then
        create policy sorteos_participantes_select_own
        on public.sorteos_participantes
        for select
        to authenticated
        using (socio_id = public.current_socio_id());
    end if;
end $$;

comment on table public.sorteos_participantes is
'RLS enabled. Participation rows are blocked for anon; admins can manage rows and members can read their own participation rows.';

-- WhatsApp templates are operational messaging configuration.
alter table if exists public.whatsapp_templates enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'whatsapp_templates'
          and policyname = 'whatsapp_templates_admin_all'
    ) then
        create policy whatsapp_templates_admin_all
        on public.whatsapp_templates
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;
end $$;

comment on table public.whatsapp_templates is
'RLS enabled. Messaging templates are blocked for anon; admins can manage rows.';

-- Verified devices are sensitive authentication metadata.
alter table if exists public.socio_dispositivos_verificados enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'socio_dispositivos_verificados'
          and policyname = 'socio_dispositivos_verificados_admin_all'
    ) then
        create policy socio_dispositivos_verificados_admin_all
        on public.socio_dispositivos_verificados
        for all
        to authenticated
        using (public.current_user_is_admin())
        with check (public.current_user_is_admin());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'socio_dispositivos_verificados'
          and policyname = 'socio_dispositivos_verificados_select_own'
    ) then
        create policy socio_dispositivos_verificados_select_own
        on public.socio_dispositivos_verificados
        for select
        to authenticated
        using (socio_id = public.current_socio_id());
    end if;
end $$;

comment on table public.socio_dispositivos_verificados is
'RLS enabled. Verified-device metadata is blocked for anon; admins can manage rows and members can read their own devices.';
