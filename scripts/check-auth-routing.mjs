import { readFileSync } from "node:fs";

const source = readFileSync("src/main.jsx", "utf8");
const supabaseClientSource = readFileSync("src/services/supabase/client.js", "utf8");
const workspaceSource = readFileSync("src/OrganizerWorkspace.jsx", "utf8");
const dashboardStyles = readFileSync("src/dashboard-yellow.css", "utf8");
const experienceStyles = readFileSync("src/experience-redesign.css", "utf8");
const deletionFunction = readFileSync("supabase/functions/delete-account/index.ts", "utf8");
const checks = [
  ["account deletion requires a freshly authenticated Supabase session", deletionFunction.includes("admin.auth.getUser(token)") && deletionFunction.includes("auth_time") && deletionFunction.includes("10 * 60")],
  ["Google account deletion requires provider reauthentication and resumes the confirmation screen", source.includes('company001:delete-reauth') && source.includes('account_action=delete') && source.includes("reauthenticateGoogleForDeletion") && source.includes("returningFromDeleteReauth")],
  ["Google account password setup supports fresh provider reauthentication", source.includes('company001:password-reauth') && source.includes('account_action=password') && source.includes("reauthenticateGoogleForPassword") && source.includes("returningFromPasswordReauth")],
  ["email password reauthentication keeps the organiser on Profile instead of restoring an old workspace tab", source.includes('company001:password-update-reauth') && source.includes('setView("account")') && source.includes('password was not changed')],
  ["profile menu closes on outside press and Escape", source.includes("closeMenuOnOutsidePress") && source.includes("closeMenuOnEscape") && source.includes('aria-haspopup="menu"')],
  ["profile menu exposes accessible controls and Settings/Sign out actions", source.includes('aria-label={settingsOpen ? "Close profile menu" : "Open profile menu"}') && source.includes('role="menuitem"') && source.includes("<Settings size={16} /> Settings") && source.includes("<LogOut size={16} /> Sign out")],
  ["account deletion instructions match email and Google authentication methods", source.includes("Confirm your account email, current password, and type DELETE.") && source.includes("Reconfirm with Google, confirm your account email, and type DELETE.")],
  ["profile prevents duplicate organiser setup while an application is active", source.includes("const refreshOrganizerWorkspace = async () =>") && source.includes('application.status !== "rejected"') && source.includes("Refresh status") && source.includes('!(setupOpen && application.status === "rejected")')],
  ["email account deletion still verifies the current password", source.includes("if (hasPasswordIdentity)") && source.includes("Password verification failed. Check your password and try again.")],
  ["missing profile roles fail closed", source.includes('const role = !profileError && profile && ["owner", "organizer"].includes(profile.platform_role)') && source.includes(': "unknown";')],
  ["auth changes re-resolve the dashboard destination", source.includes("supabase.auth.onAuthStateChange") && source.includes("resolveSession(session?.user || null)")],
  ["stale async role lookups cannot overwrite newer sessions", source.includes("const authResolutionRef = useRef(0)") && source.includes("let resolvedUserId = null") && source.includes("version !== authResolutionRef.current")],
  ["no obsolete request counter remains in auth routing", !source.includes("requestVersion")],
  ["organiser dashboard requires verified role and workspace", source.includes('platformRole === "organizer" && organizerWorkspaceReady') && source.includes('platformRole !== "organizer" || !organizerWorkspaceReady')],
  ["owner dashboard requires verified owner role", source.includes('view === "owner" && platformRole !== "owner"')],
  ["organizer Google sign-in cannot enter the owner area", source.includes('auth_flow') && source.includes('company001:google-owner-blocked')],
  ["Google OAuth returns to the exact site origin that started sign-in", source.includes('redirectTo: window.location.origin + "/?auth_flow=organizer_google"') && source.includes('new URLSearchParams(window.location.search).get("auth_flow") === "organizer_google"')],
  ["Google OAuth redirect is not hardcoded to the production domain", (() => { const start = source.indexOf("const signInWithGoogle = async"); const end = source.indexOf("const authenticate =", start); const handler = source.slice(start, end); return handler.includes("window.location.origin") && !handler.includes("company-001.pages.dev"); })()],
  ["signed-out users cannot fall through to the legacy dashboard", !source.includes('authReady && !signedInUser && ["organizer", "registrations", "customize"].includes(view)')],
  ["direct site creation cannot bypass organizer role verification", source.includes('!signedInUser || platformRole !== "organizer" || !organizerWorkspaceReady') && source.includes("setOrganizerWorkspaceReady(true)") && source.includes("setOrganizerWorkspaceReady(false)") && source.includes('const openOrganizerWorkspace = async (candidateUser = signedInUser, destination = "organizer") =>') && source.includes('onOpenWorkspace={openOrganizerWorkspace}')],
  ["login and workspace handoff verify the same authenticated organiser", source.includes('const openOrganizerWorkspace = async (candidateUser = signedInUser, destination = "organizer") =>') && source.includes("setSignedInUser(candidateUser)") && source.includes('.eq("id", candidateUser.id)') && source.includes('.eq("owner_user_id", candidateUser.id)') && source.includes("setView(destination)") && source.includes("setUser(data.user)")],
  ["both account entry routes use the verified workspace handoff", source.split("onOpenWorkspace={openOrganizerWorkspace}").length - 1 >= 2 && !source.includes('onOpenWorkspace={() => { setOrganizerWorkspaceReady(true); setView("organizer"); }}')],
  ["email login verifies organiser workspace before clearing its busy state", (() => { const start = source.indexOf("const authenticate = async"); const end = source.indexOf("const submitApplication", start); const handler = source.slice(start, end); return handler.includes("setBusy(true)") && handler.includes('.eq("owner_user_id", data.user.id)') && handler.includes("finally { setBusy(false); }"); })()],
  ["browser sessions persist across browser restarts and refresh tokens auto-renew", supabaseClientSource.includes("persistSession: true") && supabaseClientSource.includes("autoRefreshToken: true") && supabaseClientSource.includes("storage: typeof window !== \"undefined\" ? window.localStorage : undefined")],
  ["first-page session restoration uses Supabase INITIAL_SESSION", source.includes('onAuthStateChange((event, session)') && source.includes('"INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"') && source.includes('event === "INITIAL_SESSION"') ],
  ["duplicate INITIAL_SESSION and SIGNED_IN events do not repeat role/workspace lookups", source.includes("const isDuplicateUserEvent = nextUserId === lastScheduledUserId") && source.includes("if (isDuplicateUserEvent)") && source.includes('if (event === "INITIAL_SESSION") setAuthReady(true);')],
  ["auth bootstrap waits before showing public or profile UI", source.includes('if (!isLiveEventRoute && (!authReady || authResolving))') && source.includes("Restoring your profile…")],
  ["role and organizer workspace are loaded in parallel", source.includes('Promise.all([\n          supabase.from("profiles").select("platform_role")') && source.includes('supabase.from("organizers").select("id,display_name,slug,status")')],
  ["verified user and organizer summary are handed directly to Profile", source.includes('initialUser={platformRole === "organizer" ? signedInUser : null}') && source.includes("initialOrganizer={organizerWorkspaceSummary}")],
  ["verified profile avoids a duplicate role lookup and profile upsert", source.includes('if (initialUser?.id === nextUser.id)') && source.includes('const isParentVerifiedUser = initialUser?.id === user.id') && source.includes('const profileWriteRequest = isParentVerifiedUser')],
  ["profile data requests run concurrently and show a stable loading action", source.includes("Promise.all([organizerRequest, applicationRequest, profileWriteRequest])") && source.includes("Loading your sites…")],
  ["normal Google login does not force the account picker", (() => { const start = source.indexOf("const signInWithGoogle = async"); const end = source.indexOf("const authenticate =", start); return !source.slice(start, end).includes("prompt: \"select_account\""); })()],
  ["organizer workspace data remains attached to the stable Supabase user ID", source.includes('.eq("owner_user_id", user.id)') && source.includes('.eq("applicant_user_id", user.id)')],
  ["workspace tab follows the latest parent auth route", workspaceSource.includes("useEffect(() => { setTab(initialView); }, [initialView])")],
  ["main app and organiser workspace share one Supabase client", source.includes('from "./services/supabase/client.js"') && workspaceSource.includes('from "./services/supabase/client.js"') && !workspaceSource.includes("createClient(")],
  ["organiser My Sites dashboard loads the gold visual layer", workspaceSource.includes('import "./dashboard-yellow.css"') && workspaceSource.includes('import "./experience-redesign.css"') && workspaceSource.includes('className="sites-dashboard"') && experienceStyles.includes(".sites-dashboard,.sites-detail-view{") && experienceStyles.includes(".sites-create-button{")],
  ["gold dashboard styles include the signature panel and experience overrides", dashboardStyles.includes(".dashboard-signature{") && experienceStyles.includes(".dashboard-signature{") && experienceStyles.includes(".workspace-tabs button.active") && experienceStyles.includes("@media(max-width:760px)") && experienceStyles.includes("@media(max-width:520px)")],
  ["dashboard visual styles load after legacy workspace styles", workspaceSource.indexOf('import "./workspace.css"') < workspaceSource.indexOf('import "./dashboard-yellow.css"') && workspaceSource.indexOf('import "./dashboard-yellow.css"') < workspaceSource.indexOf('import "./experience-redesign.css"')],
  ["owner dashboard routing requires verified AAL2", source.includes("supabase.auth.mfa.getAuthenticatorAssuranceLevel()") && source.includes('assurance?.currentLevel === "aal2"') && source.includes('setView(!assuranceError && assurance?.currentLevel === "aal2" ? "owner" : "king-login")')],
  ["owner dashboard remains restricted to MFA-verified King sessions", source.includes('if (role === "owner") {') && source.includes("supabase.auth.mfa.getAuthenticatorAssuranceLevel()") && source.includes('setView(!assuranceError && assurance?.currentLevel === "aal2" ? "owner" : "king-login")') && source.includes('setView(platformRole === "owner" ? "owner" : "king-login")')],

  ["Create site routes signed-in creators directly into the default editor", source.includes('openOrganizerWorkspace(signedInUser, "customize")') && source.includes('const openOrganizerWorkspace = async (candidateUser = signedInUser, destination = "organizer")') && source.includes("setView(destination)")],
  ["first Create site action activates a missing internal organiser record without a manual review step", source.includes('from("organizer_applications").insert({') && source.includes('status: "approved"') && source.includes('Creator workspace activation') && source.includes('select("id,display_name,slug,status")')],
  ["Profile Create Website action opens the editor instead of an organisation setup form", source.includes('onClick={() => { void onOpenWorkspace(user, "customize"); }}>Create Website')],
  ["instant creator activation migration keeps approval disabled and creates an owned organiser record", (() => { const migration = readFileSync("supabase/migrations/20261101130000_instant_creator_workspace_activation.sql", "utf8"); return migration.includes("new.status := 'approved'") && migration.includes("insert into public.organizers") && migration.includes("applicant_user_id = (select auth.uid())") && migration.includes("status = 'approved'") && migration.includes("create trigger organizer_applications_auto_activate"); })()],

];

let failed = false;
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\n`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
