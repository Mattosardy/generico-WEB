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

El token del bot no va en el frontend. El worker separado `workers/cururu-telegram-bot` usa:

- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_CURURU_ADMIN_SECRET` opcional para proteger `/telegram/send-test`
- `TELEGRAM_WEBHOOK_SECRET` opcional si el webhook se configura con secret token
- `NOTIFICATION_WORKER_SECRET` opcional para endpoints internos

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

### Envio directo de prueba

```bash
curl -X POST "https://<worker-url>/telegram/send-test" \
  -H "Content-Type: application/json" \
  -H "X-CURURU-ADMIN-SECRET: <X_CURURU_ADMIN_SECRET>" \
  -d '{"chat_id":"<telegram_chat_id>","text":"Mensaje de prueba Cururu Club"}'
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
