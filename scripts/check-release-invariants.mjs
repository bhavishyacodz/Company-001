import { existsSync, readFileSync } from "node:fs";
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
      const sql = read("supabase/migrations/20261028045634_instant_organizer_workspace.sql");
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
        && account.includes('onOpenWorkspace={() => setView("organizer")}');
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
      const sql = read("supabase/migrations/20261027054910_owner_application_review_rpc.sql");
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
      const sql = read("supabase/migrations/20261027055827_owner_event_publication_review.sql");
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
      const sql = read("supabase/migrations/20261027053304_company001_esports_foundation.sql");
      return sql.includes("grant update (display_name) on public.profiles to authenticated;")
        && sql.includes("using (id = (select auth.uid()))")
        && sql.includes("with check (id = (select auth.uid()) and platform_role = 'organizer')");
    },
  },
  {
    name: "delegated event access is event-scoped and owner-managed",
    run: () => {
      const sql = read("supabase/migrations/20261027150621_organizer_access_panel.sql").replace(/\s+/g, "");
      const accessPolicies = read("supabase/migrations/20261027161935_consolidate_organizer_event_access_policies.sql").replace(/\s+/g, "");
      return sql.includes("a.event_id=e.idanda.user_id=(selectauth.uid())")
        && sql.includes("a.access_level='editor'")
        && sql.includes("Onlytheplatformownercanchangeorganiseraccessstatus")
        && accessPolicies.includes("using((selectprivate.is_platform_owner()))")
        && accessPolicies.includes("withcheck((selectprivate.is_platform_owner()))");
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
    name: "registration endpoint enforces streaming body limits and proxy-safe IP selection",
    run: () => {
      const endpoint = read("supabase/functions/register-esports/index.ts");
      const consultation = read("supabase/functions/request-consultation/index.ts");
      const evidence = read("supabase/functions/view-payment-evidence/index.ts");
      const selfDeletion = read("supabase/functions/delete-account/index.ts");
      const ownerManagement = read("supabase/functions/manage-user-accounts/index.ts");
      const reader = read("supabase/functions/_shared/request-body.ts");
      const tests = read("supabase/functions/_shared/request-body.test.ts");
      return endpoint.includes("readBodyLimited(req, 4_000_000)")
        && endpoint.includes('req.headers.get("cf-connecting-ip")')
        && endpoint.includes('split(",").at(-1)')
        && consultation.includes("readBodyLimited(req, 12_000)")
        && evidence.includes("readBodyLimited(req, 2_048)")
        && selfDeletion.includes("readBodyLimited(req, 4_096)")
        && ownerManagement.includes("readBodyLimited(req, 4_096)")
        && consultation.includes('req.headers.get("cf-connecting-ip")')
        && consultation.includes('split(",").at(-1)')
        && consultation.includes('new TextDecoder("utf-8", { fatal: true })')
        && reader.includes("reader.read()")
        && reader.includes("total > maxBytes")
        && reader.includes("reader.cancel()")
        && tests.includes("body larger than the configured limit")
        && tests.includes("body at the configured limit");
    },
  },
  {
    name: "Cloudflare Pages publishes baseline browser security headers",
    run: () => {
      const headers = read("public/_headers");
      return headers.includes("X-Content-Type-Options: nosniff")
        && headers.includes("X-Frame-Options: DENY")
        && headers.includes("Referrer-Policy: strict-origin-when-cross-origin")
        && headers.includes("Permissions-Policy: camera=(), microphone=(), geolocation=()")
        && headers.includes("Strict-Transport-Security: max-age=31536000")
        && headers.includes("frame-ancestors 'none'")
        && headers.includes("Cache-Control: no-cache, no-store, must-revalidate");
    },
  },
  {
    name: "account deletion failure paths are tested before Auth removal",
    run: () => {
      const helper = read("supabase/functions/_shared/account-deletion.ts");
      const tests = read("supabase/functions/_shared/account-deletion.test.ts");
      const workflow = read(".github/workflows/local-privacy-integration.yml");
      return helper.includes("prepare_account_deletion")
        && helper.includes("complete_account_deletion_storage")
        && tests.includes("Storage failure preserves the deletion job")
        && tests.includes("malformed Storage manifest fails closed")
        && tests.includes("Storage completion failure prevents Auth deletion")
        && tests.includes("Auth deletion failure is retryable")
        && tests.includes("already-removed Auth identity as success")
        && tests.includes("removed in batches of at most 100")
        && workflow.includes("account-deletion.test.ts");
    },
  },
  {
    name: "suspension is enforced at the database RLS boundary",
    run: () => {
      const migration = read("supabase/migrations/20261030110000_enforce_suspension_at_rls_boundary.sql");
      const tests = read("supabase/tests/registration_privacy.test.sql");
      return migration.includes("private.is_active_account()")
        && migration.includes("u.banned_until")
        && migration.includes("raw_app_meta_data ->> 'account_suspended'")
        && migration.includes("public.is_account_active_for_user(p_user_id uuid)")
        && migration.includes("grant execute on function public.is_account_active_for_user(uuid) to service_role")
        && migration.includes("(select private.is_active_account())")
        && migration.includes("create policy registrations_read_own_organizer_only")
        && migration.includes("create policy payment_evidence_read_own_organizer_only")
        && migration.includes('create policy "organizer reads only their own private payment evidence"')
        && tests.includes("banned organizer cannot read participant registrations with an existing token")
        && tests.includes("banned organizer cannot read payment evidence with an existing token")
        && tests.includes("banned organizer cannot read private screenshots with an existing token")
        && tests.includes("server-managed suspension flag also disables an account");
    },
  },
  {
    name: "participant registration responses are never cached",
    run: () => read("supabase/functions/register-esports/index.ts")
      .includes('"Cache-Control": "no-store"'),
  },
  {
    name: "suspension blocks signed evidence links and new public registrations",
    run: () => {
      const evidence = read("supabase/functions/view-payment-evidence/index.ts");
      const registration = read("supabase/functions/register-esports/index.ts");
      return evidence.includes('"is_account_active_for_user"')
        && evidence.includes("p_user_id: user.id")
        && registration.includes('"is_account_active_for_user"')
        && registration.includes("p_user_id: organizerOwnerId");
    },
  },
  {
    name: "owner account directory responses are not cacheable",
    run: () => read("supabase/functions/manage-user-accounts/index.ts")
      .includes('"Cache-Control": "no-store"')
      && read("supabase/functions/delete-account/index.ts").includes('"Cache-Control": "no-store"'),
  },
  {
    name: "anonymous visitors have no direct organizer delegation privileges",
    run: () => {
      const migration = read("supabase/migrations/20261030100000_revoke_anon_organizer_event_access.sql");
      const tests = read("supabase/tests/registration_privacy.test.sql");
      return migration.includes("revoke all privileges on table public.organizer_event_access from anon")
        && tests.includes("no direct SELECT grant on organizer delegation records")
        && tests.includes("cannot create organizer delegation records")
        && tests.includes("cannot modify organizer delegation records")
        && tests.includes("cannot delete organizer delegation records");
    },
  },
  {
    name: "payment evidence remains private and rate-limit storage is server-only",
    run: () => {
      const sql = read("supabase/migrations/20261027054121_registration_endpoint_and_private_evidence.sql");
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
    name: "event save action label matches create or edit state",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('editingStatus==="published"?"Save changes & request review":"Save changes"')
        && editor.includes('"Create event draft"')
        && editor.includes('saving?"Saving…":<><Save size={14}/>');
    },
  },
  {
    name: "organizer workspace controls show visible keyboard focus",
    run: () => {
      const styles = read("src/workspace.css");
      return styles.includes(".workspace-shell :is(a, button, input, select, textarea, [tabindex]):focus-visible")
        && styles.includes("outline: 3px solid #c9b5ff;")
        && styles.includes("outline-offset: 3px;");
    },
  },
  {
    name: "event editor buttons declare explicit button types",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      const formStart = editor.indexOf('<form id="workspace-builder-form"');
      const formEnd = editor.indexOf("</form>", formStart);
      if (formStart < 0 || formEnd < 0) return false;
      const formMarkup = editor.slice(formStart, formEnd);
      const buttons = [...formMarkup.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
      return buttons.length > 0 && buttons.every(button => /\btype\s*=/.test(button));
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
    name: "successful event saves bring confirmation into view",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('id="workspace-notice" className="workspace-notice" role="status"')
        && editor.includes('window.requestAnimationFrame(() => document.getElementById("workspace-notice")?.scrollIntoView({ behavior: "smooth", block: "center" }))')
        && editor.includes('Event draft created in Supabase.');
    },
  },
  {
    name: "workspace errors automatically scroll into view and receive focus",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('useEffect(() => {\n    if (!error) return;')
        && editor.includes('document.getElementById("workspace-alert")')
        && editor.includes('alert?.scrollIntoView({ behavior: "smooth", block: "center" })')
        && editor.includes('alert?.focus({ preventScroll: true })')
        && editor.includes('}, [error]);');
    },
  },
  {
    name: "event save errors scroll into view on mobile and desktop",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('id="workspace-alert" className="workspace-alert" role="alert" tabIndex={-1}')
        && editor.includes('setError(e.message || "Could not save event.")')
        && editor.includes('alert?.scrollIntoView({ behavior: "smooth", block: "center" })');
    },
  },
  {
    name: "website-only toggle exposes its active state accessibly",
    run: () => read("src/OrganizerWorkspace.jsx").includes('className="button button-secondary workspace-canvas-toggle" aria-pressed={websiteOnlyMode} onClick=')
      && read("src/OrganizerWorkspace.jsx").includes('websiteOnlyMode?"Back to editing controls":"Website-only view"'),
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
  },
  {
    name: "event draft saves and review submissions prevent rapid duplicate requests",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes("const savingLock = useRef(false);")
        && editor.includes("if (savingLock.current) return;")
        && editor.includes("savingLock.current = true;")
        && editor.includes("finally { savingLock.current = false; setSaving(false); }")
        && editor.includes("const saveEvent = async (event) =>")
        && editor.includes("const requestReview = async (ev) =>");
    },
  },
  {
    name: "save and review errors focus the accessible alert before scrolling",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.split("alert?.focus({ preventScroll: true })").length >= 3
        && editor.includes('role="alert" tabIndex={-1}');
    },
  },
  {
    name: "save and review failures scroll the accessible error alert into view",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return (editor.match(/workspace-alert/g) || []).length >= 3
        && editor.includes('role="alert" tabIndex={-1}')
        && editor.includes('scrollIntoView({ behavior: "smooth", block: "center" })');
    },
  },
  {
    name: "event titles are validated after trimming before save",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes('const title = String(form.title || "").trim();')
        && editor.includes('if (title.length < 2) throw new Error("Enter an event title with at least 2 characters.");')
        && editor.includes('if (title.length > 140) throw new Error("Event titles can be at most 140 characters.");')
        && editor.includes("title,slug");
    },
  },
  {
    name: "entry fee and team size are validated instead of silently clamped",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      return editor.includes("const entryFee = Number(form.entry_fee);")
        && editor.includes('if (!Number.isFinite(entryFee) || entryFee < 0) throw new Error("Enter a valid entry fee of ₹0 or more.");')
        && editor.includes("const teamSize = Number(form.team_size);")
        && editor.includes('if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 100) throw new Error("Team size must be a whole number between 1 and 100.");')
        && editor.includes("team_size:teamSize,entry_fee_minor:Math.round(entryFee*100)");
    },
  },
  {
    name: "event cover crop position is validated, persisted, and consistent between preview and public page",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      const app = read("src/main.jsx");
      const styles = read("src/workspace.css");
      return editor.includes('value={form.hero_background_position}')
        && editor.includes('heroBackgroundPosition:["center center","center top","center bottom","left center","right center","left top","right top","left bottom","right bottom"].includes(form.hero_background_position)?form.hero_background_position:"center center"')
        && app.includes('eventData?.branding?.heroBackgroundPosition')
        && styles.includes('var(--preview-background-position,center center)/cover');
    },
  },
  {
    name: "event cover images are HTTPS-validated, persisted, and rendered in preview and public pages",
    run: () => {
      const editor = read("src/OrganizerWorkspace.jsx");
      const app = read("src/main.jsx");
      const styles = read("src/workspace.css");
      return editor.includes('safePublicImageUrl(form.hero_background_url, "Hero background image URL")')
        && editor.includes('heroBackgroundUrl:safeHeroBackgroundUrl')
        && editor.includes('value={form.hero_background_url}')
        && editor.includes('value={form.hero_overlay}')
        && editor.includes('has-custom-background')
        && app.includes('eventData?.branding?.heroBackgroundUrl')
        && app.includes('backgroundSize: "cover"')
        && styles.includes('.workspace-live-preview-hero.has-custom-background');
    },
  },
  {
    name: "King account management is owner-only and protects owner accounts and self",
    run: () => {
      const manager = read("supabase/functions/manage-user-accounts/index.ts");
      const deletionHelper = read("supabase/functions/_shared/account-deletion.ts");
      const panel = read("src/OwnerPanel.jsx");
      const styles = read("src/styles.css");
      return manager.includes("admin.auth.getUser(token)")
        && manager.includes('actorProfile?.platform_role !== "owner"')
        && manager.includes('targetId === actor.id')
        && manager.includes('targetProfile?.platform_role === "owner"')
        && manager.includes('ban_duration: "876000h"')
        && manager.includes('ban_duration: "none"')
        && manager.includes('body.confirmation !== "DELETE"')
        && manager.includes("completeAccountDeletion(admin, targetId)")
        && deletionHelper.includes('admin.storage.from("payment-evidence").remove')
        && deletionHelper.includes('admin.auth.admin.deleteUser(userId)')
        && deletionHelper.includes("getUserById(userId)")
        && deletionHelper.includes('prepare_account_deletion')
        && panel.includes('supabase.functions.invoke("manage-user-accounts"')
        && panel.includes('id="owner-user-accounts"')
        && panel.includes('accountConfirmWord !== "DELETE"')
        && panel.includes('accountActionTarget.action === "suspend"')
        && styles.includes(".owner-user-account-list")
        && styles.includes("@media(max-width:700px)");
    },
  },
  {
    name: "organiser accounts can securely change passwords from both profile settings and workspace security",
    run: () => {
      const account = read("src/main.jsx");
      const workspace = read("src/OrganizerWorkspace.jsx");
      const styles = read("src/styles.css");
      const workspaceStyles = read("src/workspace.css");
      return account.includes('id="account-password-title"')
        && account.includes("supabase.auth.signInWithPassword({")
        && account.includes("password: accountCurrentPassword")
        && account.includes("supabase.auth.updateUser({ password: accountNewPassword })")
        && account.includes("accountNewPassword.length < 12")
        && account.includes("accountNewPassword !== accountConfirmPassword")
        && workspace.includes('tab==="security"')
        && workspace.includes("supabase.auth.updateUser({ password: newPassword })")
        && workspace.includes("newPassword.length < 12")
        && workspace.includes("newPassword !== confirmPassword")
        && styles.includes(".account-password-form")
        && workspaceStyles.includes(".workspace-password-form");
    },
  },
  {
    name: "King Login password change requires owner role, current-password verification, and matching strong confirmation",
    run: () => {
      const owner = read("src/OwnerPanel.jsx");
      return owner.includes('if (!user?.email || role !== "owner")')
        && owner.includes("supabase.auth.signInWithPassword({")
        && owner.includes("email: user.email")
        && owner.includes("password: currentPassword")
        && owner.includes("supabase.auth.updateUser({ password: newPassword })")
        && owner.includes("newPassword.length < 12")
        && owner.includes("newPassword !== confirmPassword")
        && owner.includes('id="owner-security"')
        && owner.includes('setCurrentPassword("");')
        && owner.includes('setNewPassword("");')
        && owner.includes('setConfirmPassword("");');
    },
  },
  {
    name: "user and owner login paths stay separate and route to role-appropriate dashboards",
    run: () => {
      const app = read("src/main.jsx");
      const owner = read("src/OwnerPanel.jsx");
      const workspace = read("src/OrganizerWorkspace.jsx");
      return app.includes('if (initialRole === "owner")')
        && app.includes('else if (initialRole === "organizer")')
        && app.includes('else if (platformRole === "owner") setView("king-login"); else setView("organizer");')
        && app.includes('if (profile?.platform_role === "owner")')
        && app.includes('onOpenWorkspace={() => setView("organizer")}')
        && owner.includes('if (!user || role !== "owner")')
        && owner.includes('supabase.auth.signOut()')
        && workspace.includes('onClick={signOut}');
    },
  },
  {
    name: "self-service account deletion reauthenticates and requires explicit confirmation",
    run: () => {
      const account = read("src/main.jsx");
      const deletion = read("supabase/functions/delete-account/index.ts");
      const deletionHelper = read("supabase/functions/_shared/account-deletion.ts");
      return account.includes('supabase.auth.signInWithPassword({')
        && account.includes('functions.invoke("delete-account"')
        && account.includes('deleteConfirmation !== "DELETE"')
        && account.includes('deleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()')
        && deletion.includes('admin.auth.getUser(token)')
        && deletion.includes('profile?.platform_role === "owner"')
        && deletion.includes('body.confirmation !== "DELETE"')
        && deletion.includes("completeAccountDeletion(admin, user.id)")
        && deletionHelper.includes('admin.storage.from("payment-evidence").remove')
        && deletionHelper.includes('admin.auth.admin.deleteUser(userId)')
        && deletionHelper.includes('complete_account_deletion_storage')
        && deletionHelper.includes("getUserById(userId)")
        && !account.includes("SUPABASE_SERVICE_ROLE_KEY");
    },
  },
  {
    name: "shared owner Gmail cannot enter normal User account or be signed out by User Login",
    run: () => {
      const app = read("src/main.jsx");
      const accountAdmin = read("supabase/functions/manage-user-accounts/index.ts");
      return app.includes('const [ownerSessionBlocked, setOwnerSessionBlocked] = useState(false)')
        && app.includes('setOwnerSessionBlocked(true);')
        && app.includes('This Gmail belongs to King Login. Normal User access is disabled for this account.')
        && app.includes('if (ownerSessionBlocked) {')
        && app.includes('onOpenKingLogin={() => setView("king-login")}')
        && app.includes('onClick={onOpenKingLogin}')
        && !app.includes('if (profile?.platform_role === "owner") {\n          await supabase.auth.signOut();')
        && accountAdmin.includes('if (targetProfile?.platform_role === "owner")');
    },
  },

  {
    name: "public event pages do not expose platform login entry points to participants",
    run: () => {
      const app = read("src/main.jsx");
      const headerStart = app.indexOf('<div className="top-actions">');
      const headerEnd = app.indexOf('</div>\n      </header>', headerStart);
      const publicHeader = headerStart >= 0 && headerEnd > headerStart
        ? app.slice(headerStart, headerEnd)
        : "";
      return publicHeader.includes("{!isLiveEventRoute && <>")
        && publicHeader.includes('className="owner-shortcut king-login"')
        && publicHeader.includes('className="account-entry"')
        && publicHeader.includes('className="menu-button"');
    },
  },

  {
    name: "participant records and payment evidence remain strictly organizer-owned",
    run: () => {
      const privacy = read("supabase/migrations/20261030043305_organizer_registration_privacy.sql");
      return privacy.includes("create policy registrations_read_own_organizer_only")
        && privacy.includes("not (select private.is_platform_owner())")
        && privacy.includes("private.can_access_event(registrations.event_id)")
        && privacy.includes("o.owner_user_id = (select auth.uid())")
        && privacy.includes("o.status = 'approved'")
        && privacy.includes("create policy payment_evidence_read_own_organizer_only")
        && privacy.includes("organizer reads only their own private payment evidence")
        && privacy.includes("Platform owner accounts cannot review participant payments")
        && privacy.includes("Only the owning approved organiser can review this registration");
    },
  },

  {
    name: "payment-evidence endpoint parses bearer tokens and enforces organizer-only access",
    run: () => {
      const evidence = read("supabase/functions/view-payment-evidence/index.ts");
      const oneSlashBearerPattern = String.raw`match(/^Bearer\s+(.+)$/i)`;
      const twoSlashBearerPattern = String.raw`match(/^Bearer\\s+(.+)$/i)`;
      return evidence.includes(oneSlashBearerPattern)
        && !evidence.includes(twoSlashBearerPattern)
        && evidence.includes('authClient.auth.getUser(token)')
        && evidence.includes('profile?.platform_role === "owner"')
        && evidence.includes('organizer?.owner_user_id !== user.id')
        && evidence.includes('organizer?.status !== "approved"')
        && evidence.includes('createSignedUrl(evidence.private_object_path, 60)')
        && evidence.includes('"Cache-Control": "no-store"');
    },
  },
  {
    name: "public registration response never returns participant or screenshot data",
    run: () => {
      const registration = read("supabase/functions/register-esports/index.ts");
      const response = registration.slice(registration.lastIndexOf("return reply(origin, 201, {"));
      return response.includes("confirmation_reference:")
        && response.includes("event_title:")
        && response.includes("payment_status:")
        && !response.includes("participant_name:")
        && !response.includes("participant_email:")
        && !response.includes("private_object_path:")
        && !response.includes("signedUrl:");
    },
  },

  {
    name: "King dashboard has no participant directory or payment-evidence viewer",
    run: () => {
      const owner = read("src/OwnerPanel.jsx");
      return !owner.includes("OwnerRegistrations")
        && !owner.includes("OwnerPaymentEvidence")
        && !owner.includes('from("registrations")')
        && !owner.includes('from("payment_evidence")')
        && !owner.includes('functions.invoke("view-payment-evidence"');
    },
  },
  {
    name: "organizer privacy wording excludes platform-owner and delegated access",
    run: () => read("src/OrganizerWorkspace.jsx").includes(
      "Private participant records visible only to the approved organiser account that owns this event. Platform-owner and delegated event access are excluded."
    ),
  },
  {
    name: "obsolete King participant viewer components stay deleted",
    run: () => {
      return !existsSync(join(process.cwd(), "src/OwnerRegistrations.jsx"))
        && !existsSync(join(process.cwd(), "src/OwnerPaymentEvidence.jsx"));
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
