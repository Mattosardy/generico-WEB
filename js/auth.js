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
    const dockLogin = document.getElementById('dockBtnLogin');
    const productosNav = document.querySelector('.header-nav [data-section="productos"]');
    const dockProductos = document.getElementById('dockBtnProductos');
    const desktopLogout = document.getElementById('btnLogout');

    if (desktopLogin) desktopLogin.style.display = autenticado ? 'none' : 'inline-block';
    if (dockLogin) dockLogin.style.display = autenticado ? 'none' : 'flex';
    if (productosNav) productosNav.style.display = autenticado ? '' : 'none';
    if (dockProductos) dockProductos.style.display = autenticado ? 'flex' : 'none';
    if (desktopLogout) desktopLogout.style.display = autenticado ? 'inline-block' : 'none';
}

async function actualizarUIporRol() {
    const usuario = await obtenerUsuarioActual();
    appState.usuarioActual = usuario;

    if (usuario) {
        let socio = usuario.id && typeof obtenerSocioPorAuthId === 'function'
            ? await obtenerSocioPorAuthId(usuario.id)
            : { success: false };
        if (!socio.success && usuario.email) {
            socio = await obtenerSocioPorEmail(usuario.email);
        }
        if (socio.success && socio.data) {
            appState.rolUsuario = socio.data.rol || 'socio';
            appState.socioData = socio.data;
            document.getElementById('userName').textContent = `${escapeHtml(socio.data.nombre)} ${escapeHtml(socio.data.apellido)}`;
        } else {
            appState.rolUsuario = 'socio';
            appState.socioData = null;
            const dashboard = document.getElementById('socioDashboard');
            if (dashboard) dashboard.style.display = 'none';
            document.getElementById('userName').textContent = escapeHtml(usuario.email);
        }
        actualizarBotonesSesion(true);
    } else {
        appState.rolUsuario = 'invitado';
        appState.socioData = null;
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        document.getElementById('userName').textContent = 'Invitado';
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
    document.querySelectorAll('.auth-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'invitado' ? 'none' : '';
    });

    if (appState.rolUsuario !== 'invitado' && appState.socioData?.id && typeof cargarReservasSocio === 'function') {
        await cargarReservasSocio();
    }
    if ((appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro') && typeof cargarAdminData === 'function') {
        await cargarAdminData();
    }
    if (appState.rolUsuario === 'maestro' && typeof cargarMaestroDataCompleta === 'function') {
        await cargarMaestroDataCompleta();
    }
}

async function iniciarSesion() {
    if (typeof mostrarSeccion === 'function') mostrarSeccion('login');
    mostrarPanelLogin();
}

async function cerrarSesionHandler() {
    const resultado = await cerrarSesion();
    if (!resultado.success) {
        mostrarMensaje('No se pudo cerrar sesión', false);
        return;
    }
    localStorage.setItem('cururu_seccion_activa', 'inicio');
    await verificarSesion();
    mostrarMensaje('Sesión cerrada', true);
    if (typeof mostrarSeccion === 'function') mostrarSeccion('inicio');
}

console.log('Auth loaded');
