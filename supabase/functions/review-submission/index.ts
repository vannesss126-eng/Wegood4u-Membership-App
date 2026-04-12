import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  throw new Error("Missing Supabase environment variables");
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function parseSubmissionId(body: any): number | null {
  const candidates = [
    body?.submission_id,
    body?.submissionId,
    body?.new?.id,
    body?.record?.id,
    body?.payload?.new?.id,
    body?.payload?.record?.id,
    body?.event?.new?.id,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && /^\\d+$/.test(candidate)) return Number(candidate);
  }

  return null;
}

async function fetchImageBytes(url: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    }
  } catch (error) {
    console.warn("Receipt fetch failed via URL, falling back to storage path", error);
  }

  const parsed = parseSupabaseStoragePath(url);
  if (!parsed) {
    throw new Error("Unable to resolve image URL to Supabase storage path");
  }

  const { data, error } = await supabaseAdmin.storage
    .from(parsed.bucket)
    .download(parsed.path);

  if (error || !data) {
    throw new Error(`Failed to download image from storage: ${error?.message ?? "unknown"}`);
  }

  if (typeof (data as any).arrayBuffer === "function") {
    const buffer = await (data as any).arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  throw new Error("Unsupported storage response type when downloading image");
}

function parseSupabaseStoragePath(urlString: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split("/").filter(Boolean);

    const publicIndex = segments.indexOf("public");
    if (publicIndex >= 0 && segments.length > publicIndex + 2) {
      const bucket = segments[publicIndex + 1];
      const path = segments.slice(publicIndex + 2).join("/");
      return { bucket, path };
    }

    const objectIndex = segments.indexOf("object");
    if (objectIndex >= 0 && segments.length > objectIndex + 3) {
      const bucket = segments[objectIndex + 2];
      const path = segments.slice(objectIndex + 3).join("/");
      return { bucket, path };
    }

    return null;
  } catch {
    return null;
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeDate(input: string): string | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function extractReceiptData(receiptUrl: string): Promise<{
  date: string | null;
  total_amount: number | null;
  currency: string | null;
  merchant_name: string | null;
}> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const prompt = `You are an AI receipt parser. The receipt image is available at the following URL: ${receiptUrl}. Extract the following fields and return EXACTLY valid JSON only, without any explanatory text.

{
  "date": "YYYY-MM-DD" | null,
  "total_amount": numeric | null,
  "currency": string | null,
  "merchant_name": string | null
}

If a field cannot be determined accurately, return null for that field.`;

  const response = await fetch("https://api.anthropic.com/v1/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: "claude-3.5-mini",
      prompt,
      max_tokens_to_sample: 400,
      temperature: 0,
      top_p: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${body}`);
  }

  const result = await response.json();
  const completionText = (result?.completion ?? result?.output ?? "").toString();
  const jsonMatch = completionText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Unable to parse receipt extraction response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const totalAmount = parsed.total_amount !== undefined && parsed.total_amount !== null
    ? Number(parsed.total_amount)
    : NaN;

  return {
    date: parsed.date ? normalizeDate(parsed.date) : null,
    total_amount: Number.isFinite(totalAmount) ? totalAmount : null,
    currency: parsed.currency ? String(parsed.currency).trim() : null,
    merchant_name: parsed.merchant_name ? String(parsed.merchant_name).trim() : null,
  };
}

async function checkDuplicateSubmission(
  submission: any,
  receiptHash: string,
  receiptDate: string | null,
  totalAmount: number | null
) {
  const { data: priorSubmissions, error } = await supabaseAdmin
    .from("submissions")
    .select("id, receipt_hash, partner_store_name, receipt_date, total_amount, status")
    .eq("user_id", submission.user_id)
    .eq("status", "approved")
    .neq("id", submission.id);

  if (error) {
    throw new Error(`Failed to query prior submissions: ${error.message}`);
  }

  const normalizedStore = String(submission.partner_store_name || "").trim().toLowerCase();
  const tolerance = 0.05;

  for (const prior of priorSubmissions || []) {
    if (prior.receipt_hash && prior.receipt_hash === receiptHash) {
      return {
        found: true,
        reason: `Duplicate receipt image detected against approved submission #${prior.id}.`,
      };
    }

    const priorStore = String(prior.partner_store_name || "").trim().toLowerCase();
    const sameStore = normalizedStore && priorStore === normalizedStore;
    const sameDate = receiptDate && prior.receipt_date === receiptDate;
    const amountClose = typeof totalAmount === "number" && typeof prior.total_amount === "number"
      ? Math.abs(totalAmount - Number(prior.total_amount)) <= tolerance
      : false;

    if (sameStore && sameDate && amountClose) {
      return {
        found: true,
        reason: `Same store, same date, and same amount detected against approved submission #${prior.id}.`,
      };
    }

    if (sameStore && sameDate) {
      return {
        found: true,
        reason: `Possible duplicate: same store and receipt date as approved submission #${prior.id}.`,
      };
    }
  }

  return { found: false, reason: null };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse({}, 204);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const submissionId = parseSubmissionId(body);
    if (!submissionId) {
      return jsonResponse({ error: "Missing submission_id or payload.new.id" }, 400);
    }

    const { data: submission, error: fetchError } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      console.error("Submission not found", fetchError);
      return jsonResponse({ error: "Submission not found" }, 404);
    }

    if (submission.status !== "pending") {
      return jsonResponse({
        submission_id: submissionId,
        warning: `Submission status is '${submission.status}', only pending submissions are processed.`,
      });
    }

    const receiptBytes = await fetchImageBytes(submission.receipt_url);
    const receiptHash = await sha256(receiptBytes);

    let extracted: {
      date: string | null;
      total_amount: number | null;
      currency: string | null;
      merchant_name: string | null;
    } = {
      date: null,
      total_amount: null,
      currency: null,
      merchant_name: null,
    };

    let aiError: string | null = null;
    try {
      extracted = await extractReceiptData(submission.receipt_url);
    } catch (error) {
      console.warn("Receipt extraction failed", error);
      aiError = (error as Error).message;
    }

    const receiptDate = extracted.date;
    const totalAmount = extracted.total_amount;
    const missingFields: string[] = [];
    if (!receiptDate) missingFields.push("date");
    if (totalAmount === null) missingFields.push("total amount");

    let decision: "approved" | "rejected" | "pending" = "pending";
    let adminNotes = "AI review pending manual confirmation.";
    let duplicateMatch: string | null = null;

    if (receiptDate && totalAmount !== null) {
      const duplicate = await checkDuplicateSubmission(submission, receiptHash, receiptDate, totalAmount);
      if (duplicate.found) {
        decision = "rejected";
        adminNotes = duplicate.reason || "Duplicate submission detected.";
        duplicateMatch = duplicate.reason;
      } else {
        decision = "approved";
        adminNotes = "Auto-approved by AI review. Receipt date and total amount extracted successfully.";
      }
    } else {
      adminNotes = `AI receipt parsing incomplete: missing ${missingFields.join(", ")}. ${aiError ? `Error: ${aiError}` : ""}`.trim();
    }

    const updatePayload: Record<string, unknown> = {
      receipt_hash: receiptHash,
      receipt_date: receiptDate,
      total_amount: totalAmount,
      currency: extracted.currency,
      merchant_name: extracted.merchant_name,
      admin_notes: adminNotes,
    };

    if (decision !== "pending") {
      updatePayload.status = decision;
      updatePayload.reviewed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("submissions")
      .update(updatePayload)
      .eq("id", submissionId);

    if (updateError) {
      console.error("Failed to update submission", updateError);
      return jsonResponse({ error: "Failed to update submission record" }, 500);
    }

    return jsonResponse({
      submission_id: submissionId,
      decision,
      admin_notes: adminNotes,
      duplicate_match: duplicateMatch,
      extracted_data: extracted,
      receipt_hash: receiptHash,
    });
  } catch (error) {
    console.error("Unexpected error in review-submission function", error);
    return jsonResponse({ error: "Internal server error", details: (error as Error).message }, 500);
  }
});
