// ============================================
// SUPABASE CLIENT - CURURÚ CLUB
// VERSIÓN CON LOGIN POR EMAIL
// ============================================

const SUPABASE_URL = 'https://qjiqbcokhlwisxbeplym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaXFiY29raGx3aXN4YmVwbHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTc3MjgsImV4cCI6MjA5MDI3MzcyOH0._bRZjYV1Ly30T-g4zuI7GNNTRnZtnD9HTamojbP3xnY';
const SUPABASE_PROJECT_REF = 'qjiqbcokhlwisxbeplym';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        console.warn('No se pudo limpiar la sesiÃ³n local de Supabase:', error);
    }
}

// ============================================
// PRUEBA DE CONEXIÓN
// ============================================

async function testConexion() {
    console.log('🔌 Probando conexión con Supabase...');
    
    try {
        const { data, error } = await supabaseClient
            .from('noticias')
            .select('*')
            .limit(3);
        
        if (error) throw error;
        
        console.log('✅ Conexión exitosa!');
        console.log('📰 Noticias:', data);
        return true;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
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
async function confirmarReserva(socioId, gramos, tipo, fechaRetiro) {
    try {
        const fechaReserva = new Date(fechaRetiro);
        const reserva = {
            socio_id: socioId,
            mes: fechaReserva.getMonth() + 1,
            año: fechaReserva.getFullYear(),
            cantidad_gramos: gramos,
            fecha_retiro: fechaRetiro,
            tipo_entrega: tipo === 'primer' ? 'primer_jueves' : 'ultimo_jueves',
            fecha_confirmacion: new Date(),
            estado: 'confirmado'
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

// ============================================
// AUTENTICACIÓN CON WHATSAPP (MANTENIDA)
// ============================================

// Cambio funcional solicitado: cancelar solo reservas propias y solo mientras siga abierto el plazo de reserva.
async function cancelarReserva(reservaId, socioId) {
    try {
        const { data: reservaActual, error: loadError } = await supabaseClient
            .from('reservas_mensuales')
            .select('*')
            .eq('id', reservaId)
            .eq('socio_id', socioId)
            .single();

        if (loadError) throw loadError;
        if (!reservaActual || reservaActual.estado === 'cancelado') {
            return { success: false, message: 'La reserva no está activa.' };
        }

        const fechaRetiro = new Date(reservaActual.fecha_retiro);
        const horasLimite = reservaActual.tipo_entrega === 'primer_jueves'
            ? configSistema.horasLimitePrimer
            : configSistema.horasLimiteUltimo;

        if (!puedeConfirmar(fechaRetiro, horasLimite)) {
            return { success: false, message: 'El plazo para cancelar esta reserva ya venció.' };
        }

        const { data, error } = await supabaseClient
            .from('reservas_mensuales')
            .update({ estado: 'cancelado' })
            .eq('id', reservaId)
            .eq('socio_id', socioId)
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error al cancelar reserva:', error.message);
        return { success: false, message: error.message };
    }
}

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
window.testConexion = testConexion;
window.obtenerNoticias = obtenerNoticias;
window.obtenerProductos = obtenerProductos;
window.obtenerActividades = obtenerActividades;
window.solicitarMembresia = solicitarMembresia;

// Autenticación email (NUEVAS)
window.loginConEmail = loginConEmail;
window.verificarEmail = verificarEmail;
window.enviarEnlaceRecuperacionPassword = enviarEnlaceRecuperacionPassword;
window.obtenerUsuarioActual = obtenerUsuarioActual;
window.cerrarSesion = cerrarSesion;

// Funciones para socio
window.obtenerSocioPorEmail = obtenerSocioPorEmail;
window.obtenerReservas = obtenerReservas;
window.confirmarReserva = confirmarReserva;
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




console.log('🚀 Cururú Club - Client listo (con login por email)');
