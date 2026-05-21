const CURURU_TOUR_KEYS = {
    socio: 'cururu_tour_socio_done',
    admin: 'cururu_tour_admin_done'
};

const CURURU_TOUR_STEPS = {
    socio: [
        {
            selector: '#telegramLinkPanel',
            section: 'actividades',
            title: 'Telegram del club',
            text: 'Vincula Telegram para recibir avisos, codigos de seguridad y novedades importantes.'
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
            text: 'Cada socio puede reservar 1 Pack (20g) o 2 Packs (40g) por mes, segun stock disponible.'
        },
        {
            selector: '#userName',
            section: 'productos',
            action: 'cart',
            title: 'Carrito',
            text: 'Toca tu nombre en la barra para abrir el carrito y revisar tus pedidos del ciclo actual.'
        },
        {
            selector: '#actividades',
            section: 'actividades',
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

const cururuTourState = {
    role: null,
    stepIndex: 0,
    steps: [],
    manual: false,
    active: false,
    renderToken: 0
};

function cururuTourDelay(ms = 80) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cururuTourRole() {
    const rol = String(window.appState?.rolUsuario || '').toLowerCase();
    if (rol === 'admin') return 'admin';
    if (rol === 'socio') return 'socio';
    return '';
}

function cururuTourKey(role) {
    return CURURU_TOUR_KEYS[role] || '';
}

function cururuTourVisibleSteps(role) {
    const steps = CURURU_TOUR_STEPS[role] || [];
    if (role !== 'admin') return steps;
    const plusActivo = Boolean(window.CURURU_PLAN?.plusActivo);
    return plusActivo ? steps : steps.filter((step) => !step.title.toLowerCase().includes('articulos'));
}

function cururuTourEnsureElements() {
    if (!document.getElementById('cururuTourRoot')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="cururuTourRoot" class="tour-root" hidden>
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

        document.getElementById('tourPrev')?.addEventListener('click', cururuTourPrev);
        document.getElementById('tourNext')?.addEventListener('click', cururuTourNext);
        document.getElementById('tourSkip')?.addEventListener('click', cururuTourDismissForever);
        document.querySelectorAll('[data-tour-close]').forEach((el) => {
            el.addEventListener('click', cururuTourClose);
        });
        document.addEventListener('keydown', (event) => {
            if (!cururuTourState.active) return;
            if (event.key === 'Escape') cururuTourClose();
            if (event.key === 'ArrowRight') cururuTourNext();
            if (event.key === 'ArrowLeft') cururuTourPrev();
        });
    }
}

function cururuTourTargetForStep(step) {
    if (!step?.selector) return null;
    const target = document.querySelector(step.selector);
    if (!target || target.offsetParent === null) return null;
    return target;
}

async function cururuTourPrepareStep(step) {
    if (!step) return;
    try {
        if (step.section && typeof mostrarSeccion === 'function') {
            await mostrarSeccion(step.section);
        }

        if (step.adminSection) {
            await cururuTourDelay(80);
            const button = document.querySelector(`[data-admin-section="${step.adminSection}"]`);
            const panel = document.getElementById(`admin-${step.adminSection}`);
            const panelVisible = panel && panel.style.display !== 'none';
            if (button && !panelVisible) button.click();
        }

        if (step.action === 'cart' && typeof abrirCarritoSocio === 'function') {
            await abrirCarritoSocio();
        }
    } catch (error) {
        console.warn('No se pudo preparar el paso de la guia:', error);
    }

    await cururuTourDelay(120);
}

function cururuTourClearHighlight() {
    document.querySelectorAll('.tour-highlight').forEach((el) => el.classList.remove('tour-highlight'));
}

function cururuTourPlacePopover(target) {
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

async function cururuTourRender() {
    cururuTourEnsureElements();
    const token = Date.now();
    cururuTourState.renderToken = token;
    const root = document.getElementById('cururuTourRoot');
    const title = document.getElementById('tourTitle');
    const text = document.getElementById('tourText');
    const label = document.getElementById('tourStepLabel');
    const prev = document.getElementById('tourPrev');
    const next = document.getElementById('tourNext');
    if (!root || !title || !text || !label || !prev || !next) return;

    const total = cururuTourState.steps.length;
    const step = cururuTourState.steps[cururuTourState.stepIndex];
    if (!step) {
        cururuTourClose();
        return;
    }

    await cururuTourPrepareStep(step);
    if (cururuTourState.renderToken !== token) return;

    cururuTourClearHighlight();
    const target = cururuTourTargetForStep(step);
    if (target) {
        target.classList.add('tour-highlight');
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    label.textContent = `Paso ${cururuTourState.stepIndex + 1} de ${total}`;
    title.textContent = step.title;
    text.textContent = step.text;
    prev.disabled = cururuTourState.stepIndex === 0;
    next.textContent = cururuTourState.stepIndex === total - 1 ? 'Finalizar' : 'Siguiente';
    root.hidden = false;
    cururuTourState.active = true;

    window.setTimeout(() => cururuTourPlacePopover(target), 180);
}

function cururuTourOpen(role = cururuTourRole(), options = {}) {
    if (!role || !CURURU_TOUR_KEYS[role]) return;
    const steps = cururuTourVisibleSteps(role);
    if (!steps.length) return;
    sessionStorage.setItem(`cururu_tour_${role}_prompted_session`, 'true');
    cururuTourState.role = role;
    cururuTourState.steps = steps;
    cururuTourState.stepIndex = 0;
    cururuTourState.manual = Boolean(options.manual);
    cururuTourState.active = true;
    void cururuTourRender();
}

function cururuTourClose() {
    const root = document.getElementById('cururuTourRoot');
    if (root) root.hidden = true;
    cururuTourState.active = false;
    cururuTourClearHighlight();
}

function cururuTourPrev() {
    if (cururuTourState.stepIndex <= 0) return;
    cururuTourState.stepIndex -= 1;
    void cururuTourRender();
}

function cururuTourNext() {
    if (cururuTourState.stepIndex >= cururuTourState.steps.length - 1) {
        cururuTourClose();
        return;
    }
    cururuTourState.stepIndex += 1;
    void cururuTourRender();
}

function cururuTourDismissForever() {
    const key = cururuTourKey(cururuTourState.role);
    if (key) localStorage.setItem(key, 'true');
    cururuTourClose();
}

function cururuTourMaybeShow(role = cururuTourRole()) {
    if (!role || !CURURU_TOUR_KEYS[role]) return;
    if (cururuTourState.active) return;
    if (localStorage.getItem(cururuTourKey(role)) === 'true') return;
    const promptedKey = `cururu_tour_${role}_prompted_session`;
    if (sessionStorage.getItem(promptedKey) === 'true') return;
    sessionStorage.setItem(promptedKey, 'true');
    window.setTimeout(() => cururuTourOpen(role), 500);
}

function cururuTourEnsureButtons() {
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
        button.addEventListener('click', () => cururuTourOpen(button.dataset.tourOpen, { manual: true }));
    });
}

function cururuTourRefresh() {
    cururuTourEnsureButtons();
}

window.cururuTour = {
    refresh: cururuTourRefresh,
    maybeShow: cururuTourMaybeShow,
    open: cururuTourOpen,
    close: cururuTourClose
};
