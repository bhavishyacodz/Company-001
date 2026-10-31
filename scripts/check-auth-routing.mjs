import { readFileSync } from "node:fs";

const source = readFileSync("src/main.jsx", "utf8");
const checks = [
  ["missing profile roles fail closed", source.includes('const role = !profileError && profile && ["owner", "organizer"].includes(profile.platform_role)') && source.includes(': "unknown";')],
  ["auth changes re-resolve the dashboard destination", source.includes("supabase.auth.onAuthStateChange") && source.includes("resolveSession(session?.user || null)")],
  ["stale async role lookups cannot overwrite newer sessions", source.includes("let requestVersion = 0") && source.includes("version !== requestVersion")],
  ["organiser dashboard requires verified role and workspace", source.includes('platformRole === "organizer" && organizerWorkspaceReady') && source.includes('platformRole !== "organizer" || !organizerWorkspaceReady')],
  ["owner dashboard requires verified owner role", source.includes('view === "owner" && platformRole !== "owner"')],
  ["signed-out users cannot fall through to the legacy dashboard", !source.includes('authReady && !signedInUser && ["organizer", "registrations", "customize"].includes(view)')],
  ["template selection cannot bypass organiser role verification", source.includes('!signedInUser || platformRole !== "organizer"') && source.includes("setOrganizerWorkspaceReady(ready)")],
];

let failed = false;
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\n`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
