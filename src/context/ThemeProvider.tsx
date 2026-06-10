import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Theme } from './ThemeContext';
import { ThemeContext } from './ThemeContext';

/**
 * Resolves the user's initial theme preference.
 * Checks localStorage first, then falls back to system settings.
 */
function getInitialTheme(): Theme {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Provider component that manages the application's visual theme.
 * 
 * Synchronizes the theme state with the document root class and persists
 * the selection in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

    useEffect(() => {
        /**
         * Side effect that updates the '<html>' element class to trigger 
         * Tailwind dark mode and saves the preference.
         */
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const isDarkMode = theme === 'dark';

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
}
