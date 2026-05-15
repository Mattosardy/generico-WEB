function obtenerPedidosProductos() {
    try {
        return JSON.parse(localStorage.getItem('cururu_pedidos_productos') || '[]');
    } catch (error) {
        return [];
    }
}

function guardarPedidosProductos(pedidos) {
    localStorage.setItem('cururu_pedidos_productos', JSON.stringify(pedidos));
}

function normalizarTipoCultivoEdicion(tipoCultivo) {
    const valor = String(tipoCultivo || '').trim().toLowerCase();
    if (valor === 'exterior') return 'exterior';
    if (valor === 'dispositivos_pipas' || valor === 'parafernalia_accesorios') return valor;
    return 'invernaculo';
}

function productoEdicionEsArticuloTipo(tipoCultivo) {
    const normalizado = normalizarTipoCultivoEdicion(tipoCultivo);
    return normalizado === 'dispositivos_pipas' || normalizado === 'parafernalia_accesorios';
}

function obtenerTipoCatalogoProductoEdicion(producto = {}) {
    const cepa = String(producto.cepa || '').trim();
    if (cepa.startsWith('ARTICULO:')) return normalizarTipoCultivoEdicion(cepa.slice('ARTICULO:'.length));
    return normalizarTipoCultivoEdicion(producto.tipo_cultivo);
}

function obtenerTotalPedidoMesActual() {
    const socioId = obtenerIdentificadorSocioPedido();
    const cicloActual = obtenerCicloClub();
    return obtenerPedidosProductos()
        .filter((pedido) => {
            if (pedido.socio_id !== socioId) return false;
            if (pedido.ciclo === cicloActual.clave) return true;
            return fechaEstaEnCicloClub(pedido.fecha, cicloActual);
        })
        .reduce((acc, pedido) => acc + Number(pedido.gramos || 0), 0)
        + Number(appState.gramosReservadosCiclo || 0)
        - Number(appState.reservaEditandoGramos || 0);
}

function actualizarEstadoPedidoModal() {
    const restante = 40 - obtenerTotalPedidoMesActual();
    const restanteEl = document.getElementById('pedidoRestante');
    const alertaEl = document.getElementById('pedidoAlerta');
    const botonEl = document.getElementById('btnRealizarPedido');
    if (!restanteEl || !alertaEl || !botonEl) return;

    const cicloActual = obtenerCicloClub();
    restanteEl.textContent = `Cupo disponible en este ciclo (${cicloActual.etiqueta}): ${restante}g de 40g`;
    alertaEl.textContent = '';
    document.querySelectorAll('#opcionesPedido .opcion-pedido').forEach((btn) => {
        const gramos = Number(btn.dataset.gramos);
        btn.classList.toggle('activa', gramos === appState.gramosSeleccionadosPedido);
        btn.disabled = gramos > restante;
    });

    if (!appState.gramosSeleccionadosPedido) {
        botonEl.disabled = true;
        botonEl.innerHTML = appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido';
        return;
    }
    if (appState.gramosSeleccionadosPedido > restante) {
        alertaEl.textContent = `No podés pedir ${appState.gramosSeleccionadosPedido}g. Te quedan ${restante}g en este ciclo.`;
        botonEl.disabled = true;
        return;
    }
    const seleccion = document.querySelector(`#opcionesPedido .opcion-pedido[data-gramos="${appState.gramosSeleccionadosPedido}"]`);
    const restanteLuego = Math.max(0, restante - Number(appState.gramosSeleccionadosPedido || 0));
    restanteEl.textContent = `Pedido seleccionado: ${appState.gramosSeleccionadosPedido}g. Quedan ${restanteLuego}g disponibles en este ciclo.`;
    botonEl.innerHTML = `${appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido'}${seleccion?.dataset.precio ? ` - $${seleccion.dataset.precio}` : ''}`;
    botonEl.disabled = false;
}
function inicializarPedidoModal() {
    if (!appState.reservaEditandoId) {
        appState.gramosSeleccionadosPedido = null;
    }
    actualizarEstadoPedidoModal();
    document.querySelectorAll('#opcionesPedido .opcion-pedido').forEach((btn) => {
        btn.onclick = () => {
            const gramos = Number(btn.dataset.gramos);
            const precio = Number(btn.dataset.precio);
            const restante = 40 - obtenerTotalPedidoMesActual();
            if (gramos > restante) {
                mostrarMensaje(`Te quedan ${restante}g disponibles en este ciclo.`, false);
                return;
            }
            appState.gramosSeleccionadosPedido = gramos;
            document.getElementById('btnRealizarPedido').innerHTML = `${appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido'} - $${precio}`;
            actualizarEstadoPedidoModal();
        };
    });
    document.getElementById('btnRealizarPedido').onclick = realizarPedidoProducto;
}

async function realizarPedidoProducto() {
    if (!appState.productoModalActual) {
        mostrarMensaje('Elegí una variedad antes de realizar el pedido.', false);
        return;
    }
    if (!appState.socioData && !appState.usuarioActual) {
        mostrarMensaje('Iniciá sesión para pedir.', false);
        return;
    }
    if (!appState.gramosSeleccionadosPedido) {
        mostrarMensaje('Seleccioná una cantidad para continuar.', false);
        return;
    }

    if (!appState.socioData?.id) {
        mostrarMensaje('No se pudo vincular el pedido con tu usuario. Volve a iniciar sesion.', false);
        return;
    }

    const fechas = appState.fechasEntrega || calcularFechasEntrega();
    const tipoEditando = ['primer', 'ultimo'].includes(appState.reservaEditandoTipo) ? appState.reservaEditandoTipo : '';
    const puedePrimer = puedeConfirmar(fechas.primerJueves, configSistema.horasLimitePrimer);
    const puedeUltimo = puedeConfirmar(fechas.ultimoJueves, configSistema.horasLimiteUltimo);
    const tipoEntrega = tipoEditando || (puedePrimer ? 'primer' : (puedeUltimo ? 'ultimo' : null));
    const fechaEntrega = tipoEntrega === 'primer' ? fechas.primerJueves : fechas.ultimoJueves;
    const horasLimite = tipoEntrega === 'primer' ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    if (!tipoEntrega || !puedeConfirmar(fechaEntrega, horasLimite)) {
        mostrarMensaje('El plazo de reservas esta cerrado para este ciclo.', false);
        return;
    }

    const reservas = await obtenerReservas(appState.socioData.id);
    const reservaExistente = appState.reservaEditandoId
        ? reservas.find((reserva) => String(reserva.id) === String(appState.reservaEditandoId))
        : (typeof obtenerReservaActivaPorEntrega === 'function'
            ? obtenerReservaActivaPorEntrega(reservas, tipoEntrega === 'primer' ? 'primer_jueves' : 'ultimo_jueves', fechaEntrega)
            : null);
    const totalActual = obtenerTotalPedidoMesActual();
    if (totalActual + appState.gramosSeleccionadosPedido > 40) {
        mostrarMensaje(`Limite mensual alcanzado. Ya llevas ${totalActual}g en este ciclo.`, false);
        return;
    }

    const resultado = reservaExistente
        ? await modificarReserva(reservaExistente.id, appState.socioData.id, {
            gramos: appState.gramosSeleccionadosPedido,
            producto: appState.productoModalActual
        })
        : await confirmarReserva(
            appState.socioData.id,
            appState.gramosSeleccionadosPedido,
            tipoEntrega,
            fechaEntrega,
            appState.productoModalActual
        );

    if (!resultado.success) {
        mostrarMensaje(`No se pudo registrar el pedido: ${resultado.message || 'error desconocido'}`, false);
        return;
    }

    mostrarMensaje(`${reservaExistente ? 'Pedido modificado' : 'Pedido enviado'}: ${appState.productoModalActual.nombre} - ${appState.gramosSeleccionadosPedido}g. Revisá el detalle en tu carrito.`, true);
    cerrarProductoModal();
    if (typeof cargarReservasSocio === 'function') await cargarReservasSocio();
}

window.cambiarImagenGaleria = function(direccion) {
    if (!appState.galeriaActual?.imagenes?.length) return;
    const nuevoIndice = appState.galeriaActual.indice + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= appState.galeriaActual.imagenes.length) return;
    appState.galeriaActual.indice = nuevoIndice;
    const imagenPrincipal = document.getElementById('modalImagenGaleria');
    if (imagenPrincipal) {
        imagenPrincipal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = obtenerImagenFallback(appState.productoModalActual) || crearPlaceholderConstruccion('Sitio en construcción');
        };
        imagenPrincipal.src = appState.galeriaActual.imagenes[nuevoIndice];
    }
    actualizarControlesGaleriaProducto();
};

window.irAImagen = function(indice) {
    if (!appState.galeriaActual?.imagenes?.length) return;
    appState.galeriaActual.indice = indice;
    const imagenPrincipal = document.getElementById('modalImagenGaleria');
    if (imagenPrincipal) {
        imagenPrincipal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = obtenerImagenFallback(appState.productoModalActual) || crearPlaceholderConstruccion('Sitio en construcción');
        };
        imagenPrincipal.src = appState.galeriaActual.imagenes[indice];
    }
    actualizarControlesGaleriaProducto();
};

window.seleccionarImagenProducto = function(indice) {
    if (!appState.galeriaActual?.imagenes?.length) return;
    const imagen = appState.galeriaActual.imagenes[indice];
    if (!imagen) return;

    appState.galeriaActual.indice = indice;
    const principal = document.getElementById('modalImagenGaleria');
    if (principal) {
        principal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = obtenerImagenFallback(appState.productoModalActual) || crearPlaceholderConstruccion('Sitio en construcción');
        };
        principal.src = imagen;
    }

    actualizarControlesGaleriaProducto();
};

function renderizarGaleriaProductoModal(imagenes, titulo) {
    const imagenPrincipal = imagenes[0] || crearPlaceholderConstruccion('Sitio en construcción');
    return `
        <div class="modal-galeria horizontal producto-simple">
            <div class="modal-galeria-frame">
                <button type="button" class="galeria-flecha izquierda" id="galeriaPrev" onclick="cambiarImagenGaleria(-1)" aria-label="Imagen anterior">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <img id="modalImagenGaleria" class="modal-imagen" src="${imagenPrincipal}" alt="${escapeHtml(titulo)}">
                <button type="button" class="galeria-flecha derecha" id="galeriaNext" onclick="cambiarImagenGaleria(1)" aria-label="Imagen siguiente">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            ${imagenes.length > 1 ? `
                <div class="galeria-strip">
                    ${imagenes.map((imagen, index) => `
                        <button type="button" class="galeria-thumb${index === 0 ? ' activa' : ''}" onclick="seleccionarImagenProducto(${index})" aria-label="Ver imagen ${index + 1}">
                            <img src="${imagen}" alt="${escapeHtml(titulo)} ${index + 1}" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';">
                        </button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function actualizarControlesGaleriaProducto() {
    const total = appState.galeriaActual?.imagenes?.length || 0;
    const indice = appState.galeriaActual?.indice || 0;
    const prev = document.getElementById('galeriaPrev');
    const next = document.getElementById('galeriaNext');
    if (prev) prev.disabled = total <= 1 || indice <= 0;
    if (next) next.disabled = total <= 1 || indice >= total - 1;
    document.querySelectorAll('#modalMedia .galeria-thumb').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('activa', thumbIndex === indice);
    });
}

function habilitarSwipeGaleriaProducto() {
    const imagenPrincipal = document.getElementById('modalImagenGaleria');
    if (!imagenPrincipal) return;

    let touchInicioX = 0;

    imagenPrincipal.addEventListener('touchstart', (event) => {
        touchInicioX = event.changedTouches[0]?.clientX || 0;
    }, { passive: true });

    imagenPrincipal.addEventListener('touchend', (event) => {
        const touchFinX = event.changedTouches[0]?.clientX || 0;
        const delta = touchFinX - touchInicioX;
        if (Math.abs(delta) < 35) return;
        cambiarImagenGaleria(delta < 0 ? 1 : -1);
    }, { passive: true });
}

async function abrirModal(producto) {
    appState.productoModalActual = producto;
    appState.gramosSeleccionadosPedido = null;
    appState.reservaEditandoGramos = 0;
    const precioBase = producto.precio_por_10g || 1600;
    const disponible = producto.disponible !== false;
    const esArticulo = typeof productoEsArticulo === 'function' && productoEsArticulo(producto);

    let imagenesArray = [];
    if (typeof obtenerImagenesProducto === 'function') {
        try {
            const imagenes = await obtenerImagenesProducto(producto.id);
            if (imagenes?.length) imagenesArray = imagenes.map((img) => img.imagen_url);
        } catch (error) {
            console.warn('No se pudo cargar la galeria del producto', error);
        }
    }
    const imagenesBase = normalizarListaImagenes(producto.imagen_url);
    if (!imagenesArray.length && imagenesBase.length) imagenesArray = imagenesBase;
    if (!imagenesArray.length) imagenesArray = [obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcción')];

    appState.galeriaActual = { imagenes: imagenesArray, indice: 0, productoId: producto.id };

    const modalMedia = document.getElementById('modalMedia');
    modalMedia.innerHTML = renderizarGaleriaProductoModal(imagenesArray, producto.nombre || 'Variedad');
    const imagenPrincipal = document.getElementById('modalImagenGaleria');
    if (imagenPrincipal) {
        imagenPrincipal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = obtenerImagenFallback(producto) || crearPlaceholderConstruccion('Sitio en construcción');
        };
    }

    actualizarControlesGaleriaProducto();
    habilitarSwipeGaleriaProducto();

    document.getElementById('modalTitulo').textContent = producto.nombre;
    document.getElementById('modalCepa').textContent = esArticulo
        ? (typeof obtenerTituloTipoCultivo === 'function' && typeof obtenerTipoCatalogoProducto === 'function' ? obtenerTituloTipoCultivo(obtenerTipoCatalogoProducto(producto)) : 'Artículo destacado')
        : (producto.cepa || 'Cepa especial');
    document.getElementById('modalDescripcion').textContent = producto.descripcion || '';
    document.getElementById('modalThc').textContent = esArticulo
        ? `${disponible ? 'Disponible' : 'No disponible'}${precioBase ? ` | $${Number(precioBase).toFixed(0)}` : ''}`
        : `THC: ${producto.thc_porcentaje || '?'}% | CBD: ${producto.cbd_porcentaje || '?'}%`;
    document.getElementById('panelCalificacion').style.display = 'none';
    document.getElementById('calificacionMensaje').innerHTML = '';
    calificacionSeleccionada = 0;

    const pedidoBox = document.querySelector('#productoModal .modal-pedido-box');
    if (pedidoBox) pedidoBox.style.display = esArticulo ? 'none' : '';

    if (esArticulo) {
        document.getElementById('productoModal').style.display = 'flex';
        return;
    }

    const opcionesDisponibles = [20, 40];
    const opcionesContainer = document.getElementById('opcionesPedido');
    opcionesContainer.innerHTML = opcionesDisponibles.map((gramos) => {
        const precioTotal = (precioBase * gramos / 10).toFixed(0);
        return `<button type="button" class="opcion-pedido" data-gramos="${gramos}" data-precio="${precioTotal}">${gramos}g - $${precioTotal}</button>`;
    }).join('');

    if (!disponible) {
        document.querySelectorAll('.opcion-pedido').forEach((btn) => {
            btn.disabled = true;
        });
        document.getElementById('pedidoAlerta').textContent = 'Producto no disponible';
        document.getElementById('btnRealizarPedido').disabled = true;
    } else {
        document.getElementById('pedidoAlerta').textContent = '';
    }

    if (appState.socioData?.id) {
        try {
            const fechas = appState.fechasEntrega || calcularFechasEntrega();
            const tipoEditando = appState.reservaEditandoTipo === 'ultimo' ? 'ultimo_jueves'
                : (appState.reservaEditandoTipo === 'primer' ? 'primer_jueves' : '');
            const tipoEntrega = tipoEditando || (puedeConfirmar(fechas.primerJueves, configSistema.horasLimitePrimer) ? 'primer_jueves'
                : (puedeConfirmar(fechas.ultimoJueves, configSistema.horasLimiteUltimo) ? 'ultimo_jueves' : null));
            const fechaEntrega = tipoEntrega === 'primer_jueves' ? fechas.primerJueves : fechas.ultimoJueves;
            const reservas = tipoEntrega ? await obtenerReservas(appState.socioData.id) : [];
            const reserva = appState.reservaEditandoId
                ? reservas.find((item) => String(item.id) === String(appState.reservaEditandoId))
                : (tipoEntrega ? obtenerReservaActivaPorEntrega(reservas, tipoEntrega, fechaEntrega) : null);
            appState.reservaEditandoGramos = Number(reserva?.cantidad_gramos || 0);
            if (appState.reservaEditandoId && appState.reservaEditandoGramos > 0) {
                appState.gramosSeleccionadosPedido = appState.reservaEditandoGramos;
            }
        } catch (error) {
            appState.reservaEditandoGramos = 0;
        }
    }

    document.getElementById('productoModal').style.display = 'flex';
    inicializarPedidoModal();
}

function cerrarProductoModal() {
    document.getElementById('productoModal').style.display = 'none';
    const pedidoBox = document.querySelector('#productoModal .modal-pedido-box');
    if (pedidoBox) pedidoBox.style.display = '';
    document.getElementById('panelCalificacion').style.display = 'none';
    document.getElementById('calificacionMensaje').innerHTML = '';
    appState.productoModalActual = null;
    appState.gramosSeleccionadosPedido = null;
    appState.reservaEditandoGramos = 0;
    appState.reservaEditandoId = null;
    appState.reservaEditandoTipo = null;
    calificacionSeleccionada = 0;
}

window.editarProductoAdmin = async function(id) {
    const { data, error } = await supabaseClient.from('productos').select('*').eq('id', id).single();
    if (error || !data) {
        mostrarMensaje('No se pudo cargar el producto para editar', false);
        return;
    }
    appState.productoEditandoId = id;
    document.getElementById('editNombre').value = data.nombre || '';
    const tipoCatalogo = obtenerTipoCatalogoProductoEdicion(data);
    const esArticulo = productoEdicionEsArticuloTipo(tipoCatalogo);
    document.getElementById('editCepa').value = esArticulo ? '' : (data.cepa || '');
    document.getElementById('editThc').value = data.thc_porcentaje || '';
    document.getElementById('editCbd').value = data.cbd_porcentaje || '';
    const perfilIndicaSativa = typeof parsearPerfilIndicaSativa === 'function'
        ? parsearPerfilIndicaSativa(data.indica_sativa)
        : { indica: null, sativa: null };
    document.getElementById('editIndicaPorcentaje').value = perfilIndicaSativa.indica ?? '';
    document.getElementById('editSativaPorcentaje').value = perfilIndicaSativa.sativa ?? '';
    sincronizarPerfilDesdeIndica();
    document.getElementById('editTipoCultivo').value = tipoCatalogo;
    document.getElementById('editPrecio').value = data.precio_por_10g || 1600;
    document.getElementById('editDescripcion').value = data.descripcion || '';
    document.getElementById('editImagenUrl').value = data.imagen_url || '';
    if (typeof limpiarInputImagenes === 'function') limpiarInputImagenes('editImagenFile', 'editImagenPreview');
    document.getElementById('editProductoModal').style.display = 'flex';
};

function cerrarEditProducto() {
    document.getElementById('editProductoModal').style.display = 'none';
    if (typeof limpiarInputImagenes === 'function') limpiarInputImagenes('editImagenFile', 'editImagenPreview');
    appState.productoEditandoId = null;
}

window.cerrarEditProducto = cerrarEditProducto;

function normalizarPorcentajePerfil(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    const ajustado = Math.max(0, Math.min(100, Math.round(numero / 10) * 10));
    return String(ajustado);
}

function sincronizarPerfilDesdeIndica() {
    const indicaInput = document.getElementById('editIndicaPorcentaje');
    const sativaInput = document.getElementById('editSativaPorcentaje');
    if (!indicaInput || !sativaInput) return;
    const indica = normalizarPorcentajePerfil(indicaInput.value);
    indicaInput.value = indica;
    if (indica !== '') sativaInput.value = String(100 - Number(indica));
}

function sincronizarPerfilDesdeSativa() {
    const indicaInput = document.getElementById('editIndicaPorcentaje');
    const sativaInput = document.getElementById('editSativaPorcentaje');
    if (!indicaInput || !sativaInput) return;
    const sativa = normalizarPorcentajePerfil(sativaInput.value);
    sativaInput.value = sativa;
    if (sativa !== '') indicaInput.value = String(100 - Number(sativa));
}

let calificacionSeleccionada = 0;

window.togglePanelCalificacion = function() {
    const panel = document.getElementById('panelCalificacion');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        cargarCalificacionExistente();
    } else {
        panel.style.display = 'none';
    }
};

window.seleccionarEstrella = function(valor) {
    calificacionSeleccionada = valor;
    document.querySelectorAll('.calificacion-estrella').forEach((estrella, index) => {
        estrella.classList.toggle('activa', index < valor);
    });
};

async function cargarCalificacionExistente() {
    if (!appState.productoModalActual || !appState.socioData?.id) return;
    const puntuacion = await obtenerCalificacionUsuario(appState.productoModalActual.id, appState.socioData.id);
    if (!puntuacion) {
        calificacionSeleccionada = 0;
        document.querySelectorAll('.calificacion-estrella').forEach((estrella) => estrella.classList.remove('activa'));
        return;
    }
    calificacionSeleccionada = puntuacion;
    window.seleccionarEstrella(puntuacion);
}

window.enviarCalificacion = async function() {
    if (!appState.productoModalActual) {
        mostrarMensaje('No hay producto seleccionado', false);
        return;
    }
    if (!appState.socioData?.id) {
        mostrarMensaje('Iniciá sesión para calificar', false);
        return;
    }
    if (!calificacionSeleccionada) {
        mostrarMensaje('Seleccioná una cantidad de estrellas', false);
        return;
    }
    const resultado = await calificarProducto(appState.productoModalActual.id, appState.socioData.id, calificacionSeleccionada);
    document.getElementById('calificacionMensaje').innerHTML = resultado.success
        ? '<span style="color: #000000;">Calificación enviada</span>'
        : '<span style="color: #e0b8a0;">Error al calificar</span>';
    if (resultado.success) {
        setTimeout(() => {
            document.getElementById('panelCalificacion').style.display = 'none';
            cargarProductosPublicos();
        }, 1200);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof configurarInputImagenesConLimite === 'function') {
        configurarInputImagenesConLimite('editImagenFile', 'editImagenPreview', 'productos');
    }
    document.getElementById('editIndicaPorcentaje')?.addEventListener('change', sincronizarPerfilDesdeIndica);
    document.getElementById('editSativaPorcentaje')?.addEventListener('change', sincronizarPerfilDesdeSativa);
    document.getElementById('formEditProducto')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!appState.productoEditandoId) return;
        const { data: productoActual } = await supabaseClient
            .from('productos')
            .select('imagen_url')
            .eq('id', appState.productoEditandoId)
            .single();
        let imagenUrlEditada = document.getElementById('editImagenUrl').value || null;
        const imagenesEditadas = typeof obtenerArchivosAcumulados === 'function'
            ? obtenerArchivosAcumulados('editImagenFile')
            : document.getElementById('editImagenFile')?.files;
        if (imagenesEditadas?.length) {
            try {
                const subidas = await subirMultiplesImagenes('productos', imagenesEditadas, 'producto_edit');
                imagenUrlEditada = subidas[0] || imagenUrlEditada;
            } catch (error) {
                mostrarMensaje(`No se pudo subir la imagen: ${error.message}`, false);
                return;
            }
        }
        const tipoSeleccionado = normalizarTipoCultivoEdicion(document.getElementById('editTipoCultivo').value);
        const esArticulo = productoEdicionEsArticuloTipo(tipoSeleccionado);
        const updates = {
            nombre: document.getElementById('editNombre').value,
            cepa: esArticulo ? `ARTICULO:${tipoSeleccionado}` : document.getElementById('editCepa').value,
            thc_porcentaje: esArticulo ? null : (parseFloat(document.getElementById('editThc').value) || null),
            cbd_porcentaje: esArticulo ? null : (parseFloat(document.getElementById('editCbd').value) || null),
            indica_sativa: typeof construirPerfilIndicaSativa === 'function'
                ? construirPerfilIndicaSativa(
                    document.getElementById('editIndicaPorcentaje').value,
                    document.getElementById('editSativaPorcentaje').value
                )
                : null,
            tipo_cultivo: esArticulo ? 'invernaculo' : tipoSeleccionado,
            precio_por_10g: parseFloat(document.getElementById('editPrecio').value) || 1600,
            descripcion: document.getElementById('editDescripcion').value,
            imagen_url: imagenUrlEditada
        };
        const resultadoActualizacion = typeof actualizarProductoConCompatibilidad === 'function'
            ? await actualizarProductoConCompatibilidad(appState.productoEditandoId, updates)
            : await supabaseClient.from('productos').update(updates).eq('id', appState.productoEditandoId);
        let { error } = resultadoActualizacion || {};
        if (error) {
            mostrarMensaje(`No se pudo actualizar el producto: ${error.message}`, false);
            return;
        }
        if (
            productoActual?.imagen_url &&
            productoActual.imagen_url !== updates.imagen_url &&
            typeof eliminarArchivoStoragePorUrl === 'function'
        ) {
            await eliminarArchivoStoragePorUrl(productoActual.imagen_url);
        }
        mostrarMensaje('Producto actualizado', true);
        cerrarEditProducto();
        if (typeof cargarProductosAdmin === 'function') await cargarProductosAdmin();
        if (typeof cargarProductosPublicos === 'function') await cargarProductosPublicos();
    });

    document.querySelector('#productoModal .cerrar-modal')?.addEventListener('click', cerrarProductoModal);
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('productoModal')) cerrarProductoModal();
        if (event.target === document.getElementById('editProductoModal')) cerrarEditProducto();
    });
});
