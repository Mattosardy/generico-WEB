// Global shared state for the front-end app.
window.configSistema = {
    horasLimitePrimer: 48,
    horasLimiteUltimo: 48,
    fechaEntregaPrimer: '',
    fechaEntregaUltimo: ''
};

window.defaultHistoriaVideoUrl = '';
window.defaultHistoriaImagenUrl = 'assets/images/home_inst.png';
window.TELEGRAM_BOT_USERNAME = 'GenericoWeb_bot';
window.GOOGLE_CALENDAR_EMBED_URL = '';

// Feature flags comerciales controlados por el proveedor/deploy, no por Supabase del club.
window.GENERICO_PLAN = {
    plusActivo: true,
    planPlusTitulo: 'Articulos destacados'
};

window.GENERICO_ADMIN_EMAILS = [
    'admin@generico.local'
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
