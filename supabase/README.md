# Supabase local para notificaciones

## Telegram como canal principal

La migracion `migrations/20260513_telegram_notifications.sql` agrega:

- `socios.telegram_chat_id`
- `socios.telegram_username`
- `socios.telegram_enabled`
- `socios.telegram_link_code`
- `socios.telegram_link_code_expires_at`
- `socios.telegram_linked_at`
- indices para cola de `notificaciones_programadas` con `canal = 'telegram'`

El token del bot no va en el frontend. El worker separado `workers/telegram-bot` usa:

- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_GENERICO_ADMIN_SECRET`
- `TELEGRAM_WEBHOOK_SECRET`
- `NOTIFICATION_WORKER_SECRET`

El webhook productivo queda en:

```text
https://<worker-url>/webhook/telegram
```

Si se usa el dominio por defecto de Cloudflare Workers, normalmente sera:

```text
https://telegram-bot.<tu-subdominio>.workers.dev/webhook/telegram
```

Configurar el nombre publico del bot en `js/config.js`:

```js
window.TELEGRAM_BOT_USERNAME = 'nombre_de_tu_bot';
```

### Flujo de prueba Telegram

1. Crear un bot con BotFather y guardar el token.
2. Configurar los secretos del worker, sin hacer deploy automatico desde este repo.
3. Configurar el webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<worker-url>/webhook/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

4. Aplicar la migracion SQL `20260513_telegram_notifications.sql` en Supabase.
5. En la web, iniciar sesion como socio y usar "Vincular Telegram".
6. Tocar Start en Telegram.
7. Confirmar en Supabase que el socio quedo con `telegram_enabled = true`, `telegram_chat_id` cargado y el codigo limpio.
8. Probar un mensaje desde el panel admin. Queda en `notificaciones_programadas` con `canal = 'telegram'`.
9. Ejecutar el despacho con `POST https://<worker-url>/api/notifications/dispatch-pending`.

### Mensajes entrantes de Telegram

El endpoint `POST /webhook/telegram` tambien recibe mensajes normales enviados por socios al bot.
El worker extrae y guarda en `telegram_mensajes_entrantes`:

- `chat_id`
- `telegram_user_id`
- `username`, `first_name`, `last_name` y `display_name`
- `text`
- `message_date`
- `raw_update` completo para depuracion
- `socio_id` cuando el `chat_id` ya esta vinculado a un socio

La tabla tiene RLS activado y no se escribe desde el frontend. El Worker necesita `SUPABASE_SERVICE_ROLE_KEY` configurada como secret para registrar los mensajes. El webhook rechaza requests que no incluyan el header `X-Telegram-Bot-Api-Secret-Token` con el valor configurado en `TELEGRAM_WEBHOOK_SECRET`.

Luego responde automaticamente:

```text
Nombre del Club
Recibimos tu mensaje. Un administrador lo revisara a la brevedad.
```

El flujo existente de `/start CODIGO` para vincular Telegram sigue funcionando y tambien queda registrado como mensaje entrante.

### Telegram Security Lite

Seguridad reforzada: la plataforma puede exigir validacion por Telegram al vincular la cuenta y tambien al detectar un dispositivo nuevo. Esto reduce accesos no autorizados y protege los datos del club y de sus socios.

La mejora se apoya en:

- codigo temporal de 6 digitos enviado solo al Telegram vinculado del socio;
- hash del codigo en base de datos, sin guardar el codigo plano;
- vencimiento de 24 horas;
- tabla `socio_dispositivos_verificados` para permitir varios dispositivos verificados por socio;
- validacion post-login, sin bloquear el primer acceso antes de vincular Telegram.

### Pruebas y operacion del webhook

#### 1. Levantar el proyecto localmente

Frontend estatico:

```bash
npx serve .
```

Worker Telegram:

```bash
cd workers/telegram-bot
npx wrangler dev
```

Configurar secretos del worker, nunca en archivos publicos:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put NOTIFICATION_WORKER_SECRET
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` estan en `wrangler.jsonc`; el token del bot y service role deben ir como secrets.

#### 2. Probar el endpoint localmente

Con el worker en `http://127.0.0.1:8787`:

```bash
curl -X POST "http://127.0.0.1:8787/webhook/telegram" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>" \
  -d '{
    "update_id": 1000001,
    "message": {
      "message_id": 10,
      "date": 1778860800,
      "chat": { "id": 123456789, "type": "private", "username": "socio_test", "first_name": "Socio" },
      "from": { "id": 123456789, "is_bot": false, "username": "socio_test", "first_name": "Socio" },
      "text": "Hola Nombre del Club"
    }
  }'
```

Respuesta esperada: JSON con `method: "sendMessage"`. En logs de Wrangler debe aparecer `Telegram inbound message stored`.

#### 3. Configurar el webhook en Telegram

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<worker-url>/webhook/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verificar configuracion:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

#### 4. Verificar que Telegram esta enviando mensajes

1. Enviar un mensaje cualquiera al bot desde Telegram.
2. Revisar logs del worker:

```bash
npx wrangler tail telegram-bot
```

3. Confirmar en Supabase:

```sql
select
  created_at,
  chat_id,
  telegram_user_id,
  username,
  display_name,
  text,
  socio_id
from public.telegram_mensajes_entrantes
order by created_at desc
limit 20;
```

#### 5. Volver atras o borrar el webhook

Quitar webhook en Telegram:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

Verificar que quedo desactivado:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Si tambien se quiere retirar la tabla de mensajes entrantes:

```sql
drop table if exists public.telegram_mensajes_entrantes;
```

### Envio directo de prueba

```bash
curl -X POST "https://<worker-url>/telegram/send-test" \
  -H "Content-Type: application/json" \
  -H "X-GENERICO-ADMIN-SECRET: <X_GENERICO_ADMIN_SECRET>" \
  -d '{"chat_id":"<telegram_chat_id>","text":"Mensaje de prueba Nombre del Club"}'
```

## WhatsApp legacy / futuro

Esta carpeta deja preparado el proyecto para sumar notificaciones por WhatsApp usando:

- Supabase Edge Functions
- Supabase Cron / pg_cron
- Twilio WhatsApp API

## Que incluye

- `migrations/20260417_whatsapp_notifications.sql`
  Agrega campos de trazabilidad a `notificaciones_programadas`, crea `whatsapp_templates`, habilita `pg_cron` y `pg_net`, y crea la funcion SQL `queue_monthly_whatsapp_reminders`.
- `functions/schedule-reminders`
  Edge Function que invoca la generacion de recordatorios del mes.
- `functions/dispatch-whatsapp`
  Edge Function que toma notificaciones pendientes y las envia por Twilio.
- `functions/_shared/twilio.ts`
  Utilidades compartidas para normalizar telefonos Uruguay y enviar mensajes.

## Secrets necesarios

Configurar estos secretos en Supabase antes de desplegar funciones:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

Ejemplo de remitente:

- `whatsapp:+14155238886` para sandbox de Twilio
- `whatsapp:+<numero_propio>` para un numero productivo aprobado

## Cron recomendado

1. Generar recordatorios una vez al dia:

```sql
select
  cron.schedule(
    'schedule-whatsapp-reminders-daily',
    '0 9 * * *',
    $$
    select
      net.http_post(
        url := 'https://<project-ref>.functions.supabase.co/schedule-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <service-role-or-function-token>'
        ),
        body := jsonb_build_object('target_date', current_date)::text
      );
    $$
  );
```

2. Despachar cola cada 15 minutos:

```sql
select
  cron.schedule(
    'dispatch-whatsapp-queue',
    '*/15 * * * *',
    $$
    select
      net.http_post(
        url := 'https://<project-ref>.functions.supabase.co/dispatch-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <service-role-or-function-token>'
        ),
        body := '{}'::text
      );
    $$
  );
```

## Pendientes funcionales

- Cambiar el panel admin para que los mensajes manuales carguen `canal = 'whatsapp'`.
- Permitir elegir canal o mantener `email` y `whatsapp` en paralelo.
- Confirmar si el recordatorio del primer jueves se envia a todos los socios o solo a quienes aun no reservaron.
- Reemplazar texto libre por templates de Twilio/Meta si el numero productivo lo exige.

## Nota importante

Esta base local es aditiva y no deberia romper el flujo actual. Las credenciales de Twilio no deben guardarse en tablas visibles al frontend.
