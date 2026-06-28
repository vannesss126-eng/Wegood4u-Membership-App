import { createClient } from "npm:@supabase/supabase-js@2";

console.info("delete-account function starting");

// Environment variables (provided automatically in hosted Supabase)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  throw new Error("Missing Supabase environment variables");
}

// Create an admin client using the service role key
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// User content is stored across these private buckets, each keyed by a
// `${uid}/` folder prefix (see the storage RLS policies in the migrations).
// ALL of them must be purged on account deletion. NOTE: the previous value
// ("user-uploads") was a bucket that does not exist, so no user files were ever
// deleted — receipts (PII) and selfies (faces) were orphaned in storage while
// the function still returned success.
const STORAGE_BUCKETS = [
  "submitted-receipt",
  "submitted-selfie",
  "profilePic",
  "submission-share-screenshots",
];
const STORAGE_PAGE_SIZE = 1000;
const storagePrefixFor = (uid: string) => `${uid}/`;

// Simple JSON response helper
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

// Main handler using Deno.serve
Deno.serve(async (req: Request) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") return jsonResponse({}, 204);
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    // Expect Authorization: Bearer <token>
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);

    // Verify token and obtain user info
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.getUser(token);
    if (getUserError || !userData?.user) {
      console.warn("auth.getUser failed", getUserError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // 1) Call DB RPC to delete user data (transactional server-side operation)
    const { error: rpcError } = await supabaseAdmin.rpc("delete_user_data", { p_user_id: userId });
    if (rpcError) {
      console.error("RPC app.delete_user_data error:", rpcError);
      // Return 500 since DB cleanup failed
      return jsonResponse({ error: "Failed to delete DB records", details: rpcError.message ?? rpcError }, 500);
    }

    // 2) Delete storage objects under the user's prefix in EVERY user-content
    //    bucket (best-effort, paginated). IMPORTANT: paths returned by
    //    .list(prefix) are RELATIVE to the prefix, so they must be re-prefixed
    //    with `${uid}/` before passing to .remove(), or nothing is deleted.
    const storageFailures: string[] = [];
    const prefix = storagePrefixFor(userId);
    for (const bucket of STORAGE_BUCKETS) {
      try {
        let offset = 0;
        while (true) {
          const listRes = await supabaseAdmin.storage
            .from(bucket)
            .list(prefix, { limit: STORAGE_PAGE_SIZE, offset });

          if (listRes.error) {
            console.warn(`storage.list error [${bucket}]`, listRes.error);
            storageFailures.push(`${bucket}:list_error:${String(listRes.error.message ?? listRes.error)}`);
            break;
          }

          const items = listRes.data ?? [];
          if (items.length === 0) break;

          const paths = items.map((it: any) => `${prefix}${it.name}`);
          const rm = await supabaseAdmin.storage.from(bucket).remove(paths);
          if (rm.error) {
            console.warn(`storage.remove error [${bucket}]`, rm.error);
            storageFailures.push(`${bucket}:remove_error_offset_${offset}:${String(rm.error.message ?? rm.error)}`);
            // Continue attempting further pages
          }

          // If fewer than page size, we're done with this bucket
          if (items.length < STORAGE_PAGE_SIZE) break;
          offset += STORAGE_PAGE_SIZE;
        }
      } catch (e) {
        console.warn(`Unexpected exception during storage cleanup [${bucket}]`, e);
        storageFailures.push(`${bucket}:exception:${String(e)}`);
      }
    }

    // 3) Delete the Auth user (final step)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error("auth.admin.deleteUser error:", deleteUserError);
      // Return 500 since auth deletion failed
      return jsonResponse({ error: "Failed to delete auth user", details: deleteUserError.message ?? deleteUserError }, 500);
    }

    // Success — include any storage cleanup failures for visibility
    return jsonResponse({ success: true, storageFailures });
  } catch (err) {
    console.error("Unexpected error in delete-account function:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});