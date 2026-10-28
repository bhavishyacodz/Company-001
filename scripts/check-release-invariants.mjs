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
    name: "new organiser workspaces activate immediately without owner-role escalation",
    run: () => {
      const sql = read("supabase/migrations/20261028050000_instant_organizer_workspace.sql");
      const account = read("src/main.jsx");
      return sql.includes("create trigger organizer_applications_auto_activate")
        && sql.includes("status = 'approved'")
        && sql.includes("revoke all on function public.auto_activate_organizer_application() from public, anon, authenticated")
        && sql.includes("if current_user = 'postgres' then")
        && account.includes("Workspace activated. Opening your template editor")
        && account.includes("Your workspace activates immediately");
    },
  },
  {
    name: "saved sessions restore account routing and template selection avoids login loops",
    run: () => {
      const account = read("src/main.jsx");
      return account.includes('storage: window.localStorage')
        && account.includes('window.localStorage.getItem("company001:selected-template")')
        && account.includes('data.session?.user && !isLiveEventRoute')
        && account.includes('supabase.from("organizers").select("id").eq("owner_user_id", data.session.user.id)')
        && account.includes('const handleUseTemplate = async (templateKey)')
        && account.includes('<TemplateGallery onUseTemplate={handleUseTemplate} />')
        && account.includes('onBack={() => setView("templates")}')
        && account.includes('onOpenWorkspace={() => setView("customize")}');
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
    name: "website-only editor keeps layers and inspector visible on desktop and mobile",
    run: () => {
      const css = read("src/workspace.css");
      return css.includes(".workspace-website-canvas-mode .workspace-form> :not(.workspace-canvas-layers):not(#workspace-builder-preview):not(.workspace-canvas-inspector):not(.workspace-form-actions)")
        && css.includes(".workspace-website-canvas-mode .workspace-canvas-layers{grid-column:1;grid-row:1}")
        && css.includes(".workspace-website-canvas-mode .workspace-canvas-inspector{grid-column:3;grid-row:1}")
        && css.includes("@media(max-width:650px)");
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
  {
    name: "signed-in account has a responsive profile overview and clear account actions",
    run: () => {
      const account = read("src/main.jsx");
      const css = read("src/styles.css");
      return account.includes('className="profile-overview"')
        && account.includes('MEMBER SINCE')
        && account.includes('Browse templates')
        && account.includes('onClick={signOut}')
        && css.includes(".profile-overview-meta")
        && css.includes("@media(max-width:480px)");
    },
  },

  {
    name: "template selection preserves restricted owner routing",
    run: () => {
      const app = read("src/main.jsx");
      return app.includes('if (platformRole === "owner") {')
        && app.includes('setView("owner");')
        && app.includes('if (!signedInUser) {')
        && app.includes('setView("account");');
    },
  },

  {
    name: "event setup checklist jumps to its matching field",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('target: "workspace-event-title"')
        && editor.includes('target: "workspace-event-slug"')
        && editor.includes('target: "workspace-event-description"')
        && editor.includes('target: "workspace-event-rules"')
        && editor.includes('target?.scrollIntoView({behavior:"smooth",block:"center"})')
        && editor.includes('id="workspace-event-title"')
        && editor.includes('id="workspace-event-slug"')
        && editor.includes('id="workspace-event-description"')
        && editor.includes('id="workspace-event-rules"');
    },
  },
  {
    name: "event save errors scroll into view on mobile and desktop",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('id="workspace-alert" className="workspace-alert" role="alert" tabIndex={-1}')
        && editor.includes('window.requestAnimationFrame(() => document.getElementById("workspace-alert")?.scrollIntoView({ behavior: "smooth", block: "center" }))')
        && editor.includes('Could not save event.');
    },
  },
  {
    name: "website-only toggle scrolls to the controls when leaving preview",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('id="workspace-builder-form"')
        && editor.includes('document.getElementById(websiteOnlyMode ? "workspace-builder-form" : "workspace-builder-preview")?.scrollIntoView')
        && editor.includes('websiteOnlyMode?"Back to editing controls":"Website-only view"');
    },
  },
  {
    name: "editing an existing event opens its focused website canvas",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('editEvent(ev);changeWorkspaceTab("customize");window.scrollTo')
        && !editor.includes('editEvent(ev);changeWorkspaceTab("customize");setWebsiteOnlyMode(false);window.scrollTo')
        && editor.includes('setWebsiteOnlyMode(true);');
    },
  },
  {
    name: "refresh recovery preserves the saved event editor draft",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('const editEvent = (ev, { persist = true } = {})')
        && editor.includes('editEvent(savedEvent, { persist: false });')
        && editor.includes('if (persist) {')
        && editor.includes('setForm(savedEditor.formDraft);');
    },
  },
  {
    name: "mobile focused editor uses one clear grid order for layers, controls, preview, and actions",
    run: () => {
      const styles = read("src/workspace.css");
      const mobileStart = styles.lastIndexOf("@media (max-width: 700px)");
      const mobileEditor = styles.slice(mobileStart);
      const layers = mobileEditor.indexOf(".workspace-canvas-layers");
      const inspector = mobileEditor.indexOf(".workspace-canvas-inspector {");
      const preview = mobileEditor.indexOf("#workspace-builder-preview");
      const actions = mobileEditor.indexOf(".workspace-form-actions");
      return mobileStart >= 0
        && layers >= 0 && inspector > layers && preview > inspector && actions > preview
        && mobileEditor.includes("grid-row: 1 !important;")
        && mobileEditor.includes("grid-row: 2 !important;")
        && mobileEditor.includes("grid-row: 3 !important;")
        && mobileEditor.includes("grid-row: 4 !important;")
        && !styles.includes("place selected-element controls before the long page preview");
    },
  }];

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
