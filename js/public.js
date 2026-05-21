async function cargarContenidoInstitucional() {
    try {
        const { data, error } = await supabaseClient.from('configuracion_sistema').select('clave, valor');
        if (error) throw error;

        const configMap = {};
        (data || []).forEach((item) => {
            configMap[item.clave] = item.valor;
            if (item.clave === 'fecha_entrega_primer') configSistema.fechaEntregaPrimer = item.valor || '';
            if (item.clave === 'fecha_entrega_ultimo') configSistema.fechaEntregaUltimo = item.valor || '';
        });
        appState.configMap = configMap;
        const entregasFuturas = obtenerEntregasConfiguradasFuturas(configMap, 3);
        if (entregasFuturas[0]?.fecha) configSistema.fechaEntregaPrimer = entregasFuturas[0].fecha;
        if (entregasFuturas[1]?.fecha) configSistema.fechaEntregaUltimo = entregasFuturas[1].fecha;
        configSistema.horasLimitePrimer = 48;
        configSistema.horasLimiteUltimo = 48;
        const videoGuardado = localStorage.getItem('cururu_historia_video_url') || '';
        const videoHistoria = String(configMap.historia_video_url || videoGuardado || window.defaultHistoriaVideoUrl || '').trim();
        if (videoHistoria) {
            configMap.historia_video_url = videoHistoria;
            appState.historiaVideoActual = videoHistoria;
            localStorage.setItem('cururu_historia_video_url', videoHistoria);
        }

        aplicarContenidoInstitucional(configMap);
        return configMap;
    } catch (error) {
        console.warn('No se pudo cargar la configuración del sitio', error);
        const configMap = {};
        appState.configMap = configMap;
        const videoGuardado = localStorage.getItem('cururu_historia_video_url') || '';
        const videoHistoria = String(videoGuardado || window.defaultHistoriaVideoUrl || '').trim();
        if (videoHistoria) {
            configMap.historia_video_url = videoHistoria;
            appState.historiaVideoActual = videoHistoria;
        }
        aplicarContenidoInstitucional(configMap);
        return configMap;
    }
}

function obtenerImagenesNoticia(noticia) {
    const imagenes = normalizarListaImagenes(noticia?.imagen_url);
    return imagenes.length ? imagenes : [crearPlaceholderConstruccion('Sitio en construcción')];
}

function formatearFechaNoticia(fecha) {
    if (!fecha) return 'Sin fecha';
    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return 'Sin fecha';
    return valor.toLocaleDateString('es-UY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function obtenerIntroNoticia(contenido) {
    const texto = (contenido || '').replace(/\s+/g, ' ').trim();
    if (!texto) return 'Hacé clic para ver la novedad completa...';
    if (texto.length <= 135) return `${texto}...`;
    return `${texto.slice(0, 135).trimEnd()}...`;
}

function obtenerFechaIngresoProducto(producto, indiceOriginal) {
    const fechaBase = producto?.created_at || producto?.fecha_alta || producto?.fecha_ingreso || producto?.updated_at || null;
    const timestamp = fechaBase ? new Date(fechaBase).getTime() : Number.NaN;
    return {
        timestamp: Number.isNaN(timestamp) ? null : timestamp,
        indiceOriginal
    };
}

function ordenarProductosParaCatalogo(productos) {
    return [...productos].sort((a, b) => {
        const aTieneCalificacion = Number(a.totalCalificaciones || 0) > 0;
        const bTieneCalificacion = Number(b.totalCalificaciones || 0) > 0;

        if (aTieneCalificacion && bTieneCalificacion) {
            if (b.promedio !== a.promedio) return b.promedio - a.promedio;
            if (b.totalCalificaciones !== a.totalCalificaciones) return b.totalCalificaciones - a.totalCalificaciones;
        } else if (aTieneCalificacion !== bTieneCalificacion) {
            return aTieneCalificacion ? -1 : 1;
        }

        const fechaA = obtenerFechaIngresoProducto(a, a.indiceOriginal);
        const fechaB = obtenerFechaIngresoProducto(b, b.indiceOriginal);

        if (fechaA.timestamp !== null && fechaB.timestamp !== null && fechaA.timestamp !== fechaB.timestamp) {
            return fechaA.timestamp - fechaB.timestamp;
        }
        if (fechaA.timestamp !== null && fechaB.timestamp === null) return -1;
        if (fechaA.timestamp === null && fechaB.timestamp !== null) return 1;

        return fechaA.indiceOriginal - fechaB.indiceOriginal;
    });
}

const TIPOS_ARTICULOS_PRODUCTOS = ['dispositivos_pipas', 'parafernalia_accesorios'];
const PREFIJO_ARTICULO_PRODUCTO = 'ARTICULO:';
const PACK_GRAMOS_DEFAULT = 20;
const PLAN_PLUS_TITULO_DEFAULT = 'Artículos destacados';

function obtenerConfigSistemaValor(clave, fallback = '') {
    const configMap = appState.configMap || {};
    const valor = configMap[clave];
    if (valor === undefined || valor === null || String(valor).trim() === '') return fallback;
    return valor;
}

function configSistemaBooleano(clave, fallback = false) {
    const valor = obtenerConfigSistemaValor(clave, fallback ? 'true' : 'false');
    if (typeof valor === 'boolean') return valor;
    return ['true', '1', 'si', 'sí', 'on', 'activo'].includes(String(valor).trim().toLowerCase());
}

function planPlusActivo() {
    return window.CURURU_PLAN?.plusActivo === true;
}

function obtenerTituloPlanPlus() {
    const tituloDeploy = String(window.CURURU_PLAN?.planPlusTitulo || PLAN_PLUS_TITULO_DEFAULT).trim() || PLAN_PLUS_TITULO_DEFAULT;
    return String(obtenerConfigSistemaValor('plan_plus_titulo', tituloDeploy)).trim() || tituloDeploy;
}

function normalizarTipoCultivo(tipoCultivo) {
    const valor = String(tipoCultivo || '').trim().toLowerCase();
    if (valor === 'exterior') return 'exterior';
    if (TIPOS_ARTICULOS_PRODUCTOS.includes(valor)) return valor;
    return 'invernaculo';
}

function obtenerTipoCatalogoProducto(producto) {
    const cepa = String(producto?.cepa || '').trim();
    if (cepa.startsWith(PREFIJO_ARTICULO_PRODUCTO)) {
        return normalizarTipoCultivo(cepa.slice(PREFIJO_ARTICULO_PRODUCTO.length));
    }
    return normalizarTipoCultivo(producto?.tipo_cultivo);
}

function productoEsArticulo(producto) {
    return TIPOS_ARTICULOS_PRODUCTOS.includes(obtenerTipoCatalogoProducto(producto));
}

function obtenerTituloTipoCultivo(tipoCultivo) {
    if (tipoCultivo === 'exterior') return 'STANDARD';
    if (tipoCultivo === 'dispositivos_pipas') return 'Dispositivos y pipas';
    if (tipoCultivo === 'parafernalia_accesorios') return 'Parafernalia y Accesorios';
    return 'PREMIUM';
}

function obtenerDescripcionTipoCultivo(tipoCultivo) {
    if (tipoCultivo === 'dispositivos_pipas') return 'Opciones de uso y cuidado personal.';
    if (tipoCultivo === 'parafernalia_accesorios') return 'Complementos para socios del club.';
    return tipoCultivo === 'exterior'
        ? 'Cultivo exterior, perfil clasico y acceso simple.'
        : 'Cultivo asistido, seleccion cuidada y mayor control.';
}

function normalizarEnteroNoNegativo(valor, fallback = 0) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return fallback;
    return Math.max(0, Math.floor(numero));
}

function obtenerInfoStockProducto(producto = {}) {
    const tieneCamposStock = Object.prototype.hasOwnProperty.call(producto, 'stock_packs')
        || Object.prototype.hasOwnProperty.call(producto, 'stock_activo')
        || Object.prototype.hasOwnProperty.call(producto, 'bajo_stock_packs')
        || Object.prototype.hasOwnProperty.call(producto, 'pack_gramos');
    const stockActivo = tieneCamposStock ? producto.stock_activo !== false : false;
    const packGramos = normalizarEnteroNoNegativo(producto.pack_gramos, PACK_GRAMOS_DEFAULT) || PACK_GRAMOS_DEFAULT;
    const stockPacks = normalizarEnteroNoNegativo(producto.stock_packs, 0);
    const bajoStockPacks = normalizarEnteroNoNegativo(producto.bajo_stock_packs, 2);
    const sinStock = stockActivo && stockPacks <= 0;
    const bajoStock = stockActivo && stockPacks > 0 && stockPacks <= bajoStockPacks;
    return {
        tieneCamposStock,
        stockActivo,
        stockPacks,
        bajoStockPacks,
        packGramos,
        gramosDisponibles: stockPacks * packGramos,
        sinStock,
        bajoStock
    };
}

function productoTieneStockParaGramos(producto = {}, gramos = 0) {
    const info = obtenerInfoStockProducto(producto);
    if (!info.stockActivo) return true;
    return info.stockPacks >= Math.ceil(Number(gramos || 0) / info.packGramos);
}

function obtenerClaseStockProducto(producto = {}) {
    const info = obtenerInfoStockProducto(producto);
    if (info.sinStock) return ' producto-sin-stock';
    if (info.bajoStock) return ' producto-bajo-stock';
    return '';
}

function renderizarBadgeStockProducto(producto = {}, compacto = false) {
    const info = obtenerInfoStockProducto(producto);
    if (!info.stockActivo) return '';
    const detalle = compacto ? '' : `<span>${formatearPacksDisponibles(info.stockPacks, info.gramosDisponibles)}</span>`;
    const estado = info.sinStock
        ? '<strong>SIN STOCK</strong>'
        : (info.bajoStock ? '<strong>Poca disponibilidad</strong>' : '<strong>Disponible</strong>');
    return `<div class="producto-stock-badge${info.sinStock ? ' sin-stock' : ''}${info.bajoStock ? ' bajo-stock' : ''}">${estado}${detalle}</div>`;
}

const STORAGE_PRODUCTOS_VISTOS = 'cururu_productos_vistos_v1';
const STORAGE_NOTICIAS_VISTAS = 'cururu_noticias_vistas_v1';
const STORAGE_ACTIVIDADES_VISTAS = 'cururu_actividades_vistas_v1';
const novedadesActuales = {
    productos: [],
    noticias: [],
    actividades: []
};

function leerIdsVistos(clave) {
    try {
        return new Set(JSON.parse(localStorage.getItem(clave) || '[]').map(String));
    } catch (error) {
        return new Set();
    }
}

function guardarIdsVistos(clave, ids) {
    localStorage.setItem(clave, JSON.stringify([...new Set(ids.map(String))]));
}

function obtenerIdNovedad(prefijo, item) {
    return `${prefijo}:${item?.id || item?.created_at || item?.fecha_publicacion || item?.fecha || item?.titulo || ''}`;
}

function asegurarBaseNovedades(clave, ids) {
    if (localStorage.getItem(clave) === null) {
        guardarIdsVistos(clave, ids);
    }
}

function hayIdsNuevos(clave, ids) {
    if (localStorage.getItem(clave) === null) return false;
    const vistos = leerIdsVistos(clave);
    return ids.some((id) => !vistos.has(String(id)));
}

function actualizarIndicadorSeccion(seccion, activo) {
    document.querySelectorAll(`[data-section="${seccion}"]`).forEach((btn) => {
        btn.classList.toggle('nav-has-new', Boolean(activo));
    });
}

function actualizarIndicadoresNovedades() {
    const productoIds = novedadesActuales.productos.map((producto) => String(producto.id));
    const noticiaIds = novedadesActuales.noticias.map((noticia) => obtenerIdNovedad('noticia', noticia));
    const actividadIds = novedadesActuales.actividades.map((actividad) => obtenerIdNovedad('actividad', actividad));

    actualizarIndicadorSeccion('productos', hayIdsNuevos(STORAGE_PRODUCTOS_VISTOS, productoIds));
    actualizarIndicadorSeccion(
        'actividades',
        hayIdsNuevos(STORAGE_NOTICIAS_VISTAS, noticiaIds) || hayIdsNuevos(STORAGE_ACTIVIDADES_VISTAS, actividadIds)
    );
}

function calcularRangoHorarioActividad(horaInicio = '') {
    const match = String(horaInicio || '').match(/^(\d{2}):(\d{2})/);
    if (!match) return '--:--';
    const inicioMinutos = Number(match[1]) * 60 + Number(match[2]);
    const finMinutos = (inicioMinutos + 120) % (24 * 60);
    const inicio = `${String(Math.floor(inicioMinutos / 60)).padStart(2, '0')}:${String(inicioMinutos % 60).padStart(2, '0')}`;
    const fin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;
    return `${inicio} a ${fin}`;
}

function construirCalendarioEntregasPublicoHTML(actividadesEntrega = []) {
    if (!actividadesEntrega.length || typeof construirCalendarioEntregasHTML !== 'function') return '';
    const meses = actividadesEntrega.map((actividad) => normalizarFechaEventoCalendario(actividad.fecha));
    const eventos = actividadesEntrega.map((actividad) => {
        const horario = calcularRangoHorarioActividad(actividad.hora);
        const lugar = actividad.ubicacion && actividad.ubicacion !== 'Cururu Club' ? actividad.ubicacion : 'Lugar de Siempre';
        const titulo = `${actividad.entregaIndice || ''}a Entrega Mensual`.trim();
        return {
            fecha: actividad.fecha,
            entregaAConfirmar: actividad.entregaAConfirmar,
            titulo: actividad.entregaAConfirmar ? titulo : 'Proxima entrega',
            hora: actividad.hora,
            horario: actividad.entregaAConfirmar ? '' : horario,
            detalle: actividad.entregaAConfirmar
                ? `${titulo} pendiente de confirmacion`
                : `${titulo} · ${obtenerResumenEntregaActividad()}`,
            lugar: actividad.entregaAConfirmar ? '' : lugar,
            destacado: !actividad.entregaAConfirmar
        };
    });
    return `
        <div class="actividad-entrega-calendar-block">
            <div class="actividad-entrega-calendar-title">
                <span class="dashboard-eyebrow">Calendario de entregas</span>
                <strong>Proximas fechas configuradas</strong>
            </div>
            ${construirCalendarioEntregasHTML(eventos, { meses })}
        </div>
    `;
}

function formatearFechaEntregaActividad(fecha) {
    const fechaDate = parsearFechaConfigEntrega(fecha) || new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) return '--/--/----';
    return fechaDate.toLocaleDateString('es-UY');
}

function fechaEntregaEsFutura(fecha) {
    const fechaDate = parsearFechaConfigEntrega(fecha) || new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaDate.setHours(0, 0, 0, 0);
    return fechaDate >= hoy;
}

function obtenerResumenEntregaActividad() {
    const disponibles = Number.isFinite(Number(appState.gramosRestantesCiclo)) ? Number(appState.gramosRestantesCiclo) : 40;
    const reservas = Number.isFinite(Number(appState.reservasActivasCount)) ? Number(appState.reservasActivasCount) : 0;
    const retiros = Number.isFinite(Number(appState.historialRetiradoCount)) ? Number(appState.historialRetiradoCount) : 0;
    return `${gramosAPacks(disponibles)} packs disponibles · ${reservas} pedidos activos · ${retiros} retiros`;
}

function construirActividadesEntregaCalendario(configMap = appState.configMap || {}) {
    return obtenerMesesEntregaProximos(3).flatMap((periodo) => [1, 2].map((indice) => {
        const entrega = obtenerEntregaPeriodoConfig(configMap, periodo.mesClave, indice);
        const fechaFutura = entrega.fecha && fechaEntregaEsFutura(entrega.fecha);
        return {
            id: `entrega:${periodo.mesClave}:${indice}`,
            tipo: 'entrega',
            titulo: `Calendario de entregas - ${periodo.etiqueta}`,
            fecha: fechaFutura ? entrega.fecha : formatearFechaClave(periodo.fechaMes),
            hora: entrega.hora,
            ubicacion: entrega.lugar,
            descripcion: entrega.mensaje,
            mesClave: periodo.mesClave,
            mesEtiqueta: periodo.etiqueta,
            entregaIndice: indice,
            entregaAConfirmar: !fechaFutura
        };
    }))
        .sort((a, b) => {
            const fechaA = parsearFechaConfigEntrega(a.fecha) || new Date(a.fecha);
            const fechaB = parsearFechaConfigEntrega(b.fecha) || new Date(b.fecha);
            const diferencia = fechaA.getTime() - fechaB.getTime();
            if (diferencia !== 0) return diferencia;
            return Number(a.entregaIndice || 0) - Number(b.entregaIndice || 0);
        })
        .slice(0, 3);
}

function renderActividadPublica(actividad, iconosTipo) {
    const tipo = String(actividad.tipo || '').toLowerCase();
    if (tipo === 'entrega') {
        const fecha = formatearFechaEntregaActividad(actividad.fecha);
        const horario = calcularRangoHorarioActividad(actividad.hora);
        const lugar = actividad.ubicacion && actividad.ubicacion !== 'Cururu Club' ? actividad.ubicacion : 'Lugar de Siempre';
        const estado = actividad.entregaAConfirmar
            ? `Entrega a confirmar (${actividad.mesEtiqueta || 'proximo periodo'})`
            : `Proxima Entrega: ${fecha} de ${horario}`;
        return `
            <div class="actividad-item actividad-entrega-item">
                <div class="actividad-info">
                    <div class="actividad-titulo">Calendario de entregas</div>
                    <div class="actividad-descripcion actividad-entrega-detalle">
                        <strong>${escapeHtml(estado)}</strong>
                        <span>${escapeHtml(obtenerResumenEntregaActividad())}</span>
                        <em>${escapeHtml(lugar)}</em>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="actividad-item">
            <div class="actividad-fecha">${new Date(actividad.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' })}<br>${actividad.hora?.substring(0, 5) || '--:--'}</div>
            <div class="actividad-info">
                <div class="actividad-titulo">${escapeHtml(actividad.titulo)} <span style="font-size:0.7rem;background:#7ca35a;color:#0f190c;padding:2px 8px;border-radius:12px;">${escapeHtml(iconosTipo[actividad.tipo] || actividad.tipo || 'Actividad')}</span></div>
                <div class="actividad-descripcion">${escapeHtml(actividad.descripcion || '')}</div>
            </div>
        </div>
    `;
}

function registrarProductosParaNovedades(productos) {
    novedadesActuales.productos = productos || [];
    asegurarBaseNovedades(STORAGE_PRODUCTOS_VISTOS, novedadesActuales.productos.map((producto) => String(producto.id)));
    actualizarIndicadoresNovedades();
}

function registrarNoticiasParaNovedades(noticias) {
    novedadesActuales.noticias = noticias || [];
    asegurarBaseNovedades(STORAGE_NOTICIAS_VISTAS, novedadesActuales.noticias.map((noticia) => obtenerIdNovedad('noticia', noticia)));
    actualizarIndicadoresNovedades();
}

function registrarActividadesParaNovedades(actividades) {
    novedadesActuales.actividades = actividades || [];
    asegurarBaseNovedades(STORAGE_ACTIVIDADES_VISTAS, novedadesActuales.actividades.map((actividad) => obtenerIdNovedad('actividad', actividad)));
    actualizarIndicadoresNovedades();
}

function productoEsNuevo(producto) {
    if (!producto?.id || localStorage.getItem(STORAGE_PRODUCTOS_VISTOS) === null) return false;
    return !leerIdsVistos(STORAGE_PRODUCTOS_VISTOS).has(String(producto.id));
}

window.marcarVariedadVista = function(productoId) {
    if (!productoId) return;
    const vistos = leerIdsVistos(STORAGE_PRODUCTOS_VISTOS);
    vistos.add(String(productoId));
    guardarIdsVistos(STORAGE_PRODUCTOS_VISTOS, [...vistos]);
    const selectorId = String(productoId).replace(/"/g, '\\"');
    document.querySelectorAll(`.producto-card[data-producto-id="${selectorId}"]`).forEach((card) => {
        card.classList.remove('producto-nuevo');
    });
    actualizarIndicadoresNovedades();
};

window.marcarActividadesVistas = function() {
    const noticiaIds = novedadesActuales.noticias.map((noticia) => obtenerIdNovedad('noticia', noticia));
    const actividadIds = novedadesActuales.actividades.map((actividad) => obtenerIdNovedad('actividad', actividad));
    guardarIdsVistos(STORAGE_NOTICIAS_VISTAS, [...leerIdsVistos(STORAGE_NOTICIAS_VISTAS), ...noticiaIds]);
    guardarIdsVistos(STORAGE_ACTIVIDADES_VISTAS, [...leerIdsVistos(STORAGE_ACTIVIDADES_VISTAS), ...actividadIds]);
    actualizarIndicadoresNovedades();
};

function inicializarAcordeonesProductos() {
    document.querySelectorAll('.productos-acordeon:not(.admin-main-acordeon):not(.admin-mensajes-acordeon):not(.admin-manual-acordeon)').forEach((acordeon) => {
        if (acordeon.dataset.inicializado === 'true') return;
        acordeon.dataset.inicializado = 'true';
        acordeon.querySelectorAll('.productos-toggle').forEach((toggle) => {
            toggle.addEventListener('click', () => {
                const tipoCultivo = toggle.dataset.tipoCultivo;
                const columna = toggle.closest('.productos-columna');
                const panel = acordeon.querySelector(`.productos-panel[data-tipo-cultivo="${tipoCultivo}"]`);
                if (!columna || !panel) return;

                const expandido = toggle.getAttribute('aria-expanded') === 'true';
                acordeon.querySelectorAll('.productos-columna.activa').forEach((columnaActiva) => {
                    if (columnaActiva === columna) return;
                    const toggleActivo = columnaActiva.querySelector('.productos-toggle');
                    if (toggleActivo) toggleActivo.setAttribute('aria-expanded', 'false');
                    columnaActiva.classList.remove('activa');
                });
                acordeon.querySelectorAll('.productos-panel').forEach((panelActivo) => {
                    if (panelActivo !== panel) panelActivo.hidden = true;
                });

                toggle.setAttribute('aria-expanded', String(!expandido));
                panel.hidden = expandido;
                columna.classList.toggle('activa', !expandido);
            });
        });
    });
}

function obtenerCategoriasArticulosDestacados(articulosPorCategoria = {}) {
    return TIPOS_ARTICULOS_PRODUCTOS.map((tipo) => ({
        id: tipo,
        titulo: obtenerTituloTipoCultivo(tipo),
        descripcion: obtenerDescripcionTipoCultivo(tipo),
        articulos: articulosPorCategoria[tipo] || []
    }));
}

function renderizarTarjetaArticuloDestacado(articulo) {
    const imagenes = normalizarListaImagenes(articulo.imagen_url).slice(0, 3);
    const imagenPrincipal = imagenes[0] || crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion');
    const precio = Number(articulo.precio_por_10g || 0);
    const disponible = articulo.disponible !== false;
    const puedeVerPrecios = typeof usuarioPuedeVerPrecios !== 'function' || usuarioPuedeVerPrecios();
    const precioVisible = typeof formatearPrecioVisible === 'function'
        ? formatearPrecioVisible(precio)
        : (precio ? `$${precio.toFixed(0)}` : '');
    return `
        <article class="articulo-destacado-card" data-producto-id="${escapeHtml(String(articulo.id))}" data-producto='${serializarProductoParaDataset(articulo)}'>
            <div class="articulo-destacado-media">
                <img src="${imagenPrincipal}" alt="${escapeHtml(articulo.nombre)}" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion')}';">
            </div>
            <div class="articulo-destacado-body">
                <span>${disponible ? 'Disponible' : 'No disponible'}</span>
                <strong>${escapeHtml(articulo.nombre)}</strong>
                <p>${escapeHtml(articulo.descripcion || obtenerTituloTipoCultivo(obtenerTipoCatalogoProducto(articulo)))}</p>
                ${precioVisible ? `<em class="${puedeVerPrecios ? '' : 'precio-restringido'}">${escapeHtml(precioVisible)}</em>` : ''}
            </div>
        </article>
    `;
}

function serializarProductoParaDataset(producto = {}) {
    const payload = { ...producto };
    if (typeof usuarioPuedeVerPrecios === 'function' && !usuarioPuedeVerPrecios()) {
        delete payload.precio_por_10g;
    }
    return JSON.stringify(payload).replace(/'/g, '&#39;');
}

function construirArticulosDestacadosHTML(articulosPorCategoria = {}) {
    if (!planPlusActivo()) return '';
    const categorias = obtenerCategoriasArticulosDestacados(articulosPorCategoria);
    return `
        <div class="productos-subsection articulos-destacados-section">
            <h2 class="section-title"><i class="fas fa-star"></i> ${escapeHtml(obtenerTituloPlanPlus())}</h2>
            <div class="productos-acordeon productos-acordeon-articulos">
                <div class="productos-controles">
                    ${categorias.map((categoria) => `
                        <div class="productos-columna">
                            <h3 class="productos-columna-titulo">
                                <button type="button" class="productos-toggle articulos-toggle" data-tipo-cultivo="${categoria.id}" aria-expanded="false">
                                    <span class="productos-toggle-titulo">${escapeHtml(categoria.titulo)}</span>
                                    <span class="productos-toggle-descripcion">${escapeHtml(categoria.descripcion)}</span>
                                    <i class="fas fa-chevron-down productos-toggle-icono" aria-hidden="true"></i>
                                </button>
                            </h3>
                        </div>
                    `).join('')}
                </div>
                ${categorias.map((categoria) => `
                    <div class="productos-panel articulos-panel" data-tipo-cultivo="${categoria.id}" hidden>
                        <div class="productos-lista articulos-destacados-lista">
                            ${categoria.articulos.length
                                ? categoria.articulos.map((articulo) => renderizarTarjetaArticuloDestacado(articulo)).join('')
                                : '<div class="empty-state productos-vacio"><i class="fas fa-box-open"></i><strong>Sin artículos cargados</strong><span>Agregalos desde el panel de administración.</span></div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function construirEstadoProductoHTML(producto) {
    const disponible = producto.disponible !== false;
    const stock = obtenerInfoStockProducto(producto);
    if (stock.stockActivo && stock.sinStock) {
        return `
        <div class="producto-status-row stock-sin-stock">
            <span class="producto-status-dot agotado"></span>
            <span>SIN STOCK</span>
        </div>
    `;
    }
    if (stock.stockActivo && stock.bajoStock) {
        return `
        <div class="producto-status-row stock-bajo">
            <span class="producto-status-dot disponible"></span>
            <span>Poca disponibilidad</span>
        </div>
    `;
    }
    return `
        <div class="producto-status-row">
            <span class="producto-status-dot ${disponible ? 'disponible' : 'agotado'}"></span>
            <span>${disponible ? 'Disponible' : 'Agotado'}</span>
        </div>
    `;
}

function renderizarTarjetaProducto(producto) {
    const imagenes = normalizarListaImagenes(producto.imagen_url).slice(0, 3);
    const imagenPrincipal = imagenes[0] || crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion');
    const disponible = producto.disponible !== false;
    const indicaSativa = producto.indica_sativa || '50% Indica - 50% Sativa';
    const claseNuevo = productoEsNuevo(producto) ? ' producto-nuevo' : '';
    const stock = obtenerInfoStockProducto(producto);
    const bloqueadoPorStock = stock.sinStock;
    const claseStock = obtenerClaseStockProducto(producto);

    return `
        <div class="producto-card${claseNuevo}${claseStock}" data-producto-id="${escapeHtml(String(producto.id))}" data-producto='${serializarProductoParaDataset(producto)}'>
            <div class="producto-miniatura">
                <span class="producto-disponibilidad-badge ${(!disponible || bloqueadoPorStock) ? 'agotado' : 'disponible'}">${bloqueadoPorStock ? 'SIN STOCK' : (disponible ? 'Disponible' : 'Agotado')}</span>
                <img src="${imagenPrincipal}" alt="${escapeHtml(producto.nombre)}" style="width:100%;height:160px;object-fit:cover;" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion')}';">
            </div>
            ${renderizarEstrellas(producto.promedio, producto.totalCalificaciones)}
            <div class="producto-detalle">
                <h3 class="producto-nombre">${escapeHtml(producto.nombre)}</h3>
                ${construirEstadoProductoHTML(producto)}
                ${renderizarBadgeStockProducto(producto)}
                <div style="color:#111111;font-size:0.9rem;margin-bottom:10px;">${escapeHtml(indicaSativa)}</div>
                <button class="btn-mas-info" onclick="event.stopPropagation();mostrarMasInfo('${producto.id}')" style="background:#496535;border:1px solid #496535;color:#f4f8ef;padding:8px 16px;border-radius:20px;cursor:pointer;width:100%;margin-bottom:10px;"><i class="fas fa-plus-circle"></i> Información</button>
                <button class="btn-reservar-producto" onclick="event.stopPropagation();abrirModalDesdeBoton('${producto.id}')" style="background:#496535;border:none;color:#f4f8ef;padding:10px;border-radius:25px;cursor:pointer;font-weight:bold;width:100%;" ${(!disponible || bloqueadoPorStock) ? 'disabled' : ''}><i class="fas fa-calendar-check"></i> Reservar</button>
                ${(!disponible || bloqueadoPorStock) ? '<div class="producto-agotado-texto">No disponible para reservar</div>' : ''}
            </div>
        </div>
    `;
}

function renderizarTarjetaProductoCompacta(producto) {
    const imagenes = normalizarListaImagenes(producto.imagen_url).slice(0, 3);
    const imagenPrincipal = imagenes[0] || crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion');
    const claseNuevo = productoEsNuevo(producto) ? ' producto-nuevo' : '';
    const claseStock = obtenerClaseStockProducto(producto);
    return `
        <div class="producto-card producto-card-compacta${claseNuevo}${claseStock}" data-producto-id="${escapeHtml(String(producto.id))}" data-producto='${serializarProductoParaDataset(producto)}'>
            <div class="producto-miniatura">
                <img src="${imagenPrincipal}" alt="${escapeHtml(producto.nombre)}" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('EN CONSTRUCCION', 'Foto en preparacion')}';">
                ${renderizarBadgeStockProducto(producto, true)}
                <div class="producto-overlay">
                    ${renderizarEstrellas(producto.promedio, producto.totalCalificaciones)}
                    <h3 class="producto-nombre">${escapeHtml(producto.nombre)}</h3>
                </div>
            </div>
        </div>
    `;
}

async function cargarNoticias() {
    const container = document.getElementById('noticias-container');
    if (!container) return;

    const noticias = await obtenerNoticias();
    registrarNoticiasParaNovedades(noticias || []);
    if (!noticias?.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><strong>Sin novedades por ahora</strong><span>Cuando haya comunicados del club, los vas a ver acá.</span></div>';
        inicializarAcordeonesProductos();
        return;
    }

    container.innerHTML = noticias.map((noticia) => {
        const imagenes = obtenerImagenesNoticia(noticia);
        const intro = obtenerIntroNoticia(noticia.contenido);
        const payload = JSON.stringify(noticia).replace(/'/g, '&#39;');
        return `
            <article class="noticia-card" data-noticia='${payload}'>
                <div class="noticia-miniatura">
                    <img src="${imagenes[0]}" alt="${escapeHtml(noticia.titulo || 'Novedad')}" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';">
                </div>
                <div class="noticia-body">
                    <div class="noticia-fecha">${escapeHtml(formatearFechaNoticia(noticia.fecha_publicacion))}</div>
                    <h3 class="noticia-titulo">${escapeHtml(noticia.titulo || 'Novedad')}</h3>
                    <p class="noticia-contenido">${escapeHtml(intro)}</p>
                    <div class="noticia-cta"><i class="fas fa-arrow-right"></i> Ver más</div>
                </div>
            </article>
        `;
    }).join('');

    document.querySelectorAll('.noticia-card').forEach((card) => {
        card.addEventListener('click', () => {
            const noticia = JSON.parse(card.dataset.noticia);
            abrirNoticiaModal(noticia);
        });
    });
    inicializarAcordeonesProductos();
}

async function cargarActividadesPublicas() {
    const container = document.getElementById('actividades-container');
    if (!container) return;

    const actividades = await obtenerActividades();
    const actividadesEntrega = construirActividadesEntregaCalendario(appState.configMap || {});
    const actividadesManuales = (actividades || []).filter((actividad) => String(actividad.tipo || '').toLowerCase() !== 'entrega');
    const actividadesCombinadas = [...actividadesEntrega, ...actividadesManuales];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const actividadesVigentes = actividadesCombinadas.filter((actividad) => {
        if (String(actividad.tipo || '').toLowerCase() !== 'entrega') return true;
        if (actividad.entregaAConfirmar) return true;
        const fecha = parsearFechaConfigEntrega(actividad.fecha) || new Date(actividad.fecha);
        fecha.setHours(0, 0, 0, 0);
        return fecha >= hoy;
    });
    registrarActividadesParaNovedades(actividadesVigentes);
    if (!actividadesVigentes.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    const iconosTipo = { actividad: 'Actividad', sorteo: 'Sorteo', regalo: 'Regalo', entrega: 'Proxima entrega' };
    const manualesVigentes = actividadesVigentes.filter((actividad) => String(actividad.tipo || '').toLowerCase() !== 'entrega');
    if (!manualesVigentes.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.innerHTML = `
        ${manualesVigentes.map((actividad) => renderActividadPublica(actividad, iconosTipo)).join('')}
    `;
}

async function cargarProductosPublicos() {
    const container = document.getElementById('productos-container');
    if (!container) return;

    const productos = await obtenerProductos();
    const plusActivo = planPlusActivo();
    if (!productos?.length) {
        container.innerHTML = `
            <div class="empty-state"><i class="fas fa-leaf"></i><strong>Catálogo en preparación</strong><span>Las variedades disponibles se mostrarán acá.</span></div>
            ${plusActivo ? construirArticulosDestacadosHTML() : ''}
        `;
        inicializarAcordeonesProductos();
        return;
    }

    const productosConCalificaciones = await Promise.all(productos.map(async (producto, indiceOriginal) => {
        const calificaciones = await obtenerCalificacionesProducto(producto.id);
        return {
            ...producto,
            indiceOriginal,
            promedio: calcularPromedioEstrellas(calificaciones),
            totalCalificaciones: calificaciones.length
        };
    }));

    const productosOrdenados = ordenarProductosParaCatalogo(productosConCalificaciones);
    registrarProductosParaNovedades(
        plusActivo
            ? productosOrdenados
            : productosOrdenados.filter((producto) => !productoEsArticulo(producto))
    );
    const grupos = { invernaculo: [], exterior: [] };
    const articulosPorCategoria = {
        dispositivos_pipas: [],
        parafernalia_accesorios: []
    };

    productosOrdenados.forEach((producto) => {
        const tipo = obtenerTipoCatalogoProducto(producto);
        if (TIPOS_ARTICULOS_PRODUCTOS.includes(tipo)) {
            if (plusActivo) articulosPorCategoria[tipo].push(producto);
        } else {
            grupos[tipo].push(producto);
        }
    });

    const tiposCultivo = ['invernaculo', 'exterior'];
    container.innerHTML = `
        <div class="productos-acordeon productos-acordeon-variedades">
            <div class="productos-controles">
                ${tiposCultivo.map((tipoCultivo) => `
                    <div class="productos-columna">
                        <h3 class="productos-columna-titulo">
                            <button type="button" class="productos-toggle" data-tipo-cultivo="${tipoCultivo}" aria-expanded="false">
                                <span class="productos-toggle-titulo">${obtenerTituloTipoCultivo(tipoCultivo)}</span>
                                <span class="productos-toggle-descripcion">${obtenerDescripcionTipoCultivo(tipoCultivo)}</span>
                                <i class="fas fa-chevron-down productos-toggle-icono" aria-hidden="true"></i>
                            </button>
                        </h3>
                    </div>
                `).join('')}
            </div>
            ${tiposCultivo.map((tipoCultivo) => `
                <div class="productos-panel" data-tipo-cultivo="${tipoCultivo}" hidden>
                    <div class="productos-lista">
                        ${grupos[tipoCultivo].length ? grupos[tipoCultivo].map((producto) => renderizarTarjetaProductoCompacta(producto)).join('') : '<div class="empty-state productos-vacio"><i class="fas fa-seedling"></i><strong>Sin variedades en esta categoría</strong><span>Probá revisar la otra sección del catálogo.</span></div>'}
                    </div>
                </div>
            `).join('')}
        </div>
        ${plusActivo ? construirArticulosDestacadosHTML(articulosPorCategoria) : ''}
    `;

    inicializarAcordeonesProductos();

    container.querySelectorAll('.producto-card, .articulo-destacado-card').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            const producto = JSON.parse(card.dataset.producto);
            abrirModal(producto);
            if (typeof marcarVariedadVista === 'function') marcarVariedadVista(producto.id);
        });
    });
}

window.mostrarMasInfo = async function(productoId) {
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').eq('id', productoId).single();
        if (error) throw error;
        if (data) {
            abrirModal(data);
            if (typeof marcarVariedadVista === 'function') marcarVariedadVista(data.id);
        }
    } catch (error) {
        mostrarMensaje('No se pudo cargar la información del producto', false);
    }
};

window.abrirModalDesdeBoton = async function(productoId) {
    await window.mostrarMasInfo(productoId);
};

window.seleccionarImagenNoticia = function(indice) {
    if (!appState.noticiaGaleriaActual?.imagenes?.length) return;
    const imagen = appState.noticiaGaleriaActual.imagenes[indice];
    if (!imagen) return;

    appState.noticiaGaleriaActual.indice = indice;
    const principal = document.getElementById('noticiaModalImagenPrincipal');
    if (principal) principal.src = imagen;

    document.querySelectorAll('#noticiaModalMedia .galeria-thumb').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('activa', thumbIndex === indice);
    });
};

window.abrirNoticiaModal = function(noticia) {
    const modal = document.getElementById('noticiaModal');
    if (!modal || !noticia) return;

    const media = document.getElementById('noticiaModalMedia');
    const titulo = document.getElementById('noticiaModalTitulo');
    const fecha = document.getElementById('noticiaModalFecha');
    const autor = document.getElementById('noticiaModalAutor');
    const contenido = document.getElementById('noticiaModalContenido');
    const imagenes = obtenerImagenesNoticia(noticia);

    appState.noticiaGaleriaActual = { imagenes, indice: 0 };
    media.innerHTML = construirHTMLGaleriaHorizontal(imagenes, {
        imagenPrincipalId: 'noticiaModalImagenPrincipal',
        onSelect: 'seleccionarImagenNoticia',
        titulo: noticia.titulo || 'Novedad'
    });

    const principal = document.getElementById('noticiaModalImagenPrincipal');
    if (principal) {
        principal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = crearPlaceholderConstruccion('Sitio en construcción');
        };
    }

    titulo.textContent = normalizarTextoVisual(noticia.titulo || 'Novedad');
    fecha.textContent = formatearFechaNoticia(noticia.fecha_publicacion);
    autor.textContent = noticia.autor ? `Por ${normalizarTextoVisual(noticia.autor)}` : '';
    contenido.textContent = normalizarTextoVisual(noticia.contenido || 'Sin contenido disponible.');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.cerrarNoticiaModal = function() {
    const modal = document.getElementById('noticiaModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
};

document.addEventListener('DOMContentLoaded', () => {
    const noticiaModal = document.getElementById('noticiaModal');
    if (!noticiaModal) return;
    noticiaModal.addEventListener('click', (event) => {
        if (event.target === noticiaModal) cerrarNoticiaModal();
    });
});



