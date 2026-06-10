import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Hook to access the global authentication context.
 * 
 * @returns The authentication context value.
 * @throws Error if used outside of an AuthProvider.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
