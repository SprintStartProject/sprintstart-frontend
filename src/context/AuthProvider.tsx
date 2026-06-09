import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import type { UserProfile } from '../services/types';
import { AuthContext, type AuthStatus } from './AuthContext';

const BASE_API_URL = 'http://localhost:8080/api/v1';

const seedOnboardingPath = async (userId: string) => {
    // --- TESTUSER BYPASS ---
    if (userId === 'test-user-id') return;
    // -----------------------
    const res = await fetch(`${BASE_API_URL}/onboarding/${userId}/seeding`, {
        method: 'POST',
    });

    if (!res.ok) {
        throw new Error(`Onboarding seeding failed: HTTP ${res.status}`);
    }
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const data = await userService.getProfile();

                if (!data) {
                    setStatus('unauthenticated');
                } else {
                    await seedOnboardingPath(data.id);
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
            const user = await userService.login(username, firstname, lastname);
            await seedOnboardingPath(user.id);
            setProfile(user);
            setStatus('authenticated');
        } catch (error) {
            console.error('Login failed', error);
            setStatus('unauthenticated');
        }
    };

    const logout = async () => {
        setStatus('loading');
        await userService.logout();
        setProfile(null);
        setStatus('unauthenticated');
    };
    
    const refetchProfile = async () => {
        const data = await userService.getProfile();
        if (data) setProfile(data);
    };

    

    return (
        <AuthContext.Provider value={{ status, profile, login, logout, refetchProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
