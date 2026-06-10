import { createContext } from 'react';

/** Possible themes for the application UI. */
export type Theme = 'light' | 'dark';

/**
 * Shape of the theme context.
 */
export interface ThemeContextType {
    /** Currently active theme. */
    theme: Theme;
    /** Switches between light and dark themes. */
    toggleTheme: () => void;
    /** Convenience boolean for dark mode checks. */
    isDarkMode: boolean;
}

/**
 * Context for managing UI appearance preferences.
 * Should be accessed via the `useTheme` hook.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
