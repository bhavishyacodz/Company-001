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
  const allowed = !origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowed ? (origin || "*") : allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}
function fail(message: string): never { throw new Error(message); }
async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await promise;
  if (result.error) fail(result.error.message);
  return result.data;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return response(origin, 200, { ok: true });
  if (req.method !== "POST") return response(origin, 405, { error: "Use POST for account management." });
  if (origin && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
    return response(origin, 403, { error: "This website origin is not allowed." });
  }

  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response(origin, 401, { error: "Sign in with King Login to manage accounts." });

  try {
    const { data: authResult, error: authError } = await admin.auth.getUser(token);
    if (authError || !authResult.user) return response(origin, 401, { error: "Your session is invalid or expired. Sign in again." });
    const actor = authResult.user;
    const actorProfile = await must(admin.from("profiles").select("platform_role").eq("id", actor.id).maybeSingle());
    if (actorProfile?.platform_role !== "owner") {
      return response(origin, 403, { error: "Only the verified platform owner can manage user accounts." });
    }

    let body: { action?: unknown; userId?: unknown; email?: unknown; confirmation?: unknown };
    try { body = await req.json(); } catch { return response(origin, 400, { error: "Invalid request." }); }
    const action = body.action;
    if (action === "list") {
      const users: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) fail(error.message);
        users.push(...data.users);
        if (data.users.length < 100) break;
      }
      const ids = users.map((item) => item.id);
      const profiles = ids.length
        ? await must(admin.from("profiles").select("id,display_name,platform_role").in("id", ids))
        : [];
      const organizers = ids.length
        ? await must(admin.from("organizers").select("id,owner_user_id,display_name,status").in("owner_user_id", ids))
        : [];
      const profileById = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));
      const organizersByOwner = new Map<string, { display_name: string; status: string }[]>();
      for (const item of (organizers ?? []) as { owner_user_id: string; display_name: string; status: string }[]) {
        const list = organizersByOwner.get(item.owner_user_id) ?? [];
        list.push({ display_name: item.display_name, status: item.status });
        organizersByOwner.set(item.owner_user_id, list);
      }
      const now = Date.now();
      return response(origin, 200, {
        users: users.map((item: any) => {
          const profile = profileById.get(item.id) as { display_name?: string; platform_role?: string } | undefined;
          const bannedUntil = item.banned_until ?? null;
          const suspended = Boolean(item.app_metadata?.account_suspended) ||
            Boolean(bannedUntil && new Date(bannedUntil).getTime() > now);
          return {
            id: item.id,
            email: item.email ?? "",
            displayName: profile?.display_name || item.user_metadata?.display_name || item.email?.split("@")[0] || "User",
            role: profile?.platform_role || "user",
            createdAt: item.created_at,
            lastSignInAt: item.last_sign_in_at ?? null,
            suspended,
            bannedUntil,
            workspaces: organizersByOwner.get(item.id) ?? [],
          };
        }).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))),
      });
    }

    if (!["suspend", "restore", "delete"].includes(String(action)) ||
      typeof body.userId !== "string" || !body.userId) {
      return response(origin, 400, { error: "Choose a valid account and action." });
    }
    const targetId = body.userId;
    if (targetId === actor.id) return response(origin, 400, { error: "You cannot suspend or delete your own King Login account." });
    const targetProfile = await must(admin.from("profiles").select("platform_role").eq("id", targetId).maybeSingle());
    if (targetProfile?.platform_role === "owner") {
      return response(origin, 403, { error: "Owner accounts are protected and cannot be suspended or deleted here." });
    }
    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetId);
    if (targetError || !targetResult.user) return response(origin, 404, { error: "That account no longer exists. Refresh the list." });
    const target = targetResult.user;
    if (typeof body.email !== "string" ||
      body.email.trim().toLowerCase() !== (target.email ?? "").trim().toLowerCase()) {
      return response(origin, 400, { error: "Enter the account's exact email address to confirm this action." });
    }

    if (action === "suspend") {
      const metadata = { ...(target.app_metadata ?? {}), account_suspended: true };
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h",
        app_metadata: metadata,
      });
      if (error) fail(error.message);
      return response(origin, 200, { ok: true, message: "Account suspended. Sign-in is blocked until you restore it." });
    }

    if (action === "restore") {
      const metadata = { ...(target.app_metadata ?? {}) };
      delete metadata.account_suspended;
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
        app_metadata: metadata,
      });
      if (error) fail(error.message);
      return response(origin, 200, { ok: true, message: "Account restored. The user can sign in again." });
    }

    if (body.confirmation !== "DELETE") {
      return response(origin, 400, { error: "Type DELETE to confirm permanent account removal." });
    }

    const organizerRows = await must(admin.from("organizers").select("id").eq("owner_user_id", targetId));
    const organizerIds = (organizerRows ?? []).map((item: { id: string }) => item.id);
    const eventRows = organizerIds.length
      ? await must(admin.from("events").select("id").in("organizer_id", organizerIds))
      : [];
    const eventIds = (eventRows ?? []).map((item: { id: string }) => item.id);
    const registrationsByOrganizer = organizerIds.length
      ? await must(admin.from("registrations").select("id").in("organizer_id", organizerIds))
      : [];
    const registrationsByEvent = eventIds.length
      ? await must(admin.from("registrations").select("id").in("event_id", eventIds))
      : [];
    const registrationIds = [...new Set([
      ...(registrationsByOrganizer ?? []).map((item: { id: string }) => item.id),
      ...(registrationsByEvent ?? []).map((item: { id: string }) => item.id),
    ])];

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
      if (error) fail("Could not remove private payment evidence. Account deletion was stopped before database cleanup.");
    }
    if (organizerIds.length) await must(admin.from("payment_evidence").delete().in("organizer_id", organizerIds));
    if (registrationIds.length) {
      await must(admin.from("payment_evidence").delete().in("registration_id", registrationIds));
      await must(admin.from("registrations").delete().in("id", registrationIds));
    }
    if (eventIds.length) await must(admin.from("organizer_event_access").delete().in("event_id", eventIds));
    await must(admin.from("organizer_event_access").delete().eq("user_id", targetId));
    await must(admin.from("organizer_event_access").delete().eq("granted_by", targetId));
    if (organizerIds.length) {
      await must(admin.from("audit_logs").delete().in("organizer_id", organizerIds));
      if (eventIds.length) await must(admin.from("events").delete().in("id", eventIds));
    }
    await must(admin.from("organizer_applications").delete().eq("applicant_user_id", targetId));
    await must(admin.from("organizer_applications").update({ reviewed_by: null }).eq("reviewed_by", targetId));
    await must(admin.from("payment_evidence").update({ reviewed_by: null }).eq("reviewed_by", targetId));
    await must(admin.from("audit_logs").update({ actor_user_id: null }).eq("actor_user_id", targetId));
    if (organizerIds.length) await must(admin.from("organizers").delete().in("id", organizerIds));

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) fail("Related data cleanup finished, but the account login could not be deleted. Please inspect the records before retrying.");
    return response(origin, 200, { ok: true, deleted: true, message: "Account and linked organiser data permanently deleted." });
  } catch (error) {
    console.error("manage-user-accounts failed", error);
    return response(origin, 500, { error: "Account management failed. Refresh the account list and check the result before retrying." });
  }
});
