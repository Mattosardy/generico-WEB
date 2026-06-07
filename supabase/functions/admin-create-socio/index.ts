import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MASTER_PHONE = "+59891950107";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizePhoneUy(value: string) {
  const phone = String(value || "").replace(/[^\d+]/g, "").trim();
  const digits = phone.replace(/[^\d]/g, "");
  if (phone.startsWith("+598")) return phone;
  if (digits.startsWith("598") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("09") && digits.length === 9) return `+598${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 8) return `+598${digits}`;
  return phone;
}

function buildTechnicalEmail(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `socio-${digits}@generico.local`;
}

function buildTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint8Array(12));
  const random = Array.from(values, (value) => chars[value % chars.length]).join("");
  return `Gen-${random}7`;
}

async function requireAdmin(supabase: ReturnType<typeof createClient>, token: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sesion invalida.");

  const user = userData.user;
  const { data: socio, error } = await supabase
    .from("socios")
    .select("id, rol, estado, telefono")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email ?? ""}`)
    .maybeSingle();

  if (error) throw error;
  if (!socio || !["admin", "maestro"].includes(String(socio.rol || "")) || String(socio.estado || "activo") !== "activo") {
    throw new Error("No tenes permisos para crear socios.");
  }

  return {
    user,
    socio,
    isMaster: String(socio.rol || "") === "maestro" && normalizePhoneUy(String(socio.telefono || "")) === MASTER_PHONE,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Metodo no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Faltan secretos de Supabase." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ ok: false, error: "Sesion requerida." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const actor = await requireAdmin(supabase, token);

    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre || "").trim();
    const apellido = String(body.apellido || "").trim();
    const telefono = normalizePhoneUy(String(body.telefono || ""));
    const rol = ["socio", "admin", "maestro"].includes(String(body.rol)) ? String(body.rol) : "socio";
    const estado = ["activo", "pendiente", "inactivo"].includes(String(body.estado)) ? String(body.estado) : "activo";
    const telegramEnabled = Boolean(body.telegram_enabled && body.telegram_chat_id);

    if (!nombre || !telefono) throw new Error("Nombre y telefono son obligatorios.");
    if (rol === "maestro") throw new Error("El rol maestro es unico y no se puede crear desde el panel.");
    if (rol === "admin" && !actor.isMaster) throw new Error("Solo el maestro puede crear administradores.");
    if (rol !== "socio" && rol !== "admin") throw new Error("Rol no permitido.");
    if (telefono === MASTER_PHONE && rol !== "socio") throw new Error("El telefono maestro no se puede registrar como admin.");

    const email = buildTechnicalEmail(telefono);
    const temporaryPassword = buildTemporaryPassword();

    const { data: existingSocio } = await supabase
      .from("socios")
      .select("id")
      .eq("telefono", telefono)
      .maybeSingle();
    if (existingSocio) throw new Error("Ya existe un socio con ese telefono.");

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { nombre, apellido, telefono, rol },
    });
    if (authError) throw authError;

    const authUserId = authData.user?.id;
    if (!authUserId) throw new Error("No se pudo crear el usuario Auth.");

    const cedulaFallback = `tel-${telefono.replace(/[^\d]/g, "")}`;
    const { error: insertError } = await supabase.from("socios").insert([{
      nombre,
      apellido,
      cedula: String(body.cedula || "").trim() || cedulaFallback,
      telefono,
      email,
      auth_user_id: authUserId,
      rol,
      estado,
      activo: estado === "activo",
      has_password: true,
      debe_cambiar_password: true,
      password_temporal: true,
      telegram_chat_id: body.telegram_chat_id || null,
      telegram_username: body.telegram_username || null,
      telegram_enabled: telegramEnabled,
      telegram_linked_at: telegramEnabled ? (body.telegram_linked_at || new Date().toISOString()) : null,
    }]);

    if (insertError) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
      throw insertError;
    }

    return jsonResponse({
      ok: true,
      telefono,
      link_web: req.headers.get("Origin") || "",
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
