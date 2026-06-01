const TELEGRAM_BOT_USERNAME = window.TELEGRAM_BOT_USERNAME || 'NOMBRE_DEL_BOT';
const TELEGRAM_LINK_CODE_TTL_MINUTES = 15;
const TELEGRAM_SECURITY_DEVICE_STORAGE_KEY = 'generico_telegram_security_device_id_v1';
const notificationTemplates = {
    reserva_creada: ({ variety = 'Entrega mensual', grams = '-', estado = 'pendiente de confirmacion' } = {}) =>
        `Nombre del Club\nTu pedido mensual fue recibido.\nVariedad: ${variety}\nCantidad: ${grams}g\nEstado: ${estado}.`,
    reserva_confirmada: ({ variety = 'Entrega mensual', grams = '-', retiro = '' } = {}) =>
        `Nombre del Club\nTu pedido mensual fue confirmado.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro ? `\nRetiro: ${retiro}` : ''}`,
    reserva_rechazada: ({ variety = 'Entrega mensual', grams = '-', motivo = 'Te vamos a contactar para coordinar.' } = {}) =>
        `Nombre del Club\nTu pedido mensual no pudo ser confirmado.\nVariedad: ${variety}\nCantidad: ${grams}g\nMotivo: ${motivo}`,
    retiro_disponible: ({ variety = 'Entrega mensual', grams = '-', retiro = '' } = {}) =>
        `Nombre del Club\nTu retiro ya esta disponible.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro ? `\nRetiro: ${retiro}` : ''}`,
    aviso_general: ({ message = '' } = {}) => `Nombre del Club\n${message}`,
};

function generarTelegramLinkCode() {
    const random = new Uint8Array(12);
    crypto.getRandomValues(random);
    return Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('');
}

function generarTelegramSecurityDeviceId() {
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    return Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('');
}

function asegurarEstadoTelegramSecurity() {
    if (!appState.telegramSecurity) {
        appState.telegramSecurity = {
            deviceId: null,
            deviceName: '',
            verified: false,
            required: false,
            pending: false,
            expiresAt: null
        };
    }
    return appState.telegramSecurity;
}

function obtenerTelegramSecurityDeviceId() {
    asegurarEstadoTelegramSecurity();
    let deviceId = localStorage.getItem(TELEGRAM_SECURITY_DEVICE_STORAGE_KEY);
    if (!deviceId) {
        deviceId = generarTelegramSecurityDeviceId();
        localStorage.setItem(TELEGRAM_SECURITY_DEVICE_STORAGE_KEY, deviceId);
    }
    appState.telegramSecurity.deviceId = deviceId;
    return deviceId;
}

function obtenerTelegramSecurityDeviceName() {
    asegurarEstadoTelegramSecurity();
    const navegador = navigator.userAgentData?.brands?.[0]?.brand || navigator.userAgent?.split(' ')?.[0] || 'Navegador';
    const plataforma = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo';
    const deviceName = `${navegador} - ${plataforma}`.slice(0, 120);
    appState.telegramSecurity.deviceName = deviceName;
    return deviceName;
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
    let { data, error } = await supabaseClient
        .from('socios')
        .select('telegram_chat_id, telegram_username, telegram_enabled, telegram_login_verified, telegram_login_code_expires_at, telegram_login_verified_at, telegram_require_device_verification')
        .eq('id', appState.socioData.id)
        .single();

    if (error && /telegram_login_|telegram_require_device_verification|column/i.test(error.message || '')) {
        const fallback = await supabaseClient
            .from('socios')
            .select('telegram_chat_id, telegram_username, telegram_enabled')
            .eq('id', appState.socioData.id)
            .single();
        data = fallback.data;
        error = fallback.error;
    }

    if (error) throw error;
    appState.socioData = { ...appState.socioData, ...data };
    await actualizarEstadoSeguridadTelegram();
    return data;
}

function telegramSecurityEstaDisponible(error) {
    const mensaje = String(error?.message || error?.details || error || '');
    return !/function .*does not exist|Could not find the function|telegram_login_|socio_dispositivos_verificados|schema cache/i.test(mensaje);
}

function obtenerTelegramSecurityVerified(data) {
    if (Array.isArray(data)) {
        return Boolean(data[0]?.verified);
    }
    if (data && typeof data === 'object') {
        return Boolean(data.verified);
    }
    return Boolean(data);
}

async function actualizarEstadoSeguridadTelegram() {
    asegurarEstadoTelegramSecurity();
    const linked = Boolean(appState.socioData?.telegram_enabled && appState.socioData?.telegram_chat_id);
    const requireDevice = appState.socioData?.telegram_require_device_verification !== false;
    const baseState = {
        ...appState.telegramSecurity,
        required: false,
        pending: false,
        verified: false,
        expiresAt: appState.socioData?.telegram_login_code_expires_at || null
    };

    if (!appState.socioData?.id || !linked || !requireDevice) {
        appState.telegramSecurity = baseState;
        return appState.telegramSecurity;
    }

    const deviceId = obtenerTelegramSecurityDeviceId();
    const deviceName = obtenerTelegramSecurityDeviceName();

    try {
        const { data, error } = await supabaseClient.rpc('is_current_device_telegram_verified', {
            p_device_id: deviceId
        });
        if (error) throw error;
        const deviceVerified = obtenerTelegramSecurityVerified(data);
        appState.telegramSecurity = {
            ...baseState,
            deviceId,
            deviceName,
            verified: deviceVerified,
            required: !deviceVerified,
            pending: !deviceVerified && Boolean(appState.socioData?.telegram_login_code_hash || appState.socioData?.telegram_login_code_expires_at)
        };
    } catch (error) {
        if (telegramSecurityEstaDisponible(error)) {
            console.warn('No se pudo verificar el dispositivo Telegram:', error.message || error);
        }
        appState.telegramSecurity = {
            ...baseState,
            deviceId,
            deviceName,
            verified: false,
            required: false,
            pending: false
        };
    }

    return appState.telegramSecurity;
}

function obtenerMensajeErrorTelegramSecurity(reason) {
    if (reason === 'expired') return 'El código venció. Pedí uno nuevo para continuar.';
    if (reason === 'invalid') return 'El código no es correcto. Revisalo e intentá otra vez.';
    if (reason === 'missing_code') return 'Primero solicitá un código por Telegram.';
    return 'No se pudo validar el código.';
}

async function solicitarCodigoTelegramSecurity() {
    const deviceId = obtenerTelegramSecurityDeviceId();
    const deviceName = obtenerTelegramSecurityDeviceName();
    const { data, error } = await supabaseClient.rpc('request_telegram_login_code', {
        p_device_id: deviceId,
        p_device_name: deviceName
    });
    if (error) throw error;
    appState.telegramSecurity.pending = true;
    appState.telegramSecurity.expiresAt = data?.expires_at || null;
    return data;
}

async function verificarCodigoTelegramSecurity(code) {
    const deviceId = obtenerTelegramSecurityDeviceId();
    const deviceName = obtenerTelegramSecurityDeviceName();
    const { data, error } = await supabaseClient.rpc('verify_telegram_login_code', {
        p_code: String(code || '').trim(),
        p_device_id: deviceId,
        p_device_name: deviceName
    });
    if (error) throw error;
    if (!data?.verified) return data || { verified: false, reason: 'invalid' };
    appState.telegramSecurity.verified = true;
    appState.telegramSecurity.required = false;
    appState.telegramSecurity.pending = false;
    appState.telegramSecurity.expiresAt = null;
    appState.socioData = {
        ...appState.socioData,
        telegram_login_verified: true,
        telegram_login_verified_at: new Date().toISOString(),
        telegram_login_code_expires_at: null
    };
    return data;
}

function renderTelegramLinkPanel() {
    const container = document.getElementById('telegramLinkPanel');
    if (!container || !appState.socioData?.id) return;

    const linked = Boolean(appState.socioData.telegram_enabled && appState.socioData.telegram_chat_id);
    const username = appState.socioData.telegram_username ? `@${escapeHtml(appState.socioData.telegram_username)}` : 'Telegram vinculado';
    const securityRequired = linked && appState.telegramSecurity?.required;
    const securityVerified = linked && !securityRequired && appState.telegramSecurity?.verified;
    const expiresAt = appState.telegramSecurity?.expiresAt
        ? new Date(appState.telegramSecurity.expiresAt).toLocaleString('es-UY')
        : '';

    container.innerHTML = `
        <div class="telegram-link-card ${linked ? 'linked' : ''}">
            <div>
                <span class="metric-label">Notificaciones</span>
                <strong>${linked ? username : 'Telegram'}</strong>
                <small>${linked ? 'Canal de avisos activo.' : 'Vincula tu cuenta para recibir avisos del club.'}</small>
                <small class="telegram-delay-note"><i class="fas fa-info-circle" aria-hidden="true"></i> Los mensajes y notificaciones por Telegram pueden demorar hasta 4 minutos.</small>
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
        ${securityRequired ? `
            <div class="telegram-security-card" role="region" aria-live="polite">
                <div class="telegram-security-copy">
                    <span class="metric-label">Seguridad</span>
                    <strong><i class="fas fa-lock" aria-hidden="true"></i> Verificación Telegram requerida</strong>
                    <small>Para proteger tu cuenta, ingresá el código enviado a tu Telegram. El código es válido por 24 horas.</small>
                    ${expiresAt ? `<em>Código vigente hasta ${escapeHtml(expiresAt)}</em>` : ''}
                    <small class="telegram-delay-note"><i class="fas fa-info-circle" aria-hidden="true"></i> Los mensajes y notificaciones por Telegram pueden demorar hasta 4 minutos.</small>
                </div>
                <div class="telegram-security-actions">
                    <button type="button" id="btnEnviarTelegramSecurityCode" class="dashboard-shortcut">
                        <i class="fab fa-telegram"></i> ${appState.telegramSecurity?.pending ? 'Reenviar código' : 'Enviar código'}
                    </button>
                    <form id="formTelegramSecurityCode" class="telegram-security-form">
                        <input type="text" id="telegramSecurityCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Ingresar código" autocomplete="one-time-code">
                        <button type="submit" class="dashboard-shortcut">Verificar código</button>
                    </form>
                    <small id="telegramSecurityFeedback" class="telegram-security-feedback"></small>
                </div>
            </div>
        ` : ''}
        ${securityVerified ? `
            <div class="telegram-security-card verified">
                <span class="metric-label">Seguridad</span>
                <strong>Dispositivo verificado</strong>
                <small>Este navegador ya fue validado con Telegram.</small>
            </div>
        ` : ''}
    `;

    document.getElementById('btnVincularTelegram')?.addEventListener('click', async () => {
        try {
            const estado = await refrescarEstadoTelegramSocio();
            if (estado?.telegram_enabled && estado?.telegram_chat_id) {
                mostrarMensaje('Telegram vinculado correctamente', true);
                await actualizarEstadoSeguridadTelegram();
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

    document.getElementById('btnEnviarTelegramSecurityCode')?.addEventListener('click', async () => {
        const feedback = document.getElementById('telegramSecurityFeedback');
        const button = document.getElementById('btnEnviarTelegramSecurityCode');
        try {
            if (button) button.disabled = true;
            const data = await solicitarCodigoTelegramSecurity();
            if (feedback) {
                feedback.textContent = data?.already_verified
                    ? 'Este dispositivo ya estaba verificado.'
                    : 'Código enviado por Telegram. Puede demorar hasta unos minutos.';
            }
            await refrescarEstadoTelegramSocio();
            renderTelegramLinkPanel();
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo enviar el código.';
        } finally {
            if (button) button.disabled = false;
        }
    });

    document.getElementById('formTelegramSecurityCode')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const feedback = document.getElementById('telegramSecurityFeedback');
        const code = document.getElementById('telegramSecurityCode')?.value || '';
        try {
            const result = await verificarCodigoTelegramSecurity(code);
            if (!result?.verified) {
                if (feedback) feedback.textContent = obtenerMensajeErrorTelegramSecurity(result?.reason);
                return;
            }
            mostrarMensaje('Dispositivo verificado correctamente.', true);
            renderTelegramLinkPanel();
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo verificar el código.';
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
window.actualizarEstadoSeguridadTelegram = actualizarEstadoSeguridadTelegram;
window.solicitarCodigoTelegramSecurity = solicitarCodigoTelegramSecurity;
window.verificarCodigoTelegramSecurity = verificarCodigoTelegramSecurity;
window.crearSolicitudMembresiaConTelegram = crearSolicitudMembresiaConTelegram;
window.obtenerTelegramLinkUrl = obtenerTelegramLinkUrl;
window.openTelegramLink = openTelegramLink;
