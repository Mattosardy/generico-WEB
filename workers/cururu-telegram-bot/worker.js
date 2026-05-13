const JSON_HEADERS = { "Content-Type": "application/json" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function getEnv(env, key) {
  return String(env[key] || "").trim();
}

function requireEnv(env, key) {
  const value = getEnv(env, key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function buildSupabase(env) {
  const url = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  async function request(path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase ${response.status}: ${detail}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return { request };
}

function buildSupabaseRpc(env) {
  const url = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv(env, "SUPABASE_ANON_KEY");

  async function rpc(functionName, body = {}) {
    const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(async () => ({ error: await response.text() }));
    if (!response.ok) {
      throw new Error(`Supabase RPC ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload;
  }

  return { rpc };
}

function parseStartCode(text = "") {
  const parts = String(text).trim().split(/\s+/);
  if (parts[0] !== "/start") return null;
  return parts[1] || null;
}

function telegramMessageFromUpdate(update) {
  return update?.message || update?.edited_message || null;
}

function getTelegramApiBase(env) {
  const token = requireEnv(env, "TELEGRAM_BOT_TOKEN");
  return `https://api.telegram.org/bot${token}`;
}

async function sendTelegramMessage(env, chatId, text) {
  if (!chatId) throw new Error("Telegram chat_id faltante.");
  const response = await fetch(`${getTelegramApiBase(env)}/sendMessage`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.description || `Telegram ${response.status}`);
  }
  return body.result;
}

function telegramWebhookSendMessage(chatId, text) {
  return json({
    method: "sendMessage",
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

function createTelegramProvider(env) {
  return {
    async send(chatId, message) {
      return sendTelegramMessage(env, chatId, message);
    },
  };
}

function createWhatsAppProvider() {
  return {
    async send() {
      throw new Error("WhatsApp provider reservado para fase futura.");
    },
  };
}

function createEmailProvider() {
  return {
    async send() {
      throw new Error("Email provider reservado para fase futura.");
    },
  };
}

function createNotificationService(env, supabase) {
  const providers = {
    telegram: createTelegramProvider(env),
    whatsapp: createWhatsAppProvider(),
    email: createEmailProvider(),
  };

  return {
    async send(userId, message, options = {}) {
      const channel = options.channel || "telegram";
      const provider = providers[channel];
      if (!provider) throw new Error(`Canal no soportado: ${channel}`);

      if (channel !== "telegram") {
        return provider.send(userId, message, options);
      }

      const socios = await supabase.request(
        `socios?id=eq.${encodeURIComponent(userId)}&select=id,telegram_chat_id,telegram_enabled`,
      );
      const socio = socios?.[0];
      if (!socio?.telegram_enabled || !socio?.telegram_chat_id) {
        throw new Error("El socio no tiene Telegram vinculado.");
      }

      return provider.send(socio.telegram_chat_id, message);
    },
  };
}

function renderMessage(type, payload = {}) {
  const variety = payload.variety || payload.variedad || "Sin especificar";
  const grams = payload.grams || payload.cantidad_gramos || "-";
  const retiro = payload.retiro ? `\nRetiro: ${payload.retiro}` : "";

  const templates = {
    reserva_creada: `Cururu Club\nTu reserva fue recibida.\nVariedad: ${variety}\nCantidad: ${grams}g\nEstado: pendiente de confirmacion.${retiro}`,
    reserva_confirmada: `Cururu Club\nTu reserva fue confirmada.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro}`,
    reserva_rechazada: `Cururu Club\nTu reserva no pudo ser confirmada.\nVariedad: ${variety}\nCantidad: ${grams}g\nMotivo: ${payload.motivo || "Te vamos a contactar para coordinar."}`,
    retiro_disponible: `Cururu Club\nTu retiro ya esta disponible.\nVariedad: ${variety}\nCantidad: ${grams}g${retiro}`,
    aviso_general: `Cururu Club\n${payload.message || payload.mensaje || ""}`,
  };

  return templates[type] || String(payload.message || payload.mensaje || "");
}

function getReservationVariety(reservation = {}) {
  return reservation.variety || reservation.variedad || reservation.producto_nombre || "Entrega mensual";
}

function getReservationGrams(reservation = {}) {
  return reservation.grams || reservation.cantidad_gramos || reservation.gramos || "-";
}

function notifyReservationCreated(env, user, reservation) {
  return sendTelegramMessage(
    env,
    user.telegram_chat_id,
    renderMessage("reserva_creada", {
      variety: getReservationVariety(reservation),
      grams: getReservationGrams(reservation),
      retiro: reservation.fecha_retiro,
    }),
  );
}

function notifyReservationConfirmed(env, user, reservation) {
  return sendTelegramMessage(
    env,
    user.telegram_chat_id,
    renderMessage("reserva_confirmada", {
      variety: getReservationVariety(reservation),
      grams: getReservationGrams(reservation),
      retiro: reservation.fecha_retiro,
    }),
  );
}

function notifyReservationRejected(env, user, reservation) {
  return sendTelegramMessage(
    env,
    user.telegram_chat_id,
    renderMessage("reserva_rechazada", {
      variety: getReservationVariety(reservation),
      grams: getReservationGrams(reservation),
      motivo: reservation.motivo,
    }),
  );
}

function notifyPickupAvailable(env, user, reservation) {
  return sendTelegramMessage(
    env,
    user.telegram_chat_id,
    renderMessage("retiro_disponible", {
      variety: getReservationVariety(reservation),
      grams: getReservationGrams(reservation),
      retiro: reservation.fecha_retiro,
    }),
  );
}

async function handleTelegramWebhook(request, env) {
  const expectedSecret = getEnv(env, "TELEGRAM_WEBHOOK_SECRET");
  if (expectedSecret) {
    const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (receivedSecret !== expectedSecret) return json({ error: "Forbidden" }, 403);
  }

  const update = await request.json();
  const message = telegramMessageFromUpdate(update);
  const startCode = parseStartCode(message?.text);
  if (!message || !startCode) {
    console.log("Telegram inbound message ignored", {
      reason: "announcements_only",
      chat_id: message?.chat?.id ? String(message.chat.id) : null,
      has_text: Boolean(message?.text),
    });
    return json({ ok: true, ignored: true });
  }

  const chat = message.chat || {};
  const from = message.from || {};
  const supabaseRpc = buildSupabaseRpc(env);
  const result = await supabaseRpc.rpc("link_telegram_by_code", {
    p_code: startCode,
    p_chat_id: String(chat.id),
    p_username: from.username || chat.username || null,
    p_first_name: from.first_name || null,
  });

  if (result?.linked) {
    console.log("Telegram linked", {
      target: result.target,
      id: result.id,
      chat_id: String(chat.id),
      username: from.username || chat.username || null,
      first_name: from.first_name || null,
    });
    const text = result.target === "solicitud"
      ? "Curur\u00FA Club \uD83C\uDF3F\nTelegram verificado correctamente.\nTu solicitud quedo pendiente de aprobacion."
      : "Curur\u00FA Club \uD83C\uDF3F\nTelegram vinculado correctamente.\nEste canal se usara solo para avisos del club.";
    return telegramWebhookSendMessage(chat.id, text);
  }

  const alreadyLinked = result?.reason === "chat_already_linked";
  console.log("Telegram link rejected", { reason: result?.reason || "unknown", chat_id: String(chat.id) });
  return telegramWebhookSendMessage(
    chat.id,
    alreadyLinked
      ? "Este Telegram ya esta vinculado a otro socio. Contacta al club para cambiar la vinculacion."
      : "C\u00F3digo inv\u00E1lido o vencido. Volv\u00E9 a la web y toc\u00E1 Vincular Telegram otra vez.",
  );
}

async function handleNotificationSend(request, env, supabase, notificationService) {
  const workerSecret = getEnv(env, "NOTIFICATION_WORKER_SECRET");
  if (workerSecret && request.headers.get("authorization") !== `Bearer ${workerSecret}`) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await request.json();
  const message = body.message || renderMessage(body.type, body.payload);
  const result = await notificationService.send(body.userId, message, {
    channel: body.channel || "telegram",
  });
  return json({ ok: true, result });
}

async function handleTelegramSendTest(request, env) {
  const adminSecret = getEnv(env, "X_CURURU_ADMIN_SECRET");
  const receivedSecret = request.headers.get("x-cururu-admin-secret") || "";
  if (adminSecret && receivedSecret !== adminSecret) return json({ error: "Forbidden" }, 403);

  const body = await request.json();
  if (!body?.chat_id || !body?.text) return json({ error: "chat_id y text son obligatorios" }, 400);

  const result = await sendTelegramMessage(env, body.chat_id, body.text);
  return json({ ok: true, result });
}

function workerSecretIsValid(request, env) {
  const workerSecret = getEnv(env, "NOTIFICATION_WORKER_SECRET");
  return !workerSecret || request.headers.get("authorization") === `Bearer ${workerSecret}`;
}

async function processPendingTelegramNotifications(env) {
  const supabaseRpc = buildSupabaseRpc(env);
  const pending = await supabaseRpc.rpc("claim_pending_telegram_notifications", {
    p_limit: 50,
  });
  const results = [];

  for (const item of pending || []) {
    try {
      const sent = await sendTelegramMessage(env, item.chat_id, item.message);
      await supabaseRpc.rpc("mark_telegram_notification_sent", {
        p_notification_id: item.notification_id,
        p_provider_message_id: sent?.message_id ? String(sent.message_id) : null,
      });
      results.push({ id: item.notification_id, status: "enviado" });
    } catch (error) {
      await supabaseRpc.rpc("mark_telegram_notification_error", {
        p_notification_id: item.notification_id,
        p_error: error?.message || String(error),
      });
      results.push({ id: item.notification_id, status: "error", detail: error?.message || String(error) });
    }
  }

  return results;
}

async function queueTelegramReservationReminders(env) {
  const supabaseRpc = buildSupabaseRpc(env);
  return supabaseRpc.rpc("queue_monthly_telegram_reservation_reminders", {});
}

async function handleDispatchPending(request, env, supabase, notificationService) {
  if (!workerSecretIsValid(request, env)) return json({ error: "Forbidden" }, 403);

  const queuedReminders = await queueTelegramReservationReminders(env);
  const results = await processPendingTelegramNotifications(env);
  return json({ queuedReminders, processed: results.length, results });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/webhook/telegram") {
        return handleTelegramWebhook(request, env);
      }

      if (request.method === "POST" && url.pathname === "/telegram/send-test") {
        return handleTelegramSendTest(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/notifications/send") {
        const supabase = buildSupabase(env);
        const notificationService = createNotificationService(env, supabase);
        return handleNotificationSend(request, env, supabase, notificationService);
      }

      if (request.method === "POST" && url.pathname === "/api/notifications/dispatch-pending") {
        return handleDispatchPending(request, env);
      }

      return json({ ok: true, service: "cururu-telegram-bot" });
    } catch (error) {
      return json({ ok: false, error: error?.message || String(error) }, 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      queueTelegramReservationReminders(env)
        .then((queuedReminders) => processPendingTelegramNotifications(env)
          .then((results) => ({ queuedReminders, results })))
        .then(({ queuedReminders, results }) => console.log("Telegram pending dispatch", {
          queuedReminders,
          processed: results.length,
        }))
        .catch((error) => console.error("Telegram pending dispatch failed", error?.message || String(error))),
    );
  },
};
