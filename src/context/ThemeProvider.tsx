import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import type { StyleMode, Theme } from "./ThemeContext";
import {
  GLOW_INTENSITY_DEFAULT,
  GLOW_INTENSITY_MAX,
  GLOW_INTENSITY_MIN,
  ThemeContext,
} from "./ThemeContext";

const STORAGE_KEY = "theme";
const STYLE_STORAGE_KEY = "style-mode";
const AURORA_STORAGE_KEY = "sprintstart:aurora-enabled";
const GLOW_INTENSITY_STORAGE_KEY = "sprintstart:glow-intensity";
const TILT_STORAGE_KEY = "sprintstart:tilt-enabled";

/**
 * Reads the user's stored theme preference, falling back to the OS
 * `prefers-color-scheme` setting (resolved to a concrete light/dark value)
 * when no preference has been persisted. 'system' is only used when explicitly
 * chosen by the user and stored.
 */
function getInitialTheme(): Theme {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // localStorage may be disabled (private mode) or throw on access.
    console.warn("Failed to read theme preference", error);
  }
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Resolves a (possibly 'system') theme to the concrete light/dark mode in effect. */
function resolveDark(theme: Theme): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
}

/**
 * Applies the resolved light/dark class to <html> and persists the preference.
 * Persistence failures (e.g. quota exceeded, private mode) are warned and
 * swallowed — the in-memory theme still applies for the current session.
 */
function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolveDark(theme) ? "dark" : "light");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.warn("Failed to persist theme preference", error);
  }
}

/**
 * Reads the user's stored style mode preference, defaulting to `'ultra'`
 * (the full-motion experience) when nothing is persisted.
 */
function getInitialStyleMode(): StyleMode {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STYLE_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to read style mode preference", error);
  }
  if (stored === "ultra" || stored === "classic") {
    return stored;
  }
  // Auto-activate classic mode when the OS has requested reduced motion,
  // with localStorage still taking priority (checked above).
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "classic";
  }
  return "ultra";
}

/**
 * Applies the `.style-classic` / `.style-ultra` classes on `<html>` and persists the
 * preference. Persistence failures are warned and swallowed — the in-memory
 * mode still applies for the current session.
 *
 * Both classes are written, not just the one: `.style-classic` is what the flat-look overrides
 * key off, while `.style-ultra` is what lifts the global reduced-motion suppression in
 * `index.css`. That one has to be an opt-in marker rather than the absence of `.style-classic`
 * so a surface with no provider on it — the Keycloak login theme — stays suppressed.
 */
function applyStyleMode(mode: StyleMode) {
  const root = window.document.documentElement;
  root.classList.toggle("style-classic", mode === "classic");
  root.classList.toggle("style-ultra", mode === "ultra");
  try {
    window.localStorage.setItem(STYLE_STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Failed to persist style mode preference", error);
  }
}

/**
 * Reads the user's stored aurora background preference.
 * Defaults to `false` (off) when nothing is stored.
 */
function getInitialAuroraEnabled(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(AURORA_STORAGE_KEY);
  } catch {
    // localStorage unavailable.
  }
  if (stored !== null) {
    return stored === "true";
  }
  return false;
}

/**
 * Reads the user's stored tilt effect preference.
 * Defaults to `false` (off) when nothing is stored.
 */
function getInitialTiltEnabled(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(TILT_STORAGE_KEY);
  } catch {
    // localStorage unavailable.
  }
  if (stored !== null) {
    return stored === "true";
  }
  return false;
}

/**
 * Reads the user's stored cursor-glow intensity, clamped into 10–100.
 * Anything missing or unparseable falls back to the default — a hand-edited
 * localStorage value must not be able to break the effect.
 */
function getInitialGlowIntensity(): number {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(GLOW_INTENSITY_STORAGE_KEY);
  } catch {
    // localStorage unavailable.
  }
  const parsed = Number.parseInt(stored ?? "", 10);
  if (Number.isNaN(parsed)) {
    return GLOW_INTENSITY_DEFAULT;
  }
  return Math.min(GLOW_INTENSITY_MAX, Math.max(GLOW_INTENSITY_MIN, parsed));
}

/**
 * Provider component that manages the application's visual theme.
 *
 * Supports an explicit 'system' preference that follows the OS
 * `prefers-color-scheme` media query and re-applies when the OS
 * preference changes. The selection is persisted to localStorage.
 *
 * The resolved `.light`/`.dark` class is applied synchronously in a
 * `useLayoutEffect` so the correct palette is on <html> before the browser
 * paints — avoiding a flash of the wrong theme on first load.
 *
 * Also manages the style mode (`'ultra'` vs `'classic'`) which toggles
 * between the high-energy glassmorphic experience and the flat, calm
 * look. The `.style-classic` class is applied to `<html>`
 * synchronously in a `useLayoutEffect` to prevent a Flash of Unstyled Glow
 * (FOUG) — ambient aurora blobs and spotlight gradients would briefly
 * render at full intensity before the CSS override takes effect if applied
 * in a standard `useEffect`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [styleMode, setStyleModeState] = useState<StyleMode>(() => getInitialStyleMode());
  const [isAuroraEnabled, setIsAuroraEnabledState] = useState<boolean>(() =>
    getInitialAuroraEnabled(),
  );
  const [glowIntensity, setGlowIntensityState] = useState<number>(() => getInitialGlowIntensity());
  const [isTiltEnabled, setIsTiltEnabledState] = useState<boolean>(() => getInitialTiltEnabled());

  // Sync before paint to avoid a FOUC of the default light palette.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply .style-classic before paint to prevent a Flash of Unstyled Glow
  // (aurora blobs / spotlight gradients flashing before the override lands).
  useLayoutEffect(() => {
    applyStyleMode(styleMode);
  }, [styleMode]);

  // When the user picks 'system', keep the applied mode in sync with the OS.
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Listen for live changes to prefers-reduced-motion so the style
  // mode follows even after initial mount.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setStyleModeState("classic");
      } else {
        // Only revert to ultra if the user hasn't explicitly toggled.
        try {
          const stored = window.localStorage.getItem("style-mode");
          if (stored !== "classic") {
            setStyleModeState("ultra");
          }
        } catch {
          // localStorage unavailable — stay safe, stay classic.
        }
      }
    };

    // Defensive guard for test environments where matchMedia lacks addEventListener.
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      }
    };
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
  };

  // Sidebar quick toggle: cycle light <-> dark. 'system' is treated as the
  // resolved mode so toggling from 'system' flips to the opposite concrete mode.
  const toggleTheme = () => {
    setThemeState((prev) => (resolveDark(prev) ? "light" : "dark"));
  };

  const setStyleMode = (next: StyleMode) => {
    setStyleModeState(next);
  };

  const toggleStyleMode = () => {
    setStyleModeState((prev) => (prev === "classic" ? "ultra" : "classic"));
  };

  const isDarkMode = resolveDark(theme);
  const isClassicMode = styleMode === "classic";

  const setIsAuroraEnabled = (enabled: boolean) => {
    setIsAuroraEnabledState(enabled);
    try {
      window.localStorage.setItem(AURORA_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // localStorage unavailable.
    }
  };

  const setGlowIntensity = (value: number) => {
    const clamped = Math.min(GLOW_INTENSITY_MAX, Math.max(GLOW_INTENSITY_MIN, value));
    setGlowIntensityState(clamped);
    try {
      window.localStorage.setItem(GLOW_INTENSITY_STORAGE_KEY, String(clamped));
    } catch {
      // localStorage unavailable.
    }
  };

  const setIsTiltEnabled = (enabled: boolean) => {
    setIsTiltEnabledState(enabled);
    try {
      window.localStorage.setItem(TILT_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // localStorage unavailable.
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDarkMode,
        styleMode,
        setStyleMode,
        toggleStyleMode,
        isClassicMode,
        isAuroraEnabled,
        setIsAuroraEnabled,
        glowIntensity,
        setGlowIntensity,
        isTiltEnabled,
        setIsTiltEnabled,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
