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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY or ANTHROPIC_API_KEY");
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

// Claude Vision caps each image at 5MB as base64-encoded data (~3.75MB raw).
// Keep raw bytes safely under that so the encoded payload never exceeds the cap.
const MAX_IMAGE_RAW_BYTES = 3_670_016;
// Profile UUID used as `reviewed_by` for AI auto-reviews.
// Points to the wegood4u@gmail.com admin account, which is dedicated to the AI reviewer.
// `admin_notes` is the source of truth for whether a decision came from the AI vs a human.
const AI_REVIEWER_ID = "11b60765-9911-4985-9cbf-0ba4d568303c";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const RECEIPT_MAX_AGE_DAYS = 21;

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

interface FetchedImage {
  bytes: Uint8Array;
  mediaType: MediaType;
}

interface ExtractedSubmission {
  receipt: {
    date: string | null;
    total_amount: number | null;
    currency: string | null;
    merchant_name: string | null;
  };
  selfie: {
    person_visible: boolean;
    receipt_visible: boolean;
  };
}

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
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
  }

  return null;
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

function detectMediaType(bytes: Uint8Array, contentType: string | null, url: string): MediaType {
  if (contentType) {
    const normalized = contentType.split(";")[0].trim().toLowerCase();
    if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
    if (normalized === "image/png") return "image/png";
    if (normalized === "image/webp") return "image/webp";
    if (normalized === "image/gif") return "image/gif";
  }

  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp";
  }

  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    if (ext === "gif") return "image/gif";
  } catch {
    // ignore
  }

  return "image/jpeg";
}

async function fetchImageBytes(url: string): Promise<FetchedImage> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const contentType = response.headers.get("content-type");
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      return { bytes, mediaType: detectMediaType(bytes, contentType, url) };
    }
  } catch (error) {
    console.warn("Image fetch failed via URL, falling back to storage path", error);
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

  let bytes: Uint8Array;
  let contentType: string | null = null;

  if (typeof (data as any).arrayBuffer === "function") {
    const buffer = await (data as any).arrayBuffer();
    bytes = new Uint8Array(buffer);
    contentType = typeof (data as any).type === "string" ? (data as any).type : null;
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    throw new Error("Unsupported storage response type when downloading image");
  }

  return { bytes, mediaType: detectMediaType(bytes, contentType, url) };
}

function encodeBase64(bytes: Uint8Array): string {
  // Chunked conversion to avoid stack overflow on multi-MB images.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
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

function merchantNameMatches(extractedName: string | null, partnerStoreName: string | null): boolean {
  if (!extractedName || !partnerStoreName) return false;
  const a = extractedName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = partnerStoreName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function isReceiptTooOld(receiptDate: string, submissionCreatedAt: string): boolean {
  const receipt = new Date(receiptDate);
  const submitted = new Date(submissionCreatedAt);
  if (Number.isNaN(receipt.getTime()) || Number.isNaN(submitted.getTime())) return false;
  const diffMs = submitted.getTime() - receipt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > RECEIPT_MAX_AGE_DAYS;
}

async function extractSubmissionData(
  receipt: FetchedImage,
  selfie: FetchedImage,
): Promise<ExtractedSubmission> {
  const receiptB64 = encodeBase64(receipt.bytes);
  const selfieB64 = encodeBase64(selfie.bytes);

  const prompt = `You are reviewing a loyalty-program submission. You are shown two images:
- Image 1: the RECEIPT photo.
- Image 2: the SELFIE the user took when submitting.

Return EXACTLY valid JSON matching this schema, with no surrounding text, no markdown fencing, and no explanation:

{
  "receipt": {
    "date": "YYYY-MM-DD" | null,
    "total_amount": number | null,
    "currency": string | null,
    "merchant_name": string | null
  },
  "selfie": {
    "person_visible": boolean,
    "receipt_visible": boolean
  }
}

Field rules:
- receipt.date: transaction date printed on the receipt, normalized to ISO YYYY-MM-DD. null if unreadable.
- receipt.total_amount: numeric grand total paid (just the number, e.g. 42.5). null if unreadable.
- receipt.currency: currency code as printed (e.g. "MYR", "USD", "RM"). null if not clearly indicated.
- receipt.merchant_name: merchant or store name as printed at the top of the receipt. null if unreadable.
- selfie.person_visible: true ONLY if a clearly recognizable human face is visible in the selfie image.
- selfie.receipt_visible: true ONLY if a physical paper receipt is also visible in the selfie image (typically held in frame by the person).

Return the JSON object only.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: receipt.mediaType, data: receiptB64 },
            },
            {
              type: "image",
              source: { type: "base64", media_type: selfie.mediaType, data: selfieB64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${body}`);
  }

  const result = await response.json();
  const textBlock = Array.isArray(result?.content)
    ? result.content.find((block: any) => block?.type === "text")
    : null;
  const completionText = typeof textBlock?.text === "string" ? textBlock.text : "";
  const jsonMatch = completionText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Unable to parse submission analysis response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const receiptData = parsed?.receipt ?? {};
  const selfieData = parsed?.selfie ?? {};
  const totalAmountRaw = receiptData.total_amount;
  const totalAmount = totalAmountRaw !== undefined && totalAmountRaw !== null
    ? Number(totalAmountRaw)
    : NaN;

  return {
    receipt: {
      date: receiptData.date ? normalizeDate(receiptData.date) : null,
      total_amount: Number.isFinite(totalAmount) ? totalAmount : null,
      currency: receiptData.currency ? String(receiptData.currency).trim() : null,
      merchant_name: receiptData.merchant_name ? String(receiptData.merchant_name).trim() : null,
    },
    selfie: {
      person_visible: selfieData.person_visible === true,
      receipt_visible: selfieData.receipt_visible === true,
    },
  };
}

async function checkHashDuplicate(submissionId: number, userId: string, receiptHash: string) {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("receipt_hash", receiptHash)
    .in("status", ["approved", "pending"])
    .neq("id", submissionId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to query hash duplicates: ${error.message}`);
  }

  const prior = data?.[0];
  if (prior) {
    return {
      found: true as const,
      reason: `Duplicate receipt image detected against submission #${prior.id} (${prior.status}).`,
    };
  }
  return { found: false as const, reason: null };
}

async function checkFuzzyDuplicate(
  submission: any,
  receiptDate: string,
  totalAmount: number,
) {
  const { data: priorSubmissions, error } = await supabaseAdmin
    .from("submissions")
    .select("id, partner_store_name, receipt_date, total_amount, status")
    .eq("user_id", submission.user_id)
    .in("status", ["approved", "pending"])
    .neq("id", submission.id);

  if (error) {
    throw new Error(`Failed to query prior submissions: ${error.message}`);
  }

  const normalizedStore = String(submission.partner_store_name || "").trim().toLowerCase();
  const tolerance = 0.05;

  for (const prior of priorSubmissions || []) {
    const priorStore = String(prior.partner_store_name || "").trim().toLowerCase();
    const sameStore = normalizedStore && priorStore === normalizedStore;
    const sameDate = prior.receipt_date === receiptDate;
    const amountClose = typeof prior.total_amount === "number"
      ? Math.abs(totalAmount - Number(prior.total_amount)) <= tolerance
      : false;

    if (sameStore && sameDate && amountClose) {
      return {
        found: true as const,
        reason: `Same store, same date, and same amount as submission #${prior.id} (${prior.status}).`,
      };
    }

    if (sameStore && sameDate) {
      return {
        found: true as const,
        reason: `Same store and receipt date as submission #${prior.id} (${prior.status}).`,
      };
    }
  }

  return { found: false as const, reason: null };
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

    // Atomic claim: only one invocation proceeds past this point per submission.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("submissions")
      .update({ reviewed_by: AI_REVIEWER_ID })
      .eq("id", submissionId)
      .eq("status", "pending")
      .is("reviewed_by", null)
      .select("id");

    if (claimError) {
      console.error("Failed to claim submission", claimError);
      return jsonResponse({
        error: "Failed to claim submission for review",
        details: claimError.message,
      }, 500);
    }

    if (!claimed || claimed.length === 0) {
      return jsonResponse({
        submission_id: submissionId,
        warning: "Submission already claimed by another reviewer — skipping.",
      });
    }

    let receiptImg: FetchedImage;
    let selfieImg: FetchedImage;
    try {
      [receiptImg, selfieImg] = await Promise.all([
        fetchImageBytes(submission.receipt_url),
        fetchImageBytes(submission.selfie_url),
      ]);
    } catch (error) {
      console.error("Failed to fetch submission images", error);
      const notes = `Failed to download submission images: ${(error as Error).message}`;
      await supabaseAdmin
        .from("submissions")
        .update({ admin_notes: notes, reviewed_by: AI_REVIEWER_ID })
        .eq("id", submissionId);
      return jsonResponse({
        error: "Failed to fetch submission images",
        details: (error as Error).message,
      }, 500);
    }

    const receiptHash = await sha256(receiptImg.bytes);

    const hashDup = await checkHashDuplicate(submissionId, submission.user_id, receiptHash);

    const oversizeReceipt = receiptImg.bytes.byteLength > MAX_IMAGE_RAW_BYTES;
    const oversizeSelfie = selfieImg.bytes.byteLength > MAX_IMAGE_RAW_BYTES;

    let extracted: ExtractedSubmission = {
      receipt: { date: null, total_amount: null, currency: null, merchant_name: null },
      selfie: { person_visible: false, receipt_visible: false },
    };
    let aiError: string | null = null;

    if (!hashDup.found && !oversizeReceipt && !oversizeSelfie) {
      try {
        extracted = await extractSubmissionData(receiptImg, selfieImg);
      } catch (error) {
        console.warn("Submission extraction failed", error);
        aiError = (error as Error).message;
      }
    }

    const receiptDate = extracted.receipt.date;
    const totalAmount = extracted.receipt.total_amount;
    const selfie = extracted.selfie;

    // Phase 1: AI only approves or leaves pending — never rejects.
    // Collect ALL issues so admin sees the full picture in one glance.
    const issues: string[] = [];

    // Duplicate checks
    if (hashDup.found) {
      issues.push(hashDup.reason);
    }

    // Image size
    if (oversizeReceipt) issues.push("Receipt image exceeds 5MB size limit");
    if (oversizeSelfie) issues.push("Selfie image exceeds 5MB size limit");

    // AI extraction failures
    if (aiError) issues.push(`AI extraction error: ${aiError}`);
    if (!receiptDate) issues.push("Receipt date not detected");
    if (totalAmount === null) issues.push("Receipt total not detected");
    if (!selfie.person_visible) issues.push("No person detected in selfie");
    if (!selfie.receipt_visible) issues.push("No receipt visible in selfie");

    // 21-day freshness check (only if date was extracted)
    if (receiptDate && isReceiptTooOld(receiptDate, submission.created_at)) {
      issues.push(`Receipt date (${receiptDate}) is older than ${RECEIPT_MAX_AGE_DAYS} days from submission`);
    }

    // Merchant name vs partner store match (only if merchant was extracted)
    if (extracted.receipt.merchant_name && !merchantNameMatches(extracted.receipt.merchant_name, submission.partner_store_name)) {
      issues.push(`Merchant name "${extracted.receipt.merchant_name}" does not match selected partner store "${submission.partner_store_name}"`);
    }

    // Fuzzy duplicate check (only if extraction succeeded)
    if (receiptDate && totalAmount !== null) {
      const fuzzyDup = await checkFuzzyDuplicate(submission, receiptDate, totalAmount);
      if (fuzzyDup.found) {
        issues.push(fuzzyDup.reason);
      }
    }

    let decision: "approved" | "pending" = "pending";
    let adminNotes: string;

    if (issues.length === 0) {
      decision = "approved";
      adminNotes = "Auto-approved: receipt parsed, selfie verified, merchant matches, no duplicates, receipt within 21 days.";
    } else {
      adminNotes = `AI review flagged ${issues.length} issue(s): ${issues.join("; ")}.`;
    }

    const updatePayload: Record<string, unknown> = {
      receipt_hash: receiptHash,
      receipt_date: receiptDate,
      total_amount: totalAmount,
      currency: extracted.receipt.currency,
      merchant_name: extracted.receipt.merchant_name,
      admin_notes: adminNotes,
      reviewed_by: AI_REVIEWER_ID,
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
      extracted_data: extracted,
      receipt_hash: receiptHash,
    });
  } catch (error) {
    console.error("Unexpected error in review-submission function", error);
    return jsonResponse({ error: "Internal server error", details: (error as Error).message }, 500);
  }
});
