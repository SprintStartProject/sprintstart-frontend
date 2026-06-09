import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Theme } from './ThemeContext';
import { ThemeContext } from './ThemeContext';

function getInitialTheme(): Theme {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

    useEffect(() => {
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
