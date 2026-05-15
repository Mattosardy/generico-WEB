function mostrarMensaje(mensaje, esExito = true) {
    const div = document.createElement('div');
    div.className = `mensaje-flotante ${esExito ? 'mensaje-exito' : 'mensaje-error'}`;
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    div.innerHTML = `<i class="fas ${esExito ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatearTelefonoUruguay(telefono) {
    const limpio = String(telefono || '').replace(/[\s\-().]/g, '');
    if (limpio.startsWith('+598')) return limpio;
    if (limpio.startsWith('09') && limpio.length === 9) return `+598${limpio.slice(1)}`;
    if (limpio.startsWith('9') && limpio.length === 8) return `+598${limpio}`;
    if (limpio.length === 9) return `+598${limpio}`;
    return limpio;
}

function parsearFechaConfigEntrega(valor) {
    const match = String(valor || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    fecha.setHours(0, 0, 0, 0);
    if (
        fecha.getFullYear() !== Number(match[1]) ||
        fecha.getMonth() !== Number(match[2]) - 1 ||
        fecha.getDate() !== Number(match[3])
    ) {
        return null;
    }
    return fecha;
}

function calcularFechasEntrega() {
    const entregasFuturas = typeof appState !== 'undefined'
        ? obtenerEntregasConfiguradasFuturas(appState.configMap || {}, 3)
        : [];
    if (entregasFuturas.length >= 2) {
        return {
            primerJueves: entregasFuturas[0].fechaDate,
            ultimoJueves: entregasFuturas[1].fechaDate
        };
    }

    const fechaPrimerConfig = parsearFechaConfigEntrega(configSistema.fechaEntregaPrimer);
    const fechaUltimoConfig = parsearFechaConfigEntrega(configSistema.fechaEntregaUltimo);
    const hoyConfig = new Date();
    hoyConfig.setHours(0, 0, 0, 0);
    if (fechaPrimerConfig && fechaUltimoConfig && fechaUltimoConfig >= hoyConfig) {
        return { primerJueves: fechaPrimerConfig, ultimoJueves: fechaUltimoConfig };
    }

    const hoy = new Date();
    let anio = hoy.getFullYear();
    let mes = hoy.getMonth();
    let primerJueves = new Date(anio, mes, 1);
    while (primerJueves.getDay() !== 4) primerJueves.setDate(primerJueves.getDate() + 1);
    if (primerJueves < hoy) {
        mes += 1;
        if (mes > 11) {
            mes = 0;
            anio += 1;
        }
        primerJueves = new Date(anio, mes, 1);
        while (primerJueves.getDay() !== 4) primerJueves.setDate(primerJueves.getDate() + 1);
    }
    const ultimoJueves = new Date(anio, mes + 1, 0);
    while (ultimoJueves.getDay() !== 4) ultimoJueves.setDate(ultimoJueves.getDate() - 1);
    return { primerJueves, ultimoJueves };
}

function puedeConfirmar(fechaEntrega, horasLimite) {
    const ahora = new Date();
    const fechaLimite = new Date(fechaEntrega.getTime() - horasLimite * 60 * 60 * 1000);
    return ahora <= fechaLimite;
}

function normalizarFechaSinHora(fecha) {
    const valor = new Date(fecha);
    valor.setHours(0, 0, 0, 0);
    return valor;
}

function obtenerUltimoJuevesDelMes(anio, mes) {
    const ultimoDia = new Date(anio, mes + 1, 0);
    ultimoDia.setHours(0, 0, 0, 0);
    while (ultimoDia.getDay() !== 4) ultimoDia.setDate(ultimoDia.getDate() - 1);
    return ultimoDia;
}

function formatearFechaClave(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function normalizarFechaEventoCalendario(fecha) {
    if (fecha instanceof Date) return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    return parsearFechaConfigEntrega(fecha) || new Date(fecha);
}

function obtenerEtiquetaDiaCalendario(fecha) {
    return fecha.toLocaleDateString('es-UY', { weekday: 'short' }).replace('.', '');
}

function obtenerMesesDesdeEventosCalendario(eventos = []) {
    const meses = new Map();
    eventos.forEach((evento) => {
        const fecha = normalizarFechaEventoCalendario(evento.fechaDate || evento.fecha);
        if (Number.isNaN(fecha.getTime())) return;
        const mes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        meses.set(formatearFechaClave(mes), mes);
    });
    return [...meses.values()].sort((a, b) => a.getTime() - b.getTime());
}

function formatearHoraRangoEntrega(horaInicio = '') {
    const match = String(horaInicio || '').match(/^(\d{2}):(\d{2})/);
    if (!match) return '';
    const inicioMinutos = Number(match[1]) * 60 + Number(match[2]);
    const finMinutos = (inicioMinutos + 120) % (24 * 60);
    const inicio = `${String(Math.floor(inicioMinutos / 60)).padStart(2, '0')}:${String(inicioMinutos % 60).padStart(2, '0')}`;
    const fin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;
    return `${inicio} a ${fin}`;
}

function construirEventoEntregaCalendarioHTML(evento, opciones = {}) {
    const eventoClickeable = evento.actionId && !opciones.accionEnDia;
    const tag = eventoClickeable ? 'button' : 'div';
    const actionAttrs = eventoClickeable
        ? ` type="button" data-reserva-evento="${escapeHtml(evento.actionId)}"`
        : '';
    const horario = evento.horario || formatearHoraRangoEntrega(evento.hora);
    const titulo = evento.fechaTexto
        ? `Entrega ${evento.fechaTexto}`
        : (evento.titulo || 'Entrega');
    const detalle = evento.reservaResumen || evento.detalle;
    return `
        <${tag}${actionAttrs} class="entrega-calendar-event ${evento.destacado ? 'destacado' : ''}">
            <strong>${escapeHtml(titulo)}</strong>
            ${horario ? `<span>${escapeHtml(horario)}</span>` : ''}
            ${detalle ? `<small>${escapeHtml(detalle)}</small>` : ''}
            ${evento.lugar ? `<em class="entrega-calendar-place">${escapeHtml(evento.lugar)}</em>` : ''}
        </${tag}>
    `;
}

function construirCalendarioMesEntregasHTML(fechaMes, eventos = [], pendientes = [], opciones = {}) {
    const inicioMes = new Date(fechaMes.getFullYear(), fechaMes.getMonth(), 1);
    const offsetLunes = (inicioMes.getDay() + 6) % 7;
    const inicioGrilla = new Date(inicioMes);
    inicioGrilla.setDate(inicioMes.getDate() - offsetLunes);
    const hoyClave = formatearFechaClave(new Date());
    const eventosPorDia = eventos.reduce((mapa, evento) => {
        const fecha = normalizarFechaEventoCalendario(evento.fechaDate || evento.fecha);
        if (Number.isNaN(fecha.getTime())) return mapa;
        const clave = formatearFechaClave(fecha);
        mapa[clave] = [...(mapa[clave] || []), evento];
        return mapa;
    }, {});
    const pendientesMes = pendientes.filter((evento) => {
        const fecha = normalizarFechaEventoCalendario(evento.fechaDate || evento.fecha);
        return !Number.isNaN(fecha.getTime())
            && fecha.getFullYear() === fechaMes.getFullYear()
            && fecha.getMonth() === fechaMes.getMonth();
    });

    const celdas = Array.from({ length: 42 }, (_, indice) => {
        const fecha = new Date(inicioGrilla);
        fecha.setDate(inicioGrilla.getDate() + indice);
        const clave = formatearFechaClave(fecha);
        const eventosDia = eventosPorDia[clave] || [];
        const eventoPrincipal = eventosDia.find((evento) => evento.actionId);
        const accionDiaAttrs = eventoPrincipal?.actionId
            ? ` role="button" tabindex="0" data-entrega-day-action="true" data-reserva-evento="${escapeHtml(eventoPrincipal.actionId)}" aria-label="Ver reserva del ${escapeHtml(fecha.toLocaleDateString('es-UY'))}"`
            : '';
        const fueraMes = fecha.getMonth() !== inicioMes.getMonth();
        return `
            <div class="entrega-calendar-day ${fueraMes ? 'fuera-mes' : ''} ${clave === hoyClave ? 'hoy' : ''} ${eventosDia.length ? 'con-entrega' : ''} ${eventoPrincipal?.actionId ? 'entrega-day-clickable' : ''}"${accionDiaAttrs}>
                <div class="entrega-calendar-date">
                    <span>${escapeHtml(obtenerEtiquetaDiaCalendario(fecha))}</span>
                    <strong>${fecha.getDate()}</strong>
                </div>
                ${eventosDia.length ? `<div class="entrega-calendar-events">${eventosDia.map((evento) => construirEventoEntregaCalendarioHTML(evento, { accionEnDia: Boolean(eventoPrincipal?.actionId) })).join('')}</div>` : ''}
            </div>
        `;
    }).join('');

    return `
        <section class="entrega-calendar-month">
            ${opciones.ocultarTitulo ? '' : `
                <div class="entrega-calendar-month-title">
                    <strong>${escapeHtml(inicioMes.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }))}</strong>
                    ${pendientesMes.length ? `<span>${pendientesMes.length} entrega${pendientesMes.length > 1 ? 's' : ''} a confirmar</span>` : ''}
                </div>
            `}
            <div class="entrega-calendar-weekdays">
                ${['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((dia) => `<span>${dia}</span>`).join('')}
            </div>
            <div class="entrega-calendar-grid">
                ${celdas}
            </div>
        </section>
    `;
}

function construirCalendarioEntregasHTML(eventos = [], opciones = {}) {
    const eventosConFecha = (eventos || [])
        .map((evento) => ({
            ...evento,
            fechaDate: normalizarFechaEventoCalendario(evento.fechaDate || evento.fecha)
        }))
        .filter((evento) => !Number.isNaN(evento.fechaDate.getTime()));
    const eventosConfirmados = eventosConFecha.filter((evento) => !evento.entregaAConfirmar);
    const eventosPendientes = eventosConFecha.filter((evento) => evento.entregaAConfirmar);
    const meses = (opciones.meses?.length ? opciones.meses : obtenerMesesDesdeEventosCalendario(eventosConFecha))
        .map((fecha) => normalizarFechaEventoCalendario(fecha))
        .filter((fecha) => !Number.isNaN(fecha.getTime()))
        .map((fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    const claves = new Set();
    const mesesUnicos = meses
        .filter((fecha) => {
            const clave = formatearFechaClave(fecha);
            if (claves.has(clave)) return false;
            claves.add(clave);
            return true;
        })
        .sort((a, b) => a.getTime() - b.getTime());
    const mesesRender = mesesUnicos.length ? mesesUnicos : [new Date(new Date().getFullYear(), new Date().getMonth(), 1)];
    const indiceInicial = Math.max(0, Math.min(Number(opciones.indiceInicial || 0), mesesRender.length - 1));
    const mesInicial = mesesRender[indiceInicial];
    const tituloInicial = mesInicial.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });

    return `
        <div class="entrega-google-calendar entrega-google-calendar-single" data-entrega-calendar data-active-index="${indiceInicial}">
            <div class="entrega-calendar-shell-head">
                <button type="button" class="entrega-calendar-nav" data-entrega-calendar-nav="-1" aria-label="Mes anterior" ${indiceInicial === 0 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="entrega-calendar-shell-title">
                    <strong data-entrega-calendar-title>${escapeHtml(tituloInicial)}</strong>
                    <span data-entrega-calendar-count>${indiceInicial + 1} de ${mesesRender.length}</span>
                </div>
                <button type="button" class="entrega-calendar-nav" data-entrega-calendar-nav="1" aria-label="Mes siguiente" ${indiceInicial >= mesesRender.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="entrega-calendar-panes">
                ${mesesRender.map((mes, index) => {
                    const titulo = mes.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
                    return `
                        <div class="entrega-calendar-pane ${index === indiceInicial ? 'active' : ''}" data-entrega-calendar-pane="${index}" data-month-title="${escapeHtml(titulo)}" data-month-count="${index + 1} de ${mesesRender.length}">
                            ${construirCalendarioMesEntregasHTML(mes, eventosConfirmados, eventosPendientes, { ocultarTitulo: true })}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function actualizarCalendarioEntregasVisible(calendar) {
    if (!calendar) return;
    const panes = [...calendar.querySelectorAll('[data-entrega-calendar-pane]')];
    if (!panes.length) return;
    const activeIndex = Math.max(0, Math.min(Number(calendar.dataset.activeIndex || 0), panes.length - 1));
    calendar.dataset.activeIndex = String(activeIndex);
    panes.forEach((pane, index) => pane.classList.toggle('active', index === activeIndex));
    const activePane = panes[activeIndex];
    const title = calendar.querySelector('[data-entrega-calendar-title]');
    const count = calendar.querySelector('[data-entrega-calendar-count]');
    if (title) title.textContent = activePane.dataset.monthTitle || '';
    if (count) count.textContent = activePane.dataset.monthCount || `${activeIndex + 1} de ${panes.length}`;
    calendar.querySelectorAll('[data-entrega-calendar-nav]').forEach((btn) => {
        const direction = Number(btn.dataset.entregaCalendarNav || 0);
        btn.disabled = (direction < 0 && activeIndex === 0) || (direction > 0 && activeIndex === panes.length - 1);
    });
}

if (typeof document !== 'undefined' && !window.__cururuDeliveryCalendarBound) {
    window.__cururuDeliveryCalendarBound = true;
    document.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-entrega-calendar-nav]');
        if (!btn) return;
        const calendar = btn.closest('[data-entrega-calendar]');
        if (!calendar) return;
        const panes = calendar.querySelectorAll('[data-entrega-calendar-pane]');
        const direction = Number(btn.dataset.entregaCalendarNav || 0);
        const nextIndex = Math.max(0, Math.min(Number(calendar.dataset.activeIndex || 0) + direction, panes.length - 1));
        calendar.dataset.activeIndex = String(nextIndex);
        actualizarCalendarioEntregasVisible(calendar);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const day = event.target.closest('[data-entrega-day-action]');
        if (!day) return;
        event.preventDefault();
        day.click();
    });
}

function obtenerClaveMesEntrega(fecha) {
    return `${fecha.getFullYear()}_${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function obtenerClaveEntregaPeriodo(mesClave, indice, campo) {
    return `entrega_${mesClave}_${indice}_${campo}`;
}

function obtenerMesesEntregaProximos(cantidad = 3, fechaReferencia = new Date()) {
    const meses = [];
    const base = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < cantidad; i += 1) {
        const fechaMes = new Date(base.getFullYear(), base.getMonth() + i, 1);
        const mesClave = obtenerClaveMesEntrega(fechaMes);
        meses.push({
            mesClave,
            fechaMes,
            etiqueta: fechaMes.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })
        });
    }
    return meses;
}

function obtenerEntregaPeriodoConfig(configMap = {}, mesClave, indice) {
    let fecha = configMap[obtenerClaveEntregaPeriodo(mesClave, indice, 'fecha')] || '';
    let hora = configMap[obtenerClaveEntregaPeriodo(mesClave, indice, 'hora')] || '18:00';
    let mensaje = configMap[obtenerClaveEntregaPeriodo(mesClave, indice, 'mensaje')] || '';
    const legacyFecha = indice === 1 ? configMap.fecha_entrega_primer : configMap.fecha_entrega_ultimo;
    const legacyMensaje = indice === 1 ? configMap.mensaje_entrega_primer : configMap.mensaje_entrega_ultimo;
    if (!fecha && legacyFecha) {
        const legacyDate = parsearFechaConfigEntrega(legacyFecha);
        if (legacyDate && obtenerClaveMesEntrega(legacyDate) === mesClave) {
            fecha = legacyFecha;
            mensaje = mensaje || legacyMensaje || '';
        }
    }
    return {
        mesClave,
        indice,
        fecha,
        hora,
        lugar: configMap[obtenerClaveEntregaPeriodo(mesClave, indice, 'lugar')] || configMap.lugar_entrega || 'Lugar de Siempre',
        mensaje
    };
}

function obtenerEntregasConfiguradasFuturas(configMap = {}, cantidadMeses = 3, fechaReferencia = new Date()) {
    const hoy = normalizarFechaSinHora(fechaReferencia);
    return obtenerMesesEntregaProximos(cantidadMeses, fechaReferencia)
        .flatMap((periodo) => [1, 2].map((indice) => {
            const entrega = obtenerEntregaPeriodoConfig(configMap, periodo.mesClave, indice);
            const fechaDate = parsearFechaConfigEntrega(entrega.fecha);
            return {
                ...entrega,
                fechaDate,
                mesEtiqueta: periodo.etiqueta
            };
        }))
        .filter((entrega) => entrega.fechaDate && entrega.fechaDate >= hoy)
        .sort((a, b) => {
            const diferencia = a.fechaDate.getTime() - b.fechaDate.getTime();
            if (diferencia !== 0) return diferencia;
            return Number(a.indice || 0) - Number(b.indice || 0);
        });
}

function obtenerCicloClub(fechaReferencia = new Date()) {
    const referencia = normalizarFechaSinHora(fechaReferencia);
    const ultimoJuevesMesActual = obtenerUltimoJuevesDelMes(referencia.getFullYear(), referencia.getMonth());

    let inicio;
    if (referencia >= ultimoJuevesMesActual) {
        inicio = ultimoJuevesMesActual;
    } else {
        const fechaMesAnterior = new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1);
        inicio = obtenerUltimoJuevesDelMes(fechaMesAnterior.getFullYear(), fechaMesAnterior.getMonth());
    }

    const siguienteInicio = obtenerUltimoJuevesDelMes(inicio.getFullYear(), inicio.getMonth() + 1);
    const fin = new Date(siguienteInicio);
    fin.setDate(fin.getDate() - 1);
    fin.setHours(23, 59, 59, 999);

    return {
        inicio,
        fin,
        clave: `${formatearFechaClave(inicio)}_${formatearFechaClave(normalizarFechaSinHora(fin))}`,
        etiqueta: `${inicio.toLocaleDateString('es-UY')} al ${normalizarFechaSinHora(fin).toLocaleDateString('es-UY')}`
    };
}

function fechaEstaEnCicloClub(fecha, ciclo = obtenerCicloClub()) {
    if (!fecha) return false;
    const valor = parsearFechaConfigEntrega(fecha) || new Date(fecha);
    return valor >= ciclo.inicio && valor <= ciclo.fin;
}

function obtenerClaveMesActual() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function obtenerIdentificadorSocioPedido() {
    if (appState.socioData?.id) return appState.socioData.id;
    if (appState.socioData?.email) return appState.socioData.email;
    if (appState.usuarioActual?.email) return appState.usuarioActual.email;
    return 'invitado';
}

function obtenerImagenFallback(producto) {
    const nombre = String(producto?.nombre || '').toLowerCase();
    if (nombre.includes('cururu')) return crearPlaceholderConstruccion('Cururu Dream', 'Imagen en actualizacion');
    if (nombre.includes('sapo')) return crearPlaceholderConstruccion('Sapo Kush', 'Imagen en actualizacion');
    if (nombre.includes('rana')) return crearPlaceholderConstruccion('Rana Verde', 'Imagen en actualizacion');
    return crearPlaceholderConstruccion('Cururu Club', 'Imagen en actualizacion');
}

function esRutaLocalInvalida(valor) {
    const ruta = String(valor || '').trim().toLowerCase();
    if (!ruta) return true;
    if (ruta.startsWith('file:///')) return true;
    if (/^[a-z]:[\\/]/.test(ruta)) return true;
    return false;
}

function crearPlaceholderConstruccion(titulo = 'Sitio en construcción', detalle = 'Contenido visual en preparación') {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#102015"/>
                    <stop offset="100%" stop-color="#27402a"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="800" fill="url(#bg)"/>
            <rect x="70" y="70" width="1060" height="660" rx="36" fill="rgba(8,15,6,0.55)" stroke="#7ca35a" stroke-width="4"/>
            <text x="600" y="340" fill="#000000" font-family="Poppins, Arial, sans-serif" font-size="54" font-weight="700" text-anchor="middle">${titulo}</text>
            <text x="600" y="410" fill="#dce8cf" font-family="Open Sans, Arial, sans-serif" font-size="30" text-anchor="middle">${detalle}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\n\s+/g, ' ').trim())}`;
}

function normalizarListaImagenes(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) {
        return valor
            .map((item) => String(item || '').trim())
            .filter((item) => item && !esRutaLocalInvalida(item));
    }
    if (typeof valor === 'string') {
        const limpio = valor.trim();
        if (!limpio || esRutaLocalInvalida(limpio)) return [];
        if (limpio.startsWith('[')) {
            try {
                const parseado = JSON.parse(limpio);
                if (Array.isArray(parseado)) {
                    return parseado
                        .map((item) => String(item || '').trim())
                        .filter((item) => item && !esRutaLocalInvalida(item));
                }
            } catch (error) {
                console.warn('No se pudo parsear la galería de imágenes', error);
            }
        }
        return [limpio];
    }
    return [];
}

function obtenerImagenPrincipal(listaImagenes = [], titulo = 'Sitio en construcción') {
    return listaImagenes[0] || crearPlaceholderConstruccion(titulo);
}

function construirHTMLGaleriaHorizontal(imagenes, opciones = {}) {
    const {
        imagenPrincipalId = 'galeriaImagenPrincipal',
        stripClass = 'galeria-strip',
        thumbClass = 'galeria-thumb',
        onSelect = 'void(0)',
        titulo = 'Sitio en construcción'
    } = opciones;

    const lista = normalizarListaImagenes(imagenes);
    const imagenesFinales = lista.length ? lista : [crearPlaceholderConstruccion(titulo)];

    return `
        <div class="modal-galeria horizontal">
            <img id="${imagenPrincipalId}" class="modal-imagen" src="${imagenesFinales[0]}" alt="${escapeHtml(titulo)}">
            <div class="${stripClass}">
                ${imagenesFinales.map((imagen, index) => `
                    <button
                        type="button"
                        class="${thumbClass}${index === 0 ? ' activa' : ''}"
                        onclick="${onSelect}(${index})"
                    >
                        <img src="${imagen}" alt="${escapeHtml(`${titulo} ${index + 1}`)}">
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function aplicarContenidoInstitucional(configMap = {}) {
    const historiaTitulo = document.getElementById('historiaTituloPrincipal');
    const historiaPrincipal = document.getElementById('historiaTextoPrincipal');
    const historiaAdicional = document.getElementById('historiaTextoAdicional');
    const btnLeerMasHistoria = document.getElementById('btnLeerMasHistoria');
    const historiaTextoPlano = typeof configMap.historia_texto === 'string' ? configMap.historia_texto.trim() : '';
    const tituloHistoriaPredeterminado = 'Cururú Club Cannábico';
    const resumenHistoria = 'Flores de alta calidad y una experiencia cuidada para quienes buscan elegir y consumir de forma consciente.';
    const normalizarTextoHistoria = (texto) => String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const extraerTextoAdicionalHistoria = (textoCompleto) => {
        if (!textoCompleto) return '';

        const bloques = textoCompleto
            .split(/\r?\n+/)
            .map((bloque) => bloque.trim())
            .filter(Boolean);

        if (!bloques.length) return '';

        const resumenNormalizado = normalizarTextoHistoria(resumenHistoria);
        const primerBloqueNormalizado = normalizarTextoHistoria(bloques[0]);
        const primerBloqueEsTitulo = primerBloqueNormalizado.includes('cururu club cannabico');
        let bloquesRestantes = primerBloqueEsTitulo ? bloques.slice(1) : [...bloques];

        if (!bloquesRestantes.length) return '';

        if (normalizarTextoHistoria(bloquesRestantes[0]) === resumenNormalizado) {
            bloquesRestantes = bloquesRestantes.slice(1);
        } else {
            const textoUnido = bloquesRestantes.join('\n\n').trim();
            if (normalizarTextoHistoria(textoUnido).startsWith(resumenNormalizado)) {
                return textoUnido.slice(resumenHistoria.length).trim();
            }
        }

        return bloquesRestantes.join('\n\n').trim();
    };

    const extraerTituloHistoria = (textoCompleto) => {
        if (!textoCompleto) return tituloHistoriaPredeterminado;
        const primerBloque = textoCompleto
            .split(/\r?\n+/)
            .map((bloque) => bloque.trim())
            .find(Boolean);
        if (!primerBloque) return tituloHistoriaPredeterminado;
        const tituloNormalizado = normalizarTextoHistoria(primerBloque);
        return tituloNormalizado.includes('cururu club cannabico')
            ? primerBloque
            : tituloHistoriaPredeterminado;
    };

    if (historiaTitulo) {
        historiaTitulo.textContent = extraerTituloHistoria(historiaTextoPlano);
    }

    if (historiaPrincipal) {
        historiaPrincipal.textContent = resumenHistoria;
    }

    if (historiaAdicional) {
        let textoAdicional = '';
        if (historiaTextoPlano) {
            const textoSinTitulo = historiaTextoPlano.replace(/^Cururú Club Cannábico\s*/i, '').trim();
            textoAdicional = textoSinTitulo.startsWith(resumenHistoria)
                ? textoSinTitulo.slice(resumenHistoria.length).trim()
                : textoSinTitulo;
        }
        historiaAdicional.textContent = textoAdicional;
        historiaAdicional.hidden = !textoAdicional;
    }

    if (historiaAdicional) {
        const textoAdicionalCorregido = extraerTextoAdicionalHistoria(historiaTextoPlano);
        historiaAdicional.textContent = textoAdicionalCorregido;
        historiaAdicional.hidden = !textoAdicionalCorregido;
    }

    if (btnLeerMasHistoria) {
        const hayTextoAdicional = Boolean(historiaAdicional && historiaAdicional.textContent.trim());
        btnLeerMasHistoria.hidden = !hayTextoAdicional;
        btnLeerMasHistoria.classList.remove('activo');
        btnLeerMasHistoria.innerHTML = '<i class="fas fa-chevron-down"></i> Mostrar más';
        if (hayTextoAdicional && historiaAdicional) {
            historiaAdicional.hidden = true;
            btnLeerMasHistoria.onclick = () => {
                const expandido = !historiaAdicional.hidden;
                historiaAdicional.hidden = expandido;
                btnLeerMasHistoria.classList.toggle('activo', !expandido);
                btnLeerMasHistoria.innerHTML = !expandido
                    ? '<i class="fas fa-chevron-up"></i> Mostrar menos'
                    : '<i class="fas fa-chevron-down"></i> Mostrar más';
            };
        } else {
            btnLeerMasHistoria.onclick = null;
        }
    }

    const cifraSocios = document.getElementById('cifra-socios');
    const cifraCepas = document.getElementById('cifra-cepas');
    const cifraAnios = document.getElementById('cifra-anios');
    if (cifraSocios && configMap.cifra_socios) cifraSocios.textContent = `+${configMap.cifra_socios}`;
    if (cifraCepas && configMap.cifra_cepas) cifraCepas.textContent = `${configMap.cifra_cepas}+`;
    if (cifraAnios && configMap.cifra_anios) cifraAnios.textContent = configMap.cifra_anios;

    const historiaMedia = document.getElementById('historiaMediaPrincipal');
    const historiaGaleria = document.getElementById('historiaGaleria');
    if (historiaMedia && historiaGaleria) {
        const esInvitado = appState.rolUsuario === 'invitado';
        const videoActualEnPantalla = historiaMedia.querySelector('video source')?.src || historiaMedia.querySelector('video')?.currentSrc || '';
        const imagenesHistoria = normalizarListaImagenes(configMap.historia_galeria);
        const videoGuardado = localStorage.getItem('cururu_historia_video_url') || '';
        const videoHistoria = String(configMap.historia_video_url || '').trim();
        if (videoHistoria) {
            appState.historiaVideoActual = videoHistoria;
            localStorage.setItem('cururu_historia_video_url', videoHistoria);
        }
        const videoPresentacion = videoHistoria || appState.historiaVideoActual || videoGuardado || videoActualEnPantalla || window.defaultHistoriaVideoUrl || '';

        if (esInvitado && videoPresentacion) {
            historiaMedia.innerHTML = `
                <video autoplay muted defaultMuted loop playsinline style="width: min(100%, 260px); aspect-ratio: 9 / 16; max-height: min(70dvh, 460px); margin: 0 auto; border-radius: 16px; object-fit: cover; background: #111; pointer-events: none;" disablepictureinpicture controlslist="nodownload nofullscreen noplaybackrate">
                    <source src="${videoPresentacion}" type="video/mp4">
                    Tu navegador no soporta videos.
                </video>
            `;
        } else if (imagenesHistoria.length) {
            const imagenPrincipal = obtenerImagenPrincipal(imagenesHistoria, 'Sitio en construcción');
            historiaMedia.innerHTML = `
                <img
                    src="${imagenPrincipal}"
                    alt="Historia Cururú Club"
                    style="width: 100%; max-height: 300px; border-radius: 16px; object-fit: cover;"
                    onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';"
                >
            `;
        } else if (videoPresentacion) {
            historiaMedia.innerHTML = `
                <video autoplay muted loop playsinline controls style="width: min(100%, 260px); aspect-ratio: 9 / 16; max-height: min(70dvh, 460px); margin: 0 auto; border-radius: 16px; object-fit: cover; background: #111;">
                    <source src="${videoPresentacion}">
                    Tu navegador no soporta videos.
                </video>
            `;
        } else {
            historiaMedia.innerHTML = `
                <video autoplay muted loop playsinline controls style="width: min(100%, 260px); aspect-ratio: 9 / 16; max-height: min(70dvh, 460px); margin: 0 auto; border-radius: 16px; object-fit: cover; background: #111;">
                    <source src="${videoPresentacion}" type="video/mp4">
                    Tu navegador no soporta videos.
                </video>
            `;
        }

        if (!esInvitado && imagenesHistoria.length > 1) {
            historiaGaleria.style.display = 'grid';
            historiaGaleria.innerHTML = imagenesHistoria.map((imagen, index) => `
                <button
                    type="button"
                    class="historia-galeria-item${index === 0 ? ' activa' : ''}"
                    onclick="seleccionarHistoriaImagen(${index})"
                >
                    <img src="${imagen}" alt="Historia ${index + 1}" onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';">
                </button>
            `).join('');
            appState.historiaGaleria = imagenesHistoria;
        } else {
            historiaGaleria.style.display = 'none';
            historiaGaleria.innerHTML = '';
            appState.historiaGaleria = esInvitado ? [] : imagenesHistoria;
        }
    }
}

function inicializarPlaceholders() {
    if (localStorage.getItem('cururu_placeholders')) return;
    const images = {
        'cururu-dream': { color: '#2d5a27', text: 'Cururu Dream' },
        'sapo-kush': { color: '#3a6b2d', text: 'Sapo Kush' },
        'rana-verde': { color: '#4a7a3a', text: 'Rana Verde' },
        'red-pop': { color: '#8b3a3a', text: 'Red Pop' }
    };
    const placeholders = {};
    Object.entries(images).forEach(([name, config]) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = config.color;
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Poppins, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(config.text, 200, 140);
        ctx.font = '14px Poppins, Arial';
        ctx.fillStyle = '#a0b890';
        ctx.fillText('Cururú Club', 200, 170);
        placeholders[name] = canvas.toDataURL('image/jpeg', 0.9);
    });
    localStorage.setItem('cururu_placeholders', JSON.stringify(placeholders));
}


window.crearPlaceholderConstruccion = crearPlaceholderConstruccion;
window.normalizarListaImagenes = normalizarListaImagenes;
window.obtenerImagenPrincipal = obtenerImagenPrincipal;
window.construirHTMLGaleriaHorizontal = construirHTMLGaleriaHorizontal;
window.obtenerCicloClub = obtenerCicloClub;
window.fechaEstaEnCicloClub = fechaEstaEnCicloClub;
window.seleccionarHistoriaImagen = function(indice) {
    const historiaMedia = document.getElementById('historiaMediaPrincipal');
    if (!historiaMedia || !Array.isArray(appState.historiaGaleria) || !appState.historiaGaleria[indice]) return;
    const imagen = appState.historiaGaleria[indice];
    historiaMedia.innerHTML = `
        <img
            src="${imagen}"
            alt="Historia Cururú Club"
            style="width: 100%; max-height: 300px; border-radius: 16px; object-fit: cover;"
            onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';"
        >
    `;
    document.querySelectorAll('.historia-galeria-item').forEach((item, itemIndex) => {
        item.classList.toggle('activa', itemIndex === indice);
    });
};
