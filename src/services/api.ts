export enum Role {
    NO_ROLE = 'NO_ROLE',
    EXISTING_MEMBER = 'EXISTING_MEMBER',
    NEW_MEMBER = 'NEW_MEMBER',
    ADMIN = 'ADMIN',
}

export enum WorkingArea {
    NO_WORKING_AREA = 'NO_WORKING_AREA',
    FRONTEND_DEV = 'FRONTEND_DEV',
    BACKEND_DEV = 'BACKEND_DEV',
    DEV_OPS = 'DEV_OPS',
    QA = 'QA',
    HR = 'HR',
}

export interface UserProfile {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    primaryRole: Role;
    secondaryRole: Role;
    workingArea: WorkingArea;
}

const SESSION_KEY = 'sprintstart_session_id';

export const apiService = {
    async login(username: string, firstname: string, lastname: string): Promise<UserProfile> {
        // 1. Fetch all users to see if we match the username
        const response = await fetch('/api/v1/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const users: UserProfile[] = await response.json();
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
        
        const newUser: UserProfile = await createResponse.json();
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
            return await response.json();
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
        return await response.json();
    },

    async resetProfile(): Promise<void> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) return;

        await this.updateProfile({
            primaryRole: Role.NO_ROLE,
            secondaryRole: Role.NO_ROLE
        });
    },

    async logout(): Promise<void> {
        localStorage.removeItem(SESSION_KEY);
    }
};
