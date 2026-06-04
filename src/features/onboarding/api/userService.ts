import { Role, WorkingArea, type UserProfile } from '../../../services/types';

const SESSION_KEY = 'sprintstart_session_id';

export const userService = {
    async login(username: string, firstname: string, lastname: string): Promise<UserProfile> {
        // 1. Fetch all users to see if we match the username
        const response = await fetch('/api/v1/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const users = await response.json() as UserProfile[];
        const existingUser = users.find(u => u.username === username);

        if (existingUser) {
            localStorage.setItem(SESSION_KEY, existingUser.id);
            return existingUser;
        }

        // 2. Not found? Create a new one
        const createResponse = await fetch('/api/v1/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                firstname,
                lastname,
                workingArea: WorkingArea.NO_WORKING_AREA
            })
        });

        if (!createResponse.ok) throw new Error('Failed to create user');
        
        const newUser = await createResponse.json() as UserProfile;
        localStorage.setItem(SESSION_KEY, newUser.id);
        return newUser;
    },

    async getProfile(): Promise<UserProfile | null> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) return null;

        try {
            const response = await fetch(`/api/v1/users/${userId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    localStorage.removeItem(SESSION_KEY);
                    return null;
                }
                throw new Error('Failed to fetch profile');
            }
            return await response.json() as UserProfile;
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) throw new Error('Not authenticated');

        const response = await fetch(`/api/v1/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });

        if (!response.ok) throw new Error('Failed to update profile');
        return await response.json() as UserProfile;
    },

    async resetProfile(): Promise<void> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) return;

        await this.updateProfile({
            primaryRole: Role.NO_ROLE,
            secondaryRole: Role.NO_ROLE
        });
    },

    logout(): Promise<void> {
        localStorage.removeItem(SESSION_KEY);
        return Promise.resolve();
    }
};
