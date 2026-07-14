create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

alter table if exists public.notificaciones_programadas
    add column if not exists provider text,
    add column if not exists provider_message_sid text,
    add column if not exists error_detalle text,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

create index if not exists idx_notificaciones_programadas_estado_fecha
    on public.notificaciones_programadas (estado, fecha_programada);

create index if not exists idx_notificaciones_programadas_canal_estado
    on public.notificaciones_programadas (canal, estado);

create table if not exists public.whatsapp_templates (
    id uuid primary key default gen_random_uuid(),
    clave text not null unique,
    nombre_template text not null,
    idioma text not null default 'es',
    canal text not null default 'whatsapp',
    cuerpo text,
    activo boolean not null default true,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.whatsapp_templates (clave, nombre_template, idioma, cuerpo)
values
    (
        'recordatorio_ultimo_jueves',
        'recordatorio_ultimo_jueves',
        'es',
        'Tenes tiempo hasta 72 hs antes del ultimo jueves del mes para confirmar tu retiro.'
    ),
    (
        'recordatorio_primer_jueves',
        'recordatorio_primer_jueves',
        'es',
        'Tenes tiempo hasta 48 hs antes del primer jueves del mes para confirmar tu retiro.'
    )
on conflict (clave) do update
set
    nombre_template = excluded.nombre_template,
    idioma = excluded.idioma,
    cuerpo = excluded.cuerpo,
    activo = true,
    updated_at = timezone('utc'::text, now());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists set_updated_at_notificaciones_programadas on public.notificaciones_programadas;
create trigger set_updated_at_notificaciones_programadas
before update on public.notificaciones_programadas
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_whatsapp_templates on public.whatsapp_templates;
create trigger set_updated_at_whatsapp_templates
before update on public.whatsapp_templates
for each row
execute procedure public.set_updated_at();

create or replace function public.primer_jueves_del_mes(target_date date)
returns date
language sql
immutable
as $$
    with month_start as (
        select date_trunc('month', target_date)::date as first_day
    )
    select (first_day + (((4 - extract(dow from first_day)::int) + 7) % 7))::date
    from month_start;
$$;

create or replace function public.ultimo_jueves_del_mes(target_date date)
returns date
language sql
immutable
as $$
    with month_end as (
        select (date_trunc('month', target_date) + interval '1 month - 1 day')::date as last_day
    )
    select (last_day - (((extract(dow from last_day)::int - 4) + 7) % 7))::date
    from month_end;
$$;

create or replace function public.queue_monthly_whatsapp_reminders(target_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

comment on function public.queue_monthly_whatsapp_reminders(date) is
'Genera recordatorios WhatsApp para socios activos sin duplicar mensajes del mismo mes.';
