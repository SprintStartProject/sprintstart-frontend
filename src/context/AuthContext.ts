import { createContext } from 'react';
import type { UserProfile } from '../services/api';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthContextType {
    status: AuthStatus;
    profile: UserProfile | null;
    login: (username: string, email: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
