const GENERICO_TOUR_KEYS = {
    socio: 'generico_tour_socio_done',
    admin: 'generico_tour_admin_done'
};

const GENERICO_TOUR_INTRO = {
    title: 'Bienvenido a la app',
    text: 'Primero activa Telegram desde el menu: el bot vincula tu numero, envia codigos de seguridad y habilita el cambio de contrasena. Despues podes instalar la app: Android en Chrome con Instalar app; iPhone/iPad en Safari con Compartir y Agregar a pantalla de inicio.'
};

const GENERICO_TOUR_STEPS = {
    socio: [
        {
            selector: '#telegramLinkPanel',
            section: 'menu',
            title: 'Telegram del club',
            text: 'Activa Telegram antes de seguir usando la app. Ahi recibis codigos de seguridad, avisos y novedades importantes.'
        },
        {
            selector: '#telegramSecurityPanel',
            section: 'actividades',
            title: 'Verificacion del dispositivo',
            text: 'Cuando el sistema detecta un dispositivo nuevo, ingresa el codigo recibido por Telegram para confirmar que sos vos.'
        },
        {
            selector: '#productos',
            section: 'productos',
            title: 'Reservas por packs',
            text: 'El cupo mensual de variedades lo define el maestro. El minimo disponible por variedad es 1 pack (20g de producto).'
        },
        {
            selector: '#carrito',
            section: 'carrito',
            title: 'Carrito',
            text: 'En Carrito podes revisar tus pedidos del ciclo actual sin abrir ventanas extra.'
        },
        {
            selector: '#reservasActividadCalendar',
            section: 'actividades',
            action: 'calendar',
            title: 'Calendario y reservas',
            text: 'En Agenda y pedidos podes ver fechas de retiro, novedades y el estado de tus reservas.'
        },
        {
            selector: '#miCuentaPanel',
            section: 'actividades',
            title: 'Cuenta segura',
            text: 'Desde Mi cuenta podes actualizar tu contrasena cuando necesites reforzar el acceso.'
        }
    ],
    admin: [
        {
            selector: '[data-admin-section="productos"]',
            section: 'admin',
            adminSection: 'productos',
            title: 'Agregar variedad',
            text: 'En Variedades podes crear productos, editar datos principales y mantener el catalogo ordenado.'
        },
        {
            selector: '#admin-productos',
            section: 'admin',
            adminSection: 'productos',
            title: 'Precio y stock',
            text: 'Carga precio, disponibilidad en packs, umbral de bajo stock y estado visible de cada variedad.'
        },
        {
            selector: '#admin-productos input[type="file"]',
            section: 'admin',
            adminSection: 'productos',
            title: 'Fotos limpias',
            text: 'Al subir imagenes, el sistema elimina metadatos EXIF/GPS antes de guardarlas.'
        },
        {
            selector: '[data-admin-section="actividades"]',
            section: 'admin',
            adminSection: 'actividades',
            title: 'Novedades',
            text: 'Publica novedades y actividades para mantener informados a los socios.'
        },
        {
            selector: '[data-admin-section="reservasAdmin"]',
            section: 'admin',
            adminSection: 'reservasAdmin',
            title: 'Reservas',
            text: 'Revisa pedidos mensuales, estados de entrega y seguimiento operativo.'
        },
        {
            selector: '[data-admin-section="mensajes"]',
            section: 'admin',
            adminSection: 'mensajes',
            title: 'Telegram',
            text: 'Usa Mensajes para revisar la bandeja y cargar avisos controlados por Telegram.'
        },
        {
            selector: '#admin-productos',
            section: 'admin',
            adminSection: 'productos',
            title: 'Articulos destacados',
            text: 'Si Plan Plus esta activo, tambien podes administrar articulos destacados para la pagina inicial.'
        }
    ]
};

const genericoTourState = {
    role: null,
    stepIndex: 0,
    steps: [],
    manual: false,
    introActive: false,
    active: false,
    renderToken: 0
};

function genericoTourDelay(ms = 80) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function genericoTourRole() {
    const rol = String(window.appState?.rolUsuario || '').toLowerCase();
    if (rol === 'admin') return 'admin';
    if (rol === 'socio') return 'socio';
    return '';
}

function genericoTourKey(role) {
    return GENERICO_TOUR_KEYS[role] || '';
}

function genericoTourSessionKey(role) {
    if (!role) return '';
    const user = window.appState?.usuarioActual || {};
    const userKey = String(user.id || user.email || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
    const loginKey = String(user.last_sign_in_at || user.created_at || 'active').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `generico_tour_${role}_${userKey}_${loginKey}_prompted_session`;
}

function genericoTourVisibleSteps(role) {
    const steps = GENERICO_TOUR_STEPS[role] || [];
    if (role !== 'admin') return steps;
    const plusActivo = Boolean(window.GENERICO_PLAN?.plusActivo);
    return plusActivo ? steps : steps.filter((step) => !step.title.toLowerCase().includes('articulos'));
}

function genericoTourEnsureElements() {
    if (!document.getElementById('genericoTourRoot')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="genericoTourRoot" class="tour-root" hidden>
                <div class="tour-scrim" data-tour-close></div>
                <section class="tour-popover" role="dialog" aria-live="polite" aria-modal="false" aria-labelledby="tourTitle">
                    <button type="button" class="tour-close" data-tour-close aria-label="Cerrar guia">&times;</button>
                    <span class="tour-step-label" id="tourStepLabel"></span>
                    <h3 id="tourTitle"></h3>
                    <p id="tourText"></p>
                    <div class="tour-actions">
                        <button type="button" class="tour-secondary" id="tourPrev">Anterior</button>
                        <button type="button" class="tour-secondary" id="tourSkip">No volver a mostrar</button>
                        <button type="button" class="tour-primary" id="tourNext">Siguiente</button>
                    </div>
                </section>
            </div>
        `);

        document.getElementById('tourPrev')?.addEventListener('click', genericoTourPrev);
        document.getElementById('tourNext')?.addEventListener('click', genericoTourNext);
        document.getElementById('tourSkip')?.addEventListener('click', genericoTourDismissForever);
        document.querySelectorAll('[data-tour-close]').forEach((el) => {
            el.addEventListener('click', genericoTourClose);
        });
        document.addEventListener('keydown', (event) => {
            if (!genericoTourState.active) return;
            if (event.key === 'Escape') genericoTourClose();
            if (event.key === 'ArrowRight') genericoTourNext();
            if (event.key === 'ArrowLeft') genericoTourPrev();
        });
    }
}

function genericoTourTargetForStep(step) {
    if (!step?.selector) return null;
    const target = document.querySelector(step.selector);
    if (!target || target.offsetParent === null) return null;
    return target;
}

function genericoTourIsVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && element.offsetParent !== null;
}

async function genericoTourOpenAccordionPanel(tipoCultivo) {
    const toggle = document.querySelector(`.productos-toggle[data-tipo-cultivo="${tipoCultivo}"]`);
    const panel = document.querySelector(`.productos-panel[data-tipo-cultivo="${tipoCultivo}"]`);
    if (!toggle || !panel) return;
    if (toggle.getAttribute('aria-expanded') !== 'true' || panel.hidden) toggle.click();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.closest('.productos-columna')?.classList.add('activa');
    await genericoTourDelay(160);
}

async function genericoTourPrepareStep(step) {
    if (!step) return;
    try {
        if (step.section && typeof mostrarSeccion === 'function') {
            await mostrarSeccion(step.section);
        }

        if (step.adminSection) {
            await genericoTourDelay(80);
            const button = document.querySelector(`[data-admin-section="${step.adminSection}"]`);
            const panel = document.getElementById(`admin-${step.adminSection}`);
            const panelVisible = panel && panel.style.display !== 'none';
            if (button && !panelVisible) button.click();
        }

        if (step.action === 'calendar') {
            if (typeof cargarReservasSocio === 'function') {
                await cargarReservasSocio();
            }
            await genericoTourOpenAccordionPanel('actividades-calendario');
            const target = document.querySelector(step.selector);
            if (!genericoTourIsVisible(target)) {
                await genericoTourOpenAccordionPanel('actividades-calendario');
            }
        }
    } catch (error) {
        console.warn('No se pudo preparar el paso de la guia:', error);
    }

    await genericoTourDelay(120);
}

function genericoTourClearHighlight() {
    document.querySelectorAll('.tour-highlight').forEach((el) => el.classList.remove('tour-highlight'));
}

function genericoTourPlacePopover(target) {
    const popover = document.querySelector('.tour-popover');
    if (!popover) return;
    popover.classList.remove('tour-popover-top', 'tour-popover-bottom', 'tour-popover-mobile', 'tour-popover-centered');
    popover.style.removeProperty('--tour-top');
    popover.style.removeProperty('--tour-left');
    popover.style.removeProperty('--tour-bottom');
    popover.style.removeProperty('--tour-transform');
    popover.style.removeProperty('--tour-max-height');

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = viewportWidth < 720 ? 12 : 20;

    if (viewportWidth < 720) {
        popover.classList.add('tour-popover-mobile');
        popover.style.setProperty('--tour-left', `${margin}px`);
        popover.style.setProperty('--tour-bottom', `calc(${margin}px + env(safe-area-inset-bottom))`);
        popover.style.setProperty('--tour-max-height', `${Math.max(220, viewportHeight - (margin * 2))}px`);
        popover.style.setProperty('--tour-transform', 'none');
        return;
    }

    popover.style.setProperty('--tour-max-height', `${Math.max(240, viewportHeight - (margin * 2))}px`);
    const measured = popover.getBoundingClientRect();
    const popoverWidth = Math.min(Math.max(measured.width || 360, 320), viewportWidth - (margin * 2));
    const popoverHeight = Math.min(measured.height || 260, viewportHeight - (margin * 2));

    if (!target) {
        popover.classList.add('tour-popover-centered');
        popover.style.setProperty('--tour-left', `${Math.max(margin, (viewportWidth - popoverWidth) / 2)}px`);
        popover.style.setProperty('--tour-top', `${Math.max(margin, (viewportHeight - popoverHeight) / 2)}px`);
        popover.style.setProperty('--tour-transform', 'none');
        return;
    }

    const rect = target.getBoundingClientRect();
    const gap = 14;
    const spaces = {
        right: viewportWidth - rect.right - gap - margin,
        left: rect.left - gap - margin,
        below: viewportHeight - rect.bottom - gap - margin,
        above: rect.top - gap - margin
    };

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    let top = rect.bottom + gap;

    if (spaces.below >= popoverHeight) {
        top = rect.bottom + gap;
        popover.classList.add('tour-popover-bottom');
    } else if (spaces.above >= popoverHeight) {
        top = rect.top - popoverHeight - gap;
        popover.classList.add('tour-popover-top');
    } else if (spaces.right >= popoverWidth) {
        left = rect.right + gap;
        top = rect.top + rect.height / 2 - popoverHeight / 2;
    } else if (spaces.left >= popoverWidth) {
        left = rect.left - popoverWidth - gap;
        top = rect.top + rect.height / 2 - popoverHeight / 2;
    } else {
        popover.classList.add('tour-popover-centered');
        left = (viewportWidth - popoverWidth) / 2;
        top = (viewportHeight - popoverHeight) / 2;
    }

    left = Math.min(Math.max(margin, left), viewportWidth - popoverWidth - margin);
    top = Math.min(Math.max(margin, top), viewportHeight - popoverHeight - margin);
    popover.style.setProperty('--tour-left', `${left}px`);
    popover.style.setProperty('--tour-top', `${top}px`);
    popover.style.setProperty('--tour-transform', 'none');
}

async function genericoTourRender() {
    genericoTourEnsureElements();
    const token = Date.now();
    genericoTourState.renderToken = token;
    const root = document.getElementById('genericoTourRoot');
    const title = document.getElementById('tourTitle');
    const text = document.getElementById('tourText');
    const label = document.getElementById('tourStepLabel');
    const prev = document.getElementById('tourPrev');
    const next = document.getElementById('tourNext');
    const skip = document.getElementById('tourSkip');
    if (!root || !title || !text || !label || !prev || !next || !skip) return;

    const total = genericoTourState.steps.length;
    if (genericoTourState.introActive) {
        genericoTourClearHighlight();
        label.textContent = 'Visita guiada';
        title.textContent = GENERICO_TOUR_INTRO.title;
        text.textContent = GENERICO_TOUR_INTRO.text;
        prev.hidden = true;
        skip.textContent = 'No volver a mostrar';
        next.textContent = 'Iniciar tour';
        root.hidden = false;
        genericoTourState.active = true;
        window.setTimeout(() => genericoTourPlacePopover(null), 80);
        return;
    }

    const step = genericoTourState.steps[genericoTourState.stepIndex];
    if (!step) {
        genericoTourClose();
        return;
    }

    await genericoTourPrepareStep(step);
    if (genericoTourState.renderToken !== token) return;

    genericoTourClearHighlight();
    const target = genericoTourTargetForStep(step);
    if (target) {
        target.classList.add('tour-highlight');
        target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        await genericoTourDelay(80);
    }

    label.textContent = `Paso ${genericoTourState.stepIndex + 1} de ${total}`;
    title.textContent = step.title;
    text.textContent = step.text;
    prev.hidden = false;
    prev.disabled = genericoTourState.stepIndex === 0;
    skip.textContent = 'No volver a mostrar';
    next.textContent = genericoTourState.stepIndex === total - 1 ? 'Finalizar' : 'Siguiente';
    root.hidden = false;
    genericoTourState.active = true;

    window.setTimeout(() => genericoTourPlacePopover(genericoTourTargetForStep(step)), 80);
}

function genericoTourOpen(role = genericoTourRole(), options = {}) {
    if (!role || !GENERICO_TOUR_KEYS[role]) return;
    const steps = genericoTourVisibleSteps(role);
    if (!steps.length) return;
    const sessionKey = genericoTourSessionKey(role);
    if (sessionKey) sessionStorage.setItem(sessionKey, 'true');
    genericoTourState.role = role;
    genericoTourState.steps = steps;
    genericoTourState.stepIndex = 0;
    genericoTourState.manual = Boolean(options.manual);
    genericoTourState.introActive = options.intro !== false;
    genericoTourState.active = true;
    void genericoTourRender();
}

function genericoTourClose() {
    const root = document.getElementById('genericoTourRoot');
    if (root) root.hidden = true;
    genericoTourState.active = false;
    genericoTourState.introActive = false;
    genericoTourClearHighlight();
}

function genericoTourPrev() {
    if (genericoTourState.stepIndex <= 0) return;
    genericoTourState.stepIndex -= 1;
    void genericoTourRender();
}

function genericoTourNext() {
    if (genericoTourState.introActive) {
        genericoTourState.introActive = false;
        genericoTourState.stepIndex = 0;
        void genericoTourRender();
        return;
    }
    if (genericoTourState.stepIndex >= genericoTourState.steps.length - 1) {
        genericoTourClose();
        return;
    }
    genericoTourState.stepIndex += 1;
    void genericoTourRender();
}

function genericoTourDismissForever() {
    const key = genericoTourKey(genericoTourState.role);
    if (key) localStorage.setItem(key, 'true');
    genericoTourClose();
}

function genericoTourMaybeShow(role = genericoTourRole()) {
    if (!role || !GENERICO_TOUR_KEYS[role]) return;
    if (genericoTourState.active) return;
    if (localStorage.getItem(genericoTourKey(role)) === 'true') return;
    const sessionKey = genericoTourSessionKey(role);
    if (sessionKey && sessionStorage.getItem(sessionKey) === 'true') return;
    if (sessionKey) sessionStorage.setItem(sessionKey, 'true');
    window.setTimeout(() => genericoTourOpen(role), 500);
}

function genericoTourEnsureButtons() {
    const socioDashboard = document.getElementById('socioDashboard');
    if (socioDashboard && !socioDashboard.querySelector('[data-tour-open="socio"]')) {
        socioDashboard.insertAdjacentHTML('afterbegin', `
            <div class="tour-panel-action">
                <button type="button" class="tour-open-btn" data-tour-open="socio">
                    <i class="fas fa-route"></i> Ver gu&iacute;a
                </button>
            </div>
        `);
    }

    const admin = document.getElementById('admin');
    const adminTitle = admin?.querySelector('.section-title');
    if (adminTitle && !admin.querySelector('[data-tour-open="admin"]')) {
        adminTitle.insertAdjacentHTML('afterend', `
            <div class="tour-panel-action tour-panel-action-admin">
                <button type="button" class="tour-open-btn" data-tour-open="admin">
                    <i class="fas fa-route"></i> Ver gu&iacute;a
                </button>
            </div>
        `);
    }

    document.querySelectorAll('[data-tour-open]:not([data-tour-bound])').forEach((button) => {
        button.dataset.tourBound = 'true';
        button.addEventListener('click', () => genericoTourOpen(button.dataset.tourOpen, { manual: true }));
    });
}

function genericoTourRefresh() {
    genericoTourEnsureButtons();
    genericoTourMaybeShow();
}

window.genericoTour = {
    refresh: genericoTourRefresh,
    maybeShow: genericoTourMaybeShow,
    open: genericoTourOpen,
    close: genericoTourClose
};
