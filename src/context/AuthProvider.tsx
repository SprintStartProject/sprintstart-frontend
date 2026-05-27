import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { apiService, type UserProfile } from '../services/api';
import { AuthContext, type AuthStatus } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const data = await apiService.getProfile();
                
                if (!data) {
                    setStatus('unauthenticated');
                } else {
                    setProfile(data);
                    setStatus('authenticated');
                }
            } catch (error) {
                console.error('Failed to initialize auth', error);
                setStatus('unauthenticated');
            }
        };

        void initAuth();
    }, []);

    const login = async (username: string, firstname: string, lastname: string) => {
        setStatus('loading');
        try {
            const user = await apiService.login(username, firstname, lastname);
            setProfile(user);
            setStatus('authenticated');
        } catch (error) {
            console.error('Login failed', error);
            setStatus('unauthenticated');
        }
    };

    const logout = async () => {
        setStatus('loading');
        await apiService.logout();
        setProfile(null);
        setStatus('unauthenticated');
    };

    return (
        <AuthContext.Provider value={{ status, profile, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
