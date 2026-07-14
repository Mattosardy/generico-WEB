# CLUB_CONFIG Contract

`js/club-config.js` exposes public per-club defaults through `window.CLUB_CONFIG`. Factory may replace or generate this file for each club.

All values in `CLUB_CONFIG` are public browser configuration. Do not include secrets.

## Minimum Shape

```js
window.CLUB_CONFIG = {
  clubName: "Club Demo",
  shortName: "Demo",
  slug: "club-demo",
  description: "Area privada de socios, pedidos, entregas y novedades.",
  installText: "Instalar Demo en el dispositivo",
  footerBrand: "Club Demo",
  supportPhone: "",
  supportEmail: "",
  telegramUsername: "DemoBot",
  colors: {
    primary: "#6b8e23",
    secondary: "#dff7cf",
    accent: "#4f6f1a",
    background: "#f8fff9",
    surface: "#ffffff",
    text: "#050505",
    muted: "#1f3d2f",
    danger: "#9B6A6C",
    success: "#6b8e23",
    warning: "#ffeb00"
  },
  assets: {
    logo: "assets/images/logo-t3-420.png",
    homeBackground: "assets/images/home_inst.png",
    favicon: "assets/icons/icon-192.png",
    icon192: "assets/icons/icon-192.png",
    icon512: "assets/icons/icon-512.png",
    appleTouchIcon: "assets/icons/apple-touch-icon.png"
  },
  supabase: {
    url: "",
    anonKey: ""
  },
  cloud: {
    workerName: "",
    cacheName: "",
    cachePrefix: ""
  }
};
```

## Public Fields

- `clubName`: public display name used in page title and app metadata.
- `shortName`: public shorter display name for compact UI.
- `slug`: public stable identifier for generated files, cache names, and deploy names.
- `description`: public app description.
- `installText`: public PWA install label.
- `footerBrand`: public footer label.
- `supportPhone`: public support phone, optional.
- `supportEmail`: public support email, optional.
- `telegramUsername`: public bot username, not a bot token.
- `colors`: public theme values.
- `assets`: public relative asset paths.
- `supabase.url`: public Supabase project URL.
- `supabase.anonKey`: public Supabase anon key.
- `cloud.workerName`: public deploy identifier.
- `cloud.cacheName`: public service worker cache name.
- `cloud.cachePrefix`: public service worker cache prefix.

## Forbidden Values

Never include these in `CLUB_CONFIG`:

- Supabase service role key
- database password
- Telegram bot token
- Twilio auth token
- WhatsApp access token
- private signing keys
- private webhook secrets
- real member data
- private phone lists
- private admin credentials

## Asset Rules

Asset paths should be relative to the site root content, for example:

```text
assets/images/logo.png
assets/images/home.png
assets/icons/icon-192.png
```

Factory must ensure generated assets exist before publishing an instance. If a generated asset is missing, the base defaults in `js/club-config.js` keep the demo usable.

## CSS Theme Override

Factory may generate `css/club-theme.css` for instance-specific CSS overrides. The base template loads it after `css/theme-generico.css`, so generated rules can override the generic theme safely.
