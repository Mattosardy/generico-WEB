// ============================================
// SUPABASE CLIENT - CURURÚ CLUB
// VERSIÓN CON LOGIN POR EMAIL
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
        throw new Error('SUPABASE_URL invalida. Verificar variables de entorno del servidor.');
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

const supabaseEnv = resolverSupabaseEnv();
SUPABASE_URL = supabaseEnv.url;
SUPABASE_ANON_KEY = supabaseEnv.anonKey;
SUPABASE_PROJECT_REF = supabaseEnv.projectRef;

window.SUPABASE_URL = SUPABASE_URL;

supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

function errorEsRefreshTokenInvalido(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    return mensaje.includes('invalid refresh token') || mensaje.includes('refresh token not found');
}

function limpiarSesionLocalSupabase() {
    if (typeof localStorage === 'undefined') return;
    try {
        const prefijo = `sb-${SUPABASE_PROJECT_REF}-`;
        Object.keys(localStorage).forEach((clave) => {
            if (clave.startsWith(prefijo)) localStorage.removeItem(clave);
        });
    } catch (error) {
        console.warn('No se pudo limpiar la sesión local de Supabase:', error);
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
        const { data, error } = await supabaseClient
            .from('solicitudes_membresia')
            .insert([{
                nombre: datos.nombre,
                apellido: datos.apellido,
                cedula: datos.cedula,
                telefono: datos.telefono,
                email: datos.email || null,
                mensaje: datos.mensaje || null
            }]);
        
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
        const phone = normalizarTelefonoAuth(telefono);
        const { data: emailTecnico, error: rpcError } = await supabaseClient.rpc('get_login_email_by_phone', {
            p_phone: phone
        });

        if (rpcError) throw rpcError;
        if (!emailTecnico) throw new Error('Telefono o contrasena incorrectos');

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailTecnico,
            password
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al iniciar sesion con telefono:', error.message);
        return { success: false, error };
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
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        if (errorEsRefreshTokenInvalido(error)) {
            limpiarSesionLocalSupabase();
            return null;
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
            año: fechaReserva.getFullYear(),
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

// Funciones para socio
window.obtenerSocioPorAuthId = obtenerSocioPorAuthId;
window.obtenerSocioPorEmail = obtenerSocioPorEmail;
window.obtenerReservas = obtenerReservas;
window.confirmarReserva = confirmarReserva;
window.modificarReserva = modificarReserva;

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
