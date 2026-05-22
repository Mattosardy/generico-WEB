--
-- PostgreSQL database dump
--

\restrict lIgSUCNeaeKub3SwcjFfrt9rIGj6THfUxUbaH527eh9fjhDOpMq5qPUch3NRaZb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- import-safe: public schema already exists in Supabase; original: CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: claim_pending_telegram_notifications(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_pending_telegram_notifications(p_limit integer DEFAULT 50) RETURNS TABLE(notification_id uuid, socio_id uuid, chat_id text, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    return query
    with pending as (
        select
            np.id,
            np.socio_id,
            s.telegram_chat_id,
            np.mensaje
        from public.notificaciones_programadas np
        join public.socios s on s.id = np.socio_id
        where np.estado = 'pendiente'
          and np.canal = 'telegram'
          and np.fecha_programada <= timezone('utc'::text, now())
          and s.telegram_enabled is true
          and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
        order by np.fecha_programada asc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        for update skip locked
    ),
    updated as (
        update public.notificaciones_programadas np
        set
            estado = 'procesando',
            provider = 'telegram',
            error_detalle = null,
            updated_at = timezone('utc'::text, now())
        from pending p
        where np.id = p.id
        returning np.id, np.socio_id, p.telegram_chat_id, np.mensaje
    )
    select
        u.id,
        u.socio_id,
        u.telegram_chat_id,
        u.mensaje
    from updated u;
end;
$$;


--
-- Name: configuracion_entero(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.configuracion_entero(p_clave text, p_default integer) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $_$
    select coalesce(
        (
            select valor::integer
            from public.configuracion_sistema
            where clave = p_clave
              and valor ~ '^[0-9]+$'
            limit 1
        ),
        p_default
    );
$_$;


--
-- Name: create_membership_request_with_telegram(text, text, text, text, text, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_membership_request_with_telegram(p_nombre text, p_apellido text, p_cedula text, p_telefono text, p_email text, p_mensaje text, p_code text, p_expires_at timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    solicitud_id uuid;
begin
    if nullif(trim(coalesce(p_nombre, '')), '') is null then
        raise exception 'El nombre es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_apellido, '')), '') is null then
        raise exception 'El apellido es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_cedula, '')), '') is null then
        raise exception 'La cedula es obligatoria.';
    end if;
    if nullif(trim(coalesce(p_telefono, '')), '') is null then
        raise exception 'El telefono es obligatorio.';
    end if;
    if nullif(trim(coalesce(p_code, '')), '') is null or p_expires_at <= timezone('utc'::text, now()) then
        raise exception 'Codigo de Telegram invalido.';
    end if;

    insert into public.solicitudes_membresia (
        nombre,
        apellido,
        cedula,
        telefono,
        email,
        mensaje,
        estado,
        telegram_link_code,
        telegram_link_code_expires_at
    )
    values (
        trim(p_nombre),
        trim(p_apellido),
        trim(p_cedula),
        trim(p_telefono),
        nullif(trim(coalesce(p_email, '')), ''),
        nullif(trim(coalesce(p_mensaje, '')), ''),
        'pendiente',
        p_code,
        p_expires_at
    )
    returning id into solicitud_id;

    return jsonb_build_object('id', solicitud_id, 'code', p_code, 'expires_at', p_expires_at);
end;
$$;


--
-- Name: current_socio_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_socio_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select s.id
    from public.socios s
    where s.auth_user_id = auth.uid()
       or lower(s.email) = lower(auth.jwt() ->> 'email')
    order by case when s.auth_user_id = auth.uid() then 0 else 1 end
    limit 1
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select coalesce(s.rol, 'socio')
    from public.socios s
    where s.id = public.current_socio_id()
    limit 1
$$;


--
-- Name: es_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM socios 
        WHERE email = auth.jwt()->>'email' 
        AND rol IN ('admin', 'maestro')
    );
$$;


--
-- Name: es_maestro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_maestro() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM socios 
        WHERE email = auth.jwt()->>'email' 
        AND rol = 'maestro'
    );
$$;


--
-- Name: fecha_entrega_configurada(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fecha_entrega_configurada(p_clave text, p_target_date date, p_fallback date) RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $_$
    select coalesce(
        (
            select valor::date
            from public.configuracion_sistema
            where clave =
                'entrega_' ||
                to_char(date_trunc('month', p_target_date), 'YYYY_MM') ||
                case when p_clave = 'fecha_entrega_primer' then '_1_fecha' else '_2_fecha' end
              and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              and date_trunc('month', valor::date) = date_trunc('month', p_target_date)
            limit 1
        ),
        (
            select valor::date
            from public.configuracion_sistema
            where clave = p_clave
              and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              and date_trunc('month', valor::date) = date_trunc('month', p_target_date)
            limit 1
        ),
        p_fallback
    );
$_$;


--
-- Name: FUNCTION fecha_entrega_configurada(p_clave text, p_target_date date, p_fallback date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fecha_entrega_configurada(p_clave text, p_target_date date, p_fallback date) IS 'Devuelve una fecha de entrega configurada para el mes objetivo o una fecha calculada por defecto.';


--
-- Name: get_login_email_by_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_login_email_by_phone(p_phone text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: FUNCTION get_login_email_by_phone(p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_login_email_by_phone(p_phone text) IS 'Resuelve el email tecnico de Auth a partir del telefono del socio para permitir login visible por telefono sin activar Phone Auth/SMS.';


--
-- Name: get_socio_id_from_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_socio_id_from_email() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT id FROM socios WHERE email = auth.jwt()->>'email' LIMIT 1;
$$;


--
-- Name: get_socio_id_from_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_socio_id_from_email(user_email text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT id FROM socios WHERE email = user_email LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
    insert into public.socios (
        auth_user_id,
        email,
        nombre,
        apellido,
        cedula,
        telefono,
        estado,
        rol
    )
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data ->> 'apellido', ''),
        coalesce(nullif(new.raw_user_meta_data ->> 'cedula', ''), 'SIN-CEDULA-' || left(new.id::text, 8)),
        coalesce(nullif(new.raw_user_meta_data ->> 'telefono', ''), new.phone),
        'activo',
        coalesce(nullif(new.raw_user_meta_data ->> 'rol', ''), 'socio')
    )
    on conflict (cedula) do update
    set
        auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        nombre = excluded.nombre,
        apellido = excluded.apellido,
        telefono = coalesce(excluded.telefono, public.socios.telefono),
        estado = 'activo',
        rol = coalesce(public.socios.rol, excluded.rol);

    return new;
end;
$$;


--
-- Name: is_admin_or_maestro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_maestro() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select coalesce(public.current_user_role(), '') in ('admin', 'maestro')
$$;


--
-- Name: link_telegram_by_code(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_telegram_by_code(p_code text, p_chat_id text, p_username text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    target_socio_id uuid;
    target_solicitud_id uuid;
begin
    if nullif(trim(coalesce(p_code, '')), '') is null then
        return jsonb_build_object('linked', false, 'reason', 'invalid_code');
    end if;

    if nullif(trim(coalesce(p_chat_id, '')), '') is null then
        return jsonb_build_object('linked', false, 'reason', 'missing_chat_id');
    end if;

    if exists (
        select 1
        from public.socios
        where telegram_chat_id = p_chat_id
          and telegram_enabled is true
    ) then
        return jsonb_build_object('linked', false, 'reason', 'chat_already_linked');
    end if;

    select id
      into target_socio_id
    from public.socios
    where telegram_link_code = p_code
      and telegram_link_code_expires_at > timezone('utc'::text, now())
    limit 1;

    if target_socio_id is not null then
        update public.socios
        set
            telegram_chat_id = p_chat_id,
            telegram_username = nullif(trim(coalesce(p_username, '')), ''),
            telegram_enabled = true,
            telegram_linked_at = timezone('utc'::text, now()),
            telegram_link_code = null,
            telegram_link_code_expires_at = null
        where id = target_socio_id;

        return jsonb_build_object('linked', true, 'target', 'socio', 'id', target_socio_id);
    end if;

    select id
      into target_solicitud_id
    from public.solicitudes_membresia
    where telegram_link_code = p_code
      and telegram_link_code_expires_at > timezone('utc'::text, now())
    limit 1;

    if target_solicitud_id is not null then
        update public.solicitudes_membresia
        set
            telegram_chat_id = p_chat_id,
            telegram_username = nullif(trim(coalesce(p_username, '')), ''),
            telegram_enabled = true,
            telegram_linked_at = timezone('utc'::text, now()),
            telegram_link_code = null,
            telegram_link_code_expires_at = null
        where id = target_solicitud_id;

        return jsonb_build_object('linked', true, 'target', 'solicitud', 'id', target_solicitud_id);
    end if;

    return jsonb_build_object('linked', false, 'reason', 'invalid_or_expired_code');
end;
$$;


--
-- Name: mark_telegram_notification_error(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_telegram_notification_error(p_notification_id uuid, p_error text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    update public.notificaciones_programadas
    set
        estado = 'error',
        provider = 'telegram',
        error_detalle = left(coalesce(p_error, 'Error desconocido'), 500),
        updated_at = timezone('utc'::text, now())
    where id = p_notification_id;
end;
$$;


--
-- Name: mark_telegram_notification_sent(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_telegram_notification_sent(p_notification_id uuid, p_provider_message_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    update public.notificaciones_programadas
    set
        estado = 'enviado',
        provider = 'telegram',
        provider_message_sid = p_provider_message_id,
        fecha_envio = timezone('utc'::text, now()),
        error_detalle = null,
        updated_at = timezone('utc'::text, now())
    where id = p_notification_id;
end;
$$;


--
-- Name: normalize_uy_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_uy_phone(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
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


--
-- Name: FUNCTION normalize_uy_phone(input text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_uy_phone(input text) IS 'Normaliza telefonos Uruguay a formato E.164 para Supabase Auth.';


--
-- Name: primer_jueves_del_mes(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.primer_jueves_del_mes(target_date date) RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$
    with month_start as (
        select date_trunc('month', target_date)::date as first_day
    )
    select (first_day + (((4 - extract(dow from first_day)::int) + 7) % 7))::date
    from month_start;
$$;


--
-- Name: queue_monthly_telegram_reservation_reminders(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_monthly_telegram_reservation_reminders(target_date date DEFAULT (timezone('America/Montevideo'::text, now()))::date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
    scheduled_count integer := 0;
    inserted_count integer := 0;
    entrega record;
begin
    for entrega in
        with meses as (
            select
                date_trunc('month', target_date)::date as mes,
                to_char(date_trunc('month', target_date), 'YYYY_MM') as mes_clave
            union
            select
                date_trunc('month', target_date + interval '1 month')::date as mes,
                to_char(date_trunc('month', target_date + interval '1 month'), 'YYYY_MM') as mes_clave
        ),
        slots as (
            select
                1::integer as indice,
                'primer'::text as clave,
                'Primera entrega'::text as etiqueta,
                'recordatorio_primer_jueves'::text as tipo_reserva,
                'recordatorio_entrega_primer'::text as tipo_entrega,
                'primer_jueves'::text as tipo_reserva_db
            union all
            select
                2::integer,
                'ultimo'::text,
                'Ultima entrega'::text,
                'recordatorio_ultimo_jueves'::text,
                'recordatorio_entrega_ultimo'::text,
                'ultimo_jueves'::text
        ),
        configuradas as (
            select
                s.indice,
                s.clave,
                s.etiqueta,
                s.tipo_reserva,
                s.tipo_entrega,
                s.tipo_reserva_db,
                f.valor::date as fecha_entrega,
                case
                    when h.valor ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then h.valor::time
                    else time '18:00'
                end as hora_entrega,
                coalesce(nullif(trim(m.valor), ''), '') as mensaje,
                coalesce(nullif(trim(l.valor), ''), nullif(trim(ld.valor), ''), 'Lugar de Siempre') as lugar
            from meses me
            cross join slots s
            join public.configuracion_sistema f
              on f.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_fecha'
             and f.valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
             and date_trunc('month', f.valor::date) = me.mes
            left join public.configuracion_sistema h
              on h.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_hora'
            left join public.configuracion_sistema m
              on m.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_mensaje'
            left join public.configuracion_sistema l
              on l.clave = 'entrega_' || me.mes_clave || '_' || s.indice || '_lugar'
            left join public.configuracion_sistema ld
              on ld.clave = 'lugar_entrega'
        )
        select
            *,
            (fecha_entrega + hora_entrega) as entrega_local_at,
            ((fecha_entrega + hora_entrega) at time zone 'America/Montevideo') as entrega_at,
            (fecha_entrega + hora_entrega - interval '48 hours') as aviso_reserva_local_at,
            ((fecha_entrega + hora_entrega - interval '48 hours') at time zone 'America/Montevideo') as aviso_reserva_at,
            (fecha_entrega + hora_entrega - interval '24 hours') as aviso_entrega_local_at,
            ((fecha_entrega + hora_entrega - interval '24 hours') at time zone 'America/Montevideo') as aviso_entrega_at
        from configuradas
    loop
        if now() >= entrega.aviso_reserva_at and now() < entrega.entrega_at then
            insert into public.notificaciones_programadas (
                socio_id,
                tipo,
                mensaje,
                fecha_programada,
                estado,
                canal,
                provider,
                metadata
            )
            select
                s.id,
                entrega.tipo_reserva,
                'Cururu Club' || chr(10) ||
                'Tenes hasta 48 horas antes de la fecha de entrega para realizar tu reserva.' || chr(10) ||
                'Retiro: ' || lower(entrega.etiqueta) || ', ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || ' de ' ||
                to_char(entrega.hora_entrega, 'HH24:MI') || ' a ' ||
                to_char(entrega.hora_entrega + interval '120 minutes', 'HH24:MI') || chr(10) ||
                'Lugar: ' || entrega.lugar || chr(10) ||
                'Tenes tiempo hasta ' || to_char(entrega.aviso_reserva_local_at, 'DD/MM/YYYY HH24:MI') || ' para confirmar tu retiro.',
                entrega.aviso_reserva_at,
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'delivery_time', to_char(entrega.hora_entrega, 'HH24:MI'),
                    'deadline_at', entrega.aviso_reserva_at,
                    'template_key', entrega.tipo_reserva
                )
            from public.socios s
            where s.estado = 'activo'
              and s.telegram_enabled is true
              and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
              and not exists (
                  select 1
                  from public.notificaciones_programadas np
                  where np.socio_id = s.id
                    and np.tipo = entrega.tipo_reserva
                    and np.canal = 'telegram'
                    and np.metadata ->> 'delivery_slot' = entrega.clave
                    and np.metadata ->> 'delivery_date' = entrega.fecha_entrega::text
              );

            get diagnostics inserted_count = row_count;
            scheduled_count := scheduled_count + inserted_count;
        end if;

        if now() >= entrega.aviso_entrega_at and now() < entrega.entrega_at then
            insert into public.notificaciones_programadas (
                socio_id,
                tipo,
                mensaje,
                fecha_programada,
                estado,
                canal,
                provider,
                metadata
            )
            select
                r.socio_id,
                entrega.tipo_entrega,
                'Cururu Club' || chr(10) ||
                coalesce(nullif(trim(entrega.mensaje), ''), 'Recordatorio de entrega.') || chr(10) ||
                'Tu retiro esta coordinado para ' || to_char(entrega.fecha_entrega, 'DD/MM/YYYY') || ' de ' ||
                to_char(entrega.hora_entrega, 'HH24:MI') || ' a ' ||
                to_char(entrega.hora_entrega + interval '120 minutes', 'HH24:MI') || chr(10) ||
                'Lugar: ' || entrega.lugar || chr(10) ||
                'Cantidad: ' || coalesce(r.cantidad_gramos::text, '-') || 'g' ||
                case when nullif(trim(coalesce(r.producto_nombre, '')), '') is not null
                    then chr(10) || 'Variedad: ' || r.producto_nombre
                    else ''
                end,
                entrega.aviso_entrega_at,
                'pendiente',
                'telegram',
                'telegram',
                jsonb_build_object(
                    'target_month', to_char(entrega.fecha_entrega, 'YYYY-MM'),
                    'delivery_slot', entrega.clave,
                    'delivery_date', entrega.fecha_entrega,
                    'delivery_time', to_char(entrega.hora_entrega, 'HH24:MI'),
                    'reserva_id', r.id,
                    'template_key', entrega.tipo_entrega
                )
            from public.reservas_mensuales r
            join public.socios s on s.id = r.socio_id
            where r.fecha_retiro::date = entrega.fecha_entrega
              and (nullif(trim(coalesce(r.tipo_entrega, '')), '') is null or r.tipo_entrega = entrega.tipo_reserva_db)
              and coalesce(r.estado, 'pendiente') not in ('cancelado', 'entregado', 'retirado')
              and s.estado = 'activo'
              and s.telegram_enabled is true
              and nullif(trim(coalesce(s.telegram_chat_id, '')), '') is not null
              and not exists (
                  select 1
                  from public.notificaciones_programadas np
                  where np.socio_id = r.socio_id
                    and np.tipo = entrega.tipo_entrega
                    and np.canal = 'telegram'
                    and np.metadata ->> 'reserva_id' = r.id::text
              );

            get diagnostics inserted_count = row_count;
            scheduled_count := scheduled_count + inserted_count;
        end if;
    end loop;

    return scheduled_count;
end;
$_$;


--
-- Name: FUNCTION queue_monthly_telegram_reservation_reminders(target_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.queue_monthly_telegram_reservation_reminders(target_date date) IS 'Genera avisos Telegram automaticos solo para fechas de entrega configuradas por el admin y usando la hora visible para el limite de 48 horas.';


--
-- Name: queue_monthly_whatsapp_reminders(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_monthly_whatsapp_reminders(target_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    scheduled_count integer := 0;
    inserted_count integer := 0;
    ultimo_jueves date := public.ultimo_jueves_del_mes(target_date);
    primer_jueves date := public.primer_jueves_del_mes(target_date);
    fecha_recordatorio_ultimo date := (public.ultimo_jueves_del_mes(target_date) - interval '7 days')::date;
    fecha_recordatorio_primer date := (public.primer_jueves_del_mes(target_date) - interval '2 days')::date;
begin
    if target_date = fecha_recordatorio_ultimo then
        insert into public.notificaciones_programadas (
            socio_id,
            tipo,
            mensaje,
            fecha_programada,
            estado,
            canal,
            provider,
            metadata
        )
        select
            s.id,
            'recordatorio_ultimo_jueves',
            'Tenes tiempo hasta 72 hs antes del ultimo jueves del mes para confirmar tu retiro.',
            timezone('utc'::text, now()),
            'pendiente',
            'whatsapp',
            'twilio',
            jsonb_build_object(
                'target_month', to_char(target_date, 'YYYY-MM'),
                'deadline_date', ultimo_jueves - interval '72 hours',
                'template_key', 'recordatorio_ultimo_jueves'
            )
        from public.socios s
        where s.estado = 'activo'
          and coalesce(s.notificacion_whatsapp, true) = true
          and coalesce(nullif(trim(s.telefono), ''), '') <> ''
          and not exists (
              select 1
              from public.notificaciones_programadas np
              where np.socio_id = s.id
                and np.tipo = 'recordatorio_ultimo_jueves'
                and np.metadata ->> 'target_month' = to_char(target_date, 'YYYY-MM')
          );

        get diagnostics inserted_count = row_count;
        scheduled_count := scheduled_count + inserted_count;
    end if;

    if target_date = fecha_recordatorio_primer then
        insert into public.notificaciones_programadas (
            socio_id,
            tipo,
            mensaje,
            fecha_programada,
            estado,
            canal,
            provider,
            metadata
        )
        select
            s.id,
            'recordatorio_primer_jueves',
            'Tenes tiempo hasta 48 hs antes del primer jueves del mes para confirmar tu retiro.',
            timezone('utc'::text, now()),
            'pendiente',
            'whatsapp',
            'twilio',
            jsonb_build_object(
                'target_month', to_char(target_date, 'YYYY-MM'),
                'deadline_date', primer_jueves - interval '48 hours',
                'template_key', 'recordatorio_primer_jueves'
            )
        from public.socios s
        where s.estado = 'activo'
          and coalesce(s.notificacion_whatsapp, true) = true
          and coalesce(nullif(trim(s.telefono), ''), '') <> ''
          and not exists (
              select 1
              from public.notificaciones_programadas np
              where np.socio_id = s.id
                and np.tipo = 'recordatorio_primer_jueves'
                and np.metadata ->> 'target_month' = to_char(target_date, 'YYYY-MM')
          );

        get diagnostics inserted_count = row_count;
        scheduled_count := scheduled_count + inserted_count;
    end if;

    return scheduled_count;
end;
$$;


--
-- Name: FUNCTION queue_monthly_whatsapp_reminders(target_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.queue_monthly_whatsapp_reminders(target_date date) IS 'Genera recordatorios WhatsApp para socios activos sin duplicar mensajes del mismo mes.';


--
-- Name: queue_telegram_notification(uuid, text, text, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_telegram_notification(p_socio_id uuid, p_tipo text, p_mensaje text, p_fecha_programada timestamp with time zone DEFAULT timezone('utc'::text, now()), p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    caller_socio public.socios%rowtype;
    notification_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesion para enviar notificaciones.';
    end if;

    select *
      into caller_socio
    from public.socios
    where auth_user_id = auth.uid()
       or lower(email) = lower(auth.jwt() ->> 'email')
    limit 1;

    if caller_socio.id is null then
        raise exception 'No se encontro el socio del usuario actual.';
    end if;

    if caller_socio.id <> p_socio_id and coalesce(caller_socio.rol, 'socio') not in ('admin', 'maestro') then
        raise exception 'No tiene permisos para enviar esta notificacion.';
    end if;

    insert into public.notificaciones_programadas (
        socio_id,
        tipo,
        mensaje,
        fecha_programada,
        estado,
        canal,
        provider,
        metadata
    )
    values (
        p_socio_id,
        coalesce(nullif(p_tipo, ''), 'manual'),
        p_mensaje,
        coalesce(p_fecha_programada, timezone('utc'::text, now())),
        'pendiente',
        'telegram',
        'telegram',
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into notification_id;

    return notification_id;
end;
$$;


--
-- Name: FUNCTION queue_telegram_notification(p_socio_id uuid, p_tipo text, p_mensaje text, p_fecha_programada timestamp with time zone, p_metadata jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.queue_telegram_notification(p_socio_id uuid, p_tipo text, p_mensaje text, p_fecha_programada timestamp with time zone, p_metadata jsonb) IS 'Encola una notificacion Telegram respetando permisos: socio propio, admin o maestro.';


--
-- Name: set_telegram_link_code(uuid, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_telegram_link_code(p_socio_id uuid, p_code text, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesion para vincular Telegram.';
    end if;

    update public.socios
    set
        telegram_link_code = p_code,
        telegram_link_code_expires_at = p_expires_at
    where id = p_socio_id
      and (
        auth_user_id = auth.uid()
        or lower(email) = lower(auth.jwt() ->> 'email')
      );

    if not found then
        raise exception 'No se encontro un socio vinculado al usuario actual.';
    end if;
end;
$$;


--
-- Name: FUNCTION set_telegram_link_code(p_socio_id uuid, p_code text, p_expires_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_telegram_link_code(p_socio_id uuid, p_code text, p_expires_at timestamp with time zone) IS 'Permite al socio autenticado generar un codigo temporal de vinculacion Telegram para su propia cuenta.';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;


--
-- Name: ultimo_jueves_del_mes(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ultimo_jueves_del_mes(target_date date) RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$
    with month_end as (
        select (date_trunc('month', target_date) + interval '1 month - 1 day')::date as last_day
    )
    select (last_day - (((extract(dow from last_day)::int - 4) + 7) % 7))::date
    from month_end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actividades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actividades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    fecha date NOT NULL,
    hora time without time zone,
    ubicacion text,
    imagen_url text,
    cupo_maximo integer,
    cupos_disponibles integer,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tipo text DEFAULT 'actividad'::text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: calificaciones_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calificaciones_productos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    producto_id uuid,
    socio_id uuid,
    puntuacion integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT calificaciones_productos_puntuacion_check CHECK (((puntuacion >= 1) AND (puntuacion <= 5)))
);


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clave text NOT NULL,
    valor text NOT NULL,
    descripcion text,
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: configuracion_sistema; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_sistema (
    id bigint NOT NULL,
    clave text NOT NULL,
    valor text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: configuracion_sistema_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.configuracion_sistema_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.configuracion_sistema_id_seq OWNED BY public.configuracion_sistema.id;


--
-- Name: configuracion_whatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_whatsapp (
    id bigint NOT NULL,
    phone_number_id text,
    access_token text,
    business_account_id text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: configuracion_whatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.configuracion_whatsapp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_whatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.configuracion_whatsapp_id_seq OWNED BY public.configuracion_whatsapp.id;


--
-- Name: documentos_socios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_socios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socio_id uuid,
    tipo text NOT NULL,
    archivo_url text NOT NULL,
    fecha_vencimiento date,
    verificado_por uuid,
    fecha_verificacion timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: logs_actividad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_actividad (
    id bigint NOT NULL,
    usuario_id uuid,
    usuario_email text,
    rol text,
    accion text NOT NULL,
    tabla_afectada text,
    registro_id text,
    detalles jsonb,
    fecha timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: logs_actividad_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_actividad_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_actividad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_actividad_id_seq OWNED BY public.logs_actividad.id;


--
-- Name: lotes_cosecha; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lotes_cosecha (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_lote text NOT NULL,
    cepa text NOT NULL,
    fecha_cosecha date NOT NULL,
    cantidad_gramos_total integer NOT NULL,
    cantidad_gramos_disponible integer NOT NULL,
    thc_porcentaje numeric(5,2),
    cbd_porcentaje numeric(5,2),
    fecha_analisis date,
    archivo_analisis_url text,
    estado text DEFAULT 'disponible'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: noticias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.noticias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    contenido text NOT NULL,
    imagen_url text,
    autor text,
    fecha_publicacion timestamp without time zone DEFAULT now(),
    destacado boolean DEFAULT false,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: notificaciones_programadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones_programadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socio_id uuid,
    tipo text NOT NULL,
    mensaje text NOT NULL,
    fecha_programada timestamp without time zone NOT NULL,
    fecha_envio timestamp without time zone,
    estado text DEFAULT 'pendiente'::text,
    canal text DEFAULT 'whatsapp'::text,
    created_at timestamp without time zone DEFAULT now(),
    provider text,
    provider_message_sid text,
    error_detalle text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT notificaciones_mensaje_length CHECK ((char_length(COALESCE(mensaje, ''::text)) <= 4096))
);


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    imagen_url text,
    cepa text,
    thc_porcentaje numeric(5,2),
    cbd_porcentaje numeric(5,2),
    fecha_cosecha date,
    lote_id uuid,
    disponible boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    activo boolean DEFAULT true,
    precio_por_10g numeric(10,2) DEFAULT 1600,
    tipo_cultivo text DEFAULT 'invernaculo'::text,
    indica_sativa text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT productos_tipo_cultivo_check CHECK ((tipo_cultivo = ANY (ARRAY['invernaculo'::text, 'exterior'::text])))
);


--
-- Name: productos_imagenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_imagenes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    producto_id uuid,
    imagen_url text NOT NULL,
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: reservas_mensuales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_mensuales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socio_id uuid,
    mes integer NOT NULL,
    "aÃ±o" integer NOT NULL,
    cantidad_gramos integer NOT NULL,
    fecha_retiro date NOT NULL,
    tipo_entrega text NOT NULL,
    fecha_confirmacion timestamp without time zone,
    estado text DEFAULT 'pendiente'::text,
    lote_id uuid,
    peso_real_entregado integer,
    entregado_por uuid,
    fecha_entrega_real timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    producto_id uuid,
    producto_nombre text,
    admin_confirmed_at timestamp with time zone,
    delivery_confirmed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT reservas_mensuales_cantidad_gramos_check CHECK ((cantidad_gramos = ANY (ARRAY[20, 40])))
);


--
-- Name: COLUMN reservas_mensuales.producto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservas_mensuales.producto_id IS 'Variedad/producto pedido por el socio, cuando la reserva se crea desde una ficha de variedad.';


--
-- Name: COLUMN reservas_mensuales.producto_nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservas_mensuales.producto_nombre IS 'Nombre de variedad congelado para reportes administrativos aunque el producto cambie de nombre.';


--
-- Name: socios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.socios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_socio integer,
    nombre text NOT NULL,
    apellido text NOT NULL,
    cedula text NOT NULL,
    telefono text NOT NULL,
    email text,
    fecha_nacimiento date,
    direccion text,
    fecha_ingreso date DEFAULT CURRENT_DATE,
    fecha_renovacion date,
    estado text DEFAULT 'pendiente'::text,
    activo boolean DEFAULT true,
    suspendido_hasta date,
    motivo_suspension text,
    notificacion_whatsapp boolean DEFAULT true,
    notificacion_email boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    rol text DEFAULT 'socio'::text,
    has_password boolean DEFAULT false,
    username text,
    telegram_chat_id text,
    telegram_username text,
    telegram_enabled boolean DEFAULT false NOT NULL,
    telegram_link_code text,
    telegram_link_code_expires_at timestamp with time zone,
    telegram_linked_at timestamp with time zone,
    auth_user_id uuid
);


--
-- Name: COLUMN socios.telegram_chat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socios.telegram_chat_id IS 'Chat ID privado de Telegram. Se guarda desde el worker al procesar /start CODIGO.';


--
-- Name: COLUMN socios.telegram_link_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socios.telegram_link_code IS 'Codigo temporal de vinculacion generado desde la web. Vence segun telegram_link_code_expires_at.';


--
-- Name: COLUMN socios.telegram_link_code_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socios.telegram_link_code_expires_at IS 'Vencimiento del codigo temporal de vinculacion de Telegram.';


--
-- Name: COLUMN socios.telegram_linked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socios.telegram_linked_at IS 'Fecha en que el Worker vinculo correctamente el chat de Telegram.';


--
-- Name: COLUMN socios.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socios.auth_user_id IS 'Identidad principal del socio en Supabase Auth. Reemplaza gradualmente la dependencia operativa del email.';


--
-- Name: solicitudes_membresia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_membresia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    cedula text NOT NULL,
    telefono text NOT NULL,
    email text,
    mensaje text,
    estado text DEFAULT 'pendiente'::text,
    fecha_solicitud timestamp without time zone DEFAULT now(),
    telegram_chat_id text,
    telegram_username text,
    telegram_enabled boolean DEFAULT false NOT NULL,
    telegram_link_code text,
    telegram_link_code_expires_at timestamp with time zone,
    telegram_linked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: sorteos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sorteos (
    id bigint NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    premio text NOT NULL,
    fecha_sorteo date NOT NULL,
    estado text DEFAULT 'activo'::text,
    ganador_id uuid,
    fecha_ganador timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    imagen_url text
);


--
-- Name: sorteos_ganadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sorteos_ganadores (
    id bigint NOT NULL,
    sorteo_id bigint,
    socio_id uuid,
    notificado boolean DEFAULT false,
    fecha_notificacion timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: sorteos_ganadores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sorteos_ganadores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sorteos_ganadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sorteos_ganadores_id_seq OWNED BY public.sorteos_ganadores.id;


--
-- Name: sorteos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sorteos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sorteos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sorteos_id_seq OWNED BY public.sorteos.id;


--
-- Name: sorteos_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sorteos_participantes (
    id bigint NOT NULL,
    sorteo_id bigint,
    socio_id uuid,
    participo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: sorteos_participantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sorteos_participantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sorteos_participantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sorteos_participantes_id_seq OWNED BY public.sorteos_participantes.id;


--
-- Name: telegram_mensajes_entrantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_mensajes_entrantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_update_id bigint,
    message_id bigint,
    socio_id uuid,
    chat_id text NOT NULL,
    telegram_user_id text,
    username text,
    first_name text,
    last_name text,
    display_name text,
    text text,
    message_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    raw_update jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT telegram_inbound_text_length CHECK ((char_length(COALESCE(text, ''::text)) <= 4096))
);


--
-- Name: TABLE telegram_mensajes_entrantes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.telegram_mensajes_entrantes IS 'Mensajes entrantes recibidos por el webhook de Telegram del worker Cururu.';


--
-- Name: COLUMN telegram_mensajes_entrantes.raw_update; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_mensajes_entrantes.raw_update IS 'Payload completo recibido desde Telegram para depuracion y trazabilidad.';


--
-- Name: whatsapp_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clave text NOT NULL,
    nombre_template text NOT NULL,
    idioma text DEFAULT 'es'::text NOT NULL,
    canal text DEFAULT 'whatsapp'::text NOT NULL,
    cuerpo text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: configuracion_sistema id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_sistema ALTER COLUMN id SET DEFAULT nextval('public.configuracion_sistema_id_seq'::regclass);


--
-- Name: configuracion_whatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_whatsapp ALTER COLUMN id SET DEFAULT nextval('public.configuracion_whatsapp_id_seq'::regclass);


--
-- Name: logs_actividad id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_actividad ALTER COLUMN id SET DEFAULT nextval('public.logs_actividad_id_seq'::regclass);


--
-- Name: sorteos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos ALTER COLUMN id SET DEFAULT nextval('public.sorteos_id_seq'::regclass);


--
-- Name: sorteos_ganadores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_ganadores ALTER COLUMN id SET DEFAULT nextval('public.sorteos_ganadores_id_seq'::regclass);


--
-- Name: sorteos_participantes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_participantes ALTER COLUMN id SET DEFAULT nextval('public.sorteos_participantes_id_seq'::regclass);


--
-- Name: actividades actividades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividades
    ADD CONSTRAINT actividades_pkey PRIMARY KEY (id);


--
-- Name: calificaciones_productos calificaciones_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_productos
    ADD CONSTRAINT calificaciones_productos_pkey PRIMARY KEY (id);


--
-- Name: calificaciones_productos calificaciones_productos_producto_id_socio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_productos
    ADD CONSTRAINT calificaciones_productos_producto_id_socio_id_key UNIQUE (producto_id, socio_id);


--
-- Name: configuracion configuracion_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: configuracion_sistema configuracion_sistema_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT configuracion_sistema_clave_key UNIQUE (clave);


--
-- Name: configuracion_sistema configuracion_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT configuracion_sistema_pkey PRIMARY KEY (clave);


--
-- Name: configuracion_whatsapp configuracion_whatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_whatsapp
    ADD CONSTRAINT configuracion_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: documentos_socios documentos_socios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_socios
    ADD CONSTRAINT documentos_socios_pkey PRIMARY KEY (id);


--
-- Name: logs_actividad logs_actividad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_actividad
    ADD CONSTRAINT logs_actividad_pkey PRIMARY KEY (id);


--
-- Name: lotes_cosecha lotes_cosecha_codigo_lote_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes_cosecha
    ADD CONSTRAINT lotes_cosecha_codigo_lote_key UNIQUE (codigo_lote);


--
-- Name: lotes_cosecha lotes_cosecha_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes_cosecha
    ADD CONSTRAINT lotes_cosecha_pkey PRIMARY KEY (id);


--
-- Name: noticias noticias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticias
    ADD CONSTRAINT noticias_pkey PRIMARY KEY (id);


--
-- Name: notificaciones_programadas notificaciones_programadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_programadas
    ADD CONSTRAINT notificaciones_programadas_pkey PRIMARY KEY (id);


--
-- Name: productos_imagenes productos_imagenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_imagenes
    ADD CONSTRAINT productos_imagenes_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: reservas_mensuales reservas_mensuales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_mensuales
    ADD CONSTRAINT reservas_mensuales_pkey PRIMARY KEY (id);


--
-- Name: socios socios_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_cedula_key UNIQUE (cedula);


--
-- Name: socios socios_numero_socio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_numero_socio_key UNIQUE (numero_socio);


--
-- Name: socios socios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_membresia solicitudes_membresia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_membresia
    ADD CONSTRAINT solicitudes_membresia_pkey PRIMARY KEY (id);


--
-- Name: sorteos_ganadores sorteos_ganadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_ganadores
    ADD CONSTRAINT sorteos_ganadores_pkey PRIMARY KEY (id);


--
-- Name: sorteos_participantes sorteos_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_participantes
    ADD CONSTRAINT sorteos_participantes_pkey PRIMARY KEY (id);


--
-- Name: sorteos_participantes sorteos_participantes_sorteo_id_socio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_participantes
    ADD CONSTRAINT sorteos_participantes_sorteo_id_socio_id_key UNIQUE (sorteo_id, socio_id);


--
-- Name: sorteos sorteos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos
    ADD CONSTRAINT sorteos_pkey PRIMARY KEY (id);


--
-- Name: telegram_mensajes_entrantes telegram_mensajes_entrantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_mensajes_entrantes
    ADD CONSTRAINT telegram_mensajes_entrantes_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_templates whatsapp_templates_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_clave_key UNIQUE (clave);


--
-- Name: whatsapp_templates whatsapp_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);


--
-- Name: idx_actividades_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actividades_fecha ON public.actividades USING btree (fecha);


--
-- Name: idx_logs_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_accion ON public.logs_actividad USING btree (accion);


--
-- Name: idx_logs_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_fecha ON public.logs_actividad USING btree (fecha DESC);


--
-- Name: idx_logs_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_usuario ON public.logs_actividad USING btree (usuario_id);


--
-- Name: idx_noticias_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noticias_fecha ON public.noticias USING btree (fecha_publicacion);


--
-- Name: idx_notificaciones_programadas_canal_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_programadas_canal_estado ON public.notificaciones_programadas USING btree (canal, estado);


--
-- Name: idx_notificaciones_programadas_estado_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_programadas_estado_fecha ON public.notificaciones_programadas USING btree (estado, fecha_programada);


--
-- Name: idx_notificaciones_programadas_telegram_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_programadas_telegram_pendientes ON public.notificaciones_programadas USING btree (estado, canal, fecha_programada) WHERE (canal = 'telegram'::text);


--
-- Name: idx_productos_imagenes_producto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_imagenes_producto_id ON public.productos_imagenes USING btree (producto_id);


--
-- Name: idx_reservas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_fecha ON public.reservas_mensuales USING btree (fecha_retiro);


--
-- Name: idx_reservas_mensuales_producto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_mensuales_producto_id ON public.reservas_mensuales USING btree (producto_id);


--
-- Name: idx_reservas_socio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_socio ON public.reservas_mensuales USING btree (socio_id);


--
-- Name: idx_reservas_socio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_socio_id ON public.reservas_mensuales USING btree (socio_id);


--
-- Name: idx_socios_auth_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_socios_auth_user_id_unique ON public.socios USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_socios_cedula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_socios_cedula ON public.socios USING btree (cedula);


--
-- Name: idx_socios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_socios_email ON public.socios USING btree (email);


--
-- Name: idx_socios_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_socios_estado ON public.socios USING btree (estado);


--
-- Name: idx_socios_telegram_chat_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_socios_telegram_chat_id_unique ON public.socios USING btree (telegram_chat_id) WHERE (telegram_chat_id IS NOT NULL);


--
-- Name: idx_socios_telegram_link_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_socios_telegram_link_code_unique ON public.socios USING btree (telegram_link_code) WHERE (telegram_link_code IS NOT NULL);


--
-- Name: idx_socios_telegram_link_code_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_socios_telegram_link_code_valid ON public.socios USING btree (telegram_link_code, telegram_link_code_expires_at) WHERE (telegram_link_code IS NOT NULL);


--
-- Name: idx_solicitudes_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_estado ON public.solicitudes_membresia USING btree (estado);


--
-- Name: idx_solicitudes_telegram_link_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_solicitudes_telegram_link_code_unique ON public.solicitudes_membresia USING btree (telegram_link_code) WHERE (telegram_link_code IS NOT NULL);


--
-- Name: idx_sorteos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sorteos_estado ON public.sorteos USING btree (estado);


--
-- Name: idx_sorteos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sorteos_fecha ON public.sorteos USING btree (fecha_sorteo);


--
-- Name: idx_sorteos_ganadores_sorteo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sorteos_ganadores_sorteo ON public.sorteos_ganadores USING btree (sorteo_id);


--
-- Name: idx_sorteos_participantes_socio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sorteos_participantes_socio ON public.sorteos_participantes USING btree (socio_id);


--
-- Name: idx_telegram_mensajes_entrantes_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_mensajes_entrantes_chat_id ON public.telegram_mensajes_entrantes USING btree (chat_id);


--
-- Name: idx_telegram_mensajes_entrantes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_mensajes_entrantes_created_at ON public.telegram_mensajes_entrantes USING btree (created_at DESC);


--
-- Name: idx_telegram_mensajes_entrantes_socio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_mensajes_entrantes_socio_id ON public.telegram_mensajes_entrantes USING btree (socio_id);


--
-- Name: socios_username_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX socios_username_unique ON public.socios USING btree (username);


--
-- Name: actividades set_updated_at_actividades; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_actividades BEFORE UPDATE ON public.actividades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: calificaciones_productos set_updated_at_calificaciones_productos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_calificaciones_productos BEFORE UPDATE ON public.calificaciones_productos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configuracion set_updated_at_configuracion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_configuracion BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configuracion_sistema set_updated_at_configuracion_sistema; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_configuracion_sistema BEFORE UPDATE ON public.configuracion_sistema FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configuracion_whatsapp set_updated_at_configuracion_whatsapp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_configuracion_whatsapp BEFORE UPDATE ON public.configuracion_whatsapp FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: documentos_socios set_updated_at_documentos_socios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_documentos_socios BEFORE UPDATE ON public.documentos_socios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: logs_actividad set_updated_at_logs_actividad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_logs_actividad BEFORE UPDATE ON public.logs_actividad FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lotes_cosecha set_updated_at_lotes_cosecha; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_lotes_cosecha BEFORE UPDATE ON public.lotes_cosecha FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: noticias set_updated_at_noticias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_noticias BEFORE UPDATE ON public.noticias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notificaciones_programadas set_updated_at_notificaciones_programadas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_notificaciones_programadas BEFORE UPDATE ON public.notificaciones_programadas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: productos set_updated_at_productos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_productos BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: productos_imagenes set_updated_at_productos_imagenes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_productos_imagenes BEFORE UPDATE ON public.productos_imagenes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reservas_mensuales set_updated_at_reservas_mensuales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_reservas_mensuales BEFORE UPDATE ON public.reservas_mensuales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: solicitudes_membresia set_updated_at_solicitudes_membresia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_solicitudes_membresia BEFORE UPDATE ON public.solicitudes_membresia FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sorteos set_updated_at_sorteos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_sorteos BEFORE UPDATE ON public.sorteos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sorteos_ganadores set_updated_at_sorteos_ganadores; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_sorteos_ganadores BEFORE UPDATE ON public.sorteos_ganadores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sorteos_participantes set_updated_at_sorteos_participantes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_sorteos_participantes BEFORE UPDATE ON public.sorteos_participantes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: telegram_mensajes_entrantes set_updated_at_telegram_mensajes_entrantes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_telegram_mensajes_entrantes BEFORE UPDATE ON public.telegram_mensajes_entrantes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: whatsapp_templates set_updated_at_whatsapp_templates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_whatsapp_templates BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: calificaciones_productos calificaciones_productos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_productos
    ADD CONSTRAINT calificaciones_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: calificaciones_productos calificaciones_productos_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_productos
    ADD CONSTRAINT calificaciones_productos_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: documentos_socios documentos_socios_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_socios
    ADD CONSTRAINT documentos_socios_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: notificaciones_programadas notificaciones_programadas_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_programadas
    ADD CONSTRAINT notificaciones_programadas_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: productos_imagenes productos_imagenes_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_imagenes
    ADD CONSTRAINT productos_imagenes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: productos productos_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_cosecha(id);


--
-- Name: reservas_mensuales reservas_mensuales_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_mensuales
    ADD CONSTRAINT reservas_mensuales_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_cosecha(id);


--
-- Name: reservas_mensuales reservas_mensuales_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_mensuales
    ADD CONSTRAINT reservas_mensuales_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE SET NULL;


--
-- Name: reservas_mensuales reservas_mensuales_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_mensuales
    ADD CONSTRAINT reservas_mensuales_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: socios socios_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);


--
-- Name: sorteos_ganadores sorteos_ganadores_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_ganadores
    ADD CONSTRAINT sorteos_ganadores_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: sorteos_ganadores sorteos_ganadores_sorteo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_ganadores
    ADD CONSTRAINT sorteos_ganadores_sorteo_id_fkey FOREIGN KEY (sorteo_id) REFERENCES public.sorteos(id) ON DELETE CASCADE;


--
-- Name: sorteos_participantes sorteos_participantes_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_participantes
    ADD CONSTRAINT sorteos_participantes_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE CASCADE;


--
-- Name: sorteos_participantes sorteos_participantes_sorteo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorteos_participantes
    ADD CONSTRAINT sorteos_participantes_sorteo_id_fkey FOREIGN KEY (sorteo_id) REFERENCES public.sorteos(id) ON DELETE CASCADE;


--
-- Name: telegram_mensajes_entrantes telegram_mensajes_entrantes_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_mensajes_entrantes
    ADD CONSTRAINT telegram_mensajes_entrantes_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.socios(id) ON DELETE SET NULL;


--
-- Name: telegram_mensajes_entrantes Admins can read telegram inbound messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read telegram inbound messages" ON public.telegram_mensajes_entrantes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.socios s
  WHERE (((s.auth_user_id = auth.uid()) OR (lower(s.email) = lower((auth.jwt() ->> 'email'::text)))) AND (COALESCE(s.rol, 'socio'::text) = ANY (ARRAY['admin'::text, 'maestro'::text]))))));


--
-- Name: actividades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

--
-- Name: actividades actividades_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY actividades_admin_write ON public.actividades TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: actividades actividades_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY actividades_select_public ON public.actividades FOR SELECT TO authenticated, anon USING (true);


--
-- Name: calificaciones_productos calificaciones_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calificaciones_insert_own ON public.calificaciones_productos FOR INSERT WITH CHECK ((socio_id IN ( SELECT socios.id
   FROM public.socios
  WHERE (socios.email = (auth.jwt() ->> 'email'::text)))));


--
-- Name: calificaciones_productos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calificaciones_productos ENABLE ROW LEVEL SECURITY;

--
-- Name: calificaciones_productos calificaciones_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calificaciones_select_all ON public.calificaciones_productos FOR SELECT USING (true);


--
-- Name: calificaciones_productos calificaciones_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calificaciones_update_own ON public.calificaciones_productos FOR UPDATE USING ((socio_id IN ( SELECT socios.id
   FROM public.socios
  WHERE (socios.email = (auth.jwt() ->> 'email'::text)))));


--
-- Name: configuracion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion configuracion_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY configuracion_admin_all ON public.configuracion TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: configuracion_sistema; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_sistema configuracion_sistema_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY configuracion_sistema_admin_write ON public.configuracion_sistema TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: configuracion_sistema configuracion_sistema_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY configuracion_sistema_select_public ON public.configuracion_sistema FOR SELECT TO authenticated, anon USING (true);


--
-- Name: configuracion_whatsapp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_whatsapp ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_whatsapp configuracion_whatsapp_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY configuracion_whatsapp_admin_all ON public.configuracion_whatsapp TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: documentos_socios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentos_socios ENABLE ROW LEVEL SECURITY;

--
-- Name: documentos_socios documentos_socios_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_socios_admin_all ON public.documentos_socios TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: documentos_socios documentos_socios_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_socios_select_own ON public.documentos_socios FOR SELECT TO authenticated USING ((socio_id = public.current_socio_id()));


--
-- Name: productos_imagenes imagenes_all_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY imagenes_all_admin ON public.productos_imagenes USING ((EXISTS ( SELECT 1
   FROM public.socios
  WHERE ((socios.email = (auth.jwt() ->> 'email'::text)) AND (socios.rol = ANY (ARRAY['admin'::text, 'maestro'::text]))))));


--
-- Name: productos_imagenes imagenes_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY imagenes_select_all ON public.productos_imagenes FOR SELECT USING (true);


--
-- Name: logs_actividad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_actividad ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_actividad logs_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_insert_authenticated ON public.logs_actividad FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: logs_actividad logs_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_select_admin ON public.logs_actividad FOR SELECT TO authenticated USING (public.is_admin_or_maestro());


--
-- Name: lotes_cosecha; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lotes_cosecha ENABLE ROW LEVEL SECURITY;

--
-- Name: lotes_cosecha lotes_cosecha_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lotes_cosecha_admin_all ON public.lotes_cosecha TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: noticias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

--
-- Name: noticias noticias_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY noticias_admin_write ON public.noticias TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: noticias noticias_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY noticias_select_public ON public.noticias FOR SELECT TO authenticated, anon USING (true);


--
-- Name: notificaciones_programadas notificaciones_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificaciones_admin_select ON public.notificaciones_programadas FOR SELECT TO authenticated USING (public.is_admin_or_maestro());


--
-- Name: notificaciones_programadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones_programadas ENABLE ROW LEVEL SECURITY;

--
-- Name: productos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

--
-- Name: productos productos_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY productos_admin_write ON public.productos TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: productos_imagenes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productos_imagenes ENABLE ROW LEVEL SECURITY;

--
-- Name: productos productos_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY productos_select_public ON public.productos FOR SELECT TO authenticated, anon USING (true);


--
-- Name: reservas_mensuales reservas_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservas_delete_admin ON public.reservas_mensuales FOR DELETE TO authenticated USING (public.is_admin_or_maestro());


--
-- Name: reservas_mensuales reservas_insert_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservas_insert_own_or_admin ON public.reservas_mensuales FOR INSERT TO authenticated WITH CHECK ((public.is_admin_or_maestro() OR (socio_id = public.current_socio_id())));


--
-- Name: reservas_mensuales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas_mensuales ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas_mensuales reservas_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservas_select_own_or_admin ON public.reservas_mensuales FOR SELECT TO authenticated USING ((public.is_admin_or_maestro() OR (socio_id = public.current_socio_id())));


--
-- Name: reservas_mensuales reservas_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservas_update_own_or_admin ON public.reservas_mensuales FOR UPDATE TO authenticated USING ((public.is_admin_or_maestro() OR (socio_id = public.current_socio_id()))) WITH CHECK ((public.is_admin_or_maestro() OR (socio_id = public.current_socio_id())));


--
-- Name: socios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

--
-- Name: socios socios_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY socios_insert_admin ON public.socios FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_maestro());


--
-- Name: socios socios_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY socios_select_own_or_admin ON public.socios FOR SELECT TO authenticated USING ((public.is_admin_or_maestro() OR (id = public.current_socio_id())));


--
-- Name: socios socios_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY socios_update_own_or_admin ON public.socios FOR UPDATE TO authenticated USING ((public.is_admin_or_maestro() OR (id = public.current_socio_id()))) WITH CHECK ((public.is_admin_or_maestro() OR (id = public.current_socio_id())));


--
-- Name: solicitudes_membresia solicitudes_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY solicitudes_admin_select ON public.solicitudes_membresia FOR SELECT TO authenticated USING (public.is_admin_or_maestro());


--
-- Name: solicitudes_membresia solicitudes_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY solicitudes_admin_update ON public.solicitudes_membresia FOR UPDATE TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: solicitudes_membresia solicitudes_insert_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY solicitudes_insert_public ON public.solicitudes_membresia FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: solicitudes_membresia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_membresia ENABLE ROW LEVEL SECURITY;

--
-- Name: sorteos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sorteos ENABLE ROW LEVEL SECURITY;

--
-- Name: sorteos sorteos_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_admin_all ON public.sorteos TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: sorteos_ganadores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sorteos_ganadores ENABLE ROW LEVEL SECURITY;

--
-- Name: sorteos_ganadores sorteos_ganadores_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_ganadores_admin_all ON public.sorteos_ganadores TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: sorteos_ganadores sorteos_ganadores_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_ganadores_select_own ON public.sorteos_ganadores FOR SELECT TO authenticated USING ((socio_id = public.current_socio_id()));


--
-- Name: sorteos_participantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sorteos_participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: sorteos_participantes sorteos_participantes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_participantes_admin_all ON public.sorteos_participantes TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- Name: sorteos_participantes sorteos_participantes_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_participantes_own ON public.sorteos_participantes TO authenticated USING ((socio_id = public.current_socio_id())) WITH CHECK ((socio_id = public.current_socio_id()));


--
-- Name: sorteos sorteos_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sorteos_select_auth ON public.sorteos FOR SELECT TO authenticated USING (true);


--
-- Name: telegram_mensajes_entrantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_mensajes_entrantes ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_templates whatsapp_templates_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY whatsapp_templates_admin_all ON public.whatsapp_templates TO authenticated USING (public.is_admin_or_maestro()) WITH CHECK (public.is_admin_or_maestro());


--
-- PostgreSQL database dump complete
--

\unrestrict lIgSUCNeaeKub3SwcjFfrt9rIGj6THfUxUbaH527eh9fjhDOpMq5qPUch3NRaZb

