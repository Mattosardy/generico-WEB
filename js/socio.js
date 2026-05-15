function sumarGramosReservadosEnCiclo(reservas = [], ciclo = obtenerCicloClub()) {
    return reservas
        .filter((reserva) => reserva?.estado !== 'cancelado' && fechaEstaEnCicloClub(reserva?.fecha_retiro, ciclo))
        .reduce((total, reserva) => total + Number(reserva?.cantidad_gramos || 0), 0);
}

function construirResumenCarritoMensual(reservas = [], gramosRestantesCiclo = 40) {
    const ciclo = appState.cicloClubActual || obtenerCicloClub();
    const activas = (reservas || [])
        .filter((reserva) => reservaEstaActiva(reserva) && fechaEstaEnCicloClub(reserva.fecha_retiro, ciclo));
    if (!activas.length) {
        return `
            <details class="actividad-carrito-submenu">
                <summary>Carrito mensual <span>${gramosRestantesCiclo}g disponibles</span></summary>
                <div class="actividad-carrito-vacio">Sin reservas para este mes.</div>
            </details>
        `;
    }
    return `
        <details class="actividad-carrito-submenu" open>
            <summary>Carrito mensual <span>${gramosRestantesCiclo}g disponibles de 40g</span></summary>
            <div class="actividad-carrito-lista">
                ${activas.map((reserva) => {
                    const variedad = reserva.producto_nombre || 'Variedad a definir';
                    const tipoReserva = obtenerTipoReservaUI(reserva);
                    const fecha = reserva.fecha_retiro ? new Date(reserva.fecha_retiro).toLocaleDateString('es-UY') : '';
                    return `
                        <button type="button" class="carrito-reserva-btn" data-reserva-id="${reserva.id}" data-tipo="${tipoReserva}">
                            <strong>${escapeHtml(variedad)}</strong>
                            <span>${Number(reserva.cantidad_gramos || 0)}g reservados</span>
                            <small>${escapeHtml(fecha)} · Modificar reserva</small>
                        </button>
                    `;
                }).join('')}
            </div>
        </details>
    `;
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
    return `<button type="button" class="btn-modificar-reserva" data-reserva-id="${reserva.id}" data-tipo="${tipo}">Modificar reserva</button>`;
}

function obtenerTipoReservaUI(reserva) {
    return String(reserva?.tipo_entrega || '').includes('primer') ? 'primer' : 'ultimo';
}

function obtenerEtiquetaEstadoReserva(reserva, puedeReservar = true) {
    if (reserva?.estado === 'cancelado') return 'Cancelado';
    if (!reservaEstaActiva(reserva)) return puedeReservar ? 'Pendiente' : 'Cerrada';
    if (reserva.estado === 'confirmado') return 'Pedido recibido';
    if (reserva.estado === 'entregado' || reserva.estado === 'retirado') return 'Entrega confirmada';
    return 'Pendiente de confirmacion';
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
    if (!proxima) return 'Entrega pendiente.';

    const fecha = proxima.fecha.toLocaleDateString('es-UY');
    if (!reservaEstaActiva(proxima.reserva)) return `Entrega del ${fecha} pendiente.`;
    if (proxima.reserva.estado === 'confirmado') return `Entrega del ${fecha} en proceso.`;
    if (proxima.reserva.estado === 'entregado' || proxima.reserva.estado === 'retirado') return `Entrega del ${fecha} confirmada.`;
    return `Entrega del ${fecha} pendiente de confirmacion.`;
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
    const estado = reservaEstaActiva(evento.reserva)
        ? obtenerEtiquetaEstadoReserva(evento.reserva, evento.puedeReservar)
        : (evento.puedeReservar ? 'Pendiente' : 'Plazo cerrado');
    const detalle = evento.reserva ? `${evento.reserva.cantidad_gramos}g reservados` : 'Sin reserva';
    return {
        fecha: evento.fecha,
        titulo: evento.titulo,
        hora: detalleEntrega.hora,
        detalle: `${estado} · ${detalle}`,
        lugar: detalleEntrega.lugar || 'Lugar de Siempre',
        actionId: evento.tipo,
        destacado: reservaEstaActiva(evento.reserva),
        fechaTexto: evento.fecha.toLocaleDateString('es-UY'),
        reservaResumen: reservaEstaActiva(evento.reserva)
            ? `Reserva confirmada - ${evento.reserva.cantidad_gramos}g`
            : 'Sin reserva'
    };
}

function renderReservasActividadCalendar(reservas, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo, gramosRestantesCiclo) {
    const container = document.getElementById('reservasActividadCalendar');
    if (!container || !appState.socioData?.id || !appState.fechasEntrega || !appState.cicloClubActual) return;

    const eventos = [
        { tipo: 'primer', titulo: '1a Entrega Mensual', fecha: appState.fechasEntrega.primerJueves, reserva: reservaPrimer, puedeReservar: puedePrimer },
        { tipo: 'ultimo', titulo: '2a Entrega Mensual', fecha: appState.fechasEntrega.ultimoJueves, reserva: reservaUltimo, puedeReservar: puedeUltimo }
    ];
    const reservasActivas = [reservaPrimer, reservaUltimo].filter(reservaEstaActiva).length;
    const historialRetirado = (reservas || []).filter((reserva) => reserva.estado === 'entregado' || reserva.estado === 'retirado').length;

    container.style.display = '';
    container.innerHTML = `
        <div class="reservas-activity-head">
            <span class="dashboard-eyebrow">Calendario de entregas</span>
            <strong>${escapeHtml(obtenerResumenEntregaUsuario(reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo))}</strong>
            <small>${gramosRestantesCiclo}g disponibles · ${reservasActivas} reservas · ${historialRetirado} retiros</small>
        </div>
        ${construirResumenCarritoMensual(reservas, gramosRestantesCiclo)}
        <div class="reservas-activity-events">
            ${construirCalendarioEntregasHTML(eventos.map(construirEventoCalendarioReservaUsuario))}
        </div>
    `;

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
    const reservado = reservaEstaActiva(evento.reserva)
        ? `Reserva confirmada - ${evento.reserva.cantidad_gramos}g`
        : 'Sin reserva';

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
            <div><span>Reserva</span><strong>${escapeHtml(reservado)}</strong></div>
        </div>
    `;
    modal.style.display = 'flex';
}

function cerrarReservaActividadModal() {
    const modal = document.getElementById('reservaActividadModal');
    if (modal) modal.style.display = 'none';
}

function renderDashboardSocio(reservas, gramosRestantesCiclo, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo) {
    const dashboard = document.getElementById('socioDashboard');
    if (!dashboard || appState.rolUsuario === 'invitado') return;

    const nombre = appState.socioData?.nombre || appState.usuarioActual?.email || 'socio';
    const reservasActivas = [reservaPrimer, reservaUltimo].filter(reservaEstaActiva);
    const historialRetirado = (reservas || []).filter((reserva) => reserva.estado === 'entregado' || reserva.estado === 'retirado').length;
    const resumenEntrega = obtenerResumenEntregaUsuario(reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo);

    dashboard.style.display = '';
    dashboard.innerHTML = `
        <div class="socio-dashboard-hero">
            <div>
                <span class="dashboard-eyebrow">Area privada</span>
                <h2>Hola, ${escapeHtml(nombre)}</h2>
                <p>${escapeHtml(resumenEntrega)}</p>
            </div>
            <div class="dashboard-grams">
                <span>${gramosRestantesCiclo}g</span>
                <small>disponibles de 40g</small>
            </div>
        </div>
        <div class="socio-dashboard-grid">
            <article class="socio-metric-card">
                <span class="metric-label">Reservas activas</span>
                <strong>${reservasActivas.length}</strong>
                <small>${reservasActivas.length ? 'Tenes entregas coordinadas.' : 'Sin reservas activas por ahora.'}</small>
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Primera entrega</span>
                ${construirBadgeEstadoReservaHTML(reservaPrimer, puedePrimer)}
                <small>${reservaPrimer ? `${reservaPrimer.cantidad_gramos}g reservados` : (puedePrimer ? 'Disponible para reservar' : 'Plazo cerrado')}</small>
                ${construirAccionModificarReservaHTML(reservaPrimer, 'primer', puedePrimer)}
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Ultima entrega</span>
                ${construirBadgeEstadoReservaHTML(reservaUltimo, puedeUltimo)}
                <small>${reservaUltimo ? `${reservaUltimo.cantidad_gramos}g reservados` : (puedeUltimo ? 'Disponible para reservar' : 'Plazo cerrado')}</small>
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
        mostrarMensaje('Inicia sesion para modificar la reserva.', false);
        return;
    }
    const reservas = await obtenerReservas(appState.socioData.id);
    const reserva = reservas.find((item) => String(item.id) === String(reservaId));
    if (!reserva) {
        mostrarMensaje('No se encontro la reserva.', false);
        return;
    }
    const fechaEntrega = tipo === 'primer' ? appState.fechasEntrega.primerJueves : appState.fechasEntrega.ultimoJueves;
    const horasLimite = tipo === 'primer' ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    if (!puedeConfirmar(fechaEntrega, horasLimite)) {
        mostrarMensaje('No se puede modificar: el plazo de reserva ya vencio.', false);
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
