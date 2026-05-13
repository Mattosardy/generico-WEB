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

function obtenerTelegramLinkUrl(code) {
    return `https://t.me/${encodeURIComponent(TELEGRAM_BOT_USERNAME)}?start=${encodeURIComponent(code)}`;
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
                <i class="fab fa-telegram"></i> ${linked ? 'Verificar' : 'Vincular Telegram'}
            </button>
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

            if (TELEGRAM_BOT_USERNAME === 'NOMBRE_DEL_BOT') {
                mostrarMensaje('Configura TELEGRAM_BOT_USERNAME antes de vincular Telegram.', false);
                return;
            }

            const { code } = await crearTelegramLinkCode(appState.socioData.id);
            window.open(obtenerTelegramLinkUrl(code), '_blank', 'noopener,noreferrer');
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
        return supabaseClient.from('notificaciones_programadas').insert([{
            socio_id: userId,
            tipo: options.type || 'manual',
            mensaje: message,
            fecha_programada: options.scheduledAt || new Date().toISOString(),
            estado: 'pendiente',
            canal,
            provider: canal === 'telegram' ? 'telegram' : null,
            metadata: options.metadata || {}
        }]);
    },
};

window.notificationService = notificationService;
window.renderTelegramLinkPanel = renderTelegramLinkPanel;
window.refrescarEstadoTelegramSocio = refrescarEstadoTelegramSocio;
