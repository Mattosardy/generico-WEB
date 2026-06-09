function obtenerPedidosProductos() {
    localStorage.removeItem('generico_pedidos_productos');
    return [];
}

function guardarPedidosProductos(pedidos) {
    localStorage.removeItem('generico_pedidos_productos');
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

function actualizarOpcionesPlanPlusEdicion(plusActivo) {
    const select = document.getElementById('editTipoCultivo');
    if (!select) return;
    Array.from(select.options).forEach((option) => {
        if (productoEdicionEsArticuloTipo(option.value)) {
            option.hidden = !plusActivo;
            option.disabled = !plusActivo;
        }
    });
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

const GRAMOS_POR_UNIDAD_ARTICULO = 20;

function productoModalEsArticulo() {
    return typeof productoEsArticulo === 'function' && productoEsArticulo(appState.productoModalActual || {});
}

function unidadesDesdeGramosPedido(gramos) {
    const gramosNumero = Number(gramos || 0);
    if (!Number.isFinite(gramosNumero) || gramosNumero <= 0) return 0;
    return Math.max(0, Math.round(gramosNumero / GRAMOS_POR_UNIDAD_ARTICULO));
}

function formatearCantidadPedido(gramos, esArticulo = false) {
    if (!esArticulo) return formatearPacksReserva(gramos);
    const unidades = unidadesDesdeGramosPedido(gramos);
    return `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`;
}

function formatearResumenDisponible(gramos, esArticulo = false) {
    if (!esArticulo) return `${gramosAPacks(gramos)} packs`;
    const unidades = unidadesDesdeGramosPedido(gramos);
    return `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`;
}

function formatearTextoDisponibles(gramos, esArticulo = false) {
    if (!esArticulo) return `${gramosAPacks(gramos)} packs disponibles`;
    const unidades = unidadesDesdeGramosPedido(gramos);
    return `${unidades} ${unidades === 1 ? 'unidad disponible' : 'unidades disponibles'}`;
}

function obtenerPrecioArticuloDesdeGramos(gramos, precioBase) {
    const unidades = unidadesDesdeGramosPedido(gramos);
    const precioBaseNumero = Number(precioBase || 0);
    return precioBaseNumero * unidades;
}

function obtenerPrecioVariedadDesdeGramos(gramos, precioPack) {
    const precioPackNumero = Number(precioPack || 0);
    const packs = typeof gramosAPacks === 'function'
        ? gramosAPacks(gramos)
        : Number(gramos || 0) / GRAMOS_POR_UNIDAD_ARTICULO;
    if (!Number.isFinite(precioPackNumero) || !Number.isFinite(packs)) return 0;
    return precioPackNumero * packs;
}

function obtenerMaxUnidadesPedidoArticulo(producto = {}) {
    const stock = typeof obtenerInfoStockProducto === 'function'
        ? obtenerInfoStockProducto(producto)
        : { stockActivo: false, gramosDisponibles: 0 };
    const unidadesDisponibles = stock.stockActivo
        ? unidadesDesdeGramosPedido(stock.gramosDisponibles)
        : 5;
    return Math.max(1, Math.min(unidadesDisponibles || 1, 10));
}

function obtenerPrecioPedidoSeleccionado(gramos, esArticulo = false) {
    const producto = appState.productoModalActual || {};
    const precioBaseNumero = Number(producto.precio_por_10g || 0);
    if (!precioBaseNumero || !Number(gramos || 0)) return 0;
    return esArticulo
        ? obtenerPrecioArticuloDesdeGramos(gramos, precioBaseNumero)
        : obtenerPrecioVariedadDesdeGramos(gramos, precioBaseNumero);
}

function actualizarEstadoPedidoModal() {
    const cupoMensual = obtenerCupoMensualGramos();
    const restante = Math.max(0, cupoMensual - obtenerTotalPedidoMesActual());
    const packsRestantes = gramosAPacks(restante);
    const packsCupo = gramosAPacks(cupoMensual);
    const restanteEl = document.getElementById('pedidoRestante');
    const alertaEl = document.getElementById('pedidoAlerta');
    const botonEl = document.getElementById('btnRealizarPedido');
    if (!restanteEl || !alertaEl || !botonEl) return;

    const esArticulo = productoModalEsArticulo();
    const cicloActual = obtenerCicloClub();
    const stock = typeof obtenerInfoStockProducto === 'function'
        ? obtenerInfoStockProducto(appState.productoModalActual || {})
        : { stockActivo: false, stockPacks: 0, gramosDisponibles: 0, sinStock: false };
    const detalleStock = stock.stockActivo
        ? ` Stock: ${esArticulo ? formatearTextoDisponibles(stock.gramosDisponibles, true) : formatearPacksDisponibles(stock.stockPacks, stock.gramosDisponibles)}.`
        : '';
    const passwordTemporalPendiente = typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword();
    const disponibleTexto = esArticulo
        ? 'Los artículos no descuentan cupo mensual'
        : `${packsRestantes} de ${packsCupo} packs`;
    restanteEl.textContent = esArticulo
        ? `${disponibleTexto}.${detalleStock}`
        : `Cupo disponible en este ciclo (${cicloActual.etiqueta}): ${disponibleTexto}.${detalleStock}`;
    alertaEl.textContent = '';
    document.querySelectorAll('#opcionesPedido .opcion-pedido').forEach((btn) => {
        const gramos = Number(btn.dataset.gramos);
        const sinStockParaCantidad = stock.stockActivo && !productoTieneStockParaGramos(appState.productoModalActual || {}, gramos);
        btn.classList.toggle('activa', gramos === appState.gramosSeleccionadosPedido);
        btn.disabled = passwordTemporalPendiente || (!esArticulo && gramos > restante) || sinStockParaCantidad;
        if (sinStockParaCantidad) {
            btn.title = esArticulo ? 'No hay unidades suficientes para esta cantidad' : 'No hay packs suficientes para esta cantidad';
        } else {
            btn.removeAttribute('title');
        }
    });
    if (esArticulo) {
        const unidades = unidadesDesdeGramosPedido(appState.gramosSeleccionadosPedido);
        const maxUnidades = obtenerMaxUnidadesPedidoArticulo(appState.productoModalActual || {});
        const cantidadEl = document.querySelector('[data-articulo-cantidad]');
        const menosEl = document.querySelector('[data-articulo-step="-1"]');
        const masEl = document.querySelector('[data-articulo-step="1"]');
        if (cantidadEl) cantidadEl.textContent = String(unidades);
        if (menosEl) menosEl.disabled = passwordTemporalPendiente || unidades <= 0 || stock.sinStock;
        if (masEl) masEl.disabled = passwordTemporalPendiente || unidades >= maxUnidades || stock.sinStock;
    }

    if (stock.sinStock) {
        alertaEl.textContent = 'SIN STOCK';
        botonEl.disabled = true;
        botonEl.innerHTML = appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido';
        return;
    }
    if (passwordTemporalPendiente) {
        alertaEl.textContent = 'Cambiá tu contraseña temporal para poder reservar.';
        botonEl.disabled = true;
        botonEl.innerHTML = appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido';
        return;
    }
    if (!appState.gramosSeleccionadosPedido) {
        botonEl.disabled = true;
        botonEl.innerHTML = appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido';
        return;
    }
    if (!esArticulo && appState.gramosSeleccionadosPedido > restante) {
        alertaEl.textContent = `No podés pedir ${formatearCantidadPedido(appState.gramosSeleccionadosPedido, esArticulo)}. Te quedan ${formatearTextoDisponibles(restante, esArticulo)} en este ciclo.`;
        botonEl.disabled = true;
        return;
    }
    if (stock.stockActivo && !productoTieneStockParaGramos(appState.productoModalActual || {}, appState.gramosSeleccionadosPedido)) {
        alertaEl.textContent = `No hay ${esArticulo ? 'unidades' : 'packs'} suficientes para pedir ${formatearCantidadPedido(appState.gramosSeleccionadosPedido, esArticulo)}.`;
        botonEl.disabled = true;
        return;
    }
    const seleccion = document.querySelector(`#opcionesPedido .opcion-pedido[data-gramos="${appState.gramosSeleccionadosPedido}"]`);
    const restanteLuego = Math.max(0, restante - Number(appState.gramosSeleccionadosPedido || 0));
    restanteEl.textContent = esArticulo
        ? `Pedido seleccionado: ${formatearCantidadPedido(appState.gramosSeleccionadosPedido, true)}. Los artículos se entregan junto a la mensu.${detalleStock}`
        : `Pedido seleccionado: ${formatearCantidadPedido(appState.gramosSeleccionadosPedido, false)}. Quedan ${formatearTextoDisponibles(restanteLuego, false)} en este ciclo.${detalleStock}`;
    const puedeVerPrecios = typeof usuarioPuedeVerPrecios !== 'function' || usuarioPuedeVerPrecios();
    const precioSeleccionado = puedeVerPrecios
        ? (Number(seleccion?.dataset.precio || 0) || obtenerPrecioPedidoSeleccionado(appState.gramosSeleccionadosPedido, esArticulo))
        : 0;
    botonEl.innerHTML = `${appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido'}${precioSeleccionado ? ` - $${precioSeleccionado.toFixed(0)}` : ''}`;
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
            const restante = Math.max(0, obtenerCupoMensualGramos() - obtenerTotalPedidoMesActual());
            const esArticulo = productoModalEsArticulo();
            if (!esArticulo && gramos > restante) {
                mostrarMensaje(`Te quedan ${formatearTextoDisponibles(restante, esArticulo)} en este ciclo.`, false);
                return;
            }
            if (typeof productoTieneStockParaGramos === 'function' && !productoTieneStockParaGramos(appState.productoModalActual || {}, gramos)) {
                mostrarMensaje(`No hay ${esArticulo ? 'unidades' : 'packs'} suficientes para esa cantidad.`, false);
                return;
            }
            appState.gramosSeleccionadosPedido = gramos;
            const puedeVerPrecios = typeof usuarioPuedeVerPrecios !== 'function' || usuarioPuedeVerPrecios();
            const precio = obtenerPrecioPedidoSeleccionado(gramos, esArticulo);
            document.getElementById('btnRealizarPedido').innerHTML = `${appState.reservaEditandoId ? 'Modificar pedido' : 'Realizar pedido'}${puedeVerPrecios && precio ? ` - $${precio.toFixed(0)}` : ''}`;
            actualizarEstadoPedidoModal();
        };
    });
    document.querySelectorAll('#opcionesPedido [data-articulo-step]').forEach((btn) => {
        btn.onclick = () => {
            const paso = Number(btn.dataset.articuloStep || 0);
            const unidadesActuales = unidadesDesdeGramosPedido(appState.gramosSeleccionadosPedido);
            const maxUnidades = obtenerMaxUnidadesPedidoArticulo(appState.productoModalActual || {});
            const nuevasUnidades = Math.max(0, Math.min(maxUnidades, unidadesActuales + paso));
            appState.gramosSeleccionadosPedido = nuevasUnidades > 0
                ? nuevasUnidades * GRAMOS_POR_UNIDAD_ARTICULO
                : null;
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
    if (typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword()) {
        mostrarMensaje('Cambiá tu contraseña temporal para poder reservar.', false);
        return;
    }
    if (!appState.gramosSeleccionadosPedido) {
        mostrarMensaje('Seleccioná una cantidad para continuar.', false);
        return;
    }

    const esArticulo = productoModalEsArticulo();
    if (typeof obtenerInfoStockProducto === 'function') {
        const stock = obtenerInfoStockProducto(appState.productoModalActual);
        if (stock.sinStock) {
            mostrarMensaje(`No hay stock disponible para ${esArticulo ? 'este artículo' : 'esta variedad'}.`, false);
            return;
        }
        if (stock.stockActivo && !productoTieneStockParaGramos(appState.productoModalActual, appState.gramosSeleccionadosPedido)) {
            mostrarMensaje(`No hay ${esArticulo ? 'unidades' : 'packs'} suficientes para esa cantidad.`, false);
            return;
        }
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
    const productosCiclo = typeof obtenerProductos === 'function' ? await obtenerProductos() : [];
    const reservaExistente = appState.reservaEditandoId
        ? reservas.find((reserva) => (
            String(reserva.id) === String(appState.reservaEditandoId)
            && String(reserva.socio_id) === String(appState.socioData.id)
            && reserva.estado !== 'cancelado'
        ))
        : null;
    const totalActual = esArticulo
        ? obtenerTotalPedidoMesActual()
        : Math.max(0, sumarGramosReservadosEnCiclo(reservas, appState.cicloClubActual || obtenerCicloClub(), productosCiclo) - Number(appState.reservaEditandoGramos || 0));
    const cupoMensual = obtenerCupoMensualGramos();
    if (!esArticulo && totalActual + appState.gramosSeleccionadosPedido > cupoMensual) {
        mostrarMensaje(`Límite mensual alcanzado. Ya llevás ${formatearResumenDisponible(totalActual, esArticulo)} en este ciclo.`, false);
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

    mostrarMensaje(`${reservaExistente ? 'Pedido modificado' : 'Pedido enviado'}: ${normalizarTextoVisual(appState.productoModalActual.nombre)} - ${formatearCantidadPedido(appState.gramosSeleccionadosPedido, esArticulo)}. Revisá el detalle en tu carrito.`, true);
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
            this.src = crearPlaceholderProducto();
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
            this.src = crearPlaceholderProducto();
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
            this.src = crearPlaceholderProducto();
        };
        principal.src = imagen;
    }

    actualizarControlesGaleriaProducto();
};

function renderizarGaleriaProductoModal(imagenes, titulo) {
    const imagenesVisibles = normalizarListaImagenes(imagenes).slice(0, 3);
    const imagenesFinales = imagenesVisibles.length
        ? imagenesVisibles
        : [crearPlaceholderProducto()];
    const imagenPrincipal = imagenesFinales[0];
    const tieneGaleria = imagenesFinales.length > 1;
    return `
        <div class="modal-galeria horizontal producto-simple">
            <div class="modal-galeria-frame">
                ${tieneGaleria ? `<button type="button" class="galeria-flecha izquierda" id="galeriaPrev" onclick="cambiarImagenGaleria(-1)" aria-label="Imagen anterior">
                    <i class="fas fa-chevron-left"></i>
                </button>` : ''}
                <img id="modalImagenGaleria" class="modal-imagen" src="${imagenPrincipal}" alt="${escapeHtml(titulo)}">
                ${tieneGaleria ? `<button type="button" class="galeria-flecha derecha" id="galeriaNext" onclick="cambiarImagenGaleria(1)" aria-label="Imagen siguiente">
                    <i class="fas fa-chevron-right"></i>
                </button>` : ''}
            </div>
            ${tieneGaleria ? `
                <div class="galeria-strip">
                    ${imagenesFinales.map((imagen, index) => `
                        <button type="button" class="galeria-thumb${index === 0 ? ' activa' : ''}" onclick="seleccionarImagenProducto(${index})" aria-label="Ver imagen ${index + 1}">
                            <img src="${imagen}" alt="${escapeHtml(titulo)} ${index + 1}" onerror="this.onerror=null; this.src='${crearPlaceholderProducto()}';">
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
    const precioBaseNumero = Number(precioBase) || 0;
    const disponible = producto.disponible !== false;
    const esArticulo = typeof productoEsArticulo === 'function' && productoEsArticulo(producto);

    const imagenesBase = normalizarListaImagenes(producto.imagen_url);
    let imagenesGaleria = [];
    if (typeof obtenerImagenesProducto === 'function') {
        try {
            const imagenes = await obtenerImagenesProducto(producto.id);
            if (imagenes?.length) imagenesGaleria = imagenes.map((img) => img.imagen_url);
        } catch (error) {
            console.warn('No se pudo cargar la galeria del producto', error);
        }
    }
    let imagenesArray = [...imagenesBase, ...normalizarListaImagenes(imagenesGaleria)]
        .filter((imagen, index, lista) => imagen && lista.indexOf(imagen) === index)
        .slice(0, 3);
    if (!imagenesArray.length) imagenesArray = [crearPlaceholderProducto()];

    appState.galeriaActual = { imagenes: imagenesArray, indice: 0, productoId: producto.id };

    const modalMedia = document.getElementById('modalMedia');
    modalMedia.innerHTML = renderizarGaleriaProductoModal(imagenesArray, normalizarTextoVisual(producto.nombre || 'Variedad'));
    const imagenPrincipal = document.getElementById('modalImagenGaleria');
    if (imagenPrincipal) {
        imagenPrincipal.onerror = function onErrorImagen() {
            this.onerror = null;
            this.src = crearPlaceholderProducto();
        };
    }

    actualizarControlesGaleriaProducto();
    habilitarSwipeGaleriaProducto();

    document.getElementById('modalTitulo').textContent = normalizarTextoVisual(producto.nombre);
    document.getElementById('modalCepa').textContent = esArticulo
        ? (typeof obtenerTituloTipoCultivo === 'function' && typeof obtenerTipoCatalogoProducto === 'function' ? obtenerTituloTipoCultivo(obtenerTipoCatalogoProducto(producto)) : 'Artículo destacado')
        : normalizarTextoVisual(producto.cepa || 'Cepa especial');
    document.getElementById('modalDescripcion').textContent = normalizarTextoVisual(producto.descripcion || '');
    const precioUnidadTexto = precioBaseNumero
        ? (typeof formatearPrecioVisible === 'function'
            ? formatearPrecioVisible(precioBaseNumero)
            : `$${precioBaseNumero.toFixed(0)}`)
        : '';
    document.getElementById('modalThc').textContent = esArticulo
        ? `${disponible ? 'Disponible' : 'No disponible'}${precioUnidadTexto ? ` | ${precioUnidadTexto} por unidad` : ''}`
        : `THC: ${producto.thc_porcentaje || '?'}% | CBD: ${producto.cbd_porcentaje || '?'}%`;
    if (!esArticulo && typeof obtenerInfoStockProducto === 'function') {
        const stock = obtenerInfoStockProducto(producto);
        if (stock.stockActivo) {
            document.getElementById('modalThc').textContent += ` | Stock: ${formatearPacksDisponibles(stock.stockPacks, stock.gramosDisponibles)}`;
            if (stock.sinStock) document.getElementById('modalThc').textContent += ' | SIN STOCK';
            if (stock.bajoStock) document.getElementById('modalThc').textContent += ' | Poca disponibilidad';
        }
    }
    document.getElementById('panelCalificacion').style.display = 'none';
    document.getElementById('calificacionMensaje').innerHTML = '';
    calificacionSeleccionada = 0;
    const botonCalificacion = document.getElementById('btnMostrarCalificacion');
    if (botonCalificacion) {
        botonCalificacion.style.display = esArticulo ? 'none' : '';
    }

    const pedidoBox = document.querySelector('#productoModal .modal-pedido-box');
    if (pedidoBox) pedidoBox.style.display = '';

    const pedidoTitulo = document.querySelector('#productoModal .modal-pedido-titulo');
    if (pedidoTitulo) {
        pedidoTitulo.textContent = esArticulo ? 'Pedido por unidad' : 'Pedido mensual';
    }
    const pedidoInfo = document.querySelector('#productoModal .modal-pedido-info');
    if (pedidoInfo) {
        pedidoInfo.innerHTML = esArticulo
            ? 'Elegí la cantidad por unidad para este pedido:<br><span style="display:block;margin-top:6px;color:var(--text-muted);">Las entregas de artículos se realizarán junto a la entrega de la mensu.</span>'
            : 'Elegí la cantidad para este pedido mensual:';
    }

    const opcionesContainer = document.getElementById('opcionesPedido');
    const puedeVerPreciosPedido = typeof usuarioPuedeVerPrecios !== 'function' || usuarioPuedeVerPrecios();
    if (esArticulo) {
        const precioUnidad = obtenerPrecioArticuloDesdeGramos(GRAMOS_POR_UNIDAD_ARTICULO, precioBaseNumero).toFixed(0);
        const precioAttr = puedeVerPreciosPedido ? ` data-precio="${precioUnidad}"` : '';
        const precioLabel = puedeVerPreciosPedido ? ` - $${precioUnidad}` : '';
        opcionesContainer.innerHTML = `
            <button type="button" class="opcion-pedido opcion-pedido-articulo-base" data-gramos="${GRAMOS_POR_UNIDAD_ARTICULO}"${precioAttr}>1 unidad${precioLabel}</button>
            <div class="articulo-cantidad-control" aria-label="Cantidad de unidades">
                <button type="button" class="articulo-cantidad-btn" data-articulo-step="-1" aria-label="Quitar una unidad">-</button>
                <span class="articulo-cantidad-numero" data-articulo-cantidad>0</span>
                <button type="button" class="articulo-cantidad-btn" data-articulo-step="1" aria-label="Agregar una unidad">+</button>
            </div>
        `;
    } else {
        opcionesContainer.innerHTML = [20, 40].map((gramos) => {
            const precioTotal = obtenerPrecioVariedadDesdeGramos(gramos, precioBaseNumero).toFixed(0);
            const precioAttr = puedeVerPreciosPedido ? ` data-precio="${precioTotal}"` : '';
            const precioLabel = puedeVerPreciosPedido ? ` - $${precioTotal}` : '';
            return `<button type="button" class="opcion-pedido" data-gramos="${gramos}"${precioAttr}>${formatearCantidadPedido(gramos, false)}${precioLabel}</button>`;
        }).join('');
    }

    const stockModal = typeof obtenerInfoStockProducto === 'function'
        ? obtenerInfoStockProducto(producto)
        : { sinStock: false };

    if (!disponible || stockModal.sinStock) {
        document.querySelectorAll('.opcion-pedido').forEach((btn) => {
            btn.disabled = true;
        });
        document.getElementById('pedidoAlerta').textContent = stockModal.sinStock ? 'SIN STOCK' : 'Producto no disponible';
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
                ? reservas.find((item) => (
                    String(item.id) === String(appState.reservaEditandoId)
                    && String(item.socio_id) === String(appState.socioData.id)
                    && item.estado !== 'cancelado'
                ))
                : (tipoEntrega ? obtenerReservaActivaPorEntrega(reservas, tipoEntrega, fechaEntrega) : null);
            appState.reservaEditandoGramos = Number(reserva?.cantidad_gramos || 0);
            if (appState.reservaEditandoId && appState.reservaEditandoGramos > 0) {
                appState.gramosSeleccionadosPedido = appState.reservaEditandoGramos;
            }
        } catch (error) {
            appState.reservaEditandoGramos = 0;
        }
    }

    const productoModal = document.getElementById('productoModal');
    productoModal.style.display = 'flex';
    productoModal.classList.add('is-open');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    inicializarPedidoModal();
}

function cerrarProductoModal() {
    const productoModal = document.getElementById('productoModal');
    productoModal.style.display = 'none';
    productoModal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
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
    const tipoCatalogo = obtenerTipoCatalogoProductoEdicion(data);
    const esArticulo = productoEdicionEsArticuloTipo(tipoCatalogo);
    const plusActivo = typeof planPlusActivo === 'function' ? planPlusActivo() : false;
    actualizarOpcionesPlanPlusEdicion(plusActivo);
    if (esArticulo && !plusActivo) {
        appState.productoEditandoId = null;
        mostrarMensaje('Artículos destacados requiere Plan Plus. Contactá al proveedor para activarlo.', false);
        return;
    }
    document.getElementById('editNombre').value = data.nombre || '';
    document.getElementById('editCepa').value = esArticulo ? '' : (data.cepa || '');
    document.getElementById('editThc').value = data.thc_porcentaje || '';
    document.getElementById('editCbd').value = data.cbd_porcentaje || '';
    const perfilIndicaSativa = typeof parsearPerfilIndicaSativa === 'function'
        ? parsearPerfilIndicaSativa(data.indica_sativa)
        : { indica: null, sativa: null };
    document.getElementById('editIndicaPorcentaje').value = perfilIndicaSativa.indica ?? '';
    document.getElementById('editSativaPorcentaje').value = perfilIndicaSativa.sativa ?? '';
    sincronizarPerfilDesdeIndica();
    const formGrid = document.querySelector('#formEditProducto .form-grid');
    if (formGrid && !document.getElementById('editStockPacks')) {
        const stockFields = document.createElement('div');
        stockFields.className = 'form-group full-width stock-edit-grid';
        stockFields.innerHTML = `
            <div class="form-group"><label>Stock disponible en packs</label><input type="number" min="0" step="1" id="editStockPacks" value="0"></div>
            <div class="form-group"><label>Bajo stock desde X packs</label><input type="number" min="0" step="1" id="editBajoStockPacks" value="2"></div>
            <div class="form-group stock-admin-control"><label><input type="checkbox" id="editStockActivo" checked> Controlar stock</label><small id="editStockEquivalente">0 Packs (0g)</small></div>
        `;
        const descripcion = document.getElementById('editDescripcion')?.closest('.form-group');
        formGrid.insertBefore(stockFields, descripcion || null);
        document.getElementById('editStockPacks')?.addEventListener('input', () => {
            if (typeof actualizarEquivalenciaStockAdmin === 'function') actualizarEquivalenciaStockAdmin('edit');
        });
    }
    const stock = typeof obtenerInfoStockProducto === 'function' ? obtenerInfoStockProducto(data) : { stockPacks: 0, bajoStockPacks: 2, stockActivo: true };
    if (document.getElementById('editStockPacks')) document.getElementById('editStockPacks').value = stock.stockPacks;
    if (document.getElementById('editBajoStockPacks')) document.getElementById('editBajoStockPacks').value = stock.bajoStockPacks;
    if (document.getElementById('editStockActivo')) document.getElementById('editStockActivo').checked = stock.stockActivo;
    if (typeof actualizarEquivalenciaStockAdmin === 'function') actualizarEquivalenciaStockAdmin('edit');
    document.getElementById('editTipoCultivo').value = tipoCatalogo;
    document.getElementById('editPrecio').value = data.precio_por_10g || 1600;
    document.getElementById('editDescripcion').value = data.descripcion || '';
    document.getElementById('editImagenUrl').value = data.imagen_url || '';
    if (typeof limpiarInputImagenes === 'function') limpiarInputImagenes('editImagenFile', 'editImagenPreview');
    const editModal = document.getElementById('editProductoModal');
    editModal.style.display = 'flex';
    editModal.classList.add('is-open');
    document.body.classList.add('modal-open');
};

function cerrarEditProducto() {
    const editModal = document.getElementById('editProductoModal');
    editModal.style.display = 'none';
    editModal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
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
        const plusActivo = typeof planPlusActivo === 'function' ? planPlusActivo() : false;
        if (esArticulo && !plusActivo) {
            mostrarMensaje('Artículos destacados requiere Plan Plus. Contactá al proveedor para activarlo.', false);
            return;
        }
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
            imagen_url: imagenUrlEditada,
            ...(typeof obtenerPayloadStockAdmin === 'function' ? obtenerPayloadStockAdmin('edit') : {})
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
