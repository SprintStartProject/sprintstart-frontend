import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import type { Theme } from "./ThemeContext";
import { ThemeContext } from "./ThemeContext";

const STORAGE_KEY = "theme";

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
 * Provider component that manages the application's visual theme.
 *
 * Supports an explicit 'system' preference that follows the OS
 * `prefers-color-scheme` media query and re-applies when the OS
 * preference changes. The selection is persisted to localStorage.
 *
 * The resolved `.light`/`.dark` class is applied synchronously in a
 * `useLayoutEffect` so the correct palette is on <html> before the browser
 * paints — avoiding a flash of the wrong theme on first load.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  // Sync before paint to avoid a FOUC of the default light palette.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // When the user picks 'system', keep the applied mode in sync with the OS.
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
  };

  // Sidebar quick toggle: cycle light <-> dark. 'system' is treated as the
  // resolved mode so toggling from 'system' flips to the opposite concrete mode.
  const toggleTheme = () => {
    setThemeState((prev) => (resolveDark(prev) ? "light" : "dark"));
  };

  const isDarkMode = resolveDark(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
