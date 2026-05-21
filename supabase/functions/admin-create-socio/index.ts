import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type CreateSocioPayload = {
  nombre?: string;
  telefono?: string;
  rol?: string;
  estado?: string;
};

type SocioRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  telefono: string | null;
};

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ALLOWED_ROLES = new Set(["socio", "admin", "maestro"]);
const ALLOWED_STATES = new Set(["activo", "pendiente", "inactivo"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUyPhone(value: string) {
  const clean = String(value || "").replace(/[^\d+]/g, "").trim();
  const digits = clean.replace(/[^\d]/g, "");
  if (clean.startsWith("+598")) return clean;
  if (digits.startsWith("598") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("09") && digits.length === 9) return `+598${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 8) return `+598${digits}`;
  return clean;
}

function technicalEmailFromPhone(phone: string) {
  const digits = normalizeUyPhone(phone).replace(/[^\d]/g, "");
  if (!digits) throw new Error("El telefono es obligatorio.");
  return `socio_${digits}@cururu.local`;
}

function generateTemporaryPassword(length = 12) {
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Faltan variables seguras para crear socios.");
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return jsonResponse({ error: "No autenticado." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: "No autenticado." }, 401);

    const { data: currentRole, error: roleError } = await userClient.rpc("current_user_role");
    if (roleError) throw roleError;
    if (currentRole !== "admin") return jsonResponse({ error: "No autorizado." }, 403);

    const payload = (await request.json()) as CreateSocioPayload;
    const nombre = String(payload.nombre || "").trim();
    const telefonoVisible = String(payload.telefono || "").trim();
    const telefono = normalizeUyPhone(telefonoVisible);
    const rol = ALLOWED_ROLES.has(String(payload.rol || "")) ? String(payload.rol) : "socio";
    const estado = ALLOWED_STATES.has(String(payload.estado || "")) ? String(payload.estado) : "activo";

    if (!nombre) return jsonResponse({ error: "El nombre es obligatorio." }, 400);
    if (!telefono || !telefono.replace(/[^\d]/g, "")) return jsonResponse({ error: "El telefono es obligatorio." }, 400);

    const { data: technicalEmail, error: emailError } = await adminClient.rpc("generate_technical_email", {
      p_phone: telefono,
    });
    if (emailError) throw emailError;
    const email = String(technicalEmail || technicalEmailFromPhone(telefono)).trim();
    const temporaryPassword = generateTemporaryPassword(12);

    let authUserId: string | null = null;
    let socioId: string | null = null;
    const { data: existingSocio } = await adminClient
      .from("socios")
      .select("id, auth_user_id, email, telefono")
      .eq("email", email)
      .maybeSingle();
    const existingSocioRow = existingSocio as SocioRow | null;

    if (existingSocioRow?.auth_user_id) {
      socioId = existingSocioRow.id;
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(existingSocioRow.auth_user_id, {
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { nombre, telefono, rol },
      });
      if (updateAuthError) throw updateAuthError;
      authUserId = existingSocioRow.auth_user_id;
    } else {
      const { data: createdUser, error: createAuthError } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { nombre, telefono, rol },
      });
      if (createAuthError) throw createAuthError;
      authUserId = createdUser.user?.id ?? null;
    }

    if (!authUserId) throw new Error("No se pudo crear el usuario Auth.");

    if (!socioId) {
      const { data: linkedSocio } = await adminClient
        .from("socios")
        .select("id, auth_user_id, email, telefono")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      const linkedSocioRow = linkedSocio as SocioRow | null;
      if (linkedSocioRow?.id) {
        socioId = linkedSocioRow.id;
      } else {
        const { data: emailSocio } = await adminClient
          .from("socios")
          .select("id, auth_user_id, email, telefono")
          .eq("email", email)
          .maybeSingle();
        const emailSocioRow = emailSocio as SocioRow | null;
        socioId = emailSocioRow?.id ?? null;
      }
    }

    const socioPayload = {
      auth_user_id: authUserId,
      email,
      nombre,
      apellido: "",
      cedula: `SIN-CEDULA-${authUserId.slice(0, 8)}`,
      telefono,
      rol,
      estado,
      debe_cambiar_password: true,
      password_temporal: true,
      password_temporal_issued_at: new Date().toISOString(),
      alta_manual_admin_id: authData.user.id,
      email_tecnico_generado: true,
    };

    if (socioId) {
      const { error: updateSocioError } = await adminClient
        .from("socios")
        .update(socioPayload)
        .eq("id", socioId);
      if (updateSocioError) throw updateSocioError;
    } else {
      const { error: insertSocioError } = await adminClient
        .from("socios")
        .insert(socioPayload);
      if (insertSocioError) throw insertSocioError;
    }

    return jsonResponse({
      ok: true,
      telefono,
      temporary_password: temporaryPassword,
      link_web: siteUrl || new URL(request.url).origin,
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "No se pudo crear el socio.",
    }, 500);
  }
});
