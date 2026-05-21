const mainSections = ['inicio', 'productos', 'actividades', 'admin', 'maestro', 'login'];
const restrictedSections = {
    productos: ['socio', 'admin', 'maestro'],
    actividades: ['socio', 'admin', 'maestro'],
    admin: ['admin'],
    maestro: ['maestro']
};

function registrarServiceWorkerPwa() {
    if (!('serviceWorker' in navigator)) return;
    const esLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (window.location.protocol !== 'https:' || esLocalhost) {
        navigator.serviceWorker.getRegistrations?.()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .catch(() => undefined);
        return;
    }
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .catch((error) => {
                console.warn('No se pudo registrar la PWA:', error);
            });
    });
}

function actualizarBotonAudio() {
    const audio = document.getElementById('backgroundAudio');
    const boton = document.getElementById('btnAudioToggle');
    if (!audio || !boton) return;
    const icono = boton.querySelector('i');
    const silenciado = audio.muted;
    boton.setAttribute('aria-label', silenciado ? 'Activar música' : 'Silenciar música');
    boton.setAttribute('title', silenciado ? 'Activar música' : 'Silenciar música');
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

    const silenciadoGuardado = localStorage.getItem('cururu_audio_muted');
    audio.volume = 0.35;
    audio.muted = silenciadoGuardado === null ? false : silenciadoGuardado === 'true';
    actualizarBotonAudio();

    boton.addEventListener('click', async () => {
        audio.muted = !audio.muted;
        localStorage.setItem('cururu_audio_muted', String(audio.muted));
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
    return visible || localStorage.getItem('cururu_seccion_activa') || 'inicio';
}

function guardarDestinoPostLogin(seccionId) {
    const destino = mainSections.includes(seccionId) ? seccionId : '';
    if (destino && destino !== 'inicio' && destino !== 'login') {
        localStorage.setItem('cururu_post_login_section', destino);
    }
}

function obtenerDestinoPostLogin() {
    const destinoGuardado = localStorage.getItem('cururu_post_login_section') || localStorage.getItem('cururu_seccion_activa');
    localStorage.removeItem('cururu_post_login_section');
    if (destinoGuardado && destinoGuardado !== 'inicio' && destinoGuardado !== 'login' && usuarioPuedeVerSeccion(destinoGuardado)) {
        return destinoGuardado;
    }
    if (appState.rolUsuario === 'maestro') return 'maestro';
    if (appState.rolUsuario === 'admin') return 'admin';
    return 'productos';
}

function validarCambioPassword(actual, nueva, repetir) {
    if (!actual || !nueva || !repetir) return 'Completá todos los campos.';
    if (nueva.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva) || !/\d/.test(nueva)) {
        return 'La nueva contraseña debe incluir letras y números.';
    }
    if (nueva !== repetir) return 'La confirmación no coincide.';
    if (actual === nueva) return 'La nueva contraseña debe ser distinta a la actual.';
    return '';
}

function validarNuevaPassword(nueva, repetir) {
    if (!nueva || !repetir) return 'Completá todos los campos.';
    if (nueva.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva) || !/\d/.test(nueva)) {
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
    mainSections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const sectionEl = document.getElementById(destino);
    if (sectionEl) sectionEl.style.display = 'block';
    if (destino !== 'login' && accesoPermitido) localStorage.setItem('cururu_seccion_activa', destino);
    document.querySelectorAll('.nav-btn[data-section]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === destino);
    });
    document.querySelectorAll('.dock-btn[data-section]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === destino);
    });
    if (destino === 'actividades' && typeof marcarActividadesVistas === 'function') {
        marcarActividadesVistas();
    }
    if (window.cururuTour && (destino === 'productos' || destino === 'admin' || destino === 'actividades')) {
        window.cururuTour.refresh();
        window.cururuTour.maybeShow();
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
    if (typeof actualizarBotonesSesion === 'function') actualizarBotonesSesion(false);

    document.getElementById('btnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('btnLogout')?.addEventListener('click', cerrarSesionHandler);
    document.getElementById('dockBtnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('userName')?.addEventListener('click', async () => {
        if (typeof abrirCarritoSocio === 'function') await abrirCarritoSocio();
    });
    document.getElementById('userName')?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (typeof abrirCarritoSocio === 'function') await abrirCarritoSocio();
    });

    document.querySelectorAll('.nav-btn[data-section]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await mostrarSeccion(btn.dataset.section);
            if (btn.dataset.scrollTarget) {
                document.getElementById(btn.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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
        await mostrarSeccion(typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword()
            ? 'actividades'
            : obtenerDestinoPostLogin());
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
    await mostrarSeccion(typeof socioDebeCambiarPassword === 'function' && socioDebeCambiarPassword()
        ? 'actividades'
        : (localStorage.getItem('cururu_seccion_activa') || 'inicio'));
    if (window.cururuTour) {
        window.cururuTour.refresh();
        window.cururuTour.maybeShow();
    }
});
