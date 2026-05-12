// verify-share — Phase 5 v1 (manual-review-default)
//
// Validates a user's share submission, dedups the post URL globally, and
// records the row as status='pending'. AI auto-verification (oEmbed scrape +
// hashtag/mention OCR) is deferred to Phase 5b — admins approve from the
// dashboard for v1, which fires the existing on_submission_share_verified
// trigger and pays out the stars.
//
// Mirrors the auth + jsonResponse shape used by review-submission/index.ts.

import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  throw new Error("Missing environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PLATFORMS = new Set(["facebook", "instagram", "tiktok"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Light normalizer so superficial differences (trailing slash, lowercased
// host, dropped tracking params) don't let the same post slip through twice.
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.host = u.host.toLowerCase();
    // Strip common UTM / sharer params.
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "igshid"];
    for (const k of drop) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

interface RequestBody {
  submission_id?: number;
  platform?: string;
  post_url?: string;
  screenshot_path?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Auth: pull caller from JWT.
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";
  if (!accessToken) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }
  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userResult?.user?.id) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }
  const userId = userResult.user.id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const submissionId = typeof body.submission_id === "number" ? body.submission_id : null;
  const platform = (body.platform ?? "").toLowerCase();
  const postUrlRaw = (body.post_url ?? "").trim();
  const screenshotPath = body.screenshot_path ?? null;

  if (!submissionId) return jsonResponse({ error: "Missing submission_id" }, 400);
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return jsonResponse({ error: "Invalid platform" }, 400);
  }
  if (!postUrlRaw) return jsonResponse({ error: "post_url required" }, 400);
  if (!isValidUrl(postUrlRaw)) {
    return jsonResponse({ error: "post_url must be a valid http(s) URL" }, 400);
  }
  const postUrl = normalizeUrl(postUrlRaw);

  // Verify the submission exists, belongs to the caller, and is approved.
  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("submissions")
    .select("id, user_id, status")
    .eq("id", submissionId)
    .single();
  if (submissionError || !submission) {
    return jsonResponse({ error: "Submission not found" }, 404);
  }
  if (submission.user_id !== userId) {
    return jsonResponse({ error: "Submission does not belong to caller" }, 403);
  }
  if (submission.status !== "approved") {
    return jsonResponse({ error: "Submission must be approved before sharing" }, 400);
  }

  // Global URL dedup — reject if any other share row already references this
  // (normalized) URL, regardless of user / platform / status. The user's own
  // existing row for this same (submission, platform) is allowed (re-submit /
  // upsert pattern below).
  const { data: dupRows, error: dupError } = await supabaseAdmin
    .from("submission_shares")
    .select("id, user_id, submission_id, platform")
    .eq("post_url", postUrl);
  if (dupError) {
    console.error("[verify-share] dedup query failed:", dupError);
    return jsonResponse({ error: "Internal error" }, 500);
  }
  const ownRowExists = (dupRows ?? []).some(
    (r) => r.user_id === userId && r.submission_id === submissionId && r.platform === platform,
  );
  const conflicting = (dupRows ?? []).some(
    (r) => !(r.user_id === userId && r.submission_id === submissionId && r.platform === platform),
  );
  if (conflicting) {
    return jsonResponse(
      { error: "This post URL has already been submitted by another share" },
      409,
    );
  }

  // Upsert: same (submission_id, platform) replaces the row (user fixing a
  // mistake before admin verifies). The UNIQUE constraint on
  // (submission_id, platform) guarantees one row per pair.
  const upsertPayload = {
    submission_id: submissionId,
    user_id: userId,
    platform,
    post_url: postUrl,
    screenshot_path: screenshotPath,
    status: "pending",
    ai_review_meta: null,
  };

  let row;
  if (ownRowExists) {
    const { data, error } = await supabaseAdmin
      .from("submission_shares")
      .update(upsertPayload)
      .eq("submission_id", submissionId)
      .eq("platform", platform)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) {
      console.error("[verify-share] update failed:", error);
      return jsonResponse({ error: "Failed to record share" }, 500);
    }
    row = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("submission_shares")
      .insert(upsertPayload)
      .select()
      .single();
    if (error) {
      console.error("[verify-share] insert failed:", error);
      return jsonResponse({ error: "Failed to record share" }, 500);
    }
    row = data;
  }

  return jsonResponse({ row, status: "pending" }, 200);
});
