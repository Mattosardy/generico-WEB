// Global shared state for the front-end app.
window.configSistema = {
    horasLimitePrimer: 48,
    horasLimiteUltimo: 48,
    fechaEntregaPrimer: '',
    fechaEntregaUltimo: ''
};

window.defaultHistoriaVideoUrl = 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/noticias/historia_video_1776899904368_g07gbj3gkwn.mp4';
window.TELEGRAM_BOT_USERNAME = 'Cururuclub_bot';

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
    configMap: {}
};
