alter table if exists public.solicitudes_membresia
    add column if not exists tipo_registro text;

comment on column public.solicitudes_membresia.tipo_registro
    is 'Origen del registro declarado al solicitar membresia: autocultivo, farmacias o ninguno.';

create or replace function public.get_config_int(p_clave text, p_fallback integer)
returns integer
language sql
stable
set search_path = public
as $$
    select coalesce(
        (
            select nullif(regexp_replace(valor, '[^0-9]', '', 'g'), '')::integer
            from public.configuracion_sistema
            where clave = p_clave
            limit 1
        ),
        p_fallback
    );
$$;

create or replace function public.reservation_deadline_is_open(
    p_fecha_retiro timestamp,
    p_tipo_entrega text default null
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
    v_horas integer;
    v_tipo text := lower(coalesce(p_tipo_entrega, ''));
begin
    if p_fecha_retiro is null then
        return true;
    end if;

    v_horas := case
        when v_tipo in ('primer', 'primer_jueves', 'entrega_1') then public.get_config_int('horas_limite_primer', 48)
        when v_tipo in ('ultimo', 'ultimo_jueves', 'entrega_2') then public.get_config_int('horas_limite_ultimo', 48)
        else public.get_config_int('horas_limite_primer', 48)
    end;

    return timezone('utc'::text, now()) <= (p_fecha_retiro - make_interval(hours => greatest(v_horas, 1)));
end;
$$;

create or replace function public.enforce_reservation_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if coalesce(new.estado, 'pendiente') not in ('cancelado', 'entregado', 'retirado')
           and not public.reservation_deadline_is_open(new.fecha_retiro, new.tipo_entrega) then
            raise exception 'El plazo de reservas esta cerrado para esta entrega.';
        end if;
        return new;
    end if;

    if coalesce(new.estado, 'pendiente') = 'pendiente'
       and (
           new.fecha_retiro is distinct from old.fecha_retiro
           or new.tipo_entrega is distinct from old.tipo_entrega
           or new.cantidad_gramos is distinct from old.cantidad_gramos
           or new.producto_id is distinct from old.producto_id
       )
       and not public.reservation_deadline_is_open(new.fecha_retiro, new.tipo_entrega) then
        raise exception 'El plazo de reservas esta cerrado para esta entrega.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_reservation_deadline on public.reservas_mensuales;
create trigger trg_enforce_reservation_deadline
before insert or update on public.reservas_mensuales
for each row
execute function public.enforce_reservation_deadline();

create or replace function public.iter_configured_deliveries(p_target_date date default current_date)
returns table (
    entrega_indice integer,
    fecha date,
    hora time,
    lugar text,
    mensaje text,
    mes_clave text
)
language sql
stable
set search_path = public
as $$
    with config as (
        select clave, valor from public.configuracion_sistema
    ),
    fechas as (
        select
            (regexp_match(clave, '^entrega_([0-9]{4}_[0-9]{2})_([12])_fecha$'))[1] as mes_clave,
            ((regexp_match(clave, '^entrega_([0-9]{4}_[0-9]{2})_([12])_fecha$'))[2])::integer as entrega_indice,
            valor::date as fecha
        from config
        where clave ~ '^entrega_[0-9]{4}_[0-9]{2}_[12]_fecha$'
          and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    )
    select
        f.entrega_indice,
        f.fecha,
        coalesce(nullif((select valor from config where clave = 'entrega_' || f.mes_clave || '_' || f.entrega_indice || '_hora'), '')::time, '18:00'::time) as hora,
        coalesce(nullif((select valor from config where clave = 'entrega_' || f.mes_clave || '_' || f.entrega_indice || '_lugar'), ''), (select valor from config where clave = 'lugar_entrega'), 'Lugar de Siempre') as lugar,
        coalesce((select valor from config where clave = 'entrega_' || f.mes_clave || '_' || f.entrega_indice || '_mensaje'), '') as mensaje,
        f.mes_clave
    from fechas f
    where f.fecha >= (p_target_date - interval '10 days')::date
    union all
    select
        1,
        valor::date,
        '18:00'::time,
        coalesce((select valor from config where clave = 'lugar_entrega'), 'Lugar de Siempre'),
        coalesce((select valor from config where clave = 'mensaje_entrega_primer'), ''),
        to_char(valor::date, 'YYYY_MM')
    from config
    where clave = 'fecha_entrega_primer'
      and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    union all
    select
        2,
        valor::date,
        '18:00'::time,
        coalesce((select valor from config where clave = 'lugar_entrega'), 'Lugar de Siempre'),
        coalesce((select valor from config where clave = 'mensaje_entrega_ultimo'), ''),
        to_char(valor::date, 'YYYY_MM')
    from config
    where clave = 'fecha_entrega_ultimo'
      and valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
$$;

create or replace function public.queue_monthly_telegram_reminders(target_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_entrega record;
    v_horas integer;
    v_deadline timestamp;
    v_inserted integer := 0;
    v_total integer := 0;
    v_tipo text;
    v_mensaje text;
begin
    for v_entrega in
        select distinct on (entrega_indice, fecha) *
        from public.iter_configured_deliveries(target_date)
        where fecha is not null
        order by entrega_indice, fecha, mes_clave
    loop
        v_horas := case when v_entrega.entrega_indice = 1
            then public.get_config_int('horas_limite_primer', 48)
            else public.get_config_int('horas_limite_ultimo', 48)
        end;
        v_deadline := (v_entrega.fecha::timestamp + coalesce(v_entrega.hora, '18:00'::time)) - make_interval(hours => greatest(v_horas, 1));

        if target_date <> v_deadline::date then
            continue;
        end if;

        v_tipo := 'recordatorio_entrega_' || v_entrega.entrega_indice;
        v_mensaje := 'Tenes hasta ' || v_horas || ' horas antes de la entrega del ' ||
            to_char(v_entrega.fecha, 'DD/MM/YYYY') || ' para realizar tu reserva.';

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
            v_tipo,
            v_mensaje,
            timezone('utc'::text, now()),
            'pendiente',
            'telegram',
            'telegram',
            jsonb_build_object(
                'delivery_date', v_entrega.fecha,
                'delivery_index', v_entrega.entrega_indice,
                'deadline_at', v_deadline,
                'hours_limit', v_horas
            )
        from public.socios s
        where coalesce(s.estado, 'activo') = 'activo'
          and coalesce(s.telegram_enabled, false) = true
          and coalesce(nullif(trim(s.telegram_chat_id), ''), '') <> ''
          and not exists (
              select 1
              from public.notificaciones_programadas np
              where np.socio_id = s.id
                and np.tipo = v_tipo
                and np.canal = 'telegram'
                and np.metadata ->> 'delivery_date' = v_entrega.fecha::text
          );

        get diagnostics v_inserted = row_count;
        v_total := v_total + v_inserted;
    end loop;

    return v_total;
end;
$$;

create or replace function public.close_expired_reservation_windows(target_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    select count(*)
    into v_count
    from public.iter_configured_deliveries(target_date) d
    where d.fecha is not null
      and not public.reservation_deadline_is_open(
          d.fecha::timestamp + coalesce(d.hora, '18:00'::time),
          case when d.entrega_indice = 1 then 'primer_jueves' else 'ultimo_jueves' end
      );

    return v_count;
end;
$$;

grant execute on function public.get_config_int(text, integer) to anon, authenticated, service_role;
grant execute on function public.reservation_deadline_is_open(timestamp, text) to anon, authenticated, service_role;
grant execute on function public.queue_monthly_telegram_reminders(date) to authenticated, service_role;
grant execute on function public.close_expired_reservation_windows(date) to authenticated, service_role;
