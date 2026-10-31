import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { readBodyLimited } from "../_shared/request-body.ts";
import { completeAccountDeletion } from "../_shared/account-deletion.ts";

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
      "Cache-Control": "no-store",
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
    // getUser() verifies the JWT signature; auth_time then enforces a fresh
    // interactive sign-in before this destructive operation is allowed.
    let authTime: number | null = null;
    try {
      const payloadPart = token.split(".")[1];
      if (payloadPart) {
        const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
        if (Number.isFinite(decoded.auth_time)) authTime = decoded.auth_time;
      }
    } catch {
      authTime = null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (authTime === null || authTime > now + 60 || now - authTime > 10 * 60) {
      return response(origin, 401, { error: "For security, sign in again before deleting your account." });
    }

    const bodyBytes = await readBodyLimited(req, 4_096);
    if (!bodyBytes) return response(origin, 413, { error: "Request is too large." });
    let body: { confirmation?: unknown; email?: unknown };
    try {
      const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed;
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

    await completeAccountDeletion(admin, user.id);
    return response(origin, 200, { deleted: true, message: "Your account and linked organiser data have been deleted." });
  } catch (error) {
    console.error("delete-account failed", error);
    return response(origin, 500, { error: "We could not complete account deletion. Your account may still exist; refresh and retry. If the problem persists, contact support." });
  }
});
