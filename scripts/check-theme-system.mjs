import assert from "node:assert/strict";
import {
  EVENT_BASELINE_THEME,
  PLATFORM_BASELINE_THEME,
  THEME_REGISTRY,
  applyThemeTokens,
  validateTheme
} from "../src/design-system/themeRegistry.js";

const platform = validateTheme(PLATFORM_BASELINE_THEME, "platform");
assert.equal(platform.valid, true, platform.errors.join("; "));

const event = validateTheme(EVENT_BASELINE_THEME, "event");
assert.equal(event.valid, true, event.errors.join("; "));

assert.equal(validateTheme(PLATFORM_BASELINE_THEME, "event").valid, false, "Platform theme must not pass event scope validation.");
assert.equal(validateTheme(EVENT_BASELINE_THEME, "platform").valid, false, "Event theme must not pass platform scope validation.");

const unsafeColor = {
  ...PLATFORM_BASELINE_THEME,
  tokens: {
    ...PLATFORM_BASELINE_THEME.tokens,
    colors: { ...PLATFORM_BASELINE_THEME.tokens.colors, primary: "url(javascript:alert(1))" }
  }
};
assert.equal(validateTheme(unsafeColor, "platform").valid, false, "Unsafe color values must be rejected.");

const unsafeFont = {
  ...PLATFORM_BASELINE_THEME,
  tokens: {
    ...PLATFORM_BASELINE_THEME.tokens,
    typography: { ...PLATFORM_BASELINE_THEME.tokens.typography, body: "x; background: url(https://bad.example)" }
  }
};
assert.equal(validateTheme(unsafeFont, "platform").valid, false, "Unsafe font values must be rejected.");

assert.equal(THEME_REGISTRY["platform-baseline"].target, "platform");
assert.equal(THEME_REGISTRY["event-baseline"].target, "event");

console.log("Theme foundation checks passed.");

const styleValues = new Map();
const fakeElement = { tagName: "HTML", style: { setProperty: (key, value) => styleValues.set(key, value) } };
assert.equal(applyThemeTokens(fakeElement, PLATFORM_BASELINE_THEME, "platform").valid, true);
assert.equal(styleValues.get("--ds-color-primary"), PLATFORM_BASELINE_THEME.tokens.colors.primary);
assert.equal(applyThemeTokens(fakeElement, PLATFORM_BASELINE_THEME, "event").valid, false);
assert.equal(applyThemeTokens(fakeElement, EVENT_BASELINE_THEME).valid, false, "Applying a theme requires an explicit scope.");

const eventScope = {
  dataset: { companyEventThemeScope: "true" },
  style: { setProperty: (key, value) => styleValues.set(key, value) }
};
assert.equal(applyThemeTokens(eventScope, EVENT_BASELINE_THEME, "event").valid, true);
assert.equal(applyThemeTokens(fakeElement, EVENT_BASELINE_THEME, "event").valid, false, "Event themes must not be applied to the document root.");
assert.equal(applyThemeTokens({ style: { setProperty() {} } }, EVENT_BASELINE_THEME, "event").valid, false, "Event themes require an explicitly marked event container.");
