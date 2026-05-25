export interface UserProfile {
    username: string;
    email?: string;
    primaryRole: string | null;
    level: string | null;
}

const USERS_KEY = 'sprintstart_users_db';
const SESSION_KEY = 'sprintstart_session';

// Helpers for mock database
const getDb = (): Record<string, UserProfile> => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? (JSON.parse(data) as Record<string, UserProfile>) : {};
};

const saveDb = (db: Record<string, UserProfile>) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(db));
};

export const apiService = {
    async login(username: string, email: string): Promise<UserProfile> {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const db = getDb();
        
        // If user doesn't exist, create a new one (will have no role, triggering wizard)
        if (!db[username]) {
            db[username] = { username, email, primaryRole: null, level: null };
            saveDb(db);
        }
        
        // Set active session
        localStorage.setItem(SESSION_KEY, username);
        return db[username];
    },

    async getProfile(): Promise<UserProfile | null> {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const activeUser = localStorage.getItem(SESSION_KEY);
        if (!activeUser) return null;
        
        const db = getDb();
        return db[activeUser] || null;
    },

    async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const activeUser = localStorage.getItem(SESSION_KEY);
        if (!activeUser) throw new Error("Not authenticated");
        
        const db = getDb();
        const current = db[activeUser];
        const updated = { ...current, ...profile };
        
        db[activeUser] = updated;
        saveDb(db);
        
        return updated;
    },

    async resetProfile(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const activeUser = localStorage.getItem(SESSION_KEY);
        if (!activeUser) return;
        
        const db = getDb();
        if (db[activeUser]) {
            db[activeUser].primaryRole = null;
            db[activeUser].level = null;
            saveDb(db);
        }
    },

    async logout(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 300));
        localStorage.removeItem(SESSION_KEY);
    }
};
