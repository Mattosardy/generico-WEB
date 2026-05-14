const TELEGRAM_BOT_USERNAME = window.TELEGRAM_BOT_USERNAME || 'NOMBRE_DEL_BOT';
const TELEGRAM_LINK_CODE_TTL_MINUTES = 15;
const notificationTemplates = {
    reserva_creada: ({ variety = 'Entrega mensual', grams = '-', estado = 'pendiente de confirmacion' } = {}) =>
        `Cururu Club\nTu reserva fue recibida.\nVariedad: ${variety}\nCantidad: ${grams}g\nEstado: ${estado}.`,
    reserva_confirmada: ({ variety = 'Entrega mensual', grams = '-', retiro = '' } = {}) =>
        `Cururu Club\nTu reserva fue confirmada.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro ? `\nRetiro: ${retiro}` : ''}`,
    reserva_rechazada: ({ variety = 'Entrega mensual', grams = '-', motivo = 'Te vamos a contactar para coordinar.' } = {}) =>
        `Cururu Club\nTu reserva no pudo ser confirmada.\nVariedad: ${variety}\nCantidad: ${grams}g\nMotivo: ${motivo}`,
    retiro_disponible: ({ variety = 'Entrega mensual', grams = '-', retiro = '' } = {}) =>
        `Cururu Club\nTu retiro ya esta disponible.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro ? `\nRetiro: ${retiro}` : ''}`,
    aviso_general: ({ message = '' } = {}) => `Cururu Club\n${message}`,
};

function generarTelegramLinkCode() {
    const random = new Uint8Array(12);
    crypto.getRandomValues(random);
    return Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('');
}

function obtenerTelegramBotUsernameLimpio(botUsername = TELEGRAM_BOT_USERNAME) {
    return String(botUsername || '').trim().replace(/^@+/, '');
}

function esDispositivoIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '')
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function obtenerTelegramLinkUrl(code, botUsername = TELEGRAM_BOT_USERNAME) {
    const username = obtenerTelegramBotUsernameLimpio(botUsername);
    return `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(code)}`;
}

function obtenerTelegramAppLinkUrl(code, botUsername = TELEGRAM_BOT_USERNAME) {
    const username = obtenerTelegramBotUsernameLimpio(botUsername);
    return `tg://resolve?domain=${encodeURIComponent(username)}&start=${encodeURIComponent(code)}`;
}

async function copiarTextoAlPortapapeles(texto) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
    }

    const input = document.createElement('textarea');
    input.value = texto;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copiado = document.execCommand('copy');
    document.body.removeChild(input);
    return copiado;
}

function mostrarFallbackTelegram(linkUniversal, linkCode) {
    const fallback = document.getElementById('telegramFallbackPanel');
    if (!fallback) return;
    fallback.innerHTML = `
        <a class="dashboard-shortcut telegram-open-fallback" href="${linkUniversal}" target="_blank" rel="noopener noreferrer">
            <i class="fab fa-telegram"></i> Abrir en Telegram
        </a>
        <button type="button" id="btnCopiarTelegramCode" class="dashboard-shortcut telegram-copy-code">
            <i class="fas fa-copy"></i> Copiar codigo
        </button>
        <small>Si Telegram no se abre automaticamente, toca Abrir en Telegram y luego presiona Iniciar dentro del chat.</small>
        <code>Codigo de vinculacion: ${escapeHtml(linkCode)}</code>
    `;
    fallback.style.display = 'grid';
    console.warn('Fallback Telegram visible');
    document.getElementById('btnCopiarTelegramCode')?.addEventListener('click', async () => {
        try {
            const copiado = await copiarTextoAlPortapapeles(linkCode);
            mostrarMensaje(copiado ? 'Codigo copiado' : 'No se pudo copiar el codigo', copiado);
        } catch (error) {
            mostrarMensaje('No se pudo copiar el codigo', false);
        }
    });
}

function openTelegramLink(botUsername, linkCode) {
    const username = obtenerTelegramBotUsernameLimpio(botUsername);
    const linkUniversal = obtenerTelegramLinkUrl(linkCode, username);
    const linkApp = obtenerTelegramAppLinkUrl(linkCode, username);
    console.log('Intentando abrir Telegram');

    const fallback = document.getElementById('telegramFallbackPanel');
    if (fallback) {
        fallback.style.display = 'none';
        fallback.innerHTML = '';
    }

    if (esDispositivoIOS()) {
        window.location.href = linkApp;
        window.setTimeout(() => mostrarFallbackTelegram(linkUniversal, linkCode), 1200);
        return;
    }

    window.open(linkUniversal, '_blank', 'noopener,noreferrer');
    mostrarFallbackTelegram(linkUniversal, linkCode);
}

async function crearTelegramLinkCode(socioId) {
    const code = generarTelegramLinkCode();
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabaseClient.rpc('set_telegram_link_code', {
        p_socio_id: socioId,
        p_code: code,
        p_expires_at: expiresAt
    });

    if (error) throw error;
    return { code, expiresAt };
}

async function crearSolicitudMembresiaConTelegram(datos) {
    const code = generarTelegramLinkCode();
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await supabaseClient.rpc('create_membership_request_with_telegram', {
        p_nombre: datos.nombre,
        p_apellido: datos.apellido,
        p_cedula: datos.cedula,
        p_telefono: datos.telefono,
        p_email: datos.email || '',
        p_mensaje: datos.mensaje || '',
        p_code: code,
        p_expires_at: expiresAt
    });

    if (error) throw error;
    return { ...(data || {}), code, expiresAt };
}

async function refrescarEstadoTelegramSocio() {
    if (!appState.socioData?.id) return null;
    const { data, error } = await supabaseClient
        .from('socios')
        .select('telegram_chat_id, telegram_username, telegram_enabled')
        .eq('id', appState.socioData.id)
        .single();

    if (error) throw error;
    appState.socioData = { ...appState.socioData, ...data };
    return data;
}

function renderTelegramLinkPanel() {
    const container = document.getElementById('telegramLinkPanel');
    if (!container || !appState.socioData?.id) return;

    const linked = Boolean(appState.socioData.telegram_enabled && appState.socioData.telegram_chat_id);
    const username = appState.socioData.telegram_username ? `@${escapeHtml(appState.socioData.telegram_username)}` : 'Telegram vinculado';

    container.innerHTML = `
        <div class="telegram-link-card ${linked ? 'linked' : ''}">
            <div>
                <span class="metric-label">Notificaciones</span>
                <strong>${linked ? username : 'Telegram'}</strong>
                <small>${linked ? 'Canal de avisos activo.' : 'Vincula tu cuenta para recibir avisos del club.'}</small>
            </div>
            <button type="button" id="btnVincularTelegram" class="dashboard-shortcut">
                <i class="fab fa-telegram"></i> ${linked ? 'Verificar' : 'Activar Telegram'}
            </button>
            ${linked ? '' : `
                <div class="telegram-link-help">
                    <small>Si Telegram no se abre automaticamente, toca Abrir en Telegram y luego presiona Iniciar dentro del chat.</small>
                    <div id="telegramFallbackPanel" class="telegram-fallback-panel" style="display: none;"></div>
                </div>
            `}
        </div>
    `;

    document.getElementById('btnVincularTelegram')?.addEventListener('click', async () => {
        try {
            const estado = await refrescarEstadoTelegramSocio();
            if (estado?.telegram_enabled && estado?.telegram_chat_id) {
                mostrarMensaje('Telegram vinculado correctamente', true);
                renderTelegramLinkPanel();
                return;
            }

            if (obtenerTelegramBotUsernameLimpio() === 'NOMBRE_DEL_BOT') {
                mostrarMensaje('Configura TELEGRAM_BOT_USERNAME antes de vincular Telegram.', false);
                return;
            }

            const { code } = await crearTelegramLinkCode(appState.socioData.id);
            openTelegramLink(TELEGRAM_BOT_USERNAME, code);
            mostrarMensaje('Se abrio Telegram. Toca Start para activar avisos del club.', true);
        } catch (error) {
            console.error('Error al vincular Telegram:', error);
            mostrarMensaje('No se pudo iniciar la vinculacion con Telegram.', false);
        }
    });
}

const notificationService = {
    render(type, payload = {}) {
        const template = notificationTemplates[type];
        return template ? template(payload) : String(payload.message || payload.mensaje || '');
    },
    async send(userId, message, options = {}) {
        const canal = options.channel || 'telegram';
        if (canal !== 'telegram') {
            return { data: null, error: new Error('Canal no soportado por ahora.') };
        }

        return supabaseClient.rpc('queue_telegram_notification', {
            p_socio_id: userId,
            p_tipo: options.type || 'manual',
            p_mensaje: message,
            p_fecha_programada: options.scheduledAt || new Date().toISOString(),
            p_metadata: options.metadata || {}
        });
    },
};

window.notificationService = notificationService;
window.renderTelegramLinkPanel = renderTelegramLinkPanel;
window.refrescarEstadoTelegramSocio = refrescarEstadoTelegramSocio;
window.crearSolicitudMembresiaConTelegram = crearSolicitudMembresiaConTelegram;
window.obtenerTelegramLinkUrl = obtenerTelegramLinkUrl;
window.openTelegramLink = openTelegramLink;
