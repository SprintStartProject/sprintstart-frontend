import { Role, WorkingArea, type UserProfile } from './types';

const SESSION_KEY = 'sprintstart_session_id';
const MOCK_PROFILE_KEY = 'sprintstart_mock_profile';

/**
 * Service managing user authentication, profile retrieval, and updates.
 * Handles both real API calls and a 'testuser' bypass for local development.
 */
export const userService = {
    /**
     * Authenticates a user or creates a new one if not found.
     * 
     * If 'testuser' is provided as username, it activates the mock bypass.
     * 
     * @param username - Unique username for login.
     * @param firstname - User's first name (used for new user creation).
     * @param lastname - User's last name (used for new user creation).
     * @returns Promise resolving to the UserProfile.
     * @throws Error if authentication or user creation fails.
     */
    async login(username: string, firstname: string, lastname: string): Promise<UserProfile> {
        // --- TESTUSER BYPASS ---
        if (username.toLowerCase() === 'testuser') {
            const mockUser: UserProfile = { 
                id: 'test-user-id', 
                username: 'testuser', 
                firstname: firstname || 'Test', 
                lastname: lastname || 'User', 
                workingArea: WorkingArea.NO_WORKING_AREA,
                primaryRole: Role.NO_ROLE,
                secondaryRole: Role.NO_ROLE
            };
            localStorage.setItem(SESSION_KEY, mockUser.id);
            localStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(mockUser));
            return mockUser;
        }
        // -----------------------
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

    /**
     * Retrieves the profile of the currently authenticated user based on session ID.
     * 
     * @returns Promise resolving to UserProfile or null if no session exists.
     */
    async getProfile(): Promise<UserProfile | null> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) return null;

        // --- TESTUSER BYPASS ---
        if (userId === 'test-user-id') {
            const stored = localStorage.getItem(MOCK_PROFILE_KEY);
            if (stored) return JSON.parse(stored) as UserProfile;
            
            return { 
                id: 'test-user-id', 
                username: 'testuser', 
                firstname: 'Test', 
                lastname: 'User', 
                workingArea: WorkingArea.NO_WORKING_AREA,
                primaryRole: Role.NO_ROLE,
                secondaryRole: Role.NO_ROLE 
            };
        }
        // -----------------------

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

    /**
     * Updates specific fields of the user's profile.
     * 
     * @param profile - Partial profile object containing fields to update.
     * @returns Promise resolving to the updated UserProfile.
     * @throws Error if the user is not authenticated or the update fails.
     */
    async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) throw new Error('Not authenticated');

        // --- TESTUSER BYPASS ---
        if (userId === 'test-user-id') {
            const stored = localStorage.getItem(MOCK_PROFILE_KEY);
            const current = stored ? JSON.parse(stored) as UserProfile : {
                id: 'test-user-id',
                username: 'testuser',
                firstname: 'Test',
                lastname: 'User',
                workingArea: WorkingArea.NO_WORKING_AREA,
                primaryRole: Role.NO_ROLE,
                secondaryRole: Role.NO_ROLE
            };

            const updated = { ...current, ...profile };
            localStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(updated));
            return updated;
        }
        // -----------------------

        const response = await fetch(`/api/v1/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });

        if (!response.ok) throw new Error('Failed to update profile');
        return await response.json() as UserProfile;
    },

    /**
     * Resets the user's roles to their default 'NO_ROLE' state.
     * 
     * @returns Promise that resolves when the reset is complete.
     */
    async resetProfile(): Promise<void> {
        const userId = localStorage.getItem(SESSION_KEY);
        if (!userId) return;

        await this.updateProfile({
            primaryRole: Role.NO_ROLE,
            secondaryRole: Role.NO_ROLE
        });
    },

    /**
     * Clears the user session and logs them out of the application.
     * 
     * @returns Promise resolving when logout is complete.
     */
    logout(): Promise<void> {
        localStorage.removeItem(SESSION_KEY);
        return Promise.resolve();
    }
};
