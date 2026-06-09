function mostrarPanelLogin() {
    document.getElementById('panelLogin').style.display = 'block';
    document.getElementById('panelRegister').style.display = 'none';
    document.getElementById('panelForgot').style.display = 'none';
}

function mostrarPanelRegister() {
    mostrarMensaje('El alta de socios la realiza el administrador del club.', false);
    mostrarPanelLogin();
    return;
    document.getElementById('panelLogin').style.display = 'none';
    document.getElementById('panelRegister').style.display = 'block';
    document.getElementById('panelForgot').style.display = 'none';
}

function mostrarPanelForgot() {
    mostrarMensaje('Solicitá una nueva clave temporal al administrador del club.', false);
    mostrarPanelLogin();
    return;
    document.getElementById('panelLogin').style.display = 'none';
    document.getElementById('panelRegister').style.display = 'none';
    document.getElementById('panelForgot').style.display = 'block';
}

function socioDebeCambiarPassword() {
    return Boolean(appState.socioData?.debe_cambiar_password || appState.socioData?.password_temporal);
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

function obtenerNombrePilaSesion(partes = ['Invitado']) {
    const limpias = partes.map((parte) => String(parte || '').trim()).filter(Boolean);
    const nombreBase = limpias[0] || 'Invitado';
    return nombreBase.includes('@') ? nombreBase.split('@')[0] : nombreBase.split(/\s+/)[0];
}

function actualizarNombreHeaderSesion(nombrePila = 'Invitado') {
    const headerName = document.getElementById('headerSessionName');
    if (!headerName) return;
    const visible = nombrePila && nombrePila !== 'Invitado';
    headerName.textContent = visible ? nombrePila : '';
    headerName.style.display = visible ? '' : 'none';
}

function obtenerPartesNombreSesion(usuario = null, socio = null) {
    const metadata = usuario?.user_metadata || {};
    const candidatos = [
        [socio?.nombre],
        [socio?.nombre, socio?.apellido],
        [metadata.nombre, metadata.apellido],
        [metadata.full_name],
        [metadata.name],
        [metadata.display_name],
        [usuario?.email]
    ];
    const limpiarPartes = (partes) => partes.map((parte) => String(parte || '').trim()).filter(Boolean);
    const normalizar = (partes) => limpiarPartes(partes).join(' ').toLowerCase();
    const esGenerico = (partes) => ['admin', 'administrador', 'maestro', 'socio', 'invitado'].includes(normalizar(partes));
    const conContenido = candidatos.map(limpiarPartes).filter((partes) => partes.length);
    return conContenido.find((partes) => !esGenerico(partes)) || conContenido[0] || ['Invitado'];
}

function actualizarNombreUsuarioNav(partes = ['Invitado'], rol = appState.rolUsuario) {
    const userName = document.getElementById('userName');
    if (!userName) return;
    const nombrePila = obtenerNombrePilaSesion(partes);
    actualizarNombreHeaderSesion(nombrePila);
    userName.classList.remove('nav-user-name-hidden');
    const visibles = nombrePila && nombrePila !== 'Invitado'
        ? [nombrePila]
        : ['Invitado'];
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
    userName.setAttribute('aria-label', nombrePila && nombrePila !== 'Invitado' ? `Abrir menu de usuario de ${nombrePila}` : 'Usuario invitado');
    userName.setAttribute('aria-haspopup', nombrePila && nombrePila !== 'Invitado' ? 'menu' : 'false');
    userName.setAttribute('aria-expanded', 'false');
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
            appState.rolUsuario = String(socio.data.rol || 'socio').trim().toLowerCase();
            appState.socioData = socio.data;
            if (typeof renderPasswordTemporalGate === 'function') {
                renderPasswordTemporalGate();
            }
            if (typeof actualizarEstadoSeguridadTelegram === 'function') {
                await actualizarEstadoSeguridadTelegram();
            }
            actualizarNombreUsuarioNav(obtenerPartesNombreSesion(usuario, socio.data), appState.rolUsuario);
        } else {
            const email = String(usuario.email || '').trim().toLowerCase();
            const adminEmails = Array.isArray(window.GENERICO_ADMIN_EMAILS)
                ? window.GENERICO_ADMIN_EMAILS.map((item) => String(item || '').trim().toLowerCase())
                : [];
            const esAdminFallback = email && adminEmails.includes(email);

            appState.rolUsuario = esAdminFallback ? 'admin' : 'socio';
            appState.socioData = null;
            if (typeof renderPasswordTemporalGate === 'function') {
                renderPasswordTemporalGate();
            }
            const dashboard = document.getElementById('socioDashboard');
            if (dashboard) dashboard.style.display = 'none';
            actualizarNombreUsuarioNav(obtenerPartesNombreSesion(usuario), appState.rolUsuario);
        }
        actualizarBotonesSesion(true);
    } else {
        appState.rolUsuario = 'invitado';
        appState.socioData = null;
        if (typeof renderPasswordTemporalGate === 'function') {
            renderPasswordTemporalGate();
        }
        appState.gramosReservadosCiclo = 0;
        appState.cicloClubActual = null;
        const dashboard = document.getElementById('socioDashboard');
        if (dashboard) dashboard.style.display = 'none';
        actualizarNombreUsuarioNav(['Invitado'], appState.rolUsuario);
        actualizarBotonesSesion(false);
        mostrarPanelLogin();
    }

    document.querySelectorAll('.socio-only').forEach((el) => {
        el.style.display = appState.rolUsuario !== 'invitado' ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = appState.rolUsuario === 'admin' || appState.rolUsuario === 'maestro' ? '' : 'none';
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
    localStorage.setItem('generico_seccion_activa', 'inicio');
    localStorage.removeItem('generico_post_login_section');
    await verificarSesion();
    mostrarMensaje('Sesión cerrada', true);
    if (typeof mostrarSeccion === 'function') mostrarSeccion('inicio');
}

window.socioDebeCambiarPassword = socioDebeCambiarPassword;
