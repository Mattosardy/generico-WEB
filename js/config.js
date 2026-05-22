// Global shared state for the front-end app.
window.configSistema = {
    horasLimitePrimer: 48,
    horasLimiteUltimo: 48,
    fechaEntregaPrimer: '',
    fechaEntregaUltimo: ''
};

window.defaultHistoriaVideoUrl = `${window.SUPABASE_URL}/storage/v1/object/public/noticias/historia_video_1776899904368_g07gbj3gkwn.mp4`;
window.TELEGRAM_BOT_USERNAME = 'Cururuclub_bot';

// Feature flags comerciales controlados por el proveedor/deploy, no por Supabase del club.
window.CURURU_PLAN = {
    plusActivo: true,
    planPlusTitulo: 'Artículos destacados'
};

window.CURURU_ADMIN_EMAILS = [
    'admin@cururu.com'
];

window.appState = {
    usuarioActual: null,
    rolUsuario: 'invitado',
    socioData: null,
    fechasEntrega: null,
    productoEditandoId: null,
    productoModalActual: null,
    gramosSeleccionadosPedido: null,
    reservaEditandoId: null,
    reservaEditandoTipo: null,
    reservaEditandoGramos: 0,
    galeriaActual: { imagenes: [], indice: 0, productoId: null },
    historiaGaleria: [],
    historiaVideoActual: window.defaultHistoriaVideoUrl,
    noticiaGaleriaActual: { imagenes: [], indice: 0 },
    cicloClubActual: null,
    gramosReservadosCiclo: 0,
    gramosRestantesCiclo: 40,
    reservasActivasCount: 0,
    historialRetiradoCount: 0,
    reservasChart: null,
    sociosChart: null,
    configWhatsApp: { phoneNumberId: null, accessToken: null },
    configTelegram: { botUsername: window.TELEGRAM_BOT_USERNAME },
    telegramSecurity: {
        deviceId: null,
        deviceName: '',
        verified: false,
        required: false,
        pending: false,
        expiresAt: null
    },
    configMap: {}
};
