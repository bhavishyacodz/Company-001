import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://company-001.pages.dev")
  .split(",").map((value) => value.trim()).filter(Boolean);

function response(origin: string, status: number, body: Record<string, unknown>) {
  const originAllowed = !origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": originAllowed ? (origin || "*") : allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function fail(message: string): never {
  throw new Error(message);
}

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await promise;
  if (result.error) fail(result.error.message);
  return result.data;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return response(origin, 200, { ok: true });
  if (req.method !== "POST") return response(origin, 405, { error: "Use POST for account deletion." });
  if (origin && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
    return response(origin, 403, { error: "This website origin is not allowed." });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response(origin, 401, { error: "Please sign in again before deleting your account." });

  try {
    const { data: userResult, error: userError } = await admin.auth.getUser(token);
    if (userError || !userResult.user) return response(origin, 401, { error: "Your session is invalid or expired. Please sign in again." });
    const user = userResult.user;

    let body: { confirmation?: unknown; email?: unknown };
    try {
      body = await req.json();
    } catch {
      return response(origin, 400, { error: "Invalid request." });
    }
    if (body.confirmation !== "DELETE" || typeof body.email !== "string" ||
      body.email.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase()) {
      return response(origin, 400, { error: "Confirm the deletion and enter the email address for this account." });
    }

    const profile = await must(admin.from("profiles").select("platform_role").eq("id", user.id).maybeSingle());
    if (profile?.platform_role === "owner") {
      return response(origin, 403, { error: "The platform owner account cannot be deleted from self-service settings. Use the protected owner account-management process." });
    }

    const organizers = await must(admin.from("organizers").select("id").eq("owner_user_id", user.id));
    const organizerIds = (organizers ?? []).map((item: { id: string }) => item.id);
    const events = organizerIds.length
      ? await must(admin.from("events").select("id").in("organizer_id", organizerIds))
      : [];
    const eventIds = (events ?? []).map((item: { id: string }) => item.id);
    const registrations = organizerIds.length
      ? await must(admin.from("registrations").select("id").in("organizer_id", organizerIds))
      : [];
    const registrationIds = (registrations ?? []).map((item: { id: string }) => item.id);

    const evidenceByOrganizer = organizerIds.length
      ? await must(admin.from("payment_evidence").select("private_object_path").in("organizer_id", organizerIds))
      : [];
    const evidenceByRegistration = registrationIds.length
      ? await must(admin.from("payment_evidence").select("private_object_path").in("registration_id", registrationIds))
      : [];
    const paths = [...new Set([...(evidenceByOrganizer ?? []), ...(evidenceByRegistration ?? [])]
      .map((item: { private_object_path: string }) => item.private_object_path).filter(Boolean))];

    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from("payment-evidence").remove(paths.slice(index, index + 100));
      if (error) fail("Could not securely remove stored payment evidence. No account records were deleted; please contact support.");
    }

    if (organizerIds.length) {
      await must(admin.from("payment_evidence").delete().in("organizer_id", organizerIds));
    }
    if (registrationIds.length) {
      await must(admin.from("payment_evidence").delete().in("registration_id", registrationIds));
      await must(admin.from("registrations").delete().in("id", registrationIds));
    }
    if (eventIds.length) {
      await must(admin.from("organizer_event_access").delete().in("event_id", eventIds));
    }
    await must(admin.from("organizer_event_access").delete().eq("user_id", user.id));
    await must(admin.from("organizer_event_access").delete().eq("granted_by", user.id));

    if (organizerIds.length) {
      await must(admin.from("audit_logs").delete().in("organizer_id", organizerIds));
      if (eventIds.length) await must(admin.from("events").delete().in("id", eventIds));
    }
    await must(admin.from("organizer_applications").delete().eq("applicant_user_id", user.id));
    await must(admin.from("organizer_applications").update({ reviewed_by: null }).eq("reviewed_by", user.id));
    await must(admin.from("payment_evidence").update({ reviewed_by: null }).eq("reviewed_by", user.id));
    await must(admin.from("audit_logs").update({ actor_user_id: null }).eq("actor_user_id", user.id));

    if (organizerIds.length) {
      await must(admin.from("organizers").delete().in("id", organizerIds));
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) fail("Your linked event data was removed, but the login could not be deleted automatically. Contact support to finish account removal.");
    return response(origin, 200, { deleted: true, message: "Your account and linked organiser data have been deleted." });
  } catch (error) {
    console.error("delete-account failed", error);
    return response(origin, 500, { error: "We could not complete account deletion. Please contact support before retrying." });
  }
});
