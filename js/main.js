const mainSections = ['inicio', 'productos', 'carrito', 'actividades', 'admin', 'maestro', 'menu', 'login'];
const restrictedSections = {
    productos: ['socio', 'admin', 'maestro'],
    carrito: ['socio', 'admin', 'maestro'],
    actividades: ['socio', 'admin', 'maestro'],
    admin: ['admin'],
    maestro: ['maestro'],
    menu: ['socio', 'admin', 'maestro']
};

function registrarServiceWorkerPwa() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
        } catch (error) {
            console.warn('No se pudo registrar la PWA:', error);
        }
    });
}

let genericoInstallPrompt = null;

function obtenerInstruccionesInstalacion() {
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    if (esIos) return 'En iPhone/iPad: abrí esta web en Safari, tocá Compartir y elegí Agregar a pantalla de inicio.';
    return 'Si no aparece el instalador, abrí el menú del navegador y elegí Instalar app o Agregar a pantalla de inicio.';
}

function inicializarInstalacionPwa() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        genericoInstallPrompt = event;
    });

    window.addEventListener('appinstalled', () => {
        genericoInstallPrompt = null;
        if (typeof mostrarMensaje === 'function') mostrarMensaje('App instalada correctamente.', true);
    });

    document.querySelectorAll('[data-install-app]').forEach((boton) => {
        boton.addEventListener('click', async () => {
            if (!genericoInstallPrompt) {
                const mensaje = obtenerInstruccionesInstalacion();
                if (typeof mostrarMensaje === 'function') mostrarMensaje(mensaje, true);
                else alert(mensaje);
                return;
            }

            genericoInstallPrompt.prompt();
            await genericoInstallPrompt.userChoice;
            genericoInstallPrompt = null;
        });
    });
}

function actualizarBotonAudio() {
    const audio = document.getElementById('backgroundAudio');
    const boton = document.getElementById('btnAudioToggle');
    if (!audio || !boton) return;
    const icono = boton.querySelector('i');
    const silenciado = audio.muted;
    boton.setAttribute('aria-label', silenciado ? 'Activar música' : 'Pausar música');
    boton.setAttribute('title', silenciado ? 'Activar música' : 'Pausar música');
    if (icono) {
        icono.className = silenciado ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
    }
}

async function intentarReproducirAudio() {
    const audio = document.getElementById('backgroundAudio');
    if (!audio || audio.muted) return;
    try {
        await audio.play();
    } catch (error) {
        // Algunos navegadores bloquean autoplay con sonido hasta la primera interacción.
    }
}

function inicializarAudioFondo() {
    const audio = document.getElementById('backgroundAudio');
    const boton = document.getElementById('btnAudioToggle');
    if (!audio || !boton) return;

    const silenciadoGuardado = localStorage.getItem('generico_audio_muted');
    audio.volume = 0.5;
    audio.muted = silenciadoGuardado === null ? true : silenciadoGuardado === 'true';
    actualizarBotonAudio();

    boton.addEventListener('click', async () => {
        audio.muted = !audio.muted;
        localStorage.setItem('generico_audio_muted', String(audio.muted));
        actualizarBotonAudio();
        if (!audio.muted) await intentarReproducirAudio();
    });

    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, intentarReproducirAudio, { passive: true, once: true });
    });

    void intentarReproducirAudio();
}

function usuarioPuedeVerSeccion(seccionId) {
    const rolesPermitidos = restrictedSections[seccionId];
    if (!rolesPermitidos) return true;
    return rolesPermitidos.includes(appState.rolUsuario);
}

function obtenerSeccionVisibleActual() {
    const visible = mainSections.find((id) => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
    });
    return visible || localStorage.getItem('generico_seccion_activa') || 'inicio';
}

function guardarDestinoPostLogin(seccionId) {
    const destino = mainSections.includes(seccionId) ? seccionId : '';
    if (destino && destino !== 'inicio' && destino !== 'login') {
        localStorage.setItem('generico_post_login_section', destino);
    }
}

function obtenerDestinoPostLogin() {
    const destinoGuardado = localStorage.getItem('generico_post_login_section') || localStorage.getItem('generico_seccion_activa');
    localStorage.removeItem('generico_post_login_section');
    if (destinoGuardado && destinoGuardado !== 'inicio' && destinoGuardado !== 'login' && usuarioPuedeVerSeccion(destinoGuardado)) {
        return destinoGuardado;
    }
    if (appState.rolUsuario === 'maestro') return 'maestro';
    if (appState.rolUsuario === 'admin') return 'admin';
    return 'productos';
}

function obtenerSeccionActividadesPrincipal() {
    if (appState.rolUsuario === 'maestro') return 'maestro';
    if (appState.rolUsuario === 'admin') return 'admin';
    return 'actividades';
}

function actualizarChromeApp(destino) {
    const esInicio = destino === 'inicio';
    document.body.classList.toggle('app-home', esInicio);
    document.body.classList.toggle('app-internal', !esInicio);
    const smartLabel = document.querySelector('[data-smart-section="actividades"] span');
    if (smartLabel) smartLabel.textContent = appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro'
        ? 'HERRAMIENTAS'
        : 'ACTIVIDADES';
}

function moverBloqueAcordeon(origenTipo, destinoTipo, slotId) {
    const slot = document.getElementById(slotId);
    const toggle = document.querySelector(`.productos-toggle[data-tipo-cultivo="${origenTipo}"]`);
    const panel = document.querySelector(`.productos-panel[data-tipo-cultivo="${origenTipo}"]`);
    const columna = toggle?.closest('.productos-columna');
    if (!slot || !toggle || !panel || !columna || slot.contains(columna)) return;
    toggle.dataset.tipoCultivo = destinoTipo;
    panel.dataset.tipoCultivo = destinoTipo;
    slot.appendChild(columna);
    slot.appendChild(panel);
}

function prepararMenuSocio() {
    moverBloqueAcordeon('actividades-manual', 'menu-manual', 'menuManualSlot');
    moverBloqueAcordeon('actividades-cuenta', 'menu-cuenta', 'menuCuentaSlot');
}

function cerrarMenuUsuario() {
    const menu = document.getElementById('userMenuDropdown');
    const boton = document.getElementById('userName');
    if (!menu || !boton) return;
    menu.hidden = true;
    menu.classList.remove('is-open');
    boton.setAttribute('aria-expanded', 'false');
}

function alternarMenuUsuario() {
    const menu = document.getElementById('userMenuDropdown');
    const boton = document.getElementById('userName');
    if (!menu || !boton || boton.getAttribute('role') !== 'button') return;
    const abierto = menu.hidden;
    menu.hidden = !abierto;
    menu.classList.toggle('is-open', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
}

async function abrirCuentaDesdeMenuUsuario(panelDestino = 'menu-cuenta') {
    cerrarMenuUsuario();
    await mostrarSeccion('menu');
    const toggle = document.querySelector(`.productos-toggle[data-tipo-cultivo="${panelDestino}"]`);
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
}

function validarCambioPassword(actual, nueva, repetir) {
    if (!actual || !nueva || !repetir) return 'Completá todos los campos.';
    if (nueva.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00f1]/.test(nueva) || !/\d/.test(nueva)) {
        return 'La nueva contraseña debe incluir letras y números.';
    }
    if (nueva !== repetir) return 'La confirmación no coincide.';
    if (actual === nueva) return 'La nueva contraseña debe ser distinta a la actual.';
    return '';
}

function validarNuevaPassword(nueva, repetir) {
    if (!nueva || !repetir) return 'Completá todos los campos.';
    if (nueva.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00f1]/.test(nueva) || !/\d/.test(nueva)) {
        return 'La nueva contraseña debe incluir letras y números.';
    }
    if (nueva !== repetir) return 'La confirmación no coincide.';
    return '';
}

function validarCambioPasswordActualizado(actual, nueva, repetir) {
    if (!actual) return 'Completá todos los campos.';
    const errorNueva = validarNuevaPassword(nueva, repetir);
    if (errorNueva) return errorNueva;
    if (actual === nueva) return 'La nueva contraseña debe ser distinta a la actual.';
    return '';
}

function renderPasswordTemporalGate() {
    const gate = document.getElementById('passwordTemporalGate');
    if (!gate) return;
    const requerido = typeof socioDebeCambiarPassword === 'function'
        ? socioDebeCambiarPassword()
        : Boolean(appState.socioData?.debe_cambiar_password || appState.socioData?.password_temporal);
    gate.hidden = !requerido;
    document.body.classList.toggle('password-temporal-required', requerido);
    renderPasswordTemporalTelegramGate();
    actualizarEstadoFormularioPasswordTemporal();
}

function telegramEstaVinculado() {
    return Boolean(appState.socioData?.telegram_enabled && appState.socioData?.telegram_chat_id);
}

function telegramEstaVerificadoParaPassword() {
    return telegramEstaVinculado() && Boolean(appState.telegramSecurity?.verified);
}

function actualizarEstadoFormularioPasswordTemporal() {
    const boton = document.getElementById('btnPasswordTemporal');
    const requerido = typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword();
    const habilitado = !requerido || telegramEstaVerificadoParaPassword();
    if (boton) {
        boton.disabled = !habilitado;
        boton.title = habilitado ? '' : 'Activá Telegram y verificá el código antes de cambiar la contraseña.';
    }
}

function renderPasswordTemporalTelegramGate() {
    const container = document.getElementById('passwordTemporalTelegramGate');
    if (!container) return;
    const requerido = typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword();
    if (!requerido || !appState.socioData?.id) {
        container.innerHTML = '';
        return;
    }

    const linked = telegramEstaVinculado();
    const verified = telegramEstaVerificadoParaPassword();
    const expiresAt = appState.telegramSecurity?.expiresAt
        ? new Date(appState.telegramSecurity.expiresAt).toLocaleString('es-UY')
        : '';

    container.innerHTML = `
        <div class="telegram-security-card ${verified ? 'verified' : ''}">
            <div class="telegram-security-copy">
                <span class="metric-label">Paso obligatorio</span>
                <strong><i class="fab fa-telegram" aria-hidden="true"></i> ${linked ? (verified ? 'Telegram verificado' : 'Verificá tu Telegram') : 'Activá Telegram'}</strong>
                <small>${linked
                    ? (verified
                        ? 'Ya podés cambiar tu contraseña temporal.'
                        : 'Enviá un código a tu Telegram y copialo acá para habilitar el cambio de contraseña.')
                    : 'Para seguir usando la app, primero vinculá tu número con Telegram. Se abrirá el bot del club.'}</small>
                ${expiresAt && !verified ? `<em>Código vigente hasta ${escapeHtml(expiresAt)}</em>` : ''}
                <small class="telegram-delay-note"><i class="fas fa-info-circle" aria-hidden="true"></i> Los mensajes de Telegram pueden demorar hasta 4 minutos.</small>
            </div>
            <div class="telegram-security-actions">
                ${linked ? `
                    <button type="button" id="btnPasswordTelegramCode" class="dashboard-shortcut">
                        <i class="fab fa-telegram"></i> ${appState.telegramSecurity?.pending ? 'Reenviar código' : 'Enviar código'}
                    </button>
                    <form id="formPasswordTelegramCode" class="telegram-security-form">
                        <input type="text" id="passwordTelegramCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Código" autocomplete="one-time-code" ${verified ? 'disabled' : ''}>
                        <button type="submit" class="dashboard-shortcut" ${verified ? 'disabled' : ''}>Verificar</button>
                    </form>
                ` : `
                    <button type="button" id="btnPasswordActivarTelegram" class="dashboard-shortcut">
                        <i class="fab fa-telegram"></i> Activar Telegram
                    </button>
                    <button type="button" id="btnPasswordRefrescarTelegram" class="dashboard-shortcut secondary">
                        Ya lo activé
                    </button>
                    <div id="telegramFallbackPanel" class="telegram-fallback-panel" style="display: none;"></div>
                `}
                <small id="passwordTelegramFeedback" class="telegram-security-feedback"></small>
            </div>
        </div>
    `;

    document.getElementById('btnPasswordActivarTelegram')?.addEventListener('click', async () => {
        const feedback = document.getElementById('passwordTelegramFeedback');
        try {
            if (typeof obtenerTelegramBotUsernameLimpio === 'function' && obtenerTelegramBotUsernameLimpio() === 'NOMBRE_DEL_BOT') {
                if (feedback) feedback.textContent = 'Configurá TELEGRAM_BOT_USERNAME antes de vincular Telegram.';
                return;
            }
            const { code } = await crearTelegramLinkCode(appState.socioData.id);
            openTelegramLink(TELEGRAM_BOT_USERNAME, code);
            if (feedback) feedback.textContent = 'Telegram se abrió. Tocá Start en el bot y luego volvé a esta pantalla.';
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo iniciar la vinculación.';
        }
    });

    document.getElementById('btnPasswordRefrescarTelegram')?.addEventListener('click', async () => {
        const feedback = document.getElementById('passwordTelegramFeedback');
        try {
            await refrescarEstadoTelegramSocio();
            renderPasswordTemporalGate();
            if (feedback) feedback.textContent = telegramEstaVinculado() ? 'Telegram vinculado.' : 'Todavía no aparece vinculado. Probá de nuevo en unos minutos.';
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo refrescar Telegram.';
        }
    });

    document.getElementById('btnPasswordTelegramCode')?.addEventListener('click', async () => {
        const feedback = document.getElementById('passwordTelegramFeedback');
        try {
            await solicitarCodigoTelegramSecurity();
            await refrescarEstadoTelegramSocio();
            renderPasswordTemporalGate();
            const nuevoFeedback = document.getElementById('passwordTelegramFeedback');
            if (nuevoFeedback) nuevoFeedback.textContent = 'Código enviado por Telegram.';
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo enviar el código.';
        }
    });

    document.getElementById('formPasswordTelegramCode')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const feedback = document.getElementById('passwordTelegramFeedback');
        const code = document.getElementById('passwordTelegramCode')?.value || '';
        try {
            const result = await verificarCodigoTelegramSecurity(code);
            if (!result?.verified) {
                if (feedback) feedback.textContent = obtenerMensajeErrorTelegramSecurity(result?.reason);
                return;
            }
            await refrescarEstadoTelegramSocio();
            renderPasswordTemporalGate();
            mostrarMensaje('Telegram verificado. Ya podés cambiar tu contraseña.', true);
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'No se pudo verificar el código.';
        }
    });
}

async function asegurarTelegramParaCambioPassword() {
    if (!appState.socioData?.id) return false;
    try {
        if (typeof refrescarEstadoTelegramSocio === 'function') {
            await refrescarEstadoTelegramSocio();
        }
    } catch (_error) {
        // El render muestra el estado actual aunque el refresco falle.
    }
    renderPasswordTemporalGate();
    if (telegramEstaVerificadoParaPassword()) return true;
    mostrarMensaje('Activá Telegram y verificá el código de seguridad antes de cambiar la contraseña.', false);
    return false;
}

async function mostrarSeccion(seccionId) {
    const seccionValida = mainSections.includes(seccionId) ? seccionId : 'inicio';
    const accesoPermitido = usuarioPuedeVerSeccion(seccionValida);
    const destino = accesoPermitido ? seccionValida : 'inicio';
    if (!accesoPermitido) guardarDestinoPostLogin(seccionValida);
    if (destino === 'admin' && appState.rolUsuario === 'admin' && typeof cargarAdminData === 'function') {
        await ejecutarCargaSegura('cargarAdminData', cargarAdminData);
    }
    if (destino === 'maestro' && appState.rolUsuario === 'maestro' && typeof cargarMaestroDataCompleta === 'function') {
        await ejecutarCargaSegura('cargarMaestroDataCompleta', cargarMaestroDataCompleta);
    }
    if (destino === 'carrito' && typeof abrirCarritoPantalla === 'function') {
        await ejecutarCargaSegura('abrirCarritoPantalla', abrirCarritoPantalla);
    }
    if (destino === 'menu') {
        prepararMenuSocio();
        if (typeof renderTelegramLinkPanel === 'function') renderTelegramLinkPanel();
    }
    mainSections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const sectionEl = document.getElementById(destino);
    if (sectionEl) sectionEl.style.display = 'block';
    if (destino !== 'login' && accesoPermitido) localStorage.setItem('generico_seccion_activa', destino);
    document.querySelectorAll('.nav-btn[data-section]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === destino);
    });
    document.querySelectorAll('.dock-btn[data-section]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === destino);
    });
    actualizarChromeApp(destino);
    if (destino === 'actividades' && typeof marcarActividadesVistas === 'function') {
        marcarActividadesVistas();
    }
    if (window.genericoTour && (destino === 'productos' || destino === 'admin' || destino === 'actividades')) {
        window.genericoTour.refresh();
        window.genericoTour.maybeShow();
    }
}

async function ejecutarCargaSegura(etiqueta, fn) {
    try {
        await fn();
    } catch (error) {
        console.error(`Error en ${etiqueta}:`, error);
    }
}

async function cargarConfigWhatsApp() {
    // Deliberadamente no traemos access tokens al cliente.
    appState.configWhatsApp = { phoneNumberId: null, accessToken: null };
    return false;
}

async function cargarGraficosDashboard() {
    const adminCards = document.getElementById('adminCards');
    if (!adminCards) return;

    const { data: reservas } = await supabaseClient
        .from('reservas_mensuales')
        .select('fecha_retiro, cantidad_gramos')
        .eq('estado', 'confirmado');
    const { data: socios } = await supabaseClient
        .from('socios')
        .select('fecha_ingreso');

    const reservasPorMes = {};
    const sociosPorMes = {};
    (reservas || []).forEach((reserva) => {
        const mes = new Date(reserva.fecha_retiro).toLocaleDateString('es', { month: 'short', year: 'numeric' });
        reservasPorMes[mes] = (reservasPorMes[mes] || 0) + gramosAPacks(reserva.cantidad_gramos);
    });
    (socios || []).forEach((socio) => {
        const mes = new Date(socio.fecha_ingreso).toLocaleDateString('es', { month: 'short', year: 'numeric' });
        sociosPorMes[mes] = (sociosPorMes[mes] || 0) + 1;
    });

    if (!document.getElementById('graficoReservas')) {
        adminCards.insertAdjacentHTML(
            'afterend',
            `<div id="adminChartsRow" class="admin-charts-row">
                <div class="admin-chart-card">
                    <div class="card-label">Pedidos mensuales</div>
                    <canvas id="graficoReservas" class="admin-chart-canvas"></canvas>
                </div>
                <div class="admin-chart-card">
                    <div class="card-label">Nuevos socios</div>
                    <canvas id="graficoSocios" class="admin-chart-canvas"></canvas>
                </div>
            </div>`
        );
    }

    if (appState.reservasChart) appState.reservasChart.destroy();
    if (appState.sociosChart) appState.sociosChart.destroy();

    const ctxReservas = document.getElementById('graficoReservas')?.getContext('2d');
    if (ctxReservas) {
        appState.reservasChart = new Chart(ctxReservas, {
            type: 'bar',
            data: {
                labels: Object.keys(reservasPorMes),
                datasets: [{ label: 'Packs', data: Object.values(reservasPorMes), backgroundColor: 'rgba(124, 163, 90, 0.5)', borderColor: '#7ca35a', borderWidth: 1 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0ecd0' } } }, scales: { y: { ticks: { color: '#e0ecd0' } }, x: { ticks: { color: '#e0ecd0' } } } }
        });
    }

    const ctxSocios = document.getElementById('graficoSocios')?.getContext('2d');
    if (ctxSocios) {
        appState.sociosChart = new Chart(ctxSocios, {
            type: 'line',
            data: {
                labels: Object.keys(sociosPorMes),
                datasets: [{ label: 'Socios', data: Object.values(sociosPorMes), fill: true, backgroundColor: 'rgba(139, 184, 106, 0.2)', borderColor: '#8fb86a', tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0ecd0' } } }, scales: { y: { ticks: { color: '#e0ecd0' } }, x: { ticks: { color: '#e0ecd0' } } } }
        });
    }
}

async function verificarSesion() {
    await ejecutarCargaSegura('cargarContenidoInstitucional', cargarContenidoInstitucional);
    await ejecutarCargaSegura('actualizarUIporRol', actualizarUIporRol);
    await ejecutarCargaSegura('cargarNoticias', cargarNoticias);
    await ejecutarCargaSegura('cargarActividadesPublicas', cargarActividadesPublicas);
    await ejecutarCargaSegura('cargarProductosPublicos', cargarProductosPublicos);
    await ejecutarCargaSegura('cargarConfigWhatsApp', cargarConfigWhatsApp);
}

document.addEventListener('DOMContentLoaded', async () => {
    registrarServiceWorkerPwa();
    inicializarPlaceholders();
    inicializarAudioFondo();
    inicializarInstalacionPwa();
    prepararMenuSocio();
    if (typeof actualizarBotonesSesion === 'function') actualizarBotonesSesion(false);

    document.getElementById('btnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('btnLogout')?.addEventListener('click', cerrarSesionHandler);
    document.getElementById('dockBtnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('userName')?.addEventListener('click', () => {
        alternarMenuUsuario();
    });
    document.getElementById('userName')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        alternarMenuUsuario();
    });
    document.querySelectorAll('[data-user-menu-section]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await abrirCuentaDesdeMenuUsuario(btn.dataset.userMenuSection);
        });
    });
    document.addEventListener('click', (event) => {
        if (event.target.closest('.app-session-actions')) return;
        cerrarMenuUsuario();
    });
    document.querySelector('.app-home-button')?.addEventListener('click', async (event) => {
        if (event.target.closest('button')) return;
        await mostrarSeccion('inicio');
    });
    document.querySelector('.app-home-button')?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        await mostrarSeccion('inicio');
    });

    document.querySelectorAll('.nav-btn[data-section]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await mostrarSeccion(btn.dataset.section);
            if (btn.dataset.scrollTarget) {
                document.getElementById(btn.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    document.querySelectorAll('[data-smart-section="actividades"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await mostrarSeccion(obtenerSeccionActividadesPrincipal());
        });
    });
    document.querySelectorAll('.mobile-hidden-dock .dock-btn[data-section]').forEach((btn) => {
        if (btn.id === 'dockBtnLogin') return;
        btn.addEventListener('click', async () => {
            await mostrarSeccion(btn.dataset.section);
            if (btn.dataset.scrollTarget) {
                document.getElementById(btn.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    document.querySelectorAll('[data-productos-target]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await mostrarSeccion('productos');
            document.getElementById(btn.dataset.productosTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    document.getElementById('tabLogin')?.addEventListener('click', () => {
        document.getElementById('tabLogin').style.background = '#7ca35a';
        document.getElementById('tabRegister').style.background = 'rgba(100,140,75,0.3)';
        mostrarPanelLogin();
    });
    document.getElementById('tabRegister')?.addEventListener('click', () => {
        document.getElementById('tabRegister').style.background = '#7ca35a';
        document.getElementById('tabLogin').style.background = 'rgba(100,140,75,0.3)';
        mostrarPanelRegister();
    });
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (event) => {
        event.preventDefault();
        mostrarPanelForgot();
    });
    document.getElementById('backToLoginFromForgot')?.addEventListener('click', (event) => {
        event.preventDefault();
        mostrarPanelLogin();
    });
    document.getElementById('mostrarLoginPassword')?.addEventListener('change', (event) => {
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
            passwordInput.type = event.target.checked ? 'text' : 'password';
        }
    });
    document.getElementById('formLoginPassword')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const telefono = document.getElementById('loginTelefonoPassword').value.trim();
        const password = document.getElementById('loginPassword').value;
        const resultado = await loginConTelefonoPassword(telefono, password);
        if (!resultado.success) {
            mostrarMensaje('Telefono o contrasena incorrectos', false);
            return;
        }
        mostrarMensaje('Inicio de sesión exitoso', true);
        await verificarSesion();
        await mostrarSeccion('inicio');
        if (window.genericoTour) {
            window.genericoTour.refresh();
            window.genericoTour.maybeShow();
        }
    });

    document.getElementById('formRegisterMagic')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const datos = {
                nombre: document.getElementById('registerNombre').value.trim(),
                apellido: document.getElementById('registerApellido').value.trim(),
                cedula: document.getElementById('registerCedula').value.trim(),
                telefono: document.getElementById('registerTelefono').value.trim(),
                email: document.getElementById('registerEmail').value.trim(),
                mensaje: document.getElementById('registerMensaje').value.trim()
            };
            const resultado = await crearSolicitudMembresiaConTelegram(datos);
            window.open(obtenerTelegramLinkUrl(resultado.code), '_blank', 'noopener,noreferrer');
            document.getElementById('registerMessage').style.display = 'block';
            event.target.reset();
            mostrarMensaje('Solicitud creada. Toca Start en Telegram para verificar.', true);
        } catch (error) {
            console.error('Error al registrar solicitud:', error);
            mostrarMensaje(error?.message || 'No se pudo crear la solicitud.', false);
        }
    });

    document.getElementById('formForgotMagic')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('forgotEmail').value;
        const resultado = await enviarEnlaceRecuperacionPassword(email);
        mostrarMensaje(resultado.success ? 'Enlace enviado' : 'No se pudo enviar el enlace', resultado.success);
    });

    document.getElementById('formCambiarPassword')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const boton = document.getElementById('btnCambiarPassword');
        const actual = document.getElementById('passwordActual')?.value || '';
        const nueva = document.getElementById('passwordNueva')?.value || '';
        const repetir = document.getElementById('passwordNuevaConfirmar')?.value || '';
        const errorValidacion = validarCambioPasswordActualizado(actual, nueva, repetir);

        if (!(await asegurarTelegramParaCambioPassword())) {
            return;
        }

        if (errorValidacion) {
            mostrarMensaje(errorValidacion, false);
            return;
        }

        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Actualizando...';
        }

        try {
            const resultado = await cambiarPasswordActual(actual, nueva);
            const passwordTemporalActivo = typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword();
            if (!resultado.success) {
                mostrarMensaje(resultado.error || 'No se pudo actualizar la contraseña.', false);
                return;
            }
            if (passwordTemporalActivo && typeof marcarPasswordCambiada === 'function') {
                const marcado = await marcarPasswordCambiada();
                if (!marcado.success) {
                    mostrarMensaje('La contraseña cambió, pero no se pudo cerrar el estado temporal.', false);
                    return;
                }
                renderPasswordTemporalGate();
            }
            form.reset();
            mostrarMensaje('Contraseña actualizada correctamente.', true);
        } finally {
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = '<i class="fas fa-key"></i> Actualizar contraseña';
            }
        }
    });

    document.getElementById('formPasswordTemporal')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const boton = document.getElementById('btnPasswordTemporal');
        const nueva = document.getElementById('passwordTemporalNueva')?.value || '';
        const repetir = document.getElementById('passwordTemporalConfirmar')?.value || '';
        const errorValidacion = validarNuevaPassword(nueva, repetir);

        if (!(await asegurarTelegramParaCambioPassword())) {
            return;
        }

        if (errorValidacion) {
            mostrarMensaje(errorValidacion, false);
            return;
        }

        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Actualizando...';
        }

        try {
            const resultado = await cambiarPasswordTemporal(nueva);
            if (!resultado.success) {
                mostrarMensaje(resultado.error || 'No se pudo actualizar la contraseña.', false);
                return;
            }
            form.reset();
            renderPasswordTemporalGate();
            mostrarMensaje('Contraseña actualizada correctamente.', true);
            if (typeof actualizarEstadoSeguridadTelegram === 'function') {
                await actualizarEstadoSeguridadTelegram();
            }
            if (typeof renderTelegramLinkPanel === 'function') renderTelegramLinkPanel();
        } finally {
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = '<i class="fas fa-key"></i> Cambiar contraseña';
            }
        }
    });

    await verificarSesion();
    await mostrarSeccion('inicio');
    if (window.genericoTour) {
        window.genericoTour.refresh();
        window.genericoTour.maybeShow();
    }
});
