import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { readBodyLimited } from "../_shared/request-body.ts";

const SITE_ORIGIN = "https://company-001.pages.dev";
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = { ...corsHeaders, "Access-Control-Allow-Origin": origin === SITE_ORIGIN ? origin : SITE_ORIGIN };
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (origin && origin !== SITE_ORIGIN) return reply(403, { error: "This website origin is not allowed." });

  try {
    const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
    if (!token) return reply(401, { error: "Authentication required" });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Server configuration is incomplete.");

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return reply(401, { error: "Invalid or expired session" });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("platform_role").eq("id", user.id).maybeSingle();
    if (profileError) throw new Error("Could not verify account access.");
    if (profile?.platform_role === "owner") return reply(403, { error: "Platform owner accounts cannot view participant payment evidence. Only the owning organiser can access it." });

    const bodyBytes = await readBodyLimited(req, 2_048);
    if (!bodyBytes) return reply(413, { error: "Request is too large." });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch {
      return reply(400, { error: "Invalid request." });
    }
    const evidenceId = typeof body?.evidenceId === "string" ? body.evidenceId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) return reply(400, { error: "A valid evidence ID is required" });

    const { data: evidence, error: evidenceError } = await admin.from("payment_evidence").select("id,organizer_id,private_object_path").eq("id", evidenceId).maybeSingle();
    if (evidenceError) throw new Error("Could not verify evidence access.");
    if (!evidence || !evidence.private_object_path) return reply(404, { error: "Evidence not found" });
    const { data: organizer, error: organizerError } = await admin.from("organizers").select("owner_user_id,status").eq("id", evidence.organizer_id).maybeSingle();
    if (organizerError) throw new Error("Could not verify organiser access.");
    if (organizer?.owner_user_id !== user.id || organizer?.status !== "approved") return reply(403, { error: "Only the approved organiser that owns this event can view its payment evidence." });

    const { data: signed, error: signedError } = await admin.storage.from("payment-evidence").createSignedUrl(evidence.private_object_path, 60);
    if (signedError || !signed?.signedUrl) throw new Error("Could not create a temporary evidence link.");
    return reply(200, { signedUrl: signed.signedUrl, expiresIn: 60 });
  } catch (error) {
    console.error("view-payment-evidence failed");
    return reply(500, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
