function sumarGramosReservadosEnCiclo(reservas = [], ciclo = obtenerCicloClub()) {
    return reservas
        .filter((reserva) => reserva?.estado !== 'cancelado' && fechaEstaEnCicloClub(reserva?.fecha_retiro, ciclo))
        .reduce((total, reserva) => total + Number(reserva?.cantidad_gramos || 0), 0);
}

function reservaEstaActiva(reserva) {
    return reserva && reserva.estado !== 'cancelado';
}

function obtenerReservaActivaPorEntrega(reservas, tipoEntrega, fechaEntrega) {
    const fechaClave = fechaEntrega.toISOString().slice(0, 10);
    return reservas.find((reserva) => (
        reservaEstaActiva(reserva)
        && reserva.tipo_entrega === tipoEntrega
        && formatearFechaClave(parsearFechaConfigEntrega(reserva.fecha_retiro) || new Date(reserva.fecha_retiro)) === fechaClave
    ));
}

function construirAccionModificarReservaHTML(reserva, tipo, puedeModificar) {
    if (!reservaEstaActiva(reserva)) return '';
    if (!puedeModificar) {
        return '<div class="estado-reserva estado-pendiente">No se puede modificar: plazo vencido</div>';
    }
    return `<button type="button" class="btn-modificar-reserva" data-reserva-id="${reserva.id}" data-tipo="${tipo}">Modificar pedido</button>`;
}

function obtenerTipoReservaUI(reserva) {
    return String(reserva?.tipo_entrega || '').includes('primer') ? 'primer' : 'ultimo';
}

function obtenerEtiquetaEstadoReserva(reserva, puedeReservar = true) {
    if (reserva?.estado === 'cancelado') return 'Cancelado';
    if (!reservaEstaActiva(reserva)) return puedeReservar ? 'Pendiente' : 'Cerrada';
    if (reserva.estado === 'confirmado') return 'Pedido confirmado';
    if (reserva.estado === 'entregado' || reserva.estado === 'retirado') return 'Entrega confirmada';
    return 'Pedido realizado - pendiente de confirmacion';
}

function construirBadgeEstadoReservaHTML(reserva, puedeReservar = true) {
    const estado = obtenerEtiquetaEstadoReserva(reserva, puedeReservar);
    const clase = reservaEstaActiva(reserva) ? `estado-${String(reserva.estado || 'pendiente').toLowerCase()}` : (puedeReservar ? 'estado-pendiente' : 'estado-cerrada');
    return `<span class="reserva-status-badge ${clase}">${estado}</span>`;
}

function obtenerResumenEntregaUsuario(reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo) {
    const opciones = [
        { reserva: reservaPrimer, fecha: appState.fechasEntrega?.primerJueves, puedeReservar: puedePrimer },
        { reserva: reservaUltimo, fecha: appState.fechasEntrega?.ultimoJueves, puedeReservar: puedeUltimo }
    ].filter((item) => item.fecha);

    const conReserva = opciones.find((item) => reservaEstaActiva(item.reserva));
    const proxima = conReserva || opciones.find((item) => item.puedeReservar) || opciones[0];
    if (!proxima) return 'Pedido mensual pendiente.';

    const fecha = proxima.fecha.toLocaleDateString('es-UY');
    if (!reservaEstaActiva(proxima.reserva)) return `Pedido para la entrega del ${fecha} pendiente.`;
    if (proxima.reserva.estado === 'confirmado') return `Pedido del ${fecha} confirmado.`;
    if (proxima.reserva.estado === 'entregado' || proxima.reserva.estado === 'retirado') return `Entrega del ${fecha} confirmada.`;
    return `Pedido realizado para el ${fecha}, pendiente de confirmacion.`;
}

function formatearFechaReservaCalendario(fecha) {
    const mes = fecha.toLocaleDateString('es-UY', { month: 'short' }).replace('.', '');
    return {
        dia: fecha.toLocaleDateString('es-UY', { day: '2-digit' }),
        mes: mes ? `${mes.charAt(0).toUpperCase()}${mes.slice(1)}` : '',
        completa: fecha.toLocaleDateString('es-UY')
    };
}

function obtenerDetalleEntregaConfigurada(fecha, indiceFallback = 0) {
    const fechaClave = formatearFechaClave(fecha);
    const entregas = obtenerEntregasConfiguradasFuturas(appState.configMap || {}, 3);
    return entregas.find((entrega) => entrega.fecha === fechaClave) || entregas[indiceFallback] || {};
}

function construirEventoCalendarioReservaUsuario(evento, indice) {
    const detalleEntrega = obtenerDetalleEntregaConfigurada(evento.fecha, indice);
    return {
        fecha: evento.fecha,
        titulo: evento.titulo,
        hora: detalleEntrega.hora,
        detalle: detalleEntrega.hora ? 'Retiro coordinado por el club' : 'Horario a confirmar',
        lugar: detalleEntrega.lugar || 'Lugar de Siempre',
        actionId: evento.tipo,
        destacado: false,
        fechaTexto: evento.fecha.toLocaleDateString('es-UY')
    };
}

function renderReservasActividadCalendar(reservas, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo, gramosRestantesCiclo) {
    const container = document.getElementById('reservasActividadCalendar');
    if (!container || !appState.socioData?.id || !appState.fechasEntrega || !appState.cicloClubActual) return;

    const eventos = [
        { tipo: 'primer', titulo: '1ra entrega', fecha: appState.fechasEntrega.primerJueves, reserva: reservaPrimer, puedeReservar: puedePrimer },
        { tipo: 'ultimo', titulo: '2da entrega', fecha: appState.fechasEntrega.ultimoJueves, reserva: reservaUltimo, puedeReservar: puedeUltimo }
    ];

    const calendarioHTML = `
        <div class="reservas-activity-head">
            <span class="dashboard-eyebrow">Calendario de entregas</span>
            <strong>Próximas fechas de retiro</strong>
            <small>El calendario muestra únicamente las entregas creadas por administración. Tus productos reservados están en el carrito.</small>
        </div>
        <div class="reservas-activity-events">
            ${construirCalendarioEntregasHTML(eventos.map(construirEventoCalendarioReservaUsuario))}
        </div>
    `;

    container.style.display = '';
    container.innerHTML = calendarioHTML;

    container.querySelectorAll('[data-reserva-evento]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const evento = eventos.find((item) => item.tipo === btn.dataset.reservaEvento);
            abrirReservaActividadModal(evento);
        });
    });
    container.querySelectorAll('.carrito-reserva-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await modificarReservaHandler(btn.dataset.reservaId, btn.dataset.tipo);
        });
    });
}

function asegurarReservaActividadModal() {
    let modal = document.getElementById('reservaActividadModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'reservaActividadModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content reserva-actividad-modal-content">
            <span class="cerrar-modal" id="cerrarReservaActividadModal">&times;</span>
            <div id="reservaActividadModalBody"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#cerrarReservaActividadModal')?.addEventListener('click', cerrarReservaActividadModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) cerrarReservaActividadModal();
    });
    return modal;
}

function abrirReservaActividadModal(evento) {
    if (!evento) return;
    const modal = asegurarReservaActividadModal();
    const body = modal.querySelector('#reservaActividadModalBody');
    const fecha = formatearFechaReservaCalendario(evento.fecha);
    const detalleEntrega = obtenerDetalleEntregaConfigurada(evento.fecha, evento.tipo === 'ultimo' ? 1 : 0);
    const horario = formatearHoraRangoEntrega(detalleEntrega.hora) || 'Horario a confirmar';
    const lugar = detalleEntrega.lugar || 'Lugar de Siempre';

    body.innerHTML = `
        <div class="reserva-modal-fecha">
            <strong>${fecha.dia}</strong>
            <span>${escapeHtml(fecha.mes)}</span>
        </div>
        <h2 class="modal-titulo">${escapeHtml(evento.titulo)}</h2>
        <div class="noticia-modal-meta">Entrega del ${escapeHtml(fecha.completa)}</div>
        <div class="reserva-modal-detalles">
            <div><span>Fecha</span><strong>${escapeHtml(fecha.completa)}</strong></div>
            <div><span>Horario</span><strong>${escapeHtml(horario)}</strong></div>
            <div><span>Lugar</span><strong class="reserva-modal-lugar">${escapeHtml(lugar)}</strong></div>
        </div>
    `;
    modal.style.display = 'flex';
}

function cerrarReservaActividadModal() {
    const modal = document.getElementById('reservaActividadModal');
    if (modal) modal.style.display = 'none';
}

function obtenerReservasActivasCarrito(reservas = []) {
    const ciclo = appState.cicloClubActual || obtenerCicloClub();
    const hoy = normalizarFechaSinHora(new Date());
    return (reservas || [])
        .filter((reserva) => {
            if (!reservaEstaActiva(reserva)) return false;
            const fechaRetiro = parsearFechaConfigEntrega(reserva.fecha_retiro) || new Date(reserva.fecha_retiro);
            if (!reserva.fecha_retiro || Number.isNaN(fechaRetiro.getTime())) return true;
            return fechaEstaEnCicloClub(fechaRetiro, ciclo) || normalizarFechaSinHora(fechaRetiro) >= hoy;
        })
        .sort((a, b) => new Date(a.fecha_retiro).getTime() - new Date(b.fecha_retiro).getTime());
}

function construirItemCarritoReservaHTML(reserva) {
    const tipoReserva = obtenerTipoReservaUI(reserva);
    const fecha = reserva.fecha_retiro ? new Date(reserva.fecha_retiro).toLocaleDateString('es-UY') : 'Fecha a confirmar';
    const nombre = reserva.producto_nombre || 'Variedad a definir';
    const estado = obtenerEtiquetaEstadoReserva(reserva, true);
    return `
        <button type="button" class="carrito-modal-item" data-reserva-id="${escapeHtml(String(reserva.id))}" data-tipo="${escapeHtml(tipoReserva)}">
            <span class="carrito-modal-item-icon"><i class="fas fa-leaf"></i></span>
            <span class="carrito-modal-item-copy">
                <strong>${escapeHtml(nombre)}</strong>
                <small>${escapeHtml(formatearPacksReserva(reserva.cantidad_gramos))} - ${escapeHtml(fecha)} - ${escapeHtml(estado)}</small>
            </span>
            <i class="fas fa-pen carrito-modal-item-action" aria-hidden="true"></i>
        </button>
    `;
}

function asegurarCarritoSocioModal() {
    let modal = document.getElementById('carritoSocioModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'carritoSocioModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content carrito-socio-modal-content">
            <span class="cerrar-modal" id="cerrarCarritoSocioModal">&times;</span>
            <div id="carritoSocioModalBody"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#cerrarCarritoSocioModal')?.addEventListener('click', cerrarCarritoSocioModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) cerrarCarritoSocioModal();
    });
    return modal;
}

async function abrirCarritoSocio() {
    if (!appState.socioData?.id) {
        mostrarMensaje('Inicia sesion para ver tu carrito.', false);
        return;
    }
    const modal = asegurarCarritoSocioModal();
    const body = modal.querySelector('#carritoSocioModalBody');
    body.innerHTML = '<div class="loading">Cargando carrito...</div>';
    modal.style.display = 'flex';

    const reservas = await obtenerReservas(appState.socioData.id);
    appState.reservasSocio = reservas;
    const ciclo = appState.cicloClubActual || obtenerCicloClub();
    const activas = obtenerReservasActivasCarrito(reservas);
    const gramosUsados = activas.reduce((total, reserva) => total + Number(reserva.cantidad_gramos || 0), 0);
    const gramosRestantes = Math.max(0, 40 - gramosUsados);
    const packsUsados = gramosAPacks(gramosUsados);
    const packsRestantes = gramosAPacks(gramosRestantes);
    const articulos = [];

    body.innerHTML = `
        <span class="dashboard-eyebrow">Carrito del socio</span>
        <h2 class="modal-titulo">Carrito de ${escapeHtml(appState.socioData.nombre || 'socio')}</h2>
        <div class="carrito-modal-summary">
            <strong>${packsUsados} de 2 packs reservados</strong>
            <span>${packsRestantes} packs disponibles en ${escapeHtml(ciclo.etiqueta || 'este ciclo')}</span>
        </div>
        <section class="carrito-modal-section">
            <h3>Variedades reservadas</h3>
            <div class="carrito-modal-list">
                ${activas.length ? activas.map(construirItemCarritoReservaHTML).join('') : '<div class="carrito-modal-empty">Todavia no tenes variedades reservadas.</div>'}
            </div>
        </section>
        <section class="carrito-modal-section">
            <h3>Artículos</h3>
            <div class="carrito-modal-list">
                ${articulos.length ? '' : '<div class="carrito-modal-empty">Los artículos que reserves aparecerán acá cuando activemos esa sección.</div>'}
            </div>
        </section>
    `;

    body.querySelectorAll('.carrito-modal-item').forEach((btn) => {
        btn.addEventListener('click', async () => {
            cerrarCarritoSocioModal();
            await modificarReservaHandler(btn.dataset.reservaId, btn.dataset.tipo);
        });
    });
}

function cerrarCarritoSocioModal() {
    const modal = document.getElementById('carritoSocioModal');
    if (modal) modal.style.display = 'none';
}

function renderDashboardSocio(reservas, gramosRestantesCiclo, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo) {
    const dashboard = document.getElementById('socioDashboard');
    if (!dashboard || appState.rolUsuario === 'invitado') return;

    const nombre = appState.socioData?.nombre || appState.usuarioActual?.email || 'socio';
    const reservasActivas = [reservaPrimer, reservaUltimo].filter(reservaEstaActiva);
    const historialRetirado = (reservas || []).filter((reserva) => reserva.estado === 'entregado' || reserva.estado === 'retirado').length;
    const resumenEntrega = obtenerResumenEntregaUsuario(reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo);
    const gramosUsados = Math.max(0, 40 - Number(gramosRestantesCiclo || 0));
    const packsUsados = gramosAPacks(gramosUsados);
    const packsRestantes = gramosAPacks(gramosRestantesCiclo);
    const progreso = Math.min(100, Math.max(0, (gramosUsados / 40) * 100));

    dashboard.style.display = '';
    dashboard.innerHTML = `
        <div class="socio-dashboard-hero">
            <div>
                <span class="dashboard-eyebrow">Area privada</span>
                <h2>Hola, ${escapeHtml(nombre)}</h2>
                <p>${escapeHtml(resumenEntrega)}</p>
            </div>
            <div class="dashboard-grams">
                <span>${packsRestantes}</span>
                <small>packs disponibles de 2</small>
                <div class="dashboard-grams-progress" aria-label="${packsUsados} packs usados de 2">
                    <i style="width:${progreso}%"></i>
                </div>
                <small>${packsUsados} packs usados este ciclo</small>
            </div>
        </div>
        <div class="socio-dashboard-grid">
            <article class="socio-metric-card">
                <span class="metric-label">Pedidos activos</span>
                <strong>${reservasActivas.length}</strong>
                <small>${reservasActivas.length ? 'Tenes entregas coordinadas.' : 'Sin pedidos activos por ahora.'}</small>
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Primera entrega</span>
                ${construirBadgeEstadoReservaHTML(reservaPrimer, puedePrimer)}
                <small>${reservaPrimer ? `${escapeHtml(formatearPacksReserva(reservaPrimer.cantidad_gramos))} pedidos` : (puedePrimer ? 'Disponible para pedir' : 'Plazo cerrado')}</small>
                ${construirAccionModificarReservaHTML(reservaPrimer, 'primer', puedePrimer)}
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Ultima entrega</span>
                ${construirBadgeEstadoReservaHTML(reservaUltimo, puedeUltimo)}
                <small>${reservaUltimo ? `${escapeHtml(formatearPacksReserva(reservaUltimo.cantidad_gramos))} pedidos` : (puedeUltimo ? 'Disponible para pedir' : 'Plazo cerrado')}</small>
                ${construirAccionModificarReservaHTML(reservaUltimo, 'ultimo', puedeUltimo)}
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Historial</span>
                <strong>${historialRetirado}</strong>
                <small>retiros marcados como completados.</small>
            </article>
        </div>
        <div id="telegramLinkPanel" class="telegram-link-panel"></div>
    `;

    if (typeof renderTelegramLinkPanel === 'function') renderTelegramLinkPanel();

    dashboard.querySelectorAll('.btn-modificar-reserva').forEach((el) => el.addEventListener('click', async () => {
        await modificarReservaHandler(el.dataset.reservaId, el.dataset.tipo);
    }));
}

async function cargarReservasSocio() {
    if (!appState.socioData?.id) {
        const activityCalendar = document.getElementById('reservasActividadCalendar');
        if (activityCalendar) activityCalendar.style.display = 'none';
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        appState.gramosReservadosCiclo = 0;
        appState.gramosRestantesCiclo = 40;
        appState.reservasActivasCount = 0;
        appState.historialRetiradoCount = 0;
        appState.cicloClubActual = null;
        return;
    }

    appState.fechasEntrega = calcularFechasEntrega();
    appState.cicloClubActual = obtenerCicloClub();
    const reservas = await obtenerReservas(appState.socioData.id);
    appState.reservasSocio = reservas;
    const reservaPrimer = obtenerReservaActivaPorEntrega(reservas, 'primer_jueves', appState.fechasEntrega.primerJueves);
    const reservaUltimo = obtenerReservaActivaPorEntrega(reservas, 'ultimo_jueves', appState.fechasEntrega.ultimoJueves);
    const puedePrimer = puedeConfirmar(appState.fechasEntrega.primerJueves, configSistema.horasLimitePrimer);
    const puedeUltimo = puedeConfirmar(appState.fechasEntrega.ultimoJueves, configSistema.horasLimiteUltimo);
    const gramosReservadosCiclo = sumarGramosReservadosEnCiclo(reservas, appState.cicloClubActual);
    const gramosRestantesCiclo = Math.max(0, 40 - gramosReservadosCiclo);
    appState.gramosReservadosCiclo = gramosReservadosCiclo;
    const reservasActivas = [reservaPrimer, reservaUltimo].filter(reservaEstaActiva);
    const historialRetirado = (reservas || []).filter((reserva) => reserva.estado === 'entregado' || reserva.estado === 'retirado').length;
    appState.gramosRestantesCiclo = gramosRestantesCiclo;
    appState.reservasActivasCount = reservasActivas.length;
    appState.historialRetiradoCount = historialRetirado;
    renderDashboardSocio(reservas, gramosRestantesCiclo, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo);
    renderReservasActividadCalendar(reservas, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo, gramosRestantesCiclo);
}

async function modificarReservaHandler(reservaId, tipo) {
    if (!appState.socioData?.id) {
        mostrarMensaje('Inicia sesion para modificar el pedido.', false);
        return;
    }
    const reservas = await obtenerReservas(appState.socioData.id);
    const reserva = reservas.find((item) => String(item.id) === String(reservaId));
    if (!reserva) {
        mostrarMensaje('No se encontro el pedido.', false);
        return;
    }
    const fechaEntrega = tipo === 'primer' ? appState.fechasEntrega.primerJueves : appState.fechasEntrega.ultimoJueves;
    const horasLimite = tipo === 'primer' ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    if (!puedeConfirmar(fechaEntrega, horasLimite)) {
        mostrarMensaje('No se puede modificar: el plazo del pedido ya vencio.', false);
        return;
    }
    const productos = await obtenerProductos();
    const productoActual = productos.find((producto) => String(producto.id) === String(reserva.producto_id)) || productos[0];
    if (!productoActual) {
        mostrarMensaje('No hay variedades disponibles para modificar.', false);
        return;
    }
    appState.reservaEditandoId = reserva.id;
    appState.reservaEditandoTipo = tipo;
    await abrirModal(productoActual);
}
