import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PLATFORM_BASELINE_THEME, THEME_REGISTRY, applyThemeTokens, validateTheme } from "./themeRegistry.js";

const CompanyThemeContext = createContext(null);

/**
 * Platform theme provider. Event themes must be applied to an event-owned
 * container using applyThemeTokens with target="event"; they are never applied
 * to the document root.
 */
export function CompanyThemeProvider({ children, initialThemeId = PLATFORM_BASELINE_THEME.id }) {
  const [themeId, setThemeIdState] = useState(initialThemeId);
  const theme = THEME_REGISTRY[themeId] || PLATFORM_BASELINE_THEME;

  const setThemeId = useCallback((nextThemeId) => {
    const candidate = THEME_REGISTRY[nextThemeId];
    if (!candidate || candidate.target !== "platform" || !validateTheme(candidate, "platform").valid) {
      return { success: false, reason: "Unknown or invalid platform theme." };
    }
    setThemeIdState(nextThemeId);
    return { success: true };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const result = applyThemeTokens(root, theme, "platform");
    if (!result.valid) return undefined;
    root.dataset.companyPlatformTheme = theme.id;
    return () => {
      delete root.dataset.companyPlatformTheme;
    };
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    themeId,
    setThemeId,
    getTheme: (id) => THEME_REGISTRY[id] || null
  }), [theme, themeId, setThemeId]);

  return <CompanyThemeContext.Provider value={value}>{children}</CompanyThemeContext.Provider>;
}

export function useCompanyTheme() {
  const context = useContext(CompanyThemeContext);
  if (!context) throw new Error("useCompanyTheme must be used inside CompanyThemeProvider.");
  return context;
}
