export type ResolvedThemeMode = "light" | "dark";
export type ThemeMode = ResolvedThemeMode | "system";

const THEME_STORAGE_KEY = "snap-razer-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function readThemeMode(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedTheme) ? storedTheme : "dark";
  } catch {
    return "dark";
  }
}

export function storeThemeMode(themeMode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch {
    // Theme switching should still work when storage is unavailable.
  }
}

export function readSystemThemeMode(): ResolvedThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveThemeMode(themeMode: ThemeMode, systemThemeMode: ResolvedThemeMode): ResolvedThemeMode {
  return themeMode === "system" ? systemThemeMode : themeMode;
}
