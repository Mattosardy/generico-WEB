const mainSections = ['inicio', 'productos', 'admin', 'maestro', 'login'];
const restrictedSections = {
    productos: ['socio', 'admin', 'maestro'],
    admin: ['admin', 'maestro'],
    maestro: ['maestro']
};

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

async function mostrarSeccion(seccionId) {
    const seccionValida = mainSections.includes(seccionId) ? seccionId : 'inicio';
    const destino = usuarioPuedeVerSeccion(seccionValida) ? seccionValida : 'inicio';
    if (destino === 'admin' && (appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro') && typeof cargarAdminData === 'function') {
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
    if (destino !== 'login') localStorage.setItem('cururu_seccion_activa', destino);
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === destino);
    });
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
        reservasPorMes[mes] = (reservasPorMes[mes] || 0) + Number(reserva.cantidad_gramos || 0);
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
                    <div class="card-label">Reservas mensuales</div>
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
                datasets: [{ label: 'Gramos', data: Object.values(reservasPorMes), backgroundColor: 'rgba(124, 163, 90, 0.5)', borderColor: '#7ca35a', borderWidth: 1 }]
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
    await ejecutarCargaSegura('actualizarUIporRol', actualizarUIporRol);
    await ejecutarCargaSegura('cargarContenidoInstitucional', cargarContenidoInstitucional);
    await ejecutarCargaSegura('cargarNoticias', cargarNoticias);
    await ejecutarCargaSegura('cargarActividadesPublicas', cargarActividadesPublicas);
    await ejecutarCargaSegura('cargarProductosPublicos', cargarProductosPublicos);
    await ejecutarCargaSegura('cargarConfigWhatsApp', cargarConfigWhatsApp);
    await ejecutarCargaSegura('renderProximasEntregasEnProductos', renderProximasEntregasEnProductos);
}

document.addEventListener('DOMContentLoaded', async () => {
    inicializarPlaceholders();
    inicializarAudioFondo();
    if (typeof actualizarBotonesSesion === 'function') actualizarBotonesSesion(false);

    document.getElementById('btnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('btnLogout')?.addEventListener('click', cerrarSesionHandler);
    document.getElementById('dockBtnLogin')?.addEventListener('click', iniciarSesion);

    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await mostrarSeccion(btn.dataset.section);
        });
    });
    document.querySelectorAll('.mobile-hidden-dock .dock-btn[data-section]').forEach((btn) => {
        if (btn.id === 'dockBtnLogin') return;
        btn.addEventListener('click', async () => {
            await mostrarSeccion(btn.dataset.section);
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

    await verificarSesion();
    await mostrarSeccion(localStorage.getItem('cururu_seccion_activa') || 'inicio');
});

console.log('Main loaded');
