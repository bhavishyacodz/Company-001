import { readFileSync } from "node:fs";

const home = readFileSync("src/CompanyHome.jsx", "utf8");
const app = readFileSync("src/main.jsx", "utf8");
const styles = readFileSync("src/tactile-design-system.css", "utf8");
const checks = [
  ["public homepage uses a dedicated tactile bento layout", home.includes("tactile-frame") && home.includes("tactile-bento-grid") && home.includes("tactile-mascot")],
  ["navigation menu is an accessible controlled popover", home.includes('aria-expanded={menuOpen}') && home.includes('aria-controls="tactile-menu"') && home.includes('id="tactile-menu"')],
  ["navigation popover closes on outside press and Escape", home.includes("closeOnOutsidePress") && home.includes("closeOnEscape") && home.includes('event.key === "Escape"')],
  ["catalog navigation now opens direct site creation instead of the public theme gallery", home.includes("onTemplates") && home.includes("Create your site") && app.includes('onTemplates={() => navigateToCreator("customize")}') && app.includes('onOrganiser={() => navigateToCreator("organizer")}') && !app.includes('<TemplateGallery onUseTemplate={handleUseTemplate} />')],
  ["organiser workspace shortcut uses the existing authenticated routing", home.includes("onClick={onOrganiser}") && app.includes('onOrganiser={() => navigateToCreator("organizer")}')],
  ["custom website enquiry remains reachable from its bento card", home.includes('className="tactile-bento-card bento-web"') && app.includes('onStart={() => document.getElementById("contact")?.scrollIntoView')],
  ["existing consultation endpoint and input validation are preserved", home.includes('/functions/v1/request-consultation') && home.includes('minLength={15}') && home.includes('maxLength={3000}') && home.includes('type="email"')],
  ["shared design tokens define brand, surfaces, text, border and motion", styles.includes("--c001-brand:#5d6fd3") && styles.includes("--c001-cream:#fdfbf2") && styles.includes("--c001-pink:#ff0055") && styles.includes("--c001-line:#efe8d5") && styles.includes("--c001-motion:")],
  ["global design theme tokens are attached to the application root", app.includes('data-design-theme="tactile"') && styles.includes('.app[data-design-theme="tactile"]')],
  ["public site has dedicated responsive navigation and page frame", styles.includes(".tactile-frame") && styles.includes(".tactile-popover") && styles.includes("@media(max-width:760px)") && styles.includes("@media(max-width:480px)") && styles.includes("@media(max-width:380px)") && styles.includes(".tactile-center-pill{display:none}")],
  ["tactile menu supports all viewport widths without a fixed overflow width", styles.includes("max-width:calc(100vw - 64px)") && styles.includes("max-width:calc(100vw - 34px)")],
  ["keyboard focus and reduced-motion preferences are supported", styles.includes(":focus-visible") && styles.includes("@media(prefers-reduced-motion:reduce)")],
  ["scroll reveals use IntersectionObserver rather than continuous scroll handlers", home.includes("new IntersectionObserver") && home.includes('root.querySelectorAll("[data-reveal]")') && !home.includes('addEventListener("scroll"')],
  ["mascot pointer movement does not trigger repeated React renders", !home.includes("const [tilt, setTilt]") && !home.includes("onPointerMove={moveStage}") && !home.includes("setTilt(")],
  ["mobile scroll keeps native touch behavior and has tactile press states", styles.includes("overscroll-behavior-x:none") && styles.includes("@media(hover:none), (pointer:coarse)") && styles.includes("scroll-behavior:smooth")],
  ["reduced-motion users receive visible non-animated content", styles.includes(".tactile-home.tactile-motion-ready [data-reveal]") && styles.includes("transition:none")],
  ["organiser, profile and King surfaces receive shared visual tokens", styles.includes(".account-card") && styles.includes(".workspace-card") && styles.includes(".owner-card") && styles.includes(".owner-section")],
  ["homepage hides duplicate global navigation only in public company-home mode", app.includes('view === "site" && !isLiveEventRoute ? "company-home-mode"') && styles.includes(".company-home-mode>.topbar")],
  ["theme styling does not change Supabase client, RLS or payment-evidence code", !app.includes("createClient(") && !home.includes("payment_evidence") && !home.includes("service_role")],
];
let failed = false;
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\\n`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
