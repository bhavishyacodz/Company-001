import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { readBodyLimited } from "../_shared/request-body.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",").map((s) => s.trim()).filter(Boolean);
const jsonHeaders = (origin: string) => ({
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": allowedOrigins.includes("*") || allowedOrigins.includes(origin) ? origin || "*" : allowedOrigins[0] || "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

function reply(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders(origin) });
}
const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function detectImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return { ext: "png", type: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: "jpg", type: "image/jpeg" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "*";
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "Method not allowed." });
  let bodyBytes: Uint8Array | null;
  try {
    bodyBytes = await readBodyLimited(req, 4_000_000);
  } catch {
    return reply(origin, 400, { error: "Invalid registration form." });
  }
  if (!bodyBytes) return reply(origin, 413, { error: "Request is too large." });

  let form: FormData;
  try {
    form = await new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: new Blob([bodyBytes.buffer as ArrayBuffer]),
    }).formData();
  } catch {
    return reply(origin, 400, { error: "Invalid registration form." });
  }

  // Honeypot for basic automated submissions.
  if (clean(form.get("website"), 200)) return reply(origin, 200, { ok: true });
  const organizerSlug = clean(form.get("organizer_slug"), 50).toLowerCase();
  const eventSlug = clean(form.get("event_slug"), 60).toLowerCase();
  const participantName = clean(form.get("participant_name"), 120);
  const participantEmail = clean(form.get("participant_email"), 254).toLowerCase();
  const gameId = clean(form.get("game_id"), 100);
  const teamName = clean(form.get("team_name"), 100);

  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(organizerSlug) ||
      !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(eventSlug) ||
      participantName.length < 2 || !validEmail(participantEmail)) {
    return reply(origin, 400, { error: "Please check the required registration details." });
  }

  // Prefer the edge-provided client IP. When using the gateway's forwarded
  // chain, use its rightmost address rather than a client-supplied first entry.
  const forwarded = req.headers.get("cf-connecting-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "unknown";
  const ipHash = await sha256(forwarded + (Deno.env.get("RATE_LIMIT_PEPPER") ?? supabaseUrl));
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 600000) * 600000).toISOString();
  const { data: allowed, error: limitError } = await admin.rpc("consume_registration_rate_limit", {
    p_ip_hash: ipHash, p_window_start: windowStart, p_limit: 10,
  });
  if (limitError) {
    console.error("rate_limit_check_failed");
    return reply(origin, 503, { error: "Registration is temporarily unavailable. Please try again later." });
  }
  if (!allowed) return reply(origin, 429, { error: "Too many attempts. Please wait a few minutes and try again." });

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, organizer_id, title, category, entry_fee_minor, status, registration_closes_at, branding, organizers!inner(slug,status,owner_user_id,plan_key,storage_quota_bytes,max_screenshot_bytes,max_screenshots,max_responses_per_form)")
    .eq("slug", eventSlug)
    .eq("organizers.slug", organizerSlug)
    .eq("status", "published")
    .eq("organizers.status", "approved")
    .maybeSingle();

  if (eventError) {
    console.error("event_lookup_failed");
    return reply(origin, 503, { error: "Could not verify this event right now." });
  }
  if (!event) return reply(origin, 404, { error: "This registration page is not available." });
  const organizerOwnerId = (event.organizers as { owner_user_id?: string } | null)?.owner_user_id;
  if (!organizerOwnerId) return reply(origin, 503, { error: "Could not verify this event right now." });
  const { data: organizerAccountActive, error: organizerAccountStatusError } = await admin.rpc(
    "is_account_active_for_user",
    { p_user_id: organizerOwnerId },
  );
  if (organizerAccountStatusError) {
    console.error("organizer_account_check_failed");
    return reply(origin, 503, { error: "Could not verify this event right now." });
  }
  if (organizerAccountActive !== true) {
    return reply(origin, 404, { error: "This registration page is not available." });
  }
  if ((event.category ?? "esports") === "esports" && gameId.length < 2) {
    return reply(origin, 400, { error: "Enter your in-game ID to register for this eSports event." });
  }
  if (event.registration_closes_at && new Date(event.registration_closes_at).getTime() <= now) {
    return reply(origin, 409, { error: "Registration for this event has closed." });
  }

  const organiserPlan = (event.organizers as {
    plan_key?: string;
    storage_quota_bytes?: number;
    max_screenshot_bytes?: number;
    max_screenshots?: number;
    max_responses_per_form?: number;
  } | null) ?? {};
  const maxResponses = Math.max(1, Number(organiserPlan.max_responses_per_form) || 100);
  const { count: responseCount, error: responseCountError } = await admin
    .from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  if (responseCountError) {
    console.error("response_quota_check_failed");
    return reply(origin, 503, { error: "Registration is temporarily unavailable. Please try again." });
  }
  if ((responseCount ?? 0) >= maxResponses) {
    return reply(origin, 409, { error: "This form has reached its response limit. Please contact the organiser." });
  }

  const fee = Number(event.entry_fee_minor ?? 0);
  const configuredFields = Array.isArray((event.branding as Record<string, unknown> | null)?.registrationFields)
    ? ((event.branding as Record<string, unknown>).registrationFields as Array<Record<string, unknown>>).slice(0, 8)
    : [];
  const customFields: Record<string, string> = {};
  for (const field of configuredFields) {
    const fieldId = typeof field.id === "string" ? field.id : "";
    const label = typeof field.label === "string" ? field.label.trim().slice(0, 80) : "";
    const type = ["text", "email", "number", "tel", "date", "textarea", "select"].includes(String(field.type)) ? String(field.type) : "text";
    const required = field.required === true;
    if (!/^[a-z0-9_-]{1,40}$/.test(fieldId) || !label) continue;
    const value = clean(form.get("custom_" + fieldId), 500);
    if (required && !value) return reply(origin, 400, { error: `Please complete: ${label}.` });
    if (type === "email" && value && !validEmail(value)) return reply(origin, 400, { error: `Please enter a valid email for: ${label}.` });
    if (type === "number" && value && !Number.isFinite(Number(value))) return reply(origin, 400, { error: `Please enter a valid number for: ${label}.` });
    if (type === "date" && value) { const parsedDate = new Date(value + "T00:00:00Z"); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) return reply(origin, 400, { error: `Please enter a valid date for: ${label}.` }); }
    if (type === "select") {
      const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string").map((option) => option.trim().slice(0, 80)).filter(Boolean).slice(0, 20) : [];
      if (options.length < 2) return reply(origin, 400, { error: `The organiser has not configured the choices for: ${label}.` });
      if (value && !options.includes(value)) return reply(origin, 400, { error: `Choose a valid option for: ${label}.` });
    }
    customFields[fieldId] = value;
  }
  const fileEntry = form.get("payment_screenshot");
  let imageBytes: Uint8Array | null = null;
  let imageType: { ext: string; type: string } | null = null;
  if (fee > 0) {
    const maxScreenshotBytes = Math.min(3_000_000, Math.max(1, Number(organiserPlan.max_screenshot_bytes) || 1_000_000));
    if (!(fileEntry instanceof File) || fileEntry.size < 1 || fileEntry.size > maxScreenshotBytes) {
      return reply(origin, 400, { error: "Your organiser's current plan allows a screenshot up to " + Math.round(maxScreenshotBytes / 1_000_000) + " MB." });
    }
    imageBytes = new Uint8Array(await fileEntry.arrayBuffer());
    imageType = detectImage(imageBytes);
    if (!imageType || fileEntry.type !== imageType.type) {
      return reply(origin, 400, { error: "Use a valid PNG, JPG, or WEBP screenshot." });
    }

    const organiserQuota = Math.max(1, Number(organiserPlan.storage_quota_bytes) || 40_000_000);
    const maxScreenshots = Math.max(1, Number(organiserPlan.max_screenshots) || 40);
    const { data: organiserEvidence, error: organiserEvidenceError } = await admin
      .from("payment_evidence").select("file_size_bytes").eq("organizer_id", event.organizer_id).limit(1000);
    if (organiserEvidenceError) {
      console.error("organiser_storage_quota_check_failed");
      return reply(origin, 503, { error: "Screenshot storage is temporarily unavailable. Please try again." });
    }
    const organiserFiles = organiserEvidence ?? [];
    const organiserBytesUsed = organiserFiles.reduce((sum, item) => sum + (Number(item.file_size_bytes) || 1_000_000), 0);
    if (organiserFiles.length >= maxScreenshots || organiserBytesUsed + fileEntry.size > organiserQuota) {
      return reply(origin, 409, { error: "Your screenshot allowance is full. Export your response data, save any screenshots you need, delete old evidence, or request a plan upgrade." });
    }

    // The pilot has a 500 MB platform-wide screenshot budget. The remaining
    // 100 MB of the 1 GB Free bucket is deliberately held as an operating reserve.
    const { data: allEvidence, error: globalEvidenceError } = await admin
      .from("payment_evidence").select("file_size_bytes").limit(1000);
    if (globalEvidenceError) {
      console.error("platform_storage_quota_check_failed");
      return reply(origin, 503, { error: "Screenshot storage is temporarily unavailable. Please try again." });
    }
    const platformBytesUsed = (allEvidence ?? []).reduce((sum, item) => sum + (Number(item.file_size_bytes) || 1_000_000), 0);
    if (platformBytesUsed + fileEntry.size > 500_000_000) {
      return reply(origin, 503, { error: "Company-001's free pilot screenshot capacity is full. Please try again after the platform owner expands storage." });
    }
  }

  const { data: registration, error: registrationError } = await admin
    .from("registrations")
    .insert({
      event_id: event.id,
      organizer_id: event.organizer_id,
      participant_name: participantName,
      participant_email: participantEmail,
      game_id: gameId,
      team_name: teamName,
      custom_fields: customFields,
      payment_status: fee > 0 ? "under_review" : "not_required",
      registration_status: "received",
    })
    .select("id, confirmation_reference")
    .single();

  if (registrationError || !registration) {
    console.error("registration_insert_failed");
    return reply(origin, 503, { error: "Could not save your registration. Please try again." });
  }

  if (imageBytes && imageType) {
    const path = `${event.organizer_id}/${registration.id}/${crypto.randomUUID()}.${imageType.ext}`;
    const { error: uploadError } = await admin.storage.from("payment-evidence")
      .upload(path, imageBytes, { contentType: imageType.type, upsert: false });
    if (uploadError) {
      await admin.from("registrations").delete().eq("id", registration.id);
      console.error("evidence_upload_failed");
      return reply(origin, 503, { error: "We could not store the screenshot. Please try again." });
    }
    const { error: evidenceError } = await admin.from("payment_evidence").insert({
      registration_id: registration.id,
      organizer_id: event.organizer_id,
      private_object_path: path,
      file_size_bytes: imageBytes.length,
      review_status: "pending",
    });
    if (evidenceError) {
      await admin.storage.from("payment-evidence").remove([path]);
      await admin.from("registrations").delete().eq("id", registration.id);
      console.error("evidence_record_failed");
      return reply(origin, 503, { error: "We could not finish the registration. Please try again." });
    }
  }

  return reply(origin, 201, {
    ok: true,
    confirmation_reference: registration.confirmation_reference,
    event_title: event.title,
    payment_status: fee > 0 ? "under_review" : "not_required",
    message: fee > 0
      ? "Registration received. The organiser will review the payment screenshot. This screenshot is not proof of payment."
      : "Registration received successfully.",
  });
});
