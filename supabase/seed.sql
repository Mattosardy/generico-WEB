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

insert into public.configuracion_sistema (clave, valor)
values
    ('horas_limite_primer', '48'),
    ('horas_limite_ultimo', '48'),
    ('lugar_entrega', 'Sede demo'),
    ('fecha_entrega_primer', to_char(current_date + 7, 'YYYY-MM-DD')),
    ('fecha_entrega_ultimo', to_char(current_date + 21, 'YYYY-MM-DD')),
    ('portada_titulo', 'T3 / 420 Demo'),
    ('portada_subtitulo', 'Una demo funcional para gestionar socios, productos y pedidos.'),
    ('portada_descripcion', 'Proyecto de demostracion reconstruido desde migraciones locales.')
on conflict (clave) do nothing;

insert into public.productos (
    id,
    nombre,
    descripcion,
    cepa,
    thc_porcentaje,
    cbd_porcentaje,
    indica_sativa,
    tipo_cultivo,
    precio_por_10g,
    disponible,
    activo,
    stock_packs,
    bajo_stock_packs,
    stock_activo,
    pack_gramos
)
values
    (
        '42000000-0000-4000-8000-000000000001',
        'Variedad Demo Norte',
        'Producto de demostracion para validar catalogo y pedidos.',
        'Demo Norte',
        18.00,
        1.00,
        '60% Indica - 40% Sativa',
        'invernaculo',
        1600,
        true,
        true,
        12,
        2,
        true,
        20
    ),
    (
        '42000000-0000-4000-8000-000000000002',
        'Variedad Demo Sur',
        'Segunda variedad para probar filtros, stock y reservas.',
        'Demo Sur',
        14.00,
        2.00,
        '40% Indica - 60% Sativa',
        'exterior',
        1500,
        true,
        true,
        8,
        2,
        true,
        20
    )
on conflict (id) do nothing;

insert into public.actividades (
    id,
    titulo,
    descripcion,
    fecha,
    hora,
    ubicacion,
    activo,
    tipo
)
values (
    '42000000-0000-4000-8000-000000000101',
    'Encuentro de bienvenida',
    'Actividad de demostracion para verificar la agenda del club.',
    current_date + 10,
    '18:00',
    'Sede demo',
    true,
    'actividad'
)
on conflict (id) do nothing;

insert into public.noticias (
    id,
    titulo,
    contenido,
    autor,
    fecha_publicacion,
    destacado,
    activo
)
values (
    '42000000-0000-4000-8000-000000000201',
    'Demo T3 / 420 activa',
    'Este contenido confirma que la carga publica desde Supabase funciona correctamente.',
    'T3 / 420',
    now(),
    true,
    true
)
on conflict (id) do nothing;
