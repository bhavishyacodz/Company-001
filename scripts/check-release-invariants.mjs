import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const checks = [
  {
    name: "historical payment-review migrations are present",
    run: () => [
      "supabase/migrations/20261027084200_limit_registration_review_updates.sql",
      "supabase/migrations/20261027085931_atomic_registration_payment_review.sql",
      "supabase/migrations/20261027091337_guard_payment_review_transitions.sql",
    ].every((path) => read(path).trim().length > 0),
  },
  {
    name: "payment review requires an authenticated, authorized reviewer",
    run: () => {
      const sql = read("supabase/migrations/20261027160524_enforce_audited_registration_payment_updates.sql");
      return sql.includes("auth.uid() is null")
        && sql.includes("private.is_platform_owner()")
        && sql.includes("private.is_organizer_owner(v_registration.organizer_id)")
        && sql.includes("set search_path = ''");
    },
  },
  {
    name: "payment-review RPC restricts execution and authorizes only owner or event organiser",
    run: () => {
      const sql = read("supabase/migrations/20261027160524_enforce_audited_registration_payment_updates.sql");
      return sql.includes("security definer")
        && sql.includes("set search_path = ''")
        && sql.includes("if auth.uid() is null")
        && sql.includes("private.is_platform_owner()")
        && sql.includes("private.is_organizer_owner(v_registration.organizer_id)")
        && sql.includes("revoke all on function public.review_registration_payment(uuid, text, text) from public, anon")
        && sql.includes("grant execute on function public.review_registration_payment(uuid, text, text) to authenticated, service_role")
        && sql.includes("insert into public.audit_logs");
    },
  },
  {
    name: "payment approval requires evidence and approved payments cannot be downgraded",
    run: () => {
      const sql = read("supabase/migrations/20261027160524_enforce_audited_registration_payment_updates.sql");
      return sql.includes("Cannot approve payment without uploaded evidence")
        && sql.includes("An approved payment cannot be downgraded");
    },
  },
  {
    name: "direct payment status changes are guarded by the audited RPC",
    run: () => {
      const sql = read("supabase/migrations/20261027160524_enforce_audited_registration_payment_updates.sql");
      return sql.includes("current_setting('company001.payment_review_rpc', true)")
        && sql.includes("create trigger guard_registration_review_status")
        && sql.includes("perform set_config('company001.payment_review_rpc', 'on', true)");
    },
  },
  {
    name: "event publication is guarded at the database boundary",
    run: () => {
      const sql = read("supabase/migrations/20261027160251_enforce_owner_only_event_publication.sql");
      return sql.includes("Only the platform owner can publish an event")
        && sql.includes("create trigger enforce_event_publication_owner");
    },
  },
  {
    name: "organiser approval status is owner-controlled",
    run: () => {
      const sql = read("supabase/migrations/20261027160359_enforce_owner_only_organizer_status.sql");
      return sql.includes("Only the platform owner can create an organiser workspace")
        && sql.includes("Only the platform owner can change organiser approval status");
    },
  },
  {
    name: "organiser application review RPC enforces owner authorization and blocks public execution",
    run: () => {
      const sql = read("supabase/migrations/202610270005_owner_application_review_rpc.sql");
      return sql.includes("security definer")
        && sql.includes("set search_path = ''")
        && sql.includes("auth.uid() is null or not (select private.is_platform_owner())")
        && sql.includes("revoke all on function public.review_organizer_application(uuid, text, text, text) from public, anon")
        && sql.includes("grant execute on function public.review_organizer_application(uuid, text, text, text) to authenticated");
    },
  },
  {
    name: "event publication review RPC enforces owner authorization and blocks public execution",
    run: () => {
      const sql = read("supabase/migrations/202610270006_owner_event_publication_review.sql");
      return sql.includes("security definer")
        && sql.includes("set search_path = ''")
        && sql.includes("auth.uid() is null or not (select private.is_platform_owner())")
        && sql.includes("revoke all on function public.review_event_publication(uuid, text, text) from public, anon")
        && sql.includes("grant execute on function public.review_event_publication(uuid, text, text) to authenticated")
        && sql.includes("create trigger guard_event_publication");
    },
  },
  {
    name: "profile policies prevent client-side owner-role escalation",
    run: () => {
      const sql = read("supabase/migrations/202610270001_company001_esports_foundation.sql");
      return sql.includes("grant update (display_name) on public.profiles to authenticated;")
        && sql.includes("using (id = (select auth.uid()))")
        && sql.includes("with check (id = (select auth.uid()) and platform_role = 'organizer')");
    },
  },
  {
    name: "delegated event access is event-scoped and owner-managed",
    run: () => {
      const sql = read("supabase/migrations/20261027150621_organizer_access_panel.sql");
      const accessPolicies = read("supabase/migrations/20261027161935_consolidate_organizer_event_access_policies.sql");
      return sql.includes("a.event_id = e.id and a.user_id = (select auth.uid())")
        && sql.includes("a.access_level = 'editor'")
        && sql.includes("Only the platform owner can change organiser access status")
        && accessPolicies.includes("using ((select private.is_platform_owner()))")
        && accessPolicies.includes("with check ((select private.is_platform_owner()))");
    },
  },
  {
    name: "registration form builder rejects duplicate or incomplete custom fields",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      const endpoint = read("supabase/functions/register-esports/index.ts");
      return editor.includes("A registration form can have at most 8 custom fields.")
        && editor.includes("Two custom fields share the same internal ID.")
        && editor.includes("Custom field labels must be unique")
        && endpoint.includes("customFields[fieldId] = value")
        && endpoint.includes("Please complete: ${label}.");
    },
  },
  {
    name: "payment evidence remains private and rate-limit storage is server-only",
    run: () => {
      const sql = read("supabase/migrations/202610270003_registration_endpoint_and_private_evidence.sql");
      return sql.includes("values ('payment-evidence', 'payment-evidence', false")
        && sql.includes("bucket_id = 'payment-evidence'")
        && sql.includes("revoke all on function public.consume_registration_rate_limit(text, timestamptz, integer) from public, anon, authenticated")
        && sql.includes("to service_role");
    },
  },
];

let failed = false;
for (const check of checks) {
  let passed = false;
  try {
    passed = Boolean(check.run());
  } catch (error) {
    console.error(`ERROR: ${check.name}: ${error.message}`);
    failed = true;
    continue;
  }
  console.log(`${passed ? "PASS" : "FAIL"}: ${check.name}`);
  if (!passed) failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`All ${checks.length} release invariant checks passed.`);
