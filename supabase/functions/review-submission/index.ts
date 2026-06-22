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
// Optional shared secret. When set, review-submission requires a matching
// x-webhook-secret header (sent by the trigger_ai_review_submission DB trigger).
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

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
    invoice_no: string | null;
    diner_count: number | null;
    adult_set_items: { name: string; qty: number }[];
    address: string | null;
    postal_code: string | null;
    city: string | null;
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

async function downloadFromStorage(bucket: string, path: string, mediaHint: string): Promise<FetchedImage> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);

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

  return { bytes, mediaType: detectMediaType(bytes, contentType, mediaHint) };
}

// `value` is either a bare object path (new private-bucket submissions) or, for
// legacy rows, a full public URL. `bucket` is the bucket the column belongs to.
async function fetchImageBytes(bucket: string, value: string): Promise<FetchedImage> {
  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value);
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        return { bytes, mediaType: detectMediaType(bytes, contentType, value) };
      }
    } catch (error) {
      console.warn("Image fetch failed via URL, falling back to storage path", error);
    }
    const parsed = parseSupabaseStoragePath(value);
    if (!parsed) {
      throw new Error("Unable to resolve image URL to Supabase storage path");
    }
    return downloadFromStorage(parsed.bucket, parsed.path, value);
  }

  // Private bucket: download directly by path with the service role.
  return downloadFromStorage(bucket, value, value);
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

  // Fast path: punctuation-insensitive substring (handles "(Bukit Jalil)" vs "• Bukit Jalil").
  const a = extractedName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = partnerStoreName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  // Token-subset path: all of the shorter name's significant words appear in the longer.
  // Handles extra words on ONE side only — e.g. store "… Bandar Bukit Raja" vs receipt
  // "… Bukit Raja", or store "… Signature … Buffet SS2" vs receipt "… Mookata SS2".
  // The branch token (bukit/raja/ss2/kepong …) still discriminates wrong-branch receipts,
  // and the address check (Phase 4f) is the second branch guard.
  const STOP = new Set(["sdn", "bhd", "mookata", "buffet", "signature", "restaurant", "the"]);
  const tokens = (s: string) =>
    new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t)));
  const ta = tokens(extractedName);
  const tb = tokens(partnerStoreName);
  if (ta.size === 0 || tb.size === 0) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const t of small) {
    if (!big.has(t)) return false;
  }
  return true;
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
    "merchant_name": string | null,
    "invoice_no": string | null,
    "adult_set_items": [{ "name": string, "qty": number }],
    "diner_count": number | null,
    "address": string | null,
    "postal_code": string | null,
    "city": string | null
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
- receipt.merchant_name: the merchant's PRIMARY TRADING NAME as printed at the top, INCLUDING any branch shown in brackets or after a slash (e.g. "THAI GENG MOOKATA (BUKIT JALIL)"). Prefer this brand line over a legal-entity line like "... SDN. BHD.". null if unreadable.
- receipt.invoice_no: the invoice / bill / receipt number printed on the receipt (e.g. "8483"). null if none is printed.
- receipt.adult_set_items: per-person buffet SET/PACKAGE line items that count as a diner — e.g. "Basic Set (Adult)", "Premium Set (Adult)", "Deluxe Buffet (Adult)", "Basic Set (Senior Citizen)", "Basic Set (Half Price)". EXCLUDE any set whose name contains Kid/Kids/Child/Children (e.g. "Basic Set (Free Kid)", "Basic Set (Kids)", "Basic Set (Birthday - Kid)"). Each as { name, qty } using the printed Qty. Empty array if none.
- receipt.diner_count: number of diners = the SUM of receipt.adult_set_items quantities (all per-person sets EXCEPT children's sets). Do NOT use any printed "Table pax"/"pax" field (it is unreliable — a real receipt printed pax=1 while 2 adults ate). Do NOT use the subtotal total-quantity. Ignore drinks, sides, soups and add-on upgrades. null if no qualifying set line is found.
- receipt.address: the merchant's full printed address block near the top of the receipt. null if not printed.
- receipt.postal_code: the postal code from that address (e.g. "57000"). null if not printed.
- receipt.city: the city / locality from that address (e.g. "Kuala Lumpur"). null if not printed.
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

  // Per-person buffet set lines (adult/senior/half-price etc., EXCLUDING kids) → diner
  // count. Recompute the sum from the listed items (more robust than the model's own
  // arithmetic); fall back to the model's diner_count only when it listed no items.
  const adultSetItems = (Array.isArray(receiptData.adult_set_items) ? receiptData.adult_set_items : [])
    .map((it: any) => ({ name: String(it?.name ?? "").trim(), qty: Math.trunc(Number(it?.qty)) }))
    .filter((it: any) => it.name && Number.isFinite(it.qty) && it.qty > 0);
  const setsSum = adultSetItems.reduce((acc: number, it: any) => acc + it.qty, 0);
  const modelDinerCount =
    receiptData.diner_count !== undefined && receiptData.diner_count !== null && Number.isFinite(Number(receiptData.diner_count))
      ? Math.trunc(Number(receiptData.diner_count))
      : null;
  const dinerCount = adultSetItems.length > 0 ? setsSum : modelDinerCount;

  return {
    receipt: {
      date: receiptData.date ? normalizeDate(receiptData.date) : null,
      total_amount: Number.isFinite(totalAmount) ? totalAmount : null,
      currency: receiptData.currency ? String(receiptData.currency).trim() : null,
      merchant_name: receiptData.merchant_name ? String(receiptData.merchant_name).trim() : null,
      invoice_no: receiptData.invoice_no ? String(receiptData.invoice_no).trim() : null,
      diner_count: dinerCount !== null && dinerCount > 0 ? dinerCount : null,
      adult_set_items: adultSetItems,
      address: receiptData.address ? String(receiptData.address).trim() : null,
      postal_code: receiptData.postal_code ? String(receiptData.postal_code).trim() : null,
      city: receiptData.city ? String(receiptData.city).trim() : null,
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

function extractPostalCode(text: string | null): string | null {
  if (!text) return null;
  const match = String(text).match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

function normalizeForMatch(value: string | null): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Address corroboration (Phase 4f). Returns a conflict reason, or null when the
// address is consistent OR there isn't enough signal to judge (missing ≠ fail).
function addressConflictReason(
  receiptPostal: string | null,
  receiptAddress: string | null,
  receiptCity: string | null,
  dbAddress: string | null,
  dbCity: string | null,
): string | null {
  const rPC = receiptPostal ?? extractPostalCode(receiptAddress);
  const dbPC = extractPostalCode(dbAddress);

  // Strongest signal: both postal codes present. Equal → consistent; differ → conflict.
  if (rPC && dbPC) {
    return rPC === dbPC ? null : `Receipt postal code ${rPC} does not match store postal code ${dbPC}`;
  }

  // No postal pair — fall back to city. Flag only if both present and neither contains the other.
  const rCity = normalizeForMatch(receiptCity);
  const dCity = normalizeForMatch(dbCity);
  if (rCity && dCity && !rCity.includes(dCity) && !dCity.includes(rCity)) {
    return `Receipt city "${receiptCity}" does not match store city "${dbCity}"`;
  }

  return null;
}

// Per-receipt diner cap (Phase 4c). Counts DISTINCT OTHER users who already claimed
// the same physical receipt (grouped by invoice no, else date + total) and flags when
// that count has already reached the receipt's diner_count.
async function checkDinerLimit(
  submission: any,
  invoiceNo: string | null,
  receiptDate: string | null,
  totalAmount: number | null,
  dinerCount: number,
) {
  let query = supabaseAdmin
    .from("submissions")
    .select("user_id")
    .eq("partner_store_id", submission.partner_store_id)
    .in("status", ["approved", "pending"])
    .neq("id", submission.id)
    .neq("user_id", submission.user_id);

  if (invoiceNo) {
    query = query.eq("receipt_reference", invoiceNo);
  } else {
    query = query.eq("receipt_date", receiptDate).eq("total_amount", totalAmount);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to query diner-limit claimants: ${error.message}`);
  }

  // NOTE: soft cap. Two users submitting the same receipt within the same review
  // window may not see each other's receipt_reference yet (race at the exact boundary).
  // Acceptable because this only flags for human review, never auto-rejects.
  const distinctOthers = new Set((data ?? []).map((row: any) => row.user_id)).size;
  if (distinctOthers >= dinerCount) {
    return {
      found: true as const,
      reason: `Buffet receipt${invoiceNo ? ` #${invoiceNo}` : ""} already claimed by ${distinctOthers} other diner(s); limit is ${dinerCount}.`,
    };
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

    // Shared-secret gate: the DB trigger sends x-webhook-secret. Enforced only
    // when WEBHOOK_SECRET is configured, so the fn can ship before the secret is
    // set, then be activated by setting the env var + the Vault secret.
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
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

    // Matched partner store — needed for the diner cap (is_buffet) and address
    // corroboration. NULL on legacy submissions without a partner_store_id.
    let store: { address: string | null; city: string | null; is_buffet: boolean } | null = null;
    if (submission.partner_store_id) {
      const { data: storeRow, error: storeError } = await supabaseAdmin
        .from("partner_stores")
        .select("address, city, is_buffet")
        .eq("id", submission.partner_store_id)
        .maybeSingle();
      if (storeError) {
        console.warn("Failed to fetch partner store for review", storeError);
      }
      store = storeRow ?? null;
    }

    let receiptImg: FetchedImage;
    let selfieImg: FetchedImage;
    try {
      [receiptImg, selfieImg] = await Promise.all([
        fetchImageBytes("submitted-receipt", submission.receipt_url),
        fetchImageBytes("submitted-selfie", submission.selfie_url),
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
      receipt: {
        date: null, total_amount: null, currency: null, merchant_name: null,
        invoice_no: null, diner_count: null, adult_set_items: [],
        address: null, postal_code: null, city: null,
      },
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
    const invoiceNo = extracted.receipt.invoice_no;
    const dinerCount = extracted.receipt.diner_count;
    const adultSetItems = extracted.receipt.adult_set_items;
    const receiptAddress = extracted.receipt.address;
    const receiptPostal = extracted.receipt.postal_code;
    const receiptCity = extracted.receipt.city;

    // True only when the AI actually parsed the images (not skipped for hash-dup /
    // oversize / API error). The buffet + address checks below need real extracted data.
    const extractionRan = !hashDup.found && !oversizeReceipt && !oversizeSelfie && !aiError;

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

    // Per-receipt diner cap — buffet outlets only (store.is_buffet).
    if (extractionRan && store?.is_buffet) {
      if (dinerCount === null) {
        issues.push("Buffet receipt: number of adult sets (diner count) not detected — manual check needed.");
      } else if (!invoiceNo && (!receiptDate || totalAmount === null)) {
        issues.push("Buffet receipt: no invoice number (or date + total) to group claims — manual check needed.");
      } else {
        const dinerCheck = await checkDinerLimit(submission, invoiceNo, receiptDate, totalAmount, dinerCount);
        if (dinerCheck.found) issues.push(dinerCheck.reason);
      }
    }

    // Address corroboration vs the store's DB address — flag only on a clear conflict.
    if (extractionRan && store) {
      const addrConflict = addressConflictReason(receiptPostal, receiptAddress, receiptCity, store.address, store.city);
      if (addrConflict) issues.push(addrConflict);
    }

    let decision: "approved" | "pending" | "rejected" = "pending";
    let adminNotes: string;

    if (issues.length === 0) {
      decision = "approved";
      adminNotes = "Auto-approved: receipt parsed, selfie verified, merchant matches, no duplicates, receipt within 21 days.";
    } else if (hashDup.found) {
      // Exact same-user receipt-image duplicate: a definitive re-submission, not a
      // judgment call. Auto-reject it — it can never be farmed, and it upholds the
      // per-user unique index on (user_id, receipt_hash) for non-rejected rows.
      decision = "rejected";
      adminNotes = `Auto-rejected (duplicate): ${issues.join("; ")}.`;
    } else {
      adminNotes = `AI review flagged ${issues.length} issue(s): ${issues.join("; ")}.`;
    }

    // Buffet audit trail: record how pax was derived so an admin can verify a flag.
    if (extractionRan && store?.is_buffet && dinerCount !== null) {
      const setsDesc = adultSetItems.map((it) => `${it.name}×${it.qty}`).join(", ");
      adminNotes += ` [Buffet pax=${dinerCount}${setsDesc ? ` from ${setsDesc}` : ""}; invoice ${invoiceNo ?? "n/a"}]`;
    }

    const updatePayload: Record<string, unknown> = {
      receipt_hash: receiptHash,
      receipt_date: receiptDate,
      total_amount: totalAmount,
      currency: extracted.receipt.currency,
      merchant_name: extracted.receipt.merchant_name,
      receipt_reference: invoiceNo,
      diner_count: dinerCount,
      receipt_address: receiptAddress,
      admin_notes: adminNotes,
      reviewed_by: AI_REVIEWER_ID,
    };

    if (decision !== "pending") {
      updatePayload.status = decision;
      updatePayload.reviewed_at = new Date().toISOString();
    }

    const firstUpdate = await supabaseAdmin
      .from("submissions")
      .update(updatePayload)
      .eq("id", submissionId);
    let updateError = firstUpdate.error;

    // Backstop for a race where two identical submissions are processed
    // concurrently: the per-user unique index (user_id, receipt_hash) on
    // non-rejected rows rejects the second hash write with 23505. Treat it as the
    // duplicate it is and reject (a rejected row is excluded from the index).
    if (updateError && (updateError as { code?: string }).code === "23505") {
      decision = "rejected";
      adminNotes = "Auto-rejected (duplicate): a prior submission already holds this receipt.";
      const retry = await supabaseAdmin
        .from("submissions")
        .update({
          ...updatePayload,
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes,
        })
        .eq("id", submissionId);
      updateError = retry.error;
    }

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
