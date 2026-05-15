const VERIFY_TOKEN = "cururu123";
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

function getCacheHeadersForPath(pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname.toLowerCase();
  if (normalizedPath.endsWith(".html") || normalizedPath.endsWith(".js") || normalizedPath.endsWith(".css")) {
    return NO_CACHE_HEADERS;
  }
  return { "Cache-Control": "public, max-age=86400" };
}

function applyAssetCacheHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  const cacheHeaders = getCacheHeadersForPath(pathname);

  Object.entries(cacheHeaders).forEach(([name, value]) => {
    headers.set(name, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getRelevantHeaders(request) {
  const names = [
    "content-type",
    "user-agent",
    "x-hub-signature",
    "x-hub-signature-256",
    "cf-connecting-ip",
    "cf-ipcountry",
  ];

  return names.reduce((headers, name) => {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
    return headers;
  }, {});
}

function getWebhookChanges(body) {
  return (body?.entry || [])
    .flatMap((entry) => entry?.changes || [])
    .filter(Boolean);
}

function getWebhookValues(body) {
  return getWebhookChanges(body)
    .map((change) => change?.value)
    .filter(Boolean);
}

function logStructured(label, data) {
  console.log(label, JSON.stringify(data));
}

function buildRequestContext(request, url) {
  return {
    timestamp: new Date().toISOString(),
    method: request.method,
    pathname: url.pathname,
    headers: getRelevantHeaders(request),
  };
}

function logDetectedWhatsAppEvents(context, body) {
  const values = getWebhookValues(body);
  const statuses = values.flatMap((value) => value?.statuses || []);
  const messages = values.flatMap((value) => value?.messages || []);
  const errors = [
    ...values.flatMap((value) => value?.errors || []),
    ...statuses.flatMap((status) => status?.errors || []),
    ...messages.flatMap((message) => message?.errors || []),
  ];

  if (statuses.length) {
    logStructured("WHATSAPP STATUS UPDATE", {
      ...context,
      count: statuses.length,
      statuses,
    });
  }

  if (messages.length) {
    logStructured("WHATSAPP MESSAGE RECEIVED", {
      ...context,
      count: messages.length,
      messages,
    });
  }

  if (errors.length) {
    logStructured("WHATSAPP ERRORS DETECTED", {
      ...context,
      count: errors.length,
      errors,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const context = buildRequestContext(request, url);

    if (url.pathname === "/webhook") {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
          logStructured("META WEBHOOK VERIFIED", {
            ...context,
            mode,
            hasChallenge: Boolean(challenge),
          });

          return new Response(challenge, { status: 200 });
        }

        logStructured("META WEBHOOK VERIFICATION FORBIDDEN", {
          ...context,
          mode,
          tokenMatches: token === VERIFY_TOKEN,
        });

        return new Response("Forbidden", { status: 403 });
      }

      if (request.method === "POST") {
        try {
          const body = await request.json();

          logStructured("WHATSAPP EVENT RECEIVED", {
            ...context,
            body,
          });

          logDetectedWhatsAppEvents(context, body);

          // Future integration points:
          // - Persist raw webhook payloads and parsed messages in Supabase.
          // - Dispatch automatic WhatsApp replies based on message type/content.
          // - Send message text/media metadata to an AI workflow for classification.
          // - Store delivery statuses and error diagnostics for admin dashboards.
        } catch (error) {
          logStructured("WHATSAPP WEBHOOK JSON PARSE ERROR", {
            ...context,
            error: {
              name: error?.name || "Error",
              message: error?.message || String(error),
            },
          });
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      logStructured("WHATSAPP WEBHOOK METHOD NOT HANDLED", context);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    if (env?.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      return applyAssetCacheHeaders(assetResponse, url.pathname);
    }

    return new Response("Cururu WhatsApp Webhook OK", {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  },
};
