import { useContext } from 'react';
import { ThemeContext, type ThemeContextType } from './ThemeContext';

/**
 * Hook to access the global theme context.
 *
 * @returns The theme context value.
 */
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        return {
                    theme: 'light',
                    setTheme: () => {},
                    toggleTheme: () => {},
                    isDarkMode: false,
                    styleMode: 'ultra',
                    setStyleMode: () => {},
                    toggleStyleMode: () => {},
                    isClassicMode: false,
                    isAuroraEnabled: false,
                                        setIsAuroraEnabled: () => {},
                                        isTiltEnabled: true,
                                        setIsTiltEnabled: () => {},
                };
    }
    return context;
}