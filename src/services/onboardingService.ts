import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint} from '../types/onboarding';
import { userService } from './userService';

export const onboardingService = {
    async fetchOnboardingPath(userId: string): Promise<OnboardingPathEndpoint> {
        const response = await fetch(`/api/v1/onboarding/${userId}/path`);
        if (!response.ok) {
            throw new Error('Failed to fetch onboarding path');
        }
        return await response.json() as OnboardingPathEndpoint;
    },

    async getUserId(): Promise<string> {
        const userId = localStorage.getItem('sprintstart_session_id');
        if (!userId) {
            const profile = await userService.getProfile();
            if (!profile) {
                throw new Error('User not authenticated');
            }
            return profile.id;
        }
        return userId;
    },

    async markStepAsCompleted(stepId: string): Promise<void> {
        const response = await fetch(`/api/v1/onboarding/steps/${stepId}/complete`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error('Failed to mark step as completed');
        }
    },

    async skipStep(stepId: string, reason: string): Promise<void> {     
        const response = await fetch(`/api/v1/onboarding/steps/${stepId}/skip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) {
            throw new Error('Failed to skip step');
        }
    }   
};