function mostrarPanelLogin() {
    document.getElementById('panelLogin').style.display = 'block';
    document.getElementById('panelRegister').style.display = 'none';
    document.getElementById('panelForgot').style.display = 'none';
}

function mostrarPanelRegister() {
    document.getElementById('panelLogin').style.display = 'none';
    document.getElementById('panelRegister').style.display = 'block';
    document.getElementById('panelForgot').style.display = 'none';
}

function mostrarPanelForgot() {
    document.getElementById('panelLogin').style.display = 'none';
    document.getElementById('panelRegister').style.display = 'none';
    document.getElementById('panelForgot').style.display = 'block';
}

function actualizarBotonesSesion(autenticado) {
    const desktopLogin = document.getElementById('btnLogin');
    const mobileLogin = document.getElementById('mobileBtnLogin');
    const desktopLogout = document.getElementById('btnLogout');
    const mobileLogout = document.getElementById('mobileBtnLogout');

    if (desktopLogin) desktopLogin.style.display = autenticado ? 'none' : 'inline-flex';
    if (mobileLogin) mobileLogin.style.display = autenticado ? 'none' : 'flex';
    if (desktopLogout) desktopLogout.style.display = autenticado ? 'flex' : 'none';
    if (mobileLogout) mobileLogout.style.display = autenticado ? 'flex' : 'none';
    const userName = document.getElementById('userName');
    if (userName) userName.style.display = autenticado ? 'inline-flex' : 'none';
}

async function actualizarUIporRol() {
    const usuario = await obtenerUsuarioActual();
    appState.usuarioActual = usuario;

    if (usuario) {
        const socio = await obtenerSocioPorEmail(usuario.email);
        if (socio.success && socio.data) {
            appState.rolUsuario = socio.data.rol || 'socio';
            appState.socioData = socio.data;
            const nombre = escapeHtml(socio.data.nombre || 'Socio');
            document.getElementById('userName').innerHTML = `<span class="nav-user-token">${nombre}</span>`;
        } else {
            appState.rolUsuario = 'socio';
            appState.socioData = null;
            document.getElementById('userName').innerHTML = `<span class="nav-user-token">${escapeHtml(usuario.email)}</span>`;
        }
        document.getElementById('userName')?.setAttribute('role', 'button');
        document.getElementById('userName')?.setAttribute('aria-haspopup', 'menu');
        document.getElementById('userName')?.setAttribute('aria-expanded', 'false');
        actualizarBotonesSesion(true);
    } else {
        appState.rolUsuario = 'invitado';
        appState.socioData = null;
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        document.getElementById('userName').innerHTML = '<span class="nav-user-token">Invitado</span>';
        document.getElementById('userName')?.setAttribute('role', 'status');
        document.getElementById('userName')?.setAttribute('aria-expanded', 'false');
        actualizarBotonesSesion(false);
        mostrarPanelLogin();
    }

    document.querySelectorAll('.socio-only').forEach((el) => {
        el.style.display = appState.rolUsuario !== 'invitado' ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = (appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro') ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.maestro-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'maestro' ? 'inline-block' : 'none';
    });

    if (appState.rolUsuario !== 'invitado' && appState.socioData?.id && typeof cargarReservasSocio === 'function') {
        await cargarReservasSocio();
    }
    if (appState.rolUsuario === 'admin' && typeof cargarAdminData === 'function') {
        await cargarAdminData();
    }
    if (appState.rolUsuario === 'maestro' && typeof cargarMaestroDataCompleta === 'function') {
        await cargarMaestroDataCompleta();
    }
    if (typeof actualizarBotonActividadesPrincipal === 'function') actualizarBotonActividadesPrincipal();
}

async function iniciarSesion() {
    if (typeof mostrarSeccion === 'function') mostrarSeccion('login');
    mostrarPanelLogin();
}

async function cerrarSesionHandler() {
    const resultado = await cerrarSesion();
    if (!resultado.success) {
        mostrarMensaje('No se pudo cerrar sesion', false);
        return;
    }
    localStorage.setItem('cururu_seccion_activa', 'inicio');
    await verificarSesion();
    mostrarMensaje('Sesion cerrada', true);
    if (typeof mostrarSeccion === 'function') mostrarSeccion('inicio');
}

console.log('Auth loaded');
