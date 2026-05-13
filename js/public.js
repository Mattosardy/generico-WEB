async function cargarContenidoInstitucional() {
    try {
        const { data, error } = await supabaseClient.from('configuracion_sistema').select('clave, valor');
        if (error) throw error;

        const configMap = {};
        (data || []).forEach((item) => {
            configMap[item.clave] = item.valor;
            if (item.clave === 'horas_limite_primer') configSistema.horasLimitePrimer = parseInt(item.valor, 10);
            if (item.clave === 'horas_limite_ultimo') configSistema.horasLimiteUltimo = parseInt(item.valor, 10);
        });
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

function normalizarTipoCultivo(tipoCultivo) {
    return String(tipoCultivo || '').trim().toLowerCase() === 'exterior' ? 'exterior' : 'invernaculo';
}

function obtenerTituloTipoCultivo(tipoCultivo) {
    return tipoCultivo === 'exterior' ? 'STANDARD' : 'PREMIUM';
}

function obtenerDescripcionTipoCultivo(tipoCultivo) {
    return tipoCultivo === 'exterior'
        ? 'Cultivo exterior, perfil clasico y acceso simple.'
        : 'Cultivo asistido, seleccion cuidada y mayor control.';
}

function inicializarAcordeonesProductos() {
    document.querySelectorAll('.productos-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const tipoCultivo = toggle.dataset.tipoCultivo;
            const columna = toggle.closest('.productos-columna');
            const panel = document.querySelector(`.productos-panel[data-tipo-cultivo="${tipoCultivo}"]`);
            if (!columna || !panel) return;

            const expandido = toggle.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.productos-columna.activa').forEach((columnaActiva) => {
                if (columnaActiva === columna) return;
                const toggleActivo = columnaActiva.querySelector('.productos-toggle');
                if (toggleActivo) toggleActivo.setAttribute('aria-expanded', 'false');
                columnaActiva.classList.remove('activa');
            });
            document.querySelectorAll('.productos-panel').forEach((panelActivo) => {
                if (panelActivo !== panel) panelActivo.hidden = true;
            });

            toggle.setAttribute('aria-expanded', String(!expandido));
            panel.hidden = expandido;
            columna.classList.toggle('activa', !expandido);
        });
    });
}

function construirEstadoProductoHTML(producto) {
    const disponible = producto.disponible !== false;
    return `
        <div class="producto-status-row">
            <span class="producto-status-dot ${disponible ? 'disponible' : 'agotado'}"></span>
            <span>${disponible ? 'Disponible' : 'Agotado'}</span>
        </div>
    `;
}

function renderizarTarjetaProducto(producto) {
    const imagenes = normalizarListaImagenes(producto.imagen_url);
    const imagenPrincipal = imagenes[0] || obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcción');
    const disponible = producto.disponible !== false;
    const indicaSativa = producto.indica_sativa || '50% Indica - 50% Sativa';

    return `
        <div class="producto-card" data-producto='${JSON.stringify(producto).replace(/'/g, '&#39;')}'>
            <div class="producto-miniatura">
                <span class="producto-disponibilidad-badge ${disponible ? 'disponible' : 'agotado'}">${disponible ? 'Disponible' : 'Agotado'}</span>
                <img src="${imagenPrincipal}" alt="${escapeHtml(producto.nombre)}" style="width:100%;height:160px;object-fit:cover;" onerror="this.onerror=null; this.src='${obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcción')}';">
            </div>
            ${renderizarEstrellas(producto.promedio, producto.totalCalificaciones)}
            <div class="producto-detalle">
                <h3 class="producto-nombre">${escapeHtml(producto.nombre)}</h3>
                ${construirEstadoProductoHTML(producto)}
                <div style="color:#111111;font-size:0.9rem;margin-bottom:10px;">${escapeHtml(indicaSativa)}</div>
                <button class="btn-mas-info" onclick="event.stopPropagation();mostrarMasInfo('${producto.id}')" style="background:#496535;border:1px solid #496535;color:#f4f8ef;padding:8px 16px;border-radius:20px;cursor:pointer;width:100%;margin-bottom:10px;"><i class="fas fa-plus-circle"></i> Información</button>
                <button class="btn-reservar-producto" onclick="event.stopPropagation();abrirModalDesdeBoton('${producto.id}')" style="background:#496535;border:none;color:#f4f8ef;padding:10px;border-radius:25px;cursor:pointer;font-weight:bold;width:100%;" ${!disponible ? 'disabled' : ''}><i class="fas fa-calendar-check"></i> Reservar</button>
                ${!disponible ? '<div class="producto-agotado-texto">No disponible para reservar</div>' : ''}
            </div>
        </div>
    `;
}

function renderizarTarjetaProductoCompacta(producto) {
    const imagenes = normalizarListaImagenes(producto.imagen_url);
    const imagenPrincipal = imagenes[0] || obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcciÃ³n');

    return `
        <div class="producto-card producto-card-compacta" data-producto='${JSON.stringify(producto).replace(/'/g, '&#39;')}'>
            <div class="producto-miniatura">
                <img src="${imagenPrincipal}" alt="${escapeHtml(producto.nombre)}" onerror="this.onerror=null; this.src='${obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcciÃ³n')}';">
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
    if (!noticias?.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><strong>Sin novedades por ahora</strong><span>Cuando haya comunicados del club, los vas a ver acá.</span></div>';
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
}

async function cargarActividadesPublicas() {
    const container = document.getElementById('actividades-container');
    if (!container) return;

    const actividades = await obtenerActividades();
    if (!actividades?.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    const iconosTipo = { actividad: 'Actividad', sorteo: 'Sorteo', regalo: 'Regalo' };
    container.innerHTML = actividades.map((actividad) => `
        <div class="actividad-item">
            <div class="actividad-fecha">${new Date(actividad.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' })}<br>${actividad.hora?.substring(0, 5) || '--:--'}</div>
            <div class="actividad-info">
                <div class="actividad-titulo">${escapeHtml(actividad.titulo)} <span style="font-size:0.7rem;background:#7ca35a;color:#0f190c;padding:2px 8px;border-radius:12px;">${escapeHtml(iconosTipo[actividad.tipo] || actividad.tipo || 'Actividad')}</span></div>
                <div class="actividad-descripcion">${escapeHtml(actividad.descripcion || '')}</div>
            </div>
        </div>
    `).join('');
}

async function cargarProductosPublicos() {
    const container = document.getElementById('productos-container');
    if (!container) return;

    const productos = await obtenerProductos();
    if (!productos?.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-leaf"></i><strong>Catálogo en preparación</strong><span>Las variedades disponibles se mostrarán acá.</span></div>';
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
    const grupos = { invernaculo: [], exterior: [] };

    productosOrdenados.forEach((producto) => {
        grupos[normalizarTipoCultivo(producto.tipo_cultivo)].push(producto);
    });

    const tiposCultivo = ['invernaculo', 'exterior'];
    container.innerHTML = `
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
    `;

    inicializarAcordeonesProductos();

    document.querySelectorAll('.producto-card').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            abrirModal(JSON.parse(card.dataset.producto));
        });
    });
}

window.mostrarMasInfo = async function(productoId) {
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').eq('id', productoId).single();
        if (error) throw error;
        if (data) abrirModal(data);
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

    titulo.textContent = noticia.titulo || 'Novedad';
    fecha.textContent = formatearFechaNoticia(noticia.fecha_publicacion);
    autor.textContent = noticia.autor ? `Por ${noticia.autor}` : '';
    contenido.textContent = noticia.contenido || 'Sin contenido disponible.';

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

console.log('Public loaded');

