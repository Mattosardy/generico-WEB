# generico_WEB

Plantilla web para clubes con Vite, JavaScript vanilla, Supabase y Cloudflare Workers.

## Desarrollo local

No abras `index.html` con doble click ni desde una ruta `file:///`. La app usa rutas absolutas, manifest, service worker y conexion Supabase pensados para ejecutarse desde `http` o `https`.

Para probar localmente:

```bash
npm install
npm run dev
```

Despues abri la URL que indique Vite, por ejemplo:

```text
http://localhost:5173
```

Si necesitas acceder desde otro dispositivo de la red local:

```bash
npm run dev:host
```

## Deploy

La version publicada se prueba en:

```text
https://generico-web.matiast3.workers.dev
```

## Notas de login

El mensaje `Telefono o contrasena incorrectos` no es un error de PWA, manifest ni service worker. Indica credenciales invalidas o un usuario inexistente en Supabase.

## PWA

El manifest y los iconos usan rutas absolutas para funcionar correctamente en `http` y `https`. El service worker no se registra cuando la app se abre por error desde `file:///`.
