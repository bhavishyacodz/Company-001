import { readFileSync } from "node:fs";

const source = readFileSync("src/main.jsx", "utf8");
const workspaceSource = readFileSync("src/OrganizerWorkspace.jsx", "utf8");
const dashboardStyles = readFileSync("src/dashboard-yellow.css", "utf8");
const checks = [
  ["missing profile roles fail closed", source.includes('const role = !profileError && profile && ["owner", "organizer"].includes(profile.platform_role)') && source.includes(': "unknown";')],
  ["auth changes re-resolve the dashboard destination", source.includes("supabase.auth.onAuthStateChange") && source.includes("resolveSession(session?.user || null)")],
  ["stale async role lookups cannot overwrite newer sessions", source.includes("const authResolutionRef = useRef(0)") && source.includes("let resolvedUserId = null") && source.includes("version !== authResolutionRef.current")],
  ["no obsolete request counter remains in auth routing", !source.includes("requestVersion")],
  ["organiser dashboard requires verified role and workspace", source.includes('platformRole === "organizer" && organizerWorkspaceReady') && source.includes('platformRole !== "organizer" || !organizerWorkspaceReady')],
  ["owner dashboard requires verified owner role", source.includes('view === "owner" && platformRole !== "owner"')],
  ["organizer Google sign-in cannot enter the owner area", source.includes('auth_flow') && source.includes('company001:google-owner-blocked')],
  ["signed-out users cannot fall through to the legacy dashboard", !source.includes('authReady && !signedInUser && ["organizer", "registrations", "customize"].includes(view)')],
  ["template selection cannot bypass organiser role verification", source.includes('!signedInUser || platformRole !== "organizer"') && source.includes("setOrganizerWorkspaceReady(ready)") && source.includes("const openOrganizerWorkspace = async (candidateUser = signedInUser) =>") && source.includes('onOpenWorkspace={openOrganizerWorkspace}')],
  ["login passes the authenticated user into workspace handoff", source.includes("const openOrganizerWorkspace = async (candidateUser = signedInUser) =>") && source.includes("onOpenWorkspace(data.user)") && source.includes("onOpenWorkspace(user)") && source.includes('.eq("id", candidateUser.id)') && source.includes('.eq("owner_user_id", candidateUser.id)')],
  ["both account entry routes use the verified workspace handoff", source.split("onOpenWorkspace={openOrganizerWorkspace}").length - 1 >= 2 && !source.includes('onOpenWorkspace={() => { setOrganizerWorkspaceReady(true); setView("organizer"); }}')],
  ["login waits for workspace verification before clearing its busy state", source.includes("await onOpenWorkspace(data.user)") && source.includes("await onOpenWorkspace(user)")],
  ["workspace tab follows the latest parent auth route", workspaceSource.includes("useEffect(() => { setTab(initialView); }, [initialView])")],
  ["main app and organiser workspace share one Supabase client", source.includes('from "./services/supabase/client.js"') && workspaceSource.includes('from "./services/supabase/client.js"') && !workspaceSource.includes("createClient(")],
  ["organiser dashboard keeps its gold visual layer", workspaceSource.includes('import "./dashboard-yellow.css"') && workspaceSource.includes('className="dashboard-signature"')],
  ["gold dashboard styles include the signature panel, tabs, and mobile layout", dashboardStyles.includes(".dashboard-signature{") && dashboardStyles.includes(".workspace-tabs button.active") && dashboardStyles.includes("@media(max-width:760px)") && dashboardStyles.includes("@media(max-width:520px)")],
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
