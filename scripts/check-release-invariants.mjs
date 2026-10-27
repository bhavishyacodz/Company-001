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
