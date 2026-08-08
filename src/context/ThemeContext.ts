import { createContext } from 'react';

/** Possible themes for the application UI. 'system' follows the OS preference. */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Visual motion mode for the application.
 * - `'ultra'` — full glassmorphic glows, animated aurora drift, and spotlight effects.
 * - `'classic'` — flat surfaces, standard borders, no ambient glow or floating animations.
 */
export type StyleMode = 'ultra' | 'classic';

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
}

/**
 * Context for managing UI appearance preferences.
 * Should be accessed via the `useTheme` hook.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
