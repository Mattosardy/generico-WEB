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
on conflict (clave) do nothing;

insert into public.configuracion_sistema (clave, valor)
values ('cupo_mensual_gramos', '40')
on conflict (clave) do nothing;
