import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(["https://company-001.pages.dev", "https://www.company-001.pages.dev"]);
function responseHeaders(origin: string) {
  return { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://company-001.pages.dev", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
}
function reply(origin: string, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) }); }
const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validEmail = (value: string) => value.length <= 254 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
const projectTypes = new Set(["business-website", "landing-page", "web-app", "dashboard", "event-platform", "other"]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "Method not allowed." });
  if (origin && !allowedOrigins.has(origin)) return reply(origin, 403, { error: "This website is not allowed to submit enquiries." });
  if (Number(req.headers.get("content-length") ?? "0") > 12000) return reply(origin, 413, { error: "Enquiry is too large." });
  let raw: Record<string, unknown>;
  try { const text = await req.text(); if (new TextEncoder().encode(text).length > 12000) return reply(origin, 413, { error: "Enquiry is too large." }); raw = JSON.parse(text); if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid"); }
  catch { return reply(origin, 400, { error: "Please submit a valid enquiry form." }); }
  if (str(raw.website, 200)) return reply(origin, 200, { ok: true });
  const name = str(raw.name, 100), email = str(raw.email, 254).toLowerCase(), phone = str(raw.phone, 40), project_type = str(raw.project_type, 40), requirements = str(raw.requirements, 3000), preferred_time = str(raw.preferred_time, 160);
  if (name.length < 2 || !validEmail(email) || !projectTypes.has(project_type) || requirements.length < 15 || requirements.length > 3000) return reply(origin, 400, { error: "Please check your name, email, project type and project details." });
  const forwarded = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await sha256(forwarded + (Deno.env.get("RATE_LIMIT_PEPPER") ?? supabaseUrl));
  const windowStart = new Date(Math.floor(Date.now() / 600000) * 600000).toISOString();
  const { data: allowed, error: limitError } = await admin.rpc("consume_registration_rate_limit", { p_ip_hash: ipHash, p_window_start: windowStart, p_limit: 3 });
  if (limitError) { console.error("consultation_rate_limit_check_failed"); return reply(origin, 503, { error: "Enquiry service is temporarily unavailable. Please try again later." }); }
  if (!allowed) return reply(origin, 429, { error: "Too many attempts. Please wait a few minutes before trying again." });
  const { data, error } = await admin.from("consultation_requests").insert({ name, email, phone, project_type, requirements, preferred_time }).select("id").single();
  if (error || !data) { console.error("consultation_insert_failed"); return reply(origin, 503, { error: "We could not save your enquiry right now. Please try again later." }); }
  return reply(origin, 201, { ok: true, reference: data.id.slice(0, 8).toUpperCase() });
});
