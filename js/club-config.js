// Public per-club defaults. This file must stay safe to expose in the browser.
(function () {
    const fallbackConfig = {
        clubName: 'T3 / 420',
        shortName: 'T3 - 420',
        slug: 't3-420',
        description: 'Demo T3 / 420 para clubes: area privada de socios, pedidos mensuales, entregas y novedades.',
        installText: 'Instalar T3 / 420 en el dispositivo',
        footerBrand: 'Nombre del Club',
        phone: '',
        email: '',
        supportPhone: '',
        supportEmail: '',
        logo: 'assets/images/logo-t3-420.png',
        features: {
            telegram: false
        },
        assets: {
            logo: 'assets/images/logo-t3-420.png',
            homeBackground: 'assets/images/home_inst.png',
            favicon: 'assets/icons/icon-192.png',
            icon192: 'assets/icons/icon-192.png',
            icon512: 'assets/icons/icon-512.png',
            appleTouchIcon: 'assets/icons/apple-touch-icon.png'
        },
        colors: {
            primary: '#6b8e23',
            secondary: '#dff7cf',
            accent: '#4f6f1a',
            background: '#f8fff9',
            surface: '#ffffff',
            text: '#050505',
            muted: '#1f3d2f',
            danger: '#9B6A6C',
            success: '#6b8e23',
            warning: '#ffeb00',
            clubText: '#11140f',
            primarySoft: 'rgba(169, 218, 111, 0.72)',
            primaryHover: 'rgba(188, 235, 134, 0.9)',
            cardBg: 'rgba(238, 255, 194, 0.62)',
            appleBorder: '#9bd55b',
            borderSoft: 'rgba(107, 142, 35, 0.24)',
            borderStrong: 'rgba(107, 142, 35, 0.46)'
        },
        telegramUsername: 'GenericoWeb_bot'
    };

    const existingConfig = window.CLUB_CONFIG && typeof window.CLUB_CONFIG === 'object'
        ? window.CLUB_CONFIG
        : {};

    window.CLUB_CONFIG = {
        ...fallbackConfig,
        ...existingConfig,
        assets: {
            ...fallbackConfig.assets,
            ...(existingConfig.assets || {}),
            logo: existingConfig.assets?.logo || existingConfig.logo || fallbackConfig.assets.logo
        },
        features: {
            ...fallbackConfig.features,
            ...(existingConfig.features || {})
        },
        colors: {
            ...fallbackConfig.colors,
            ...(existingConfig.colors || {})
        }
    };

    function getClubConfigValue(path, fallback) {
        const value = String(path || '')
            .split('.')
            .filter(Boolean)
            .reduce((current, key) => current?.[key], window.CLUB_CONFIG);
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    }

    window.getClubConfigValue = getClubConfigValue;

    function isClubFeatureEnabled(feature) {
        return window.CLUB_CONFIG?.features?.[feature] === true;
    }

    window.isClubFeatureEnabled = isClubFeatureEnabled;

    function getClubAssetValue(key, fallback) {
        return getClubConfigValue(`assets.${key}`, fallback);
    }

    function resolveClubAssetUrl(value) {
        try {
            return new URL(value, document.baseURI).href;
        } catch (_error) {
            return value;
        }
    }

    function applyCssVariable(name, path, fallback) {
        const value = getClubConfigValue(path, fallback);
        if (value) document.documentElement.style.setProperty(name, value);
    }

    function applyClubTheme() {
        applyCssVariable('--club-primary', 'colors.primary', fallbackConfig.colors.primary);
        applyCssVariable('--club-secondary', 'colors.secondary', fallbackConfig.colors.secondary);
        applyCssVariable('--club-accent', 'colors.accent', fallbackConfig.colors.accent);
        applyCssVariable('--club-background', 'colors.background', fallbackConfig.colors.background);
        applyCssVariable('--club-surface', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--club-text', 'colors.text', fallbackConfig.colors.text);
        applyCssVariable('--club-muted', 'colors.muted', fallbackConfig.colors.muted);
        applyCssVariable('--club-danger', 'colors.danger', fallbackConfig.colors.danger);
        applyCssVariable('--club-success', 'colors.success', fallbackConfig.colors.success);
        applyCssVariable('--club-warning', 'colors.warning', fallbackConfig.colors.warning);

        applyCssVariable('--generico-bg', 'colors.background', fallbackConfig.colors.background);
        applyCssVariable('--generico-panel', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--generico-text', 'colors.text', fallbackConfig.colors.text);
        applyCssVariable('--generico-muted', 'colors.muted', fallbackConfig.colors.muted);
        applyCssVariable('--generico-green', 'colors.primary', fallbackConfig.colors.primary);
        applyCssVariable('--generico-green-soft', 'colors.secondary', fallbackConfig.colors.secondary);

        applyCssVariable('--surface-dark', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--surface-strong', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--surface', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--surface-soft', 'colors.surface', fallbackConfig.colors.surface);
        applyCssVariable('--surface-muted', 'colors.background', fallbackConfig.colors.background);
        applyCssVariable('--text-strong', 'colors.text', fallbackConfig.colors.text);
        applyCssVariable('--text-main', 'colors.text', fallbackConfig.colors.text);
        applyCssVariable('--text-muted', 'colors.muted', fallbackConfig.colors.muted);
        applyCssVariable('--accent', 'colors.primary', fallbackConfig.colors.primary);
        applyCssVariable('--accent-strong', 'colors.accent', fallbackConfig.colors.accent);

        applyCssVariable('--club-primary-color', 'colors.primarySoft', fallbackConfig.colors.primarySoft);
        applyCssVariable('--club-primary-color-hover', 'colors.primaryHover', fallbackConfig.colors.primaryHover);
        applyCssVariable('--club-text-color', 'colors.clubText', fallbackConfig.colors.clubText);
        applyCssVariable('--club-card-bg', 'colors.cardBg', fallbackConfig.colors.cardBg);
        applyCssVariable('--apple-border', 'colors.appleBorder', fallbackConfig.colors.appleBorder);
        applyCssVariable('--border-soft', 'colors.borderSoft', fallbackConfig.colors.borderSoft);
        applyCssVariable('--border-strong', 'colors.borderStrong', fallbackConfig.colors.borderStrong);
    }

    window.applyClubTheme = applyClubTheme;

    function setElementAttribute(selector, attribute, value) {
        if (!value) return;
        const element = document.querySelector(selector);
        if (element) element.setAttribute(attribute, value);
    }

    function applyClubAssets() {
        const logo = getClubAssetValue('logo', fallbackConfig.assets.logo);
        const homeBackground = getClubAssetValue('homeBackground', fallbackConfig.assets.homeBackground);
        const favicon = getClubAssetValue('favicon', fallbackConfig.assets.favicon);
        const icon192 = getClubAssetValue('icon192', fallbackConfig.assets.icon192);
        const icon512 = getClubAssetValue('icon512', fallbackConfig.assets.icon512);
        const appleTouchIcon = getClubAssetValue('appleTouchIcon', fallbackConfig.assets.appleTouchIcon);

        if (homeBackground) {
            const backgroundUrl = resolveClubAssetUrl(homeBackground);
            document.documentElement.style.setProperty('--club-bg-image', `url("${backgroundUrl}")`);
        }

        const logoElement = document.getElementById('clubLogoPrincipal');
        if (logoElement) logoElement.src = logo;

        const historiaImage = document.querySelector('#historiaMediaPrincipal img.historia-media-principal');
        if (historiaImage) historiaImage.src = homeBackground;

        setElementAttribute('link[rel="apple-touch-icon"]', 'href', appleTouchIcon);
        setElementAttribute('link[rel="icon"][sizes="192x192"]', 'href', icon192 || favicon);
        setElementAttribute('link[rel="icon"][sizes="512x512"]', 'href', icon512 || favicon);
    }

    window.applyClubAssets = applyClubAssets;

    function applyClubConfig() {
        const titleName = getClubConfigValue('clubName', 'T3 / 420');
        const visibleName = getClubConfigValue('shortName', 'T3 - 420');
        const description = getClubConfigValue('description', fallbackConfig.description);
        const installText = getClubConfigValue('installText', fallbackConfig.installText);

        document.title = `${titleName} | Area de socios`;

        const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (appleTitleMeta) appleTitleMeta.setAttribute('content', titleName);

        const descriptionMeta = document.querySelector('meta[name="description"]');
        if (descriptionMeta) descriptionMeta.setAttribute('content', description);

        const nameElement = document.getElementById('clubNombrePrincipal');
        if (nameElement) nameElement.textContent = visibleName;

        document.querySelectorAll('[data-club-install-text]').forEach((element) => {
            element.textContent = installText;
        });

        applyClubAssets();
    }

    try {
        applyClubTheme();
        applyClubAssets();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyClubConfig, { once: true });
        } else {
            applyClubConfig();
        }
    } catch (error) {
        console.warn('No se pudo aplicar CLUB_CONFIG. Se mantienen los valores por defecto.', error);
    }
})();
