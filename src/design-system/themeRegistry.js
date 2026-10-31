/**
 * Company-001 theme registry.
 *
 * Themes contain presentation tokens only. They must never contain event,
 * registration, payment, authentication, or participant data.
 */

export const THEME_SCHEMA_VERSION = 1;

export const PLATFORM_BASELINE_THEME = Object.freeze({
  id: "platform-baseline",
  version: 1,
  schemaVersion: THEME_SCHEMA_VERSION,
  target: "platform",
  name: "Company-001 Current",
  description: "The existing dark violet and cyan visual identity.",
  tokens: Object.freeze({
    colors: Object.freeze({
      canvas: "#090b12",
      surface: "#11141e",
      surfaceRaised: "#171b27",
      border: "#282c3b",
      text: "#f4f5fb",
      muted: "#969bad",
      primary: "#9a6bff",
      primaryContrast: "#ffffff",
      accent: "#5be7e3",
      success: "#a7ffcc",
      warning: "#f4c66a",
      danger: "#ff6b81",
      focus: "#5be7e3"
    }),
    typography: Object.freeze({
      body: "'DM Sans', sans-serif",
      display: "'Barlow Condensed', sans-serif"
    }),
    radii: Object.freeze({
      control: "8px",
      card: "16px",
      dialog: "20px"
    }),
    motion: Object.freeze({
      fast: "140ms",
      normal: "180ms"
    })
  })
});

export const EVENT_BASELINE_THEME = Object.freeze({
  ...PLATFORM_BASELINE_THEME,
  id: "event-baseline",
  target: "event",
  name: "Event Baseline",
  description: "A safe starting theme for organizer event pages."
});

export const THEME_REGISTRY = Object.freeze({
  [PLATFORM_BASELINE_THEME.id]: PLATFORM_BASELINE_THEME,
  [EVENT_BASELINE_THEME.id]: EVENT_BASELINE_THEME
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_FONT = /^[a-zA-Z0-9 ,'""-]{1,120}$/;
const SAFE_LENGTH = /^(0|[0-9]+(\.[0-9]+)?(px|rem|em))$/;
const SAFE_DURATION = /^[0-9]+(\.[0-9]+)?ms$/;

export function validateTheme(theme, expectedTarget) {
  const errors = [];
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    return { valid: false, errors: ["Theme must be an object."] };
  }
  if (theme.schemaVersion !== THEME_SCHEMA_VERSION) errors.push("Unsupported theme schema version.");
  if (typeof theme.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(theme.id)) errors.push("Invalid theme id.");
  if (!Number.isInteger(theme.version) || theme.version < 1) errors.push("Theme version must be a positive integer.");
  if (!["platform", "event"].includes(theme.target)) errors.push("Invalid theme target.");
  if (expectedTarget && theme.target !== expectedTarget) errors.push("Theme target does not match the requested scope.");
  if (typeof theme.name !== "string" || !theme.name.trim() || theme.name.length > 80) errors.push("Theme name is required and must be 80 characters or fewer.");

  const tokens = theme.tokens;
  if (!tokens || typeof tokens !== "object") {
    errors.push("Theme tokens are required.");
    return { valid: false, errors };
  }

  const colorNames = ["canvas", "surface", "surfaceRaised", "border", "text", "muted", "primary", "primaryContrast", "accent", "success", "warning", "danger", "focus"];
  for (const name of colorNames) {
    if (!HEX_COLOR.test(tokens.colors?.[name] || "")) errors.push("Invalid or missing color token: " + name);
  }
  for (const name of ["body", "display"]) {
    if (!SAFE_FONT.test(tokens.typography?.[name] || "")) errors.push("Invalid or missing typography token: " + name);
  }
  for (const name of ["control", "card", "dialog"]) {
    if (!SAFE_LENGTH.test(tokens.radii?.[name] || "")) errors.push("Invalid or missing radius token: " + name);
  }
  for (const name of ["fast", "normal"]) {
    if (!SAFE_DURATION.test(tokens.motion?.[name] || "")) errors.push("Invalid or missing motion token: " + name);
  }

  return { valid: errors.length === 0, errors };
}

const CSS_TOKEN_MAP = Object.freeze({
  "--ds-color-canvas": ["colors", "canvas"],
  "--ds-color-surface": ["colors", "surface"],
  "--ds-color-surface-raised": ["colors", "surfaceRaised"],
  "--ds-color-border": ["colors", "border"],
  "--ds-color-text": ["colors", "text"],
  "--ds-color-muted": ["colors", "muted"],
  "--ds-color-primary": ["colors", "primary"],
  "--ds-color-primary-contrast": ["colors", "primaryContrast"],
  "--ds-color-accent": ["colors", "accent"],
  "--ds-color-success": ["colors", "success"],
  "--ds-color-warning": ["colors", "warning"],
  "--ds-color-danger": ["colors", "danger"],
  "--ds-color-focus": ["colors", "focus"],
  "--ds-font-body": ["typography", "body"],
  "--ds-font-display": ["typography", "display"],
  "--ds-radius-control": ["radii", "control"],
  "--ds-radius-card": ["radii", "card"],
  "--ds-radius-dialog": ["radii", "dialog"],
  "--ds-motion-fast": ["motion", "fast"],
  "--ds-motion-normal": ["motion", "normal"]
});

/**
 * Apply only known, validated CSS custom properties to the supplied element.
 * No arbitrary CSS text, selectors, HTML, or script values are accepted.
 */
export function applyThemeTokens(element, theme, expectedTarget) {
  if (!["platform", "event"].includes(expectedTarget)) {
    return { valid: false, errors: ["An explicit platform or event theme scope is required."] };
  }
  const result = validateTheme(theme, expectedTarget);
  if (!result.valid) return result;
  if (!element?.style?.setProperty) return { valid: false, errors: ["A valid theme scope element is required."] };

  const isDocumentRoot = element?.tagName?.toLowerCase() === "html" ||
    Boolean(element?.ownerDocument?.documentElement === element);
  if (expectedTarget === "platform" && !isDocumentRoot) {
    return { valid: false, errors: ["Platform themes may only be applied to the document root."] };
  }
  if (expectedTarget === "event" && (isDocumentRoot || element?.dataset?.companyEventThemeScope !== "true")) {
    return { valid: false, errors: ["Event themes require an explicitly marked event-owned container."] };
  }

  for (const [cssName, path] of Object.entries(CSS_TOKEN_MAP)) {
    element.style.setProperty(cssName, theme.tokens[path[0]][path[1]]);
  }
  return { valid: true, errors: [] };
}
