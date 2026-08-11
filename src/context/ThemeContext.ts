import { createContext } from "react";

/** Possible themes for the application UI. 'system' follows the OS preference. */
export type Theme = "light" | "dark" | "system";

/**
 * Shape of the theme context.
 */
export interface ThemeContextType {
  /** Currently active theme preference (may be 'system'). */
  theme: Theme;
  /** Sets the theme preference explicitly (e.g. from a settings control). */
  setTheme: (theme: Theme) => void;
  /** Switches between light and dark themes (resolves 'system' first). */
  toggleTheme: () => void;
  /** Convenience boolean for dark mode checks (resolved, never 'system'). */
  isDarkMode: boolean;
}

/**
 * Context for managing UI appearance preferences.
 * Should be accessed via the `useTheme` hook.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
