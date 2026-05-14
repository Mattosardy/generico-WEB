function sumarGramosReservadosEnCiclo(reservas = [], ciclo = obtenerCicloClub()) {
    return reservas
        .filter((reserva) => reserva?.estado !== 'cancelado' && fechaEstaEnCicloClub(reserva?.fecha_retiro, ciclo))
        .reduce((total, reserva) => total + Number(reserva?.cantidad_gramos || 0), 0);
}

function construirOpcionesReservaHTML(gramosDisponibles, tipo) {
    const opciones = [20, 40].filter((gramos) => gramos <= gramosDisponibles);
    if (!opciones.length) {
        return '<div class="estado-reserva estado-pendiente">Tope mensual alcanzado</div>';
    }
    return `<div class="opciones-gramos" data-tipo="${tipo}">${opciones.map((gramos) => `<div class="opcion-gramo" data-gramos="${gramos}">${gramos}g</div>`).join('')}</div>`;
}

// Cambio funcional solicitado: permitir cancelar reservas sin alterar el tope ni las validaciones de gramos existentes.
function reservaEstaActiva(reserva) {
    return reserva && reserva.estado !== 'cancelado';
}

function obtenerReservaActivaPorEntrega(reservas, tipoEntrega, fechaEntrega) {
    const fechaClave = fechaEntrega.toISOString().slice(0, 10);
    return reservas.find((reserva) => (
        reservaEstaActiva(reserva)
        && reserva.tipo_entrega === tipoEntrega
        && String(reserva.fecha_retiro) === fechaClave
    ));
}

function construirAccionCancelarReservaHTML(reserva, tipo, puedeCancelar) {
    if (!reservaEstaActiva(reserva)) return '';
    if (!puedeCancelar) {
        return '<div class="estado-reserva estado-pendiente">No se puede cancelar: plazo vencido</div>';
    }
    return `<button type="button" class="btn-cancelar-reserva" data-reserva-id="${reserva.id}" data-tipo="${tipo}">Cancelar reserva</button>`;
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

function construirTimelineReservaHTML(reserva, puedeReservar) {
    const estadoActual = obtenerEtiquetaEstadoReserva(reserva, puedeReservar);
    const pasos = ['Pendiente de confirmacion', 'Pedido recibido', 'Entrega confirmada'];
    const indiceActivo = Math.max(0, pasos.indexOf(estadoActual));
    return `
        <div class="reserva-timeline" aria-label="Estado de reserva">
            ${pasos.map((paso, index) => `
                <span class="reserva-timeline-step ${index <= indiceActivo ? 'activo' : ''} ${paso === estadoActual ? 'actual' : ''}">
                    <span></span>${paso}
                </span>
            `).join('')}
        </div>
    `;
}

function formatearFechaReservaCalendario(fecha) {
    return {
        dia: fecha.toLocaleDateString('es-UY', { day: '2-digit' }),
        mes: fecha.toLocaleDateString('es-UY', { month: 'short' }).replace('.', ''),
        completa: fecha.toLocaleDateString('es-UY')
    };
}

function construirTarjetaCalendarioReservaHTML({ titulo, fecha, reserva, puedeReservar, tipo, gramosRestantesCiclo }) {
    const fechaPartes = formatearFechaReservaCalendario(fecha);
    const detalle = reserva
        ? `${reserva.cantidad_gramos}g reservados`
        : (puedeReservar ? 'Disponible para reservar' : 'Plazo cerrado');
    const estadoClase = ['confirmado', 'entregado', 'retirado'].includes(reserva?.estado) ? 'estado-confirmado' : 'estado-pendiente';

    return `
        <article class="reserva-cal-card">
            <div class="reserva-cal-fecha">
                <strong>${fechaPartes.dia}</strong>
                <span>${escapeHtml(fechaPartes.mes)}</span>
            </div>
            <div class="reserva-cal-info">
                <span class="metric-label">${escapeHtml(titulo)}</span>
                <strong>${escapeHtml(fechaPartes.completa)}</strong>
                ${construirBadgeEstadoReservaHTML(reserva, puedeReservar)}
                <small>${escapeHtml(detalle)}</small>
                <div class="estado-reserva ${estadoClase}">${reserva ? `${obtenerEtiquetaEstadoReserva(reserva, puedeReservar)}: ${reserva.cantidad_gramos}g` : 'Sin confirmar'}</div>
                ${construirTimelineReservaHTML(reserva, puedeReservar)}
                ${!reserva && puedeReservar ? construirOpcionesReservaHTML(gramosRestantesCiclo, tipo) : (!puedeReservar && !reserva ? '<div class="estado-reserva estado-pendiente">Plazo vencido</div>' : '')}
                ${construirAccionCancelarReservaHTML(reserva, tipo, puedeReservar)}
            </div>
        </article>
    `;
}

function obtenerDetalleRetiroReserva(reserva) {
    if (!reservaEstaActiva(reserva)) return 'Sin retiro registrado';
    if (reserva.estado === 'entregado' || reserva.estado === 'retirado') return `${reserva.cantidad_gramos}g retirados`;
    return 'Retiro pendiente';
}

function renderReservasActividadCalendar(reservas, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo, gramosRestantesCiclo) {
    const container = document.getElementById('reservasActividadCalendar');
    if (!container || !appState.socioData?.id || !appState.fechasEntrega || !appState.cicloClubActual) return;

    const eventos = [
        { tipo: 'primer', titulo: 'Primer jueves', fecha: appState.fechasEntrega.primerJueves, reserva: reservaPrimer, puedeReservar: puedePrimer },
        { tipo: 'ultimo', titulo: 'Ultimo jueves', fecha: appState.fechasEntrega.ultimoJueves, reserva: reservaUltimo, puedeReservar: puedeUltimo }
    ];
    const reservasActivas = [reservaPrimer, reservaUltimo].filter(reservaEstaActiva).length;
    const historialRetirado = (reservas || []).filter((reserva) => reserva.estado === 'entregado' || reserva.estado === 'retirado').length;

    container.style.display = '';
    container.innerHTML = `
        <div class="reservas-activity-head">
            <span class="dashboard-eyebrow">Calendario de entregas</span>
            <strong>${escapeHtml(appState.cicloClubActual.etiqueta)}</strong>
            <small>${gramosRestantesCiclo}g disponibles · ${reservasActivas} reservas · ${historialRetirado} retiros</small>
        </div>
        <div class="reservas-activity-events">
            ${eventos.map((evento) => {
                const fecha = formatearFechaReservaCalendario(evento.fecha);
                const estado = obtenerEtiquetaEstadoReserva(evento.reserva, evento.puedeReservar);
                const detalle = evento.reserva ? `${evento.reserva.cantidad_gramos}g reservados` : 'Sin reserva';
                return `
                    <button type="button" class="reserva-activity-event" data-reserva-evento="${evento.tipo}">
                        <span class="reserva-activity-date"><strong>${fecha.dia}</strong><small>${escapeHtml(fecha.mes)}</small></span>
                        <span class="reserva-activity-copy">
                            <strong>${escapeHtml(evento.titulo)}</strong>
                            <small>${escapeHtml(estado)} · ${escapeHtml(detalle)}</small>
                        </span>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    container.querySelectorAll('[data-reserva-evento]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const evento = eventos.find((item) => item.tipo === btn.dataset.reservaEvento);
            abrirReservaActividadModal(evento, gramosRestantesCiclo);
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

function abrirReservaActividadModal(evento, gramosRestantesCiclo) {
    if (!evento) return;
    const modal = asegurarReservaActividadModal();
    const body = modal.querySelector('#reservaActividadModalBody');
    const fecha = formatearFechaReservaCalendario(evento.fecha);
    const reservado = evento.reserva ? `${evento.reserva.cantidad_gramos}g reservados` : 'Sin reserva';
    const retirado = obtenerDetalleRetiroReserva(evento.reserva);

    body.innerHTML = `
        <div class="reserva-modal-fecha">
            <strong>${fecha.dia}</strong>
            <span>${escapeHtml(fecha.mes)}</span>
        </div>
        <h2 class="modal-titulo">${escapeHtml(evento.titulo)}</h2>
        <div class="noticia-modal-meta">${escapeHtml(fecha.completa)}</div>
        <div class="reserva-modal-detalles">
            <div><span>Estado</span><strong>${escapeHtml(obtenerEtiquetaEstadoReserva(evento.reserva, evento.puedeReservar))}</strong></div>
            <div><span>Reservado</span><strong>${escapeHtml(reservado)}</strong></div>
            <div><span>Retiro</span><strong>${escapeHtml(retirado)}</strong></div>
        </div>
        ${!evento.reserva && evento.puedeReservar ? `
            <div class="modal-pedido-info">Reservar para esta fecha</div>
            ${construirOpcionesReservaHTML(gramosRestantesCiclo, evento.tipo)}
        ` : ''}
        ${construirAccionCancelarReservaHTML(evento.reserva, evento.tipo, evento.puedeReservar)}
    `;

    body.querySelectorAll('.opcion-gramo').forEach((el) => el.addEventListener('click', async () => {
        const gramos = parseInt(el.dataset.gramos, 10);
        cerrarReservaActividadModal();
        await confirmarReservaHandler(evento.tipo, gramos);
    }));
    body.querySelectorAll('.btn-cancelar-reserva').forEach((el) => el.addEventListener('click', async () => {
        cerrarReservaActividadModal();
        await cancelarReservaHandler(el.dataset.reservaId, el.dataset.tipo);
    }));
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
    const ciclo = appState.cicloClubActual?.etiqueta || 'ciclo actual';

    dashboard.style.display = '';
    dashboard.innerHTML = `
        <div class="socio-dashboard-hero">
            <div>
                <span class="dashboard-eyebrow">Área privada</span>
                <h2>Hola, ${escapeHtml(nombre)}</h2>
                <p>Tu estado del ciclo ${escapeHtml(ciclo)} está actualizado.</p>
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
                <small>${reservasActivas.length ? 'Tenés entregas coordinadas.' : 'Sin reservas activas por ahora.'}</small>
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Primer jueves</span>
                ${construirBadgeEstadoReservaHTML(reservaPrimer, puedePrimer)}
                <small>${reservaPrimer ? `${reservaPrimer.cantidad_gramos}g reservados` : (puedePrimer ? 'Disponible para reservar' : 'Plazo cerrado')}</small>
            </article>
            <article class="socio-metric-card">
                <span class="metric-label">Último jueves</span>
                ${construirBadgeEstadoReservaHTML(reservaUltimo, puedeUltimo)}
                <small>${reservaUltimo ? `${reservaUltimo.cantidad_gramos}g reservados` : (puedeUltimo ? 'Disponible para reservar' : 'Plazo cerrado')}</small>
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
}

async function renderProximasEntregasEnProductos() {
    const proximasWrapper = document.getElementById('productosProximasEntregas');
    if (proximasWrapper) proximasWrapper.style.display = 'none';
    const container = document.getElementById('calendarioProductos');
    if (!container) return;

    const fechas = calcularFechasEntrega();
    let reservaPrimer = null;
    let reservaUltimo = null;
    const puedePrimer = puedeConfirmar(fechas.primerJueves, configSistema.horasLimitePrimer);
    const puedeUltimo = puedeConfirmar(fechas.ultimoJueves, configSistema.horasLimiteUltimo);

    if (appState.socioData?.id) {
        try {
            const reservas = await obtenerReservas(appState.socioData.id);
            reservaPrimer = obtenerReservaActivaPorEntrega(reservas, 'primer_jueves', fechas.primerJueves);
            reservaUltimo = obtenerReservaActivaPorEntrega(reservas, 'ultimo_jueves', fechas.ultimoJueves);
        } catch (error) {
            console.warn('No se pudieron cargar entregas publicas', error);
        }
    }

    container.innerHTML = `
        <div class="entrega-card">
            <div class="entrega-titulo">Primer Jueves</div>
            <div class="entrega-fecha">${fechas.primerJueves.toLocaleDateString('es')}</div>
            <div class="estado-reserva ${['confirmado', 'entregado', 'retirado'].includes(reservaPrimer?.estado) ? 'estado-confirmado' : 'estado-pendiente'}">
                ${reservaPrimer ? `${obtenerEtiquetaEstadoReserva(reservaPrimer, puedePrimer)}: ${reservaPrimer.cantidad_gramos}g` : (appState.socioData ? (puedePrimer ? 'Pendiente' : 'Plazo vencido') : 'Para socios')}
            </div>
        </div>
        <div class="entrega-card">
            <div class="entrega-titulo">Ultimo Jueves</div>
            <div class="entrega-fecha">${fechas.ultimoJueves.toLocaleDateString('es')}</div>
            <div class="estado-reserva ${['confirmado', 'entregado', 'retirado'].includes(reservaUltimo?.estado) ? 'estado-confirmado' : 'estado-pendiente'}">
                ${reservaUltimo ? `${obtenerEtiquetaEstadoReserva(reservaUltimo, puedeUltimo)}: ${reservaUltimo.cantidad_gramos}g` : (appState.socioData ? (puedeUltimo ? 'Pendiente' : 'Plazo vencido') : 'Para socios')}
            </div>
        </div>
    `;
}

async function cargarReservasSocio() {
    const misReservasWrapper = document.getElementById('productosMisReservas');
    if (!appState.socioData?.id) {
        if (misReservasWrapper) misReservasWrapper.style.display = 'none';
        const activityCalendar = document.getElementById('reservasActividadCalendar');
        if (activityCalendar) activityCalendar.style.display = 'none';
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        await renderProximasEntregasEnProductos();
        return;
    }
    if (misReservasWrapper) misReservasWrapper.style.display = 'none';

    const container = document.getElementById('calendarioContainer');
    if (!container) return;

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

    container.innerHTML = `
        <div class="reserva-periodo-card">
            <span class="dashboard-eyebrow">Periodo vigente</span>
            <strong>${escapeHtml(appState.cicloClubActual.etiqueta)}</strong>
            <div class="reserva-periodo-resumen">
                <span>${gramosRestantesCiclo}g disponibles</span>
                <span>${reservasActivas.length} reservas activas</span>
                <span>${historialRetirado} retiros completados</span>
            </div>
        </div>
        ${construirTarjetaCalendarioReservaHTML({
            titulo: 'Primer jueves',
            fecha: appState.fechasEntrega.primerJueves,
            reserva: reservaPrimer,
            puedeReservar: puedePrimer,
            tipo: 'primer',
            gramosRestantesCiclo
        })}
        ${construirTarjetaCalendarioReservaHTML({
            titulo: 'Ultimo jueves',
            fecha: appState.fechasEntrega.ultimoJueves,
            reserva: reservaUltimo,
            puedeReservar: puedeUltimo,
            tipo: 'ultimo',
            gramosRestantesCiclo
        })}
    `;

    document.querySelectorAll('.opcion-gramo').forEach((el) => el.addEventListener('click', async () => {
        const gramos = parseInt(el.dataset.gramos, 10);
        const tipo = el.closest('.opciones-gramos').dataset.tipo;
        await confirmarReservaHandler(tipo, gramos);
    }));

    document.querySelectorAll('.btn-cancelar-reserva').forEach((el) => el.addEventListener('click', async () => {
        await cancelarReservaHandler(el.dataset.reservaId, el.dataset.tipo);
    }));

    const histContainer = document.getElementById('historialContainer');
    if (histContainer) {
        if (!reservas.length) {
            histContainer.innerHTML = '<div class="empty-state"><i class="fas fa-clock-rotate-left"></i><strong>Sin historial todavía</strong><span>Cuando tengas retiros registrados, van a aparecer acá.</span></div>';
        } else {
            histContainer.innerHTML = `
                <table class="historial-table">
                    <thead><tr><th>Fecha</th><th>Cantidad</th><th>Estado</th></tr></thead>
                    <tbody>${reservas.map((reserva) => `
                        <tr>
                            <td>${new Date(reserva.fecha_retiro).toLocaleDateString('es')}</td>
                            <td>${reserva.cantidad_gramos}g</td>
                            <td>${escapeHtml(obtenerEtiquetaEstadoReserva(reserva, false))}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        }
    }

    renderDashboardSocio(reservas, gramosRestantesCiclo, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo);
    renderReservasActividadCalendar(reservas, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo, gramosRestantesCiclo);
    await renderProximasEntregasEnProductos();
}

async function confirmarReservaHandler(tipo, gramos) {
    const fechaEntrega = tipo === 'primer' ? appState.fechasEntrega.primerJueves : appState.fechasEntrega.ultimoJueves;
    const horasLimite = tipo === 'primer' ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    if (!puedeConfirmar(fechaEntrega, horasLimite)) {
        mostrarMensaje('El plazo para confirmar esta reserva ya venció.', false);
        return;
    }

    const reservas = await obtenerReservas(appState.socioData.id);
    const cicloActual = appState.cicloClubActual || obtenerCicloClub();
    const gramosReservadosCiclo = sumarGramosReservadosEnCiclo(reservas, cicloActual);
    if (gramosReservadosCiclo + gramos > 40) {
        mostrarMensaje(`Límite mensual alcanzado. Te quedan ${Math.max(0, 40 - gramosReservadosCiclo)}g disponibles en este ciclo.`, false);
        return;
    }

    const resultado = await confirmarReserva(appState.socioData.id, gramos, tipo, fechaEntrega);
    if (resultado.success) {
        if (typeof notificationService !== 'undefined') {
            const mensaje = notificationService.render('reserva_creada', {
                grams: gramos,
                estado: 'pendiente de confirmacion',
                retiro: fechaEntrega.toLocaleDateString('es-UY')
            });
            notificationService
                .send(appState.socioData.id, mensaje, { type: 'reserva_creada', channel: 'telegram' })
                .catch((error) => console.warn('No se pudo encolar la notificacion de reserva:', error));
        }
        mostrarMensaje(`Pedido enviado: ${gramos}g. Queda pendiente de confirmacion del club.`, true);
        await cargarReservasSocio();
    } else {
        mostrarMensaje(`No se pudo confirmar la reserva: ${resultado.message || 'error desconocido'}`, false);
    }
}

async function cancelarReservaHandler(reservaId, tipo) {
    if (!appState.socioData?.id) {
        mostrarMensaje('Iniciá sesión para cancelar la reserva.', false);
        return;
    }

    const fechaEntrega = tipo === 'primer' ? appState.fechasEntrega.primerJueves : appState.fechasEntrega.ultimoJueves;
    const horasLimite = tipo === 'primer' ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    if (!puedeConfirmar(fechaEntrega, horasLimite)) {
        mostrarMensaje('No se puede cancelar: el plazo de reserva ya venció.', false);
        return;
    }

    const resultado = await cancelarReserva(reservaId, appState.socioData.id);
    if (resultado.success) {
        mostrarMensaje('Reserva cancelada', true);
        await cargarReservasSocio();
    } else {
        mostrarMensaje(`No se pudo cancelar la reserva: ${resultado.message || 'error desconocido'}`, false);
    }
}

console.log('Socio loaded');

