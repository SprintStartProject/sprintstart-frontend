import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

/**
 * Hook to access the global theme context.
 * 
 * @returns The theme context value.
 * @throws Error if used outside of a ThemeProvider.
 */
export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
