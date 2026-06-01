const mainSections = ['inicio', 'productos', 'carrito', 'actividades', 'admin', 'maestro', 'menu', 'login'];
const restrictedSections = {
    admin: ['admin', 'maestro'],
    maestro: ['maestro']
};

function usuarioPuedeVerSeccion(seccionId) {
    const rolesPermitidos = restrictedSections[seccionId];
    if (!rolesPermitidos) return true;
    return rolesPermitidos.includes(appState.rolUsuario);
}

function mostrarSeccion(seccionId) {
    const seccionValida = mainSections.includes(seccionId) ? seccionId : 'inicio';
    const destino = usuarioPuedeVerSeccion(seccionValida) ? seccionValida : 'inicio';
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
    document.body.classList.toggle('app-home', destino === 'inicio');
    document.body.classList.toggle('app-internal', destino !== 'inicio');
}

function obtenerSeccionActividadesPrincipal() {
    if (appState.rolUsuario === 'maestro') return 'maestro';
    if (appState.rolUsuario === 'admin') return 'admin';
    return 'actividades';
}

function actualizarBotonActividadesPrincipal() {
    const boton = document.querySelector('[data-smart-section="actividades"] span');
    if (!boton) return;
    boton.textContent = (appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro') ? 'HERRAMIENTAS' : 'ACTIVIDADES';
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
    if (typeof aplicarTemaDesdeLogo === 'function') aplicarTemaDesdeLogo();
    if (typeof actualizarBotonesSesion === 'function') actualizarBotonesSesion(false);

    document.getElementById('btnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('btnLogout')?.addEventListener('click', cerrarSesionHandler);
    document.getElementById('mobileBtnLogin')?.addEventListener('click', iniciarSesion);
    document.getElementById('mobileBtnLogout')?.addEventListener('click', cerrarSesionHandler);
    document.getElementById('userName')?.addEventListener('click', alternarMenuUsuario);
    document.addEventListener('click', (event) => {
        if (event.target.closest('.app-session-actions')) return;
        cerrarMenuUsuario();
    });
    document.querySelector('.app-home-button')?.addEventListener('click', async (event) => {
        if (event.target.closest('button')) return;
        mostrarSeccion('inicio');
    });

    document.querySelectorAll('.nav-btn').forEach((btn) => {
        if (btn.id === 'mobileBtnLogin' || btn.id === 'mobileBtnLogout') return;
        if (btn.dataset.smartSection === 'actividades') {
            btn.addEventListener('click', () => mostrarSeccion(obtenerSeccionActividadesPrincipal()));
            return;
        }
        btn.addEventListener('click', () => mostrarSeccion(btn.dataset.section));
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
        const email = document.getElementById('loginEmailPassword').value;
        const password = document.getElementById('loginPassword').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            mostrarMensaje('Email o contrasena incorrectos', false);
            return;
        }
        mostrarMensaje('Login exitoso', true);
        await verificarSesion();
        mostrarSeccion('inicio');
    });

    document.getElementById('formRegisterMagic')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const resultado = await enviarEnlaceRecuperacionPassword(email);
        mostrarMensaje(resultado.success ? 'Enlace enviado' : 'No se pudo enviar el enlace', resultado.success);
    });

    document.getElementById('formForgotMagic')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('forgotEmail').value;
        const resultado = await enviarEnlaceRecuperacionPassword(email);
        mostrarMensaje(resultado.success ? 'Enlace enviado' : 'No se pudo enviar el enlace', resultado.success);
    });

    await verificarSesion();
    actualizarBotonActividadesPrincipal();
    mostrarSeccion(localStorage.getItem('cururu_seccion_activa') || 'inicio');
});

console.log('Main loaded');
