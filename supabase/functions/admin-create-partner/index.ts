import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  throw new Error("Missing environment variables");
}

// service_role client — bypasses RLS + can create logins. Never exposed to the app.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

// Partner account roles. "partner" is a friendly alias for the event partner role.
function normalizeRole(input: unknown): "event" | "vendors" | null {
  const r = String(input ?? "").toLowerCase();
  if (r === "partner") return "event";
  if (r === "event" || r === "vendors") return r;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // 1) Authenticate the caller and require admin (defence in depth — the whole
    //    point of the function is to run privileged writes, so gate it hard).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization" }, 401);

    const { data: caller, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !caller.user) return json({ error: "Invalid session" }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single();
    if (callerProfile?.role !== "admin") return json({ error: "Admins only" }, 403);

    // 2) Validate input.
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const username = String(body.username ?? "").trim();
    const referralCode = body.referralCode ? String(body.referralCode).trim() : null;
    const role = normalizeRole(body.role);

    if (!email || !password) return json({ error: "email and password are required" }, 400);
    if (!role) return json({ error: "role must be 'vendors' or 'event' (a.k.a. partner)" }, 400);

    // 3) Create the login, auto-confirmed. This is the only service_role-only step.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: username ? { username } : undefined,
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "Could not create the login" }, 400);
    }
    const userId = created.user.id;

    // 4) Set role + display name. service_role passes the prevent_role_escalation guard.
    const { error: roleErr } = await supabaseAdmin
      .from("profiles")
      .update({ role, username: username || null, full_name: username || null })
      .eq("id", userId);
    if (roleErr) {
      // Roll back the half-created login so a retry is clean.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: `Set role failed: ${roleErr.message}` }, 400);
    }

    // 5) Optional referral/invitation code (event partners, or any account you want
    //    a code on). Unique across invitation_codes — a clash surfaces as an error.
    if (referralCode) {
      const { error: codeErr } = await supabaseAdmin
        .from("invitation_codes")
        .upsert(
          { user_id: userId, code: referralCode, is_active: true },
          { onConflict: "user_id" }
        );
      if (codeErr) {
        return json(
          { error: `Login + role created, but referral code failed: ${codeErr.message}`, user_id: userId },
          207
        );
      }
    }

    return json({ ok: true, user_id: userId, email, role, referral_code: referralCode });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
