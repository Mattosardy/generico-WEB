// ============================================
// SUPABASE CLIENT - GENERICO CLUB
// VERSION CON LOGIN POR TELEFONO Y PASSWORD
// ============================================

function resolverSupabaseEnv() {
    const supabaseUrl = String(window.__SUPABASE_ENV__?.url || '').trim();
    const supabaseAnonKey = String(window.__SUPABASE_ENV__?.anonKey || '').trim();

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('%VITE_') || supabaseAnonKey.includes('%VITE_')) {
        throw new Error('Configuracion de Supabase no disponible. Abrir la web desde npm run dev o desde el deploy, no como archivo file://.');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(supabaseUrl);
    } catch (_error) {
        const error = new Error('SUPABASE_URL invalida. Verificar variables de entorno del servidor.');
        error.code = 'SUPABASE_CONFIG_INVALID';
        throw error;
    }

    const esLocal = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
    if ((!esLocal && parsedUrl.protocol !== 'https:') || (esLocal && !['http:', 'https:'].includes(parsedUrl.protocol))) {
        const error = new Error('SUPABASE_URL debe usar HTTPS (salvo durante desarrollo local).');
        error.code = 'SUPABASE_CONFIG_INVALID';
        throw error;
    }
    if (!esLocal && !/^[a-z0-9-]+\.supabase\.co$/i.test(parsedUrl.hostname)) {
        const error = new Error('SUPABASE_URL no apunta a un hostname valido de Supabase.');
        error.code = 'SUPABASE_CONFIG_INVALID';
        throw error;
    }

    return {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        projectRef: parsedUrl.hostname.split('.')[0]
    };
}

var SUPABASE_URL = '';
var SUPABASE_ANON_KEY = '';
var SUPABASE_PROJECT_REF = '';
var supabaseClient = null;
var supabaseInitError = null;
var supabaseSessionCheckBlocked = false;

try {
    const supabaseEnv = resolverSupabaseEnv();
    SUPABASE_URL = supabaseEnv.url;
    SUPABASE_ANON_KEY = supabaseEnv.anonKey;
    SUPABASE_PROJECT_REF = supabaseEnv.projectRef;
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    supabaseInitError = error;
    console.error('No se pudo inicializar Supabase:', error.message);
}

window.SUPABASE_URL = SUPABASE_URL;
window.supabaseClient = supabaseClient;

function errorEsRefreshTokenInvalido(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    return mensaje.includes('invalid refresh token') || mensaje.includes('refresh token not found');
}

function haySesionLocalSupabase() {
    if (typeof localStorage === 'undefined' || !SUPABASE_PROJECT_REF) return false;
    try {
        const prefijo = `sb-${SUPABASE_PROJECT_REF}-`;
        return Object.keys(localStorage).some((clave) => clave.startsWith(prefijo));
    } catch (_error) {
        return false;
    }
}

function clasificarErrorSupabase(error, opciones = {}) {
    const mensajeOriginal = String(error?.message || error || '').trim();
    const mensaje = mensajeOriginal.toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    const teniaSesionLocal = Boolean(opciones.teniaSesionLocal);
    const esConsultaSesion = opciones.operacion === 'refresh' || opciones.operacion === 'sesion';
    const esErrorDeRed = error?.name === 'AuthRetryableFetchError'
        || error?.name === 'TypeError'
        || mensaje.includes('failed to fetch')
        || mensaje.includes('fetch failed')
        || mensaje.includes('network request failed')
        || mensaje.includes('load failed')
        || mensaje.includes('err_name_not_resolved');

    if (error?.code === 'SUPABASE_CONFIG_INVALID' || !SUPABASE_URL || !supabaseClient) {
        return {
            code: 'configuracion_invalida',
            message: 'La configuracion de Supabase es invalida o esta incompleta. Verifica la URL configurada para esta web.',
            canClearSession: false,
            retryable: false
        };
    }

    if (errorEsRefreshTokenInvalido(error)) {
        return {
            code: 'sesion_vieja',
            message: 'La sesion guardada ya no es valida y no se pudo refrescar. Podes limpiar solo esa sesion local e iniciar sesion nuevamente.',
            canClearSession: teniaSesionLocal,
            retryable: false
        };
    }

    if (esErrorDeRed && typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
            code: esConsultaSesion && teniaSesionLocal ? 'refresh_sin_conexion' : 'sin_conexion',
            message: esConsultaSesion && teniaSesionLocal
                ? 'No se pudo refrescar la sesion guardada porque no hay conexion. No se borro la sesion local.'
                : 'No hay conexion a Internet. Revisa la red e intenta nuevamente.',
            canClearSession: false,
            retryable: true
        };
    }

    if (esErrorDeRed || status >= 500) {
        return {
            code: esConsultaSesion && teniaSesionLocal ? 'refresh_supabase_no_disponible' : 'supabase_no_disponible',
            message: esConsultaSesion && teniaSesionLocal
                ? 'Supabase no esta disponible y no se pudo refrescar la sesion guardada. La sesion local se conservo.'
                : 'Supabase no esta disponible. Verifica la URL configurada o intenta nuevamente mas tarde.',
            canClearSession: false,
            retryable: true
        };
    }

    if (['invalid_login_credentials', 'invalid_credentials'].includes(String(error?.code || '').toLowerCase())
        || mensaje.includes('invalid login credentials')
        || mensaje.includes('telefono o contrasena incorrectos')) {
        return {
            code: 'credenciales_incorrectas',
            message: 'Telefono o contrasena incorrectos.',
            canClearSession: false,
            retryable: false
        };
    }

    return {
        code: 'error_autenticacion',
        message: mensajeOriginal || 'No se pudo completar la autenticacion.',
        canClearSession: false,
        retryable: status === 429
    };
}

function publicarEstadoAuthSupabase(diagnostico = null) {
    window.supabaseAuthStatus = diagnostico;
    window.dispatchEvent(new CustomEvent('supabase-auth-status', { detail: diagnostico }));
}

function detenerRefreshAutomaticoSupabase() {
    try {
        supabaseClient?.auth?.stopAutoRefresh();
    } catch (_error) {
        // La pantalla de login debe seguir disponible aunque no se pueda detener el timer interno.
    }
}

function limpiarSesionLocalSupabase() {
    if (typeof localStorage === 'undefined' || !SUPABASE_PROJECT_REF) return false;
    try {
        const prefijo = `sb-${SUPABASE_PROJECT_REF}-`;
        Object.keys(localStorage).forEach((clave) => {
            if (clave.startsWith(prefijo)) localStorage.removeItem(clave);
        });
        supabaseSessionCheckBlocked = false;
        publicarEstadoAuthSupabase(null);
        return true;
    } catch (error) {
        console.warn('No se pudo limpiar la sesión local de Supabase:', error);
        return false;
    }
}

async function cancelarReserva(reservaId, socioId) {
    try {
        if (!reservaId || !socioId) {
            return { success: false, message: 'No se pudo validar el pedido y el socio.' };
        }

        const { data, error } = await supabaseClient
            .from('reservas_mensuales')
            .update({ estado: 'cancelado' })
            .eq('id', reservaId)
            .eq('socio_id', socioId)
            .select();

        if (error) throw error;
        if (!data || !data.length) {
            return { success: false, message: 'No se encontro un pedido activo para este socio.' };
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error al cancelar reserva:', error.message);
        return { success: false, message: error.message };
    }
}

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

async function obtenerNoticias() {
    try {
        const { data, error } = await supabaseClient
            .from('noticias')
            .select('*')
            .order('fecha_publicacion', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error en noticias:', error.message);
        return [];
    }
}

async function obtenerProductos() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error en productos:', error.message);
        return [];
    }
}

async function obtenerActividades() {
    try {
        const { data, error } = await supabaseClient
            .from('actividades')
            .select('*')
            .order('fecha', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error en actividades:', error.message);
        return [];
    }
}

async function solicitarMembresia(datos) {
    try {
        const telefono = typeof normalizarTelefonoAuth === 'function'
            ? normalizarTelefonoAuth(datos.telefono)
            : datos.telefono;
        const payload = {
            nombre: datos.nombre,
            apellido: datos.apellido,
            cedula: datos.cedula || `pendiente-${String(telefono || '').replace(/[^\d]/g, '')}`,
            telefono,
            email: datos.email || null,
            mensaje: datos.mensaje || null,
            tipo_registro: datos.tipo_registro || null
        };
        let { data, error } = await supabaseClient
            .from('solicitudes_membresia')
            .insert([payload]);

        if (error && /tipo_registro|schema cache|column/i.test(error.message || '')) {
            const { tipo_registro, ...payloadFallback } = payload;
            const fallback = await supabaseClient
                .from('solicitudes_membresia')
                .insert([{
                    ...payloadFallback,
                    mensaje: [
                        payloadFallback.mensaje,
                        tipo_registro ? `Registro: ${tipo_registro}` : ''
                    ].filter(Boolean).join('\n')
                }]);
            data = fallback.data;
            error = fallback.error;
        }
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// AUTENTICACIÓN CON EMAIL (NUEVO)
// ============================================

// Login con Email (envía código OTP)
async function loginConEmail(email) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOtp({
            email: email,
        });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al enviar código por email:', error.message);
        return { success: false, error };
    }
}

// Verificar código de Email
async function verificarEmail(email, codigo) {
    try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
            email: email,
            token: codigo,
            type: 'email'
        });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al verificar código:', error.message);
        return { success: false, error };
    }
}

async function enviarEnlaceRecuperacionPassword(email) {
    try {
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email);
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al enviar enlace de recuperación:', error.message);
        return { success: false, error };
    }
}

function normalizarTelefonoAuth(telefono) {
    const limpio = String(telefono || '').replace(/[^\d+]/g, '').trim();
    const digitos = limpio.replace(/[^\d]/g, '');
    if (limpio.startsWith('+598')) return limpio;
    if (digitos.startsWith('598') && digitos.length === 11) return `+${digitos}`;
    if (digitos.startsWith('09') && digitos.length === 9) return `+598${digitos.slice(1)}`;
    if (digitos.startsWith('9') && digitos.length === 8) return `+598${digitos}`;
    return limpio;
}

async function loginConTelefonoPassword(telefono, password) {
    try {
        if (!supabaseClient) throw supabaseInitError || new Error('Configuracion de Supabase no disponible.');
        const phone = normalizarTelefonoAuth(telefono);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            phone,
            password
        });

        if (error) throw error;
        const refreshEstabaBloqueado = supabaseSessionCheckBlocked;
        supabaseSessionCheckBlocked = false;
        publicarEstadoAuthSupabase(null);
        if (refreshEstabaBloqueado) supabaseClient.auth.startAutoRefresh();
        return { success: true, data };
    } catch (error) {
        console.error('Error al iniciar sesion con telefono:', error.message);
        const diagnostic = clasificarErrorSupabase(error, { operacion: 'login' });
        publicarEstadoAuthSupabase(diagnostic);
        return { success: false, error, diagnostic, message: diagnostic.message };
    }
}

async function cambiarPasswordActual(passwordActual, nuevaPassword) {
    try {
        const usuario = await obtenerUsuarioActual();
        const telefono = appState?.socioData?.telefono || '';

        if (!usuario || !telefono) {
            return { success: false, error: 'No se pudo validar la sesión actual.' };
        }

        const reauth = await loginConTelefonoPassword(telefono, passwordActual);
        if (!reauth.success) {
            return { success: false, error: 'La contraseña actual no es válida.' };
        }

        if (reauth.data?.user?.id && reauth.data.user.id !== usuario.id) {
            return { success: false, error: 'No se pudo validar la sesión actual.' };
        }

        const { data, error } = await supabaseClient.auth.updateUser({ password: nuevaPassword });
        if (error) throw error;
        return { success: true, data };
    } catch (_error) {
        return { success: false, error: 'No se pudo actualizar la contraseña.' };
    }
}

async function marcarPasswordCambiada() {
    try {
        const { data, error } = await supabaseClient.rpc('mark_password_changed');
        if (error) throw error;
        appState.socioData = {
            ...appState.socioData,
            debe_cambiar_password: false,
            password_temporal: false,
            password_changed_at: new Date().toISOString()
        };
        return { success: true, data };
    } catch (error) {
        console.error('No se pudo marcar la contraseña como cambiada:', error.message);
        return { success: false, error: error.message };
    }
}

async function cambiarPasswordTemporal(nuevaPassword) {
    try {
        const { data, error } = await supabaseClient.auth.updateUser({ password: nuevaPassword });
        if (error) throw error;
        const marcado = await marcarPasswordCambiada();
        if (!marcado.success) return marcado;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message || 'No se pudo actualizar la contraseña.' };
    }
}

// Obtener usuario actual (sesión activa)
async function obtenerUsuarioActual() {
    const teniaSesionLocal = haySesionLocalSupabase();
    if (!supabaseClient) {
        publicarEstadoAuthSupabase(clasificarErrorSupabase(
            supabaseInitError || new Error('Configuracion de Supabase no disponible.'),
            { operacion: 'sesion', teniaSesionLocal }
        ));
        return null;
    }
    if (supabaseSessionCheckBlocked) return null;

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        publicarEstadoAuthSupabase(null);
        return user;
    } catch (error) {
        if (error?.message === 'Auth session missing!' && !teniaSesionLocal) {
            publicarEstadoAuthSupabase(null);
            return null;
        }
        const diagnostic = clasificarErrorSupabase(error, {
            operacion: 'refresh',
            teniaSesionLocal
        });
        publicarEstadoAuthSupabase(diagnostic);
        if (diagnostic.code.startsWith('refresh_') || diagnostic.code === 'sesion_vieja') {
            supabaseSessionCheckBlocked = true;
            detenerRefreshAutomaticoSupabase();
        }
        if (error?.message !== 'Auth session missing!') {
            console.error('Error al obtener usuario:', error.message);
        }
        return null;
    }
}

// Cerrar sesión
async function cerrarSesion() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error al cerrar sesión:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// FUNCIONES PARA SOCIOS (PANEL)
// ============================================

// Obtener socio por ID de Supabase Auth
async function obtenerSocioPorAuthId(authUserId) {
    try {
        const { data, error } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.warn('No se pudo obtener socio por Auth ID:', error.message);
        return { success: false, error: error.message };
    }
}

// Obtener socio por email
async function obtenerSocioPorEmail(email) {
    try {
        const { data, error } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al obtener socio:', error.message);
        return { success: false, error: error.message };
    }
}

// Obtener reservas de un socio
async function obtenerReservas(socioId) {
    try {
        const { data, error } = await supabaseClient
            .from('reservas_mensuales')
            .select('*')
            .eq('socio_id', socioId)
            .order('fecha_retiro', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error al obtener reservas:', error.message);
        return [];
    }
}

// Confirmar reserva
async function confirmarReserva(socioId, gramos, tipo, fechaRetiro, producto = null) {
    try {
        if (!producto?.id) {
            return { success: false, message: 'El pedido debe tener una variedad seleccionada.' };
        }
        const fechaReserva = new Date(fechaRetiro);
        const reserva = {
            socio_id: socioId,
            mes: fechaReserva.getMonth() + 1,
            ['a\u00f1o']: fechaReserva.getFullYear(),
            cantidad_gramos: gramos,
            fecha_retiro: fechaRetiro,
            tipo_entrega: tipo === 'primer' ? 'primer_jueves' : 'ultimo_jueves',
            fecha_confirmacion: new Date(),
            estado: 'pendiente',
            producto_id: producto.id,
            producto_nombre: producto.nombre || null
        };
        const { data, error } = await supabaseClient
            .from('reservas_mensuales')
            .insert([reserva]);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al confirmar reserva:', error.message);
        return { success: false, message: error.message };
    }
}

async function modificarReserva(reservaId, socioId, cambios = {}) {
    try {
        const payload = { estado: 'pendiente' };
        if (Number.isFinite(Number(cambios.gramos))) payload.cantidad_gramos = Number(cambios.gramos);
        if (cambios.producto) {
            payload.producto_id = cambios.producto.id || null;
            payload.producto_nombre = cambios.producto.nombre || null;
        }
        let { data, error } = await supabaseClient
            .from('reservas_mensuales')
            .update(payload)
            .eq('id', reservaId)
            .eq('socio_id', socioId)
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al modificar reserva:', error.message);
        return { success: false, message: error.message };
    }
}

// ============================================
// AUTENTICACIÓN CON WHATSAPP (MANTENIDA)
// ============================================

async function loginConWhatsapp(telefono) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOtp({
            phone: telefono,
        });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function verificarCodigo(telefono, codigo) {
    try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
            phone: telefono,
            token: codigo,
            type: 'sms'
        });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function obtenerImagenesProducto(productoId) {
    const { data } = await supabaseClient.from('productos_imagenes').select('*').eq('producto_id', productoId).order('orden');
    return data || [];
}
async function agregarImagenProducto(productoId, imagenUrl, orden = 0) {
    return await supabaseClient.from('productos_imagenes').insert([{ producto_id: productoId, imagen_url: imagenUrl, orden }]);
}
async function eliminarImagenProducto(imagenId) {
    return await supabaseClient.from('productos_imagenes').delete().eq('id', imagenId);
}
window.obtenerImagenesProducto = obtenerImagenesProducto;
window.agregarImagenProducto = agregarImagenProducto;
window.eliminarImagenProducto = eliminarImagenProducto;

// ============================================
// EXPORTAR FUNCIONES
// ============================================

// Funciones públicas
window.supabaseClient = supabaseClient;
window.obtenerNoticias = obtenerNoticias;
window.obtenerProductos = obtenerProductos;
window.obtenerActividades = obtenerActividades;
window.solicitarMembresia = solicitarMembresia;

// Autenticación principal
window.loginConEmail = loginConEmail;
window.verificarEmail = verificarEmail;
window.enviarEnlaceRecuperacionPassword = enviarEnlaceRecuperacionPassword;
window.loginConTelefonoPassword = loginConTelefonoPassword;
window.cambiarPasswordActual = cambiarPasswordActual;
window.cambiarPasswordTemporal = cambiarPasswordTemporal;
window.marcarPasswordCambiada = marcarPasswordCambiada;
window.normalizarTelefonoAuth = normalizarTelefonoAuth;
window.obtenerUsuarioActual = obtenerUsuarioActual;
window.cerrarSesion = cerrarSesion;
window.clasificarErrorSupabase = clasificarErrorSupabase;
window.limpiarSesionLocalSupabase = limpiarSesionLocalSupabase;
window.haySesionLocalSupabase = haySesionLocalSupabase;

// Funciones para socio
window.obtenerSocioPorAuthId = obtenerSocioPorAuthId;
window.obtenerSocioPorEmail = obtenerSocioPorEmail;
window.obtenerReservas = obtenerReservas;
window.confirmarReserva = confirmarReserva;
window.modificarReserva = modificarReserva;
window.cancelarReserva = cancelarReserva;

// Autenticación WhatsApp (mantenida)
window.loginConWhatsapp = loginConWhatsapp;
window.verificarCodigo = verificarCodigo;

// ============================================
// FUNCIONES PARA CALIFICACIONES
// ============================================

async function obtenerCalificacionesProducto(productoId) {
    try {
        const { data, error } = await supabaseClient
            .from('calificaciones_productos')
            .select('puntuacion')
            .eq('producto_id', productoId);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error al obtener calificaciones:', error);
        return [];
    }
}

async function obtenerCalificacionUsuario(productoId, socioId) {
    try {
        const { data, error } = await supabaseClient
            .from('calificaciones_productos')
            .select('puntuacion')
            .eq('producto_id', productoId)
            .eq('socio_id', socioId)
            .maybeSingle();
        if (error) throw error;
        return data?.puntuacion || null;
    } catch (error) {
        return null;
    }
}

async function calificarProducto(productoId, socioId, puntuacion) {
    try {
        const { data, error } = await supabaseClient
            .from('calificaciones_productos')
            .upsert(
                { producto_id: productoId, socio_id: socioId, puntuacion: puntuacion },
                { onConflict: 'producto_id,socio_id' }
            );
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function calcularPromedioEstrellas(calificaciones) {
    if (!calificaciones || calificaciones.length === 0) return 0;
    const suma = calificaciones.reduce((acc, c) => acc + c.puntuacion, 0);
    return suma / calificaciones.length;
}

function renderizarEstrellas(promedio, totalCalificaciones = 0) {
    const estrellasLlenas = Math.round(promedio);
    let html = '<div class="producto-estrellas">';
    for (let i = 1; i <= 5; i++) {
        html += `<i class="fas fa-star" style="color: ${i <= estrellasLlenas ? '#FFD700' : '#555'};"></i>`;
    }
    if (totalCalificaciones > 0) {
        html += `<span style="color:#111111;">(${promedio.toFixed(1)})</span>`;
    }
    html += '</div>';
    return html;
}

// Exportar
window.obtenerCalificacionesProducto = obtenerCalificacionesProducto;
window.obtenerCalificacionUsuario = obtenerCalificacionUsuario;
window.calificarProducto = calificarProducto;
window.calcularPromedioEstrellas = calcularPromedioEstrellas;
window.renderizarEstrellas = renderizarEstrellas;
