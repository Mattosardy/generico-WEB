import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTelegramConfigFromEnv, sendTelegramMessage } from "../_shared/telegram.ts";

type NotificationRow = {
  id: string;
  mensaje: string;
  socio_id: string;
  socios: { telegram_chat_id: string | null; nombre: string | null; apellido: string | null } | null;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan secretos de Supabase para ejecutar la funcion.");
    }

    let telegram;
    try {
      telegram = getTelegramConfigFromEnv(Deno.env.toObject());
    } catch (configError) {
      return new Response(JSON.stringify({
        processed: 0,
        waiting_for: "TELEGRAM_BOT_TOKEN",
        detail: configError instanceof Error ? configError.message : String(configError),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("notificaciones_programadas")
      .select("id, mensaje, socio_id, socios(telegram_chat_id, nombre, apellido)")
      .eq("estado", "pendiente")
      .eq("canal", "telegram")
      .lte("fecha_programada", new Date().toISOString())
      .order("fecha_programada", { ascending: true })
      .limit(50);

    if (error) throw error;

    const notifications = (data ?? []) as NotificationRow[];
    const results: Array<{ id: string; status: string; detail?: string }> = [];

    for (const item of notifications) {
      const chatId = item.socios?.telegram_chat_id?.trim();
      if (!chatId) {
        await supabase
          .from("notificaciones_programadas")
          .update({
            estado: "error",
            error_detalle: "El socio no tiene Telegram vinculado.",
            provider: "telegram",
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        results.push({ id: item.id, status: "error", detail: "telegram faltante" });
        continue;
      }

      try {
        const sendResult = await sendTelegramMessage(telegram, {
          chatId,
          text: item.mensaje,
        });

        await supabase
          .from("notificaciones_programadas")
          .update({
            estado: "enviado",
            fecha_envio: new Date().toISOString(),
            provider: "telegram",
            provider_message_sid: sendResult.message_id ? String(sendResult.message_id) : null,
            error_detalle: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({ id: item.id, status: "enviado" });
      } catch (sendError) {
        await supabase
          .from("notificaciones_programadas")
          .update({
            estado: "error",
            error_detalle: sendError instanceof Error ? sendError.message : "Error desconocido al enviar.",
            provider: "telegram",
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "error",
          detail: sendError instanceof Error ? sendError.message : "unknown",
        });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
