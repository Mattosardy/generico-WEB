function mostrarMensaje(mensaje, esExito = true) {
    const div = document.createElement('div');
    div.className = `mensaje-flotante ${esExito ? 'mensaje-exito' : 'mensaje-error'}`;
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    div.style.setProperty('background', 'linear-gradient(135deg, #e7f4d8, #c8e0a7)', 'important');
    div.style.setProperty('color', '#10200f', 'important');
    div.style.setProperty('border', '1px solid rgba(24, 40, 17, 0.18)', 'important');
    div.style.setProperty('box-shadow', '0 14px 34px rgba(64, 123, 37, 0.18)', 'important');
    div.innerHTML = `<i class="fas ${esExito ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

function normalizarTextoVisual(text) {
    if (text === null || text === undefined) return '';
    let valor = String(text);
    const mojibakePattern = /[\u00c3\u00c2\u00e2\u00ef\u00f0]/;
    if (!mojibakePattern.test(valor)) return valor;

    try {
        valor = decodeURIComponent(escape(valor));
    } catch (error) {
        // Fallback for text that already arrived partially mojibaked.
    }

    const replacements = [
        ['\u00e2\u20ac\u0153', '"'],
        ['\u00e2\u20ac\u009d', '"'],
        ['\u00e2\u20ac\u2122', "'"],
        ['\u00e2\u20ac\u02dc', "'"],
        ['\u00e2\u20ac\u201c', '-'],
        ['\u00e2\u20ac\u009d', '-'],
        ['\u00c2\u00b7', '-'],
        ['\u00c2', ''],
        ['\u00ef\u00bf\u00bc', ''],
        ['\u00c3\u00a1', '\u00e1'],
        ['\u00c3\u00a9', '\u00e9'],
        ['\u00c3\u00ad', '\u00ed'],
        ['\u00c3\u00b3', '\u00f3'],
        ['\u00c3\u00ba', '\u00fa'],
        ['\u00c3\u00b1', '\u00f1'],
        ['\u00c3\u0081', '\u00c1'],
        ['\u00c3\u2030', '\u00c9'],
        ['\u00c3\u008d', '\u00cd'],
        ['\u00c3\u201c', '\u00d3'],
        ['\u00c3\u0160', '\u00da'],
        ['\u00c3\u2018', '\u00d1']
    ];

    replacements.forEach(([from, to]) => {
        valor = valor.split(from).join(to);
    });

    return valor;
}
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = normalizarTextoVisual(text);
    return div.innerHTML;
}

function obtenerGoogleCalendarEmbedUrl() {
    const valor = String(window.GOOGLE_CALENDAR_EMBED_URL || '').trim();
    if (!valor) return '';
    if (/(PONER_AQUI|TODO|INCOMPLETO|REEMPLAZAR)/i.test(valor)) return '';
    return valor;
}

function construirGoogleCalendarEmbedHTML(opciones = {}) {
    const url = obtenerGoogleCalendarEmbedUrl();
    const badge = opciones.badge || 'Google Calendar';
    const titulo = opciones.titulo || 'Calendario de entregas';
    const descripcion = opciones.descripcion || 'Mirá el calendario de entregas de forma embebida cuando tenés una URL válida configurada.';
    const fallbackTitle = opciones.fallbackTitle || 'Calendario embebido sin configurar';
    const fallbackDescripcion = opciones.fallbackDescripcion || 'El calendario interno actual sigue disponible y podés activar el embebido con una URL válida.';

    if (!url) {
        return `
            <div class="google-calendar-panel ${escapeHtml(opciones.panelClass || '')}">
                <div class="google-calendar-panel-copy">
                    <span class="dashboard-eyebrow">${escapeHtml(badge)}</span>
                    <strong>${escapeHtml(fallbackTitle)}</strong>
                    <p>${escapeHtml(fallbackDescripcion)}</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="google-calendar-panel ${escapeHtml(opciones.panelClass || '')}">
            <div class="google-calendar-panel-copy">
                <span class="dashboard-eyebrow">${escapeHtml(badge)}</span>
                <strong>${escapeHtml(titulo)}</strong>
                <p>${escapeHtml(descripcion)}</p>
            </div>
            <div class="google-calendar-actions">
                <a class="btn-submit google-calendar-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir en Google Calendar</a>
            </div>
            <div class="google-calendar-wrapper">
                <iframe class="google-calendar-frame" title="${escapeHtml(titulo)}" src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
            </div>
        </div>
    `;
}

const IMAGE_UPLOAD_SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_UPLOAD_REJECTED_TYPES = new Set(['image/gif', 'image/heic', 'image/heif']);

function obtenerExtensionArchivoImagen(file, mimeType = '') {
    const nombre = String(file?.name || '');
    const extensionOriginal = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return extensionOriginal || 'jpg';
}

function obtenerNombreArchivoSanitizado(file, mimeType = '') {
    const nombre = String(file?.name || 'imagen').replace(/\.[^.]+$/, '') || 'imagen';
    const extension = obtenerExtensionArchivoImagen(file, mimeType);
    return `${nombre}.${extension}`;
}

function obtenerTipoImagenArchivo(file) {
    const tipo = String(file?.type || '').toLowerCase();
    const nombre = String(file?.name || '').toLowerCase();
    if (tipo) return tipo;
    if (/\.(jpe?g)$/.test(nombre)) return 'image/jpeg';
    if (/\.png$/.test(nombre)) return 'image/png';
    if (/\.webp$/.test(nombre)) return 'image/webp';
    if (/\.gif$/.test(nombre)) return 'image/gif';
    if (/\.(heic|heif)$/.test(nombre)) return 'image/heic';
    return '';
}

function validarFormatoImagenSanitizable(file) {
    const tipo = obtenerTipoImagenArchivo(file);
    if (IMAGE_UPLOAD_REJECTED_TYPES.has(tipo)) {
        throw new Error('Formato no soportado. Usá JPG, PNG o WEBP. GIF, HEIC y HEIF no se suben para evitar conservar metadatos.');
    }
    if (!IMAGE_UPLOAD_SUPPORTED_TYPES.has(tipo)) {
        throw new Error('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }
    return tipo;
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('No se pudo limpiar la imagen. Probá con JPG, PNG o WEBP.'));
                return;
            }
            resolve(blob);
        }, mimeType, quality);
    });
}

function cargarImagenParaSanitizar(file) {
    if (typeof createImageBitmap === 'function') {
        return createImageBitmap(file);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo leer la imagen. Verificá que sea un JPG, PNG o WEBP válido.'));
        };
        img.src = url;
    });
}

async function sanitizeImageBeforeUpload(file) {
    if (!file) throw new Error('No se seleccionó ninguna imagen.');
    const tipoOriginal = validarFormatoImagenSanitizable(file);

    let imagen;
    try {
        imagen = await cargarImagenParaSanitizar(file);
    } catch (error) {
        throw new Error(error?.message || 'No se pudo procesar la imagen seleccionada.');
    }

    const width = imagen.width || imagen.naturalWidth;
    const height = imagen.height || imagen.naturalHeight;
    if (!width || !height) {
        if (typeof imagen.close === 'function') imagen.close();
        throw new Error('La imagen no tiene dimensiones válidas.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        if (typeof imagen.close === 'function') imagen.close();
        throw new Error('El navegador no pudo preparar la imagen para limpieza.');
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(imagen, 0, 0, width, height);
    if (typeof imagen.close === 'function') imagen.close();

    let tipoSalida = tipoOriginal === 'image/jpeg' ? 'image/jpeg' : tipoOriginal;
    let calidad = tipoSalida === 'image/jpeg' ? 0.9 : undefined;
    let blob = await canvasToBlob(canvas, tipoSalida, calidad);

    if (tipoOriginal === 'image/webp' && blob.type !== 'image/webp') {
        tipoSalida = 'image/png';
        blob = await canvasToBlob(canvas, tipoSalida);
    }

    const nombreSanitizado = obtenerNombreArchivoSanitizado(file, tipoSalida || blob.type || tipoOriginal);
    return new File([blob], nombreSanitizado, {
        type: tipoSalida || blob.type || tipoOriginal,
        lastModified: Date.now()
    });
}

async function sanitizeImagesBeforeUpload(files) {
    const resultado = [];
    for (const file of Array.from(files || [])) {
        resultado.push(await sanitizeImageBeforeUpload(file));
    }
    return resultado;
}

window.sanitizeImageBeforeUpload = sanitizeImageBeforeUpload;
window.sanitizeImagesBeforeUpload = sanitizeImagesBeforeUpload;

function gramosAPacks(gramos) {
    const packs = Number(gramos || 0) / 20;
    return Number.isFinite(packs) ? packs : 0;
}

function formatearPacksReserva(gramos) {
    const packs = gramosAPacks(gramos);
    const etiquetaPack = packs === 1 ? 'Pack' : 'Packs';
    return `${packs} ${etiquetaPack} (${Number(gramos || 0)}g)`;
}

function formatearPacksDisponibles(packs, gramos) {
    const cantidad = Number(packs || 0);
    const etiquetaPack = cantidad === 1 ? 'Pack' : 'Packs';
    return `${cantidad} ${etiquetaPack} (${Number(gramos || 0)}g)`;
}

function obtenerCupoMensualGramos() {
    const valor = Number(configSistema?.cupoMensualGramos || appState?.configMap?.cupo_mensual_gramos || 40);
    return Number.isFinite(valor) && valor > 0 ? valor : 40;
}

function usuarioEsMaestro() {
    return String(appState?.rolUsuario || '').toLowerCase() === 'maestro';
}

function usuarioPuedeVerPrecios() {
    return !usuarioEsMaestro();
}

function formatearPrecioVisible(precio) {
    if (!usuarioPuedeVerPrecios()) return 'Disponible para socios';
    const numero = Number(precio || 0);
    return numero > 0 ? `$${numero.toFixed(0)}` : '';
}

window.usuarioEsMaestro = usuarioEsMaestro;
window.usuarioPuedeVerPrecios = usuarioPuedeVerPrecios;
window.formatearPrecioVisible = formatearPrecioVisible;

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

function obtenerNumeroSemanaISO(fecha) {
    const normalizada = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const dia = normalizada.getUTCDay() || 7;
    normalizada.setUTCDate(normalizada.getUTCDate() + 4 - dia);
    const inicioAnio = new Date(Date.UTC(normalizada.getUTCFullYear(), 0, 1));
    return Math.ceil((((normalizada - inicioAnio) / 86400000) + 1) / 7);
}

function formatearTituloMesCalendario(fecha) {
    const titulo = fecha.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
    return titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : '';
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
    const titulo = evento.titulo || (evento.fechaTexto ? `Entrega ${evento.fechaTexto}` : 'Entrega');
    const detalle = evento.reservaResumen || evento.detalle;
    const estado = evento.entregaAConfirmar ? 'Pendiente' : 'Confirmada';
    const estadoClase = evento.entregaAConfirmar ? 'estado-pendiente' : 'estado-confirmada';
    return `
        <${tag}${actionAttrs} class="entrega-calendar-event ${evento.destacado ? 'destacado' : ''} ${estadoClase}">
            <strong>${escapeHtml(titulo)}</strong>
            <span class="entrega-calendar-state ${estadoClase}">${escapeHtml(estado)}</span>
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

    const filas = Array.from({ length: 6 }, (_, fila) => {
        const inicioSemana = new Date(inicioGrilla);
        inicioSemana.setDate(inicioGrilla.getDate() + (fila * 7));
        const dias = Array.from({ length: 7 }, (_, columna) => {
            const fecha = new Date(inicioSemana);
            fecha.setDate(inicioSemana.getDate() + columna);
            const clave = formatearFechaClave(fecha);
            const eventosDia = eventosPorDia[clave] || [];
            const eventoPrincipal = eventosDia.find((evento) => evento.actionId);
            const etiquetaFecha = fecha.toLocaleDateString('es-UY');
            const accionDiaAttrs = eventoPrincipal?.actionId
                ? ` role="button" tabindex="0" data-entrega-day-action="true" data-reserva-evento="${escapeHtml(eventoPrincipal.actionId)}" aria-label="Ver entrega del ${escapeHtml(etiquetaFecha)}"`
                : ` aria-label="${escapeHtml(etiquetaFecha)}"`;
            const fueraMes = fecha.getMonth() !== inicioMes.getMonth();
            const tooltip = eventosDia.length ? ` title="${escapeHtml(eventosDia.map((evento) => evento.titulo || 'Entrega').join(' · '))}"` : '';
            return `
                <td class="entrega-calendar-day ${fueraMes ? 'fuera-mes' : ''} ${clave === hoyClave ? 'hoy' : ''} ${eventosDia.length ? 'con-entrega' : ''} ${eventoPrincipal?.actionId ? 'entrega-day-clickable' : ''}"${accionDiaAttrs}${tooltip}>
                    <div class="entrega-calendar-date">
                        <strong>${fecha.getDate()}</strong>
                    </div>
                </td>
            `;
        }).join('');
        return `
            <tr class="entrega-calendar-week-row">
                <th class="entrega-calendar-week-number" scope="row">${obtenerNumeroSemanaISO(inicioSemana)}</th>
                ${dias}
            </tr>
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
            <table class="entrega-calendar-table" aria-label="${escapeHtml(formatearTituloMesCalendario(inicioMes))}">
                <colgroup>
                    <col class="entrega-calendar-week-col">
                    ${Array.from({ length: 7 }, () => '<col class="entrega-calendar-day-col">').join('')}
                </colgroup>
                <thead class="entrega-calendar-weekdays">
                    <tr>
                        <th class="entrega-calendar-week-spacer" scope="col"></th>
                        ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((dia) => `<th scope="col">${dia}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="entrega-calendar-grid">
                    ${filas}
                </tbody>
            </table>
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
    const tituloInicial = formatearTituloMesCalendario(mesInicial);

    return `
        <div class="entrega-google-calendar entrega-google-calendar-single" data-entrega-calendar data-active-index="${indiceInicial}">
            <div class="entrega-calendar-shell-head">
                <div class="entrega-calendar-shell-title">
                    <strong data-entrega-calendar-title>${escapeHtml(tituloInicial)}</strong>
                    <span data-entrega-calendar-count>${indiceInicial + 1} de ${mesesRender.length}</span>
                </div>
                <div class="entrega-calendar-actions">
                    <button type="button" class="entrega-calendar-nav" data-entrega-calendar-nav="-1" aria-label="Mes anterior" ${indiceInicial === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button type="button" class="entrega-calendar-nav" data-entrega-calendar-nav="1" aria-label="Mes siguiente" ${indiceInicial >= mesesRender.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="entrega-calendar-panes">
                ${mesesRender.map((mes, index) => {
                    const titulo = formatearTituloMesCalendario(mes);
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

if (typeof document !== 'undefined' && !window.__genericoDeliveryCalendarBound) {
    window.__genericoDeliveryCalendarBound = true;
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

function obtenerHorasLimiteEntrega(configMap = {}, indice = 1) {
    const clave = Number(indice) === 1 ? 'horas_limite_primer' : 'horas_limite_ultimo';
    const fallback = Number(indice) === 1 ? configSistema.horasLimitePrimer : configSistema.horasLimiteUltimo;
    const valor = Number.parseInt(configMap[clave], 10);
    return Number.isFinite(valor) && valor > 0 ? valor : (Number(fallback) || 48);
}

function construirMensajeLimiteReserva(horas, indice = 1) {
    const numero = Number(horas) || 48;
    const entrega = Number(indice) === 1 ? 'primera entrega' : 'segunda entrega';
    return `Tenes tiempo hasta ${numero} hs antes de la ${entrega} para confirmar tu retiro.`;
}

function mensajeLimiteReservaEsAutomatico(mensaje = '') {
    return /ten\S*s tiempo hasta\s+\d+\s*(?:hs|horas)\s+antes/i.test(String(mensaje || ''));
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
    const mensajeAutomatico = construirMensajeLimiteReserva(obtenerHorasLimiteEntrega(configMap, indice), indice);
    const legacyFecha = indice === 1 ? configMap.fecha_entrega_primer : configMap.fecha_entrega_ultimo;
    const legacyMensaje = indice === 1 ? configMap.mensaje_entrega_primer : configMap.mensaje_entrega_ultimo;
    if (!fecha && legacyFecha) {
        const legacyDate = parsearFechaConfigEntrega(legacyFecha);
        if (legacyDate && obtenerClaveMesEntrega(legacyDate) === mesClave) {
            fecha = legacyFecha;
            mensaje = mensaje || legacyMensaje || '';
        }
    }
    if (!mensaje || mensajeLimiteReservaEsAutomatico(mensaje)) {
        mensaje = mensajeAutomatico;
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
    return crearPlaceholderProducto();
}

function esRutaLocalInvalida(valor) {
    const ruta = String(valor || '').trim().toLowerCase();
    if (!ruta) return true;
    if (ruta.startsWith('file:///')) return true;
    if (/^[a-z]:[\\/]/.test(ruta)) return true;
    return false;
}

function crearPlaceholderConstruccion(titulo = 'EN CONSTRUCCION', detalle = 'Foto en preparacion') {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0b0d0b"/>
                    <stop offset="100%" stop-color="#1d2a1f"/>
                </linearGradient>
                <linearGradient id="metal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f7faf5"/>
                    <stop offset="45%" stop-color="#bcc8b8"/>
                    <stop offset="100%" stop-color="#7ca35a"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="800" fill="url(#bg)"/>
            <rect x="76" y="76" width="1048" height="648" rx="42" fill="rgba(255,255,255,0.06)" stroke="url(#metal)" stroke-width="4"/>
            <circle cx="600" cy="285" r="88" fill="rgba(255,255,255,0.08)" stroke="#dce8cf" stroke-width="5"/>
            <path d="M535 295h130v36H535z" fill="url(#metal)" rx="14"/>
            <path d="M555 278c14-54 76-54 90 0" fill="none" stroke="#dce8cf" stroke-width="18" stroke-linecap="round"/>
            <path d="M506 370h188" stroke="#7ca35a" stroke-width="12" stroke-linecap="round"/>
            <path d="M526 430h148M556 486h88" stroke="rgba(220,232,207,0.55)" stroke-width="8" stroke-linecap="round"/>
            <text x="600" y="575" fill="#f7faf5" font-family="Poppins, Arial, sans-serif" font-size="58" font-weight="700" text-anchor="middle" letter-spacing="2">${titulo}</text>
            <text x="600" y="635" fill="#dce8cf" font-family="Open Sans, Arial, sans-serif" font-size="30" text-anchor="middle">${detalle}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\n\s+/g, ' ').trim())}`;
}

function crearPlaceholderProducto() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f7faf1"/>
                    <stop offset="100%" stop-color="#e8f1db"/>
                </linearGradient>
                <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#8db467"/>
                    <stop offset="100%" stop-color="#5d7d43"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="800" fill="url(#bg)"/>
            <rect x="78" y="78" width="1044" height="644" rx="42" fill="rgba(255,255,255,0.88)" stroke="#d9e6c4" stroke-width="4"/>
            <circle cx="600" cy="320" r="120" fill="#f0f6e4"/>
            <path d="M600 235c33 0 59 27 59 62 0 16-6 31-16 43-11 13-17 29-17 46 0 10 3 18 8 25-6 0-12-3-16-7-8-6-12-15-12-25 0-14 5-27 13-37 7-8 10-19 10-30 0-20-9-37-23-49-15-12-34-15-51-8-3 1-6 4-9 6 16-23 41-37 68-37z" fill="url(#accent)"/>
            <path d="M600 284c-15 11-26 29-26 48 0 18 7 36 18 48 8 8 19 13 29 13 11 0 21-5 29-13 12-12 18-30 18-48 0-19-10-37-26-48-4-3-9-1-11 3-2 3-1 8 2 11 13 9 21 25 21 41 0 14-5 28-15 38-6 6-14 9-22 9-9 0-17-3-23-9-10-10-15-24-15-38 0-14 7-27 18-36 3-3 4-8 2-11-2-4-7-6-11-3z" fill="#fcfdf8"/>
            <path d="M590 432h22l-8 33h-6z" fill="url(#accent)"/>
            <path d="M578 500c-9-10-15-24-15-38h74c0 14-6 28-15 38" fill="#d2e2bf"/>
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
    const portada = document.getElementById('portadaInstitucional');
    const portadaTitulo = document.getElementById('portadaTitulo');
    const portadaSubtitulo = document.getElementById('portadaSubtitulo');
    const portadaDescripcion = document.getElementById('portadaDescripcion');
    const portadaDefaults = {
        portada_titulo: 'Club privado para socios',
        portada_subtitulo: 'Pedidos mensuales, entregas claras y novedades en un solo lugar.',
        portada_descripcion: 'Nombre del Club centraliza el catálogo, el cupo mensual, las fechas de retiro, las novedades y la comunicación interna para que cada socio tenga una experiencia simple, ordenada y segura.'
    };
    const tieneClavePortada = (clave) => Object.prototype.hasOwnProperty.call(configMap, clave);
    const valorPortada = (clave) => {
        if (!tieneClavePortada(clave)) return portadaDefaults[clave] || '';
        return String(configMap[clave] || '').trim();
    };
    const portadaActiva = !tieneClavePortada('portada_activa')
        || ['true', '1', 'si', 'sí', 'on', 'activo'].includes(String(configMap.portada_activa || '').trim().toLowerCase());

    if (portada) portada.hidden = !portadaActiva;
    [
        [portadaTitulo, valorPortada('portada_titulo')],
        [portadaSubtitulo, valorPortada('portada_subtitulo')],
        [portadaDescripcion, valorPortada('portada_descripcion')]
    ].forEach(([elemento, texto]) => {
        if (!elemento) return;
        elemento.textContent = texto;
        elemento.hidden = !texto || !portadaActiva;
    });

    const historiaTitulo = document.getElementById('historiaTituloPrincipal');
    const historiaPrincipal = document.getElementById('historiaTextoPrincipal');
    const historiaAdicional = document.getElementById('historiaTextoAdicional');
    const btnLeerMasHistoria = document.getElementById('btnLeerMasHistoria');
    const historiaTextoPlano = typeof configMap.historia_texto === 'string' ? configMap.historia_texto.trim() : '';
    const tituloHistoriaPredeterminado = 'generico_WEB';
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
        const primerBloqueEsTitulo = primerBloqueNormalizado.includes('generico club cannabico');
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
        return tituloNormalizado.includes('generico club cannabico')
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
            const textoSinTitulo = historiaTextoPlano.replace(/^generico_WEB\s*/i, '').trim();
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
        const imagenesHistoria = normalizarListaImagenes(configMap.historia_galeria || window.defaultHistoriaImagenUrl);
        const videoGuardado = localStorage.getItem('generico_historia_video_url') || '';
        const videoHistoria = String(configMap.historia_video_url || '').trim();
        if (videoHistoria) {
            appState.historiaVideoActual = videoHistoria;
            localStorage.setItem('generico_historia_video_url', videoHistoria);
        }
        const videoPresentacion = videoHistoria || appState.historiaVideoActual || videoGuardado || videoActualEnPantalla || window.defaultHistoriaVideoUrl || '';

        if (imagenesHistoria.length) {
            const imagenPrincipal = obtenerImagenPrincipal(imagenesHistoria, 'Sitio en construcción');
            historiaMedia.innerHTML = `
                <img
                    src="${imagenPrincipal}"
                    alt="Historia generico_WEB"
                    class="historia-media-principal"
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
    if (localStorage.getItem('generico_placeholders')) return;
    const images = {
        'generico-dream': { color: '#2d5a27', text: 'generico_WEB Dream' },
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
        ctx.fillText('generico_WEB', 200, 170);
        placeholders[name] = canvas.toDataURL('image/jpeg', 0.9);
    });
    localStorage.setItem('generico_placeholders', JSON.stringify(placeholders));
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
            alt="Historia generico_WEB"
            class="historia-media-principal"
            onerror="this.onerror=null; this.src='${crearPlaceholderConstruccion('Sitio en construcción')}';"
        >
    `;
    document.querySelectorAll('.historia-galeria-item').forEach((item, itemIndex) => {
        item.classList.toggle('activa', itemIndex === indice);
    });
};
