import { createContext } from "react";

/** Possible themes for the application UI. 'system' follows the OS preference. */
export type Theme = "light" | "dark" | "system";

/**
 * Visual motion mode for the application.
 * - `'ultra'` — full glassmorphic glows, animated aurora drift, and spotlight effects.
 * - `'classic'` — flat surfaces, standard borders, no ambient glow or floating animations.
 */
export type StyleMode = "ultra" | "classic";

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
  /** Currently active style mode ('ultra' or 'classic'). */
  styleMode: StyleMode;
  /** Sets the style mode explicitly. */
  setStyleMode: (mode: StyleMode) => void;
  /** Toggles between 'ultra' and 'classic' style modes. */
  toggleStyleMode: () => void;
  /** Convenience boolean — true when classic (flat) mode is active. */
  isClassicMode: boolean;
  /** Whether the aurora background effect is currently enabled. */
  isAuroraEnabled: boolean;
  /** Enables or disables the aurora background effect (persisted to localStorage). */
  setIsAuroraEnabled: (enabled: boolean) => void;
  /** Cursor-glow intensity of the aurora spotlight, 10–100 (percent). */
  glowIntensity: number;
  /** Sets the cursor-glow intensity, clamped to 10–100 and persisted to localStorage. */
  setGlowIntensity: (value: number) => void;
  /** Whether the 3D tilt / spotlight hover effect on cards is enabled. */
  isTiltEnabled: boolean;
  /** Enables or disables the card tilt effect (persisted to localStorage). */
  setIsTiltEnabled: (enabled: boolean) => void;
}

/**
 * Context for managing UI appearance preferences.
 * Should be accessed via the `useTheme` hook.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
