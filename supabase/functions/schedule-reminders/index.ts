import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json().catch(() => ({}));
    const targetDate = typeof body.target_date === "string" ? body.target_date : new Date().toISOString().slice(0, 10);

    const { data: scheduled, error: scheduleError } = await supabase.rpc("queue_monthly_telegram_reminders", {
      target_date: targetDate,
    });
    if (scheduleError) throw scheduleError;

    const { data: closed, error: closeError } = await supabase.rpc("close_expired_reservation_windows", {
      target_date: targetDate,
    });
    if (closeError) throw closeError;

    return new Response(JSON.stringify({
      channel: "telegram",
      scheduled: scheduled ?? 0,
      closed_windows: closed ?? 0,
      target_date: targetDate,
    }), {
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
