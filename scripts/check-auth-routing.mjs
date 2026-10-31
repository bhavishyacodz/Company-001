import { readFileSync } from "node:fs";

const source = readFileSync("src/main.jsx", "utf8");
const workspaceSource = readFileSync("src/OrganizerWorkspace.jsx", "utf8");
const dashboardStyles = readFileSync("src/dashboard-yellow.css", "utf8");
const experienceStyles = readFileSync("src/experience-redesign.css", "utf8");
const deletionFunction = readFileSync("supabase/functions/delete-account/index.ts", "utf8");
const checks = [
  ["account deletion requires a freshly authenticated Supabase session", deletionFunction.includes("admin.auth.getUser(token)") && deletionFunction.includes("auth_time") && deletionFunction.includes("10 * 60")],
  ["Google account deletion requires provider reauthentication and resumes the confirmation screen", source.includes('company001:delete-reauth') && source.includes('account_action=delete') && source.includes("reauthenticateGoogleForDeletion") && source.includes("returningFromDeleteReauth")],
  ["Google account password setup supports fresh provider reauthentication", source.includes('company001:password-reauth') && source.includes('account_action=password') && source.includes("reauthenticateGoogleForPassword") && source.includes("returningFromPasswordReauth")],
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
  ["template selection cannot bypass organiser role verification", source.includes('!signedInUser || platformRole !== "organizer"') && source.includes("setOrganizerWorkspaceReady(ready)") && source.includes("const openOrganizerWorkspace = async (candidateUser = signedInUser) =>") && source.includes('onOpenWorkspace={openOrganizerWorkspace}')],
  ["login and workspace handoff verify the same authenticated organiser", source.includes("const openOrganizerWorkspace = async (candidateUser = signedInUser) =>") && source.includes("setSignedInUser(candidateUser)") && source.includes('.eq("id", candidateUser.id)') && source.includes('.eq("owner_user_id", candidateUser.id)') && source.includes('setView("organizer")') && source.includes("setUser(data.user)")],
  ["both account entry routes use the verified workspace handoff", source.split("onOpenWorkspace={openOrganizerWorkspace}").length - 1 >= 2 && !source.includes('onOpenWorkspace={() => { setOrganizerWorkspaceReady(true); setView("organizer"); }}')],
  ["email login verifies organiser workspace before clearing its busy state", (() => { const start = source.indexOf("const authenticate = async"); const end = source.indexOf("const submitApplication", start); const handler = source.slice(start, end); return handler.includes("setBusy(true)") && handler.includes('.eq("owner_user_id", data.user.id)') && handler.includes("finally { setBusy(false); }"); })()],
  ["workspace tab follows the latest parent auth route", workspaceSource.includes("useEffect(() => { setTab(initialView); }, [initialView])")],
  ["main app and organiser workspace share one Supabase client", source.includes('from "./services/supabase/client.js"') && workspaceSource.includes('from "./services/supabase/client.js"') && !workspaceSource.includes("createClient(")],
  ["organiser My Sites dashboard loads the gold visual layer", workspaceSource.includes('import "./dashboard-yellow.css"') && workspaceSource.includes('import "./experience-redesign.css"') && workspaceSource.includes('className="sites-dashboard"') && experienceStyles.includes(".sites-dashboard,.sites-detail-view{") && experienceStyles.includes(".sites-create-button{")],
  ["gold dashboard styles include the signature panel and experience overrides", dashboardStyles.includes(".dashboard-signature{") && experienceStyles.includes(".dashboard-signature{") && experienceStyles.includes(".workspace-tabs button.active") && experienceStyles.includes("@media(max-width:760px)") && experienceStyles.includes("@media(max-width:520px)")],
  ["dashboard visual styles load after legacy workspace styles", workspaceSource.indexOf('import "./workspace.css"') < workspaceSource.indexOf('import "./dashboard-yellow.css"') && workspaceSource.indexOf('import "./dashboard-yellow.css"') < workspaceSource.indexOf('import "./experience-redesign.css"')],
  ["owner dashboard routing requires verified AAL2", source.includes("supabase.auth.mfa.getAuthenticatorAssuranceLevel()") && source.includes('assurance?.currentLevel === "aal2"') && source.includes('setView(!assuranceError && assurance?.currentLevel === "aal2" ? "owner" : "king-login")')],
  ["template selection cannot bypass owner MFA", (() => { const start = source.indexOf("const handleUseTemplate = async"); const end = source.indexOf("const copyPlatformLink", start); const handler = source.slice(start, end); return handler.includes('if (platformRole === "owner")') && handler.includes('setView("king-login")') && !handler.includes('setView("owner")'); })()],
];

let failed = false;
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\n`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
