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

    if (desktopLogin) desktopLogin.style.display = autenticado ? 'none' : 'inline-flex';
    if (dockLogin) dockLogin.style.display = autenticado ? 'none' : 'flex';
    if (productosNav) productosNav.style.display = autenticado ? '' : 'none';
    if (dockProductos) dockProductos.style.display = autenticado ? 'flex' : 'none';
    if (desktopLogout) desktopLogout.style.display = autenticado ? 'inline-flex' : 'none';
}

function actualizarNombreUsuarioNav(partes = ['Invitado']) {
    const userName = document.getElementById('userName');
    if (!userName) return;
    const limpias = partes.map((parte) => String(parte || '').trim()).filter(Boolean);
    const nombreBase = limpias[0] || 'Invitado';
    const nombrePila = nombreBase.includes('@') ? nombreBase.split('@')[0] : nombreBase.split(/\s+/)[0];
    const visibles = nombrePila && nombrePila !== 'Invitado' ? [`Carrito de ${nombrePila}`] : ['Invitado'];
    userName.textContent = '';
    visibles.forEach((parte) => {
        const token = document.createElement('span');
        token.className = 'nav-user-token';
        token.textContent = parte;
        userName.appendChild(token);
    });
    userName.title = visibles[0];
    userName.setAttribute('role', nombrePila && nombrePila !== 'Invitado' ? 'button' : 'status');
    userName.setAttribute('tabindex', nombrePila && nombrePila !== 'Invitado' ? '0' : '-1');
    userName.setAttribute('aria-label', nombrePila && nombrePila !== 'Invitado' ? `Abrir carrito de ${nombrePila}` : 'Usuario invitado');
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
            if (typeof actualizarEstadoSeguridadTelegram === 'function') {
                await actualizarEstadoSeguridadTelegram();
            }
            actualizarNombreUsuarioNav([socio.data.nombre]);
        } else {
            appState.rolUsuario = 'socio';
            appState.socioData = null;
            const dashboard = document.getElementById('socioDashboard');
            if (dashboard) dashboard.style.display = 'none';
            actualizarNombreUsuarioNav([usuario.email]);
        }
        actualizarBotonesSesion(true);
    } else {
        appState.rolUsuario = 'invitado';
        appState.socioData = null;
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        actualizarNombreUsuarioNav(['Invitado']);
        actualizarBotonesSesion(false);
        mostrarPanelLogin();
    }

    document.querySelectorAll('.socio-only').forEach((el) => {
        el.style.display = appState.rolUsuario !== 'invitado' ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'admin' ? '' : 'none';
    });
    document.querySelectorAll('.maestro-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'maestro' ? '' : 'none';
    });
    document.querySelectorAll('.auth-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'invitado' ? 'none' : '';
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
}

async function iniciarSesion() {
    if (typeof guardarDestinoPostLogin === 'function' && typeof obtenerSeccionVisibleActual === 'function') {
        guardarDestinoPostLogin(obtenerSeccionVisibleActual());
    }
    if (typeof mostrarSeccion === 'function') await mostrarSeccion('login');
    mostrarPanelLogin();
}

async function cerrarSesionHandler() {
    const resultado = await cerrarSesion();
    if (!resultado.success) {
        mostrarMensaje('No se pudo cerrar sesión', false);
        return;
    }
    localStorage.setItem('cururu_seccion_activa', 'inicio');
    localStorage.removeItem('cururu_post_login_section');
    await verificarSesion();
    mostrarMensaje('Sesión cerrada', true);
    if (typeof mostrarSeccion === 'function') mostrarSeccion('inicio');
}
