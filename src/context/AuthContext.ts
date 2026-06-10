import { createContext } from 'react';
import type { UserProfile } from '../services/types';

/**
 * Represents the current authentication state of the application.
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

/**
 * Shape of the authentication context.
 */
export interface AuthContextType {
    /** Current state of authentication (e.g., loading, logged in, logged out). */
    status: AuthStatus;
    /** The authenticated user's profile metadata, or null if not logged in. */
    profile: UserProfile | null;
    /** Triggers the login flow and creates a session. */
    login: (username: string, firstname: string, lastname: string) => Promise<void>;
    /** Ends the current session and clears local credentials. */
    logout: () => Promise<void>;
    /** Force-refreshes the user profile from the backend. */
    refetchProfile: () => Promise<void>;
}

/**
 * Context for managing and accessing global authentication state.
 * Should be accessed via the `useAuth` hook.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
