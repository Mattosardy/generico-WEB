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
    if (!reservaEstaActiva(reserva)) return puedeReservar ? 'Pendiente' : 'Cerrada';
    if (reserva.estado === 'confirmado') return 'Confirmada';
    if (reserva.estado === 'entregado' || reserva.estado === 'retirado') return 'Retirada';
    return 'Pendiente';
}

function construirBadgeEstadoReservaHTML(reserva, puedeReservar = true) {
    const estado = obtenerEtiquetaEstadoReserva(reserva, puedeReservar);
    const clase = reservaEstaActiva(reserva) ? `estado-${String(reserva.estado || 'pendiente').toLowerCase()}` : (puedeReservar ? 'estado-pendiente' : 'estado-cerrada');
    return `<span class="reserva-status-badge ${clase}">${estado}</span>`;
}

function construirTimelineReservaHTML(reserva, puedeReservar) {
    const estadoActual = obtenerEtiquetaEstadoReserva(reserva, puedeReservar);
    const pasos = ['Pendiente', 'Confirmada', 'Retirada'];
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
        <div class="dashboard-shortcuts">
            <button type="button" class="dashboard-shortcut" data-section="productos"><i class="fas fa-calendar-check"></i> Reservas</button>
            <button type="button" class="dashboard-shortcut" data-section="productos"><i class="fas fa-history"></i> Historial</button>
        </div>
    `;

    if (typeof renderTelegramLinkPanel === 'function') renderTelegramLinkPanel();

    dashboard.querySelectorAll('.dashboard-shortcut').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (typeof mostrarSeccion === 'function') await mostrarSeccion(btn.dataset.section);
        });
    });
}

async function renderProximasEntregasEnProductos() {
    const proximasWrapper = document.getElementById('productosProximasEntregas');
    if (proximasWrapper) proximasWrapper.style.display = 'block';
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
            <div class="estado-reserva ${reservaPrimer?.estado === 'confirmado' ? 'estado-confirmado' : 'estado-pendiente'}">
                ${reservaPrimer?.estado === 'confirmado' ? `Confirmado: ${reservaPrimer.cantidad_gramos}g` : (appState.socioData ? (puedePrimer ? 'Pendiente' : 'Plazo vencido') : 'Para socios')}
            </div>
        </div>
        <div class="entrega-card">
            <div class="entrega-titulo">Ultimo Jueves</div>
            <div class="entrega-fecha">${fechas.ultimoJueves.toLocaleDateString('es')}</div>
            <div class="estado-reserva ${reservaUltimo?.estado === 'confirmado' ? 'estado-confirmado' : 'estado-pendiente'}">
                ${reservaUltimo?.estado === 'confirmado' ? `Confirmado: ${reservaUltimo.cantidad_gramos}g` : (appState.socioData ? (puedeUltimo ? 'Pendiente' : 'Plazo vencido') : 'Para socios')}
            </div>
        </div>
    `;
}

async function cargarReservasSocio() {
    const misReservasWrapper = document.getElementById('productosMisReservas');
    if (!appState.socioData?.id) {
        if (misReservasWrapper) misReservasWrapper.style.display = 'none';
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        await renderProximasEntregasEnProductos();
        return;
    }
    if (misReservasWrapper) misReservasWrapper.style.display = 'block';

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

    container.innerHTML = `
        <div class="estado-reserva estado-confirmado" style="grid-column: 1 / -1; text-align: center;">
            Disponible en este ciclo (${appState.cicloClubActual.etiqueta}): ${gramosRestantesCiclo}g de 40g
        </div>
        <div class="entrega-card">
            <div class="entrega-titulo">Primer Jueves</div>
            <div class="entrega-fecha">${appState.fechasEntrega.primerJueves.toLocaleDateString('es')}</div>
            ${construirBadgeEstadoReservaHTML(reservaPrimer, puedePrimer)}
            <div class="estado-reserva ${reservaPrimer?.estado === 'confirmado' ? 'estado-confirmado' : 'estado-pendiente'}">${reservaPrimer?.estado === 'confirmado' ? `Confirmado: ${reservaPrimer.cantidad_gramos}g` : 'Sin confirmar'}</div>
            ${construirTimelineReservaHTML(reservaPrimer, puedePrimer)}
            ${!reservaPrimer && puedePrimer ? construirOpcionesReservaHTML(gramosRestantesCiclo, 'primer') : (!puedePrimer && !reservaPrimer ? '<div class="estado-reserva estado-pendiente">Plazo vencido</div>' : '')}
            ${construirAccionCancelarReservaHTML(reservaPrimer, 'primer', puedePrimer)}
        </div>
        <div class="entrega-card">
            <div class="entrega-titulo">Ultimo Jueves</div>
            <div class="entrega-fecha">${appState.fechasEntrega.ultimoJueves.toLocaleDateString('es')}</div>
            ${construirBadgeEstadoReservaHTML(reservaUltimo, puedeUltimo)}
            <div class="estado-reserva ${reservaUltimo?.estado === 'confirmado' ? 'estado-confirmado' : 'estado-pendiente'}">${reservaUltimo?.estado === 'confirmado' ? `Confirmado: ${reservaUltimo.cantidad_gramos}g` : 'Sin confirmar'}</div>
            ${construirTimelineReservaHTML(reservaUltimo, puedeUltimo)}
            ${!reservaUltimo && puedeUltimo ? construirOpcionesReservaHTML(gramosRestantesCiclo, 'ultimo') : (!puedeUltimo && !reservaUltimo ? '<div class="estado-reserva estado-pendiente">Plazo vencido</div>' : '')}
            ${construirAccionCancelarReservaHTML(reservaUltimo, 'ultimo', puedeUltimo)}
        </div>
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
                            <td>${reserva.estado === 'confirmado' ? 'Confirmado' : (reserva.estado === 'cancelado' ? 'Cancelado' : 'Pendiente')}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        }
    }

    renderDashboardSocio(reservas, gramosRestantesCiclo, reservaPrimer, reservaUltimo, puedePrimer, puedeUltimo);
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
            const mensaje = notificationService.render('reserva_confirmada', {
                grams: gramos,
                retiro: fechaEntrega.toLocaleDateString('es-UY')
            });
            notificationService
                .send(appState.socioData.id, mensaje, { type: 'reserva_confirmada', channel: 'telegram' })
                .catch((error) => console.warn('No se pudo encolar la notificacion de reserva:', error));
        }
        mostrarMensaje(`Reserva confirmada: ${gramos}g`, true);
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

