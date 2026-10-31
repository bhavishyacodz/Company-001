import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

async function readBodyLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError("maxBytes must be a non-negative safe integer");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

const allowedOrigins = new Set(["https://company-001.pages.dev", "https://www.company-001.pages.dev"]);
function isAllowedOrigin(origin: string) {
  if (!origin) return true;
  try {
    const hostname = new URL(origin).hostname;
    return allowedOrigins.has(origin) || (hostname.endsWith(".company-001.pages.dev") && hostname !== "company-001.pages.dev");
  } catch { return false; }
}
function headers(origin: string) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? (origin || "https://company-001.pages.dev") : "https://company-001.pages.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function reply(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "Method not allowed." });
  if (!isAllowedOrigin(origin)) return reply(origin, 403, { error: "This website origin is not allowed." });

  try {
    const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
    if (!token) return reply(origin, 401, { error: "Sign in to manage your payment screenshots." });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Server configuration is incomplete.");

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return reply(origin, 401, { error: "Your session is invalid or expired. Sign in again." });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: accountActive, error: accountStatusError } = await admin.rpc("is_account_active_for_user", { p_user_id: user.id });
    if (accountStatusError) throw new Error("Could not verify account access.");
    if (accountActive !== true) return reply(origin, 403, { error: "This account is suspended or unavailable." });
    const { data: profile, error: profileError } = await admin.from("profiles").select("platform_role").eq("id", user.id).maybeSingle();
    if (profileError) throw new Error("Could not verify account access.");
    if (profile?.platform_role === "owner") return reply(origin, 403, { error: "Only the organiser that owns this workspace can delete its payment evidence." });

    const bodyBytes = await readBodyLimited(req, 2048);
    if (!bodyBytes) return reply(origin, 413, { error: "Request is too large." });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch { return reply(origin, 400, { error: "Invalid request." }); }
    const evidenceId = typeof body.evidenceId === "string" ? body.evidenceId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) {
      return reply(origin, 400, { error: "A valid screenshot reference is required." });
    }

    const { data: evidence, error: evidenceError } = await admin.from("payment_evidence")
      .select("id,organizer_id,private_object_path")
      .eq("id", evidenceId).maybeSingle();
    if (evidenceError) throw new Error("Could not verify screenshot access.");
    if (!evidence?.private_object_path) return reply(origin, 404, { error: "Screenshot not found." });

    const { data: organizer, error: organizerError } = await admin.from("organizers")
      .select("owner_user_id,status").eq("id", evidence.organizer_id).maybeSingle();
    if (organizerError) throw new Error("Could not verify organiser access.");
    if (organizer?.owner_user_id !== user.id || organizer?.status !== "approved") {
      return reply(origin, 403, { error: "Only the approved organiser that owns this screenshot can delete it." });
    }

    const { error: storageError } = await admin.storage.from("payment-evidence").remove([evidence.private_object_path]);
    if (storageError) {
      console.error("payment_evidence_storage_delete_failed");
      return reply(origin, 503, { error: "The screenshot could not be deleted from private storage. Your records have been kept." });
    }
    const { error: deleteError } = await admin.from("payment_evidence")
      .delete().eq("id", evidence.id).eq("organizer_id", evidence.organizer_id);
    if (deleteError) {
      console.error("payment_evidence_record_delete_failed");
      return reply(origin, 503, { error: "The file was removed, but its record could not be cleared. Refresh and contact support if it still appears." });
    }

    return reply(origin, 200, { ok: true, message: "Screenshot permanently deleted. The participant response record was kept." });
  } catch (error) {
    console.error("delete-payment-evidence failed");
    return reply(origin, 500, { error: error instanceof Error ? error.message : "Request failed." });
  }
});
