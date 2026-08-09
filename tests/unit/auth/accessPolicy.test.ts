import { describe, it, expect } from 'vitest';
import {
    canAccessRoute,
    getDefaultRoute,
    getMatchingProtectedRoute,
    isOnboardingAccessible,
} from '../../../src/auth/accessPolicy';
import { PermissionGroup } from '../../../src/services/types';
import type { UserProfile } from '../../../src/services/types';

const createMockProfile = (permissionGroup: PermissionGroup): UserProfile => ({
    id: '123',
    authId: 'auth-123',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    projectRoles: [],
    projectIds: [],
    permissionGroup,
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
});

describe('accessPolicy', () => {
    describe('canAccessRoute', () => {
        it('blocks USER from /admin but allows /knowledge-base', () => {
            const userProfile = createMockProfile(PermissionGroup.USER);
            expect(canAccessRoute(userProfile, '/admin')).toBe(false);
            expect(canAccessRoute(userProfile, '/knowledge-base')).toBe(true);
        });

        it('permits ADMIN to access protected routes like /data-ingestion and /team-management', () => {
            const adminProfile = createMockProfile(PermissionGroup.ADMIN);
            expect(canAccessRoute(adminProfile, '/data-ingestion')).toBe(true);
            expect(canAccessRoute(adminProfile, '/team-management')).toBe(true);
            expect(canAccessRoute(adminProfile, '/admin')).toBe(true);
        });

        it('returns false when profile is null', () => {
            expect(canAccessRoute(null, '/chat')).toBe(false);
        });

        it('blocks a PM who only has member access to the selected project from the manager-scoped routes', () => {
            const pmProfile = createMockProfile(PermissionGroup.PM);

            expect(canAccessRoute(pmProfile, '/pm-dashboard', false)).toBe(false);
            expect(canAccessRoute(pmProfile, '/data-ingestion', false)).toBe(false);
            // Defaults to the strict side when no project context is supplied.
            expect(canAccessRoute(pmProfile, '/pm-dashboard')).toBe(false);
        });

        it('allows a PM into the manager-scoped routes when they manage the selected project', () => {
            const pmProfile = createMockProfile(PermissionGroup.PM);

            expect(canAccessRoute(pmProfile, '/pm-dashboard', true)).toBe(true);
            expect(canAccessRoute(pmProfile, '/data-ingestion', true)).toBe(true);
        });

        it('gates a PM out of the team and insights routes of a project they only belong to', () => {
            const pmProfile = createMockProfile(PermissionGroup.PM);

            // These show the selected project's members, questions and documentation gaps.
            // The backend enforces the same rule, so leaving them reachable would only
            // produce 403s.
            expect(canAccessRoute(pmProfile, '/team-management', false)).toBe(false);
            expect(canAccessRoute(pmProfile, '/insights/faq', false)).toBe(false);
            expect(canAccessRoute(pmProfile, '/insights/knowledge-gaps', false)).toBe(false);

            expect(canAccessRoute(pmProfile, '/team-management', true)).toBe(true);
            expect(canAccessRoute(pmProfile, '/insights/faq', true)).toBe(true);
            expect(canAccessRoute(pmProfile, '/insights/knowledge-gaps', true)).toBe(true);
        });

        it('leaves routes outside the manager-scoped set ungated for a PM', () => {
            const pmProfile = createMockProfile(PermissionGroup.PM);

            expect(canAccessRoute(pmProfile, '/chat', false)).toBe(true);
        });

        it('keeps HR and ADMIN access to manager-scoped routes independent of project management', () => {
            const hrProfile = createMockProfile(PermissionGroup.HR);
            const adminProfile = createMockProfile(PermissionGroup.ADMIN);

            expect(canAccessRoute(hrProfile, '/pm-dashboard', false)).toBe(true);
            expect(canAccessRoute(hrProfile, '/data-ingestion', false)).toBe(true);
            expect(canAccessRoute(adminProfile, '/pm-dashboard', false)).toBe(true);
            expect(canAccessRoute(adminProfile, '/data-ingestion', false)).toBe(true);
        });
    });

    describe('isOnboardingAccessible', () => {
        it('is false when the user has completed onboarding', () => {
            const profile = createMockProfile(PermissionGroup.USER);
            expect(profile.hasCompletedOnboarding).toBe(true);
            expect(isOnboardingAccessible(profile)).toBe(false);
        });

        it('is true when the user has not completed onboarding', () => {
            const profile = { ...createMockProfile(PermissionGroup.USER), hasCompletedOnboarding: false };
            expect(isOnboardingAccessible(profile)).toBe(true);
        });

        it('is false when profile is null', () => {
            expect(isOnboardingAccessible(null)).toBe(false);
        });
    });

    describe('getDefaultRoute', () => {
        it('returns / when unauthenticated', () => {
            expect(getDefaultRoute(null)).toBe('/');
        });

        it('returns / for authenticated USER', () => {
            const userProfile = createMockProfile(PermissionGroup.USER);
            expect(getDefaultRoute(userProfile)).toBe('/');
        });

        it('returns / for ADMIN (since / is accessible to all)', () => {
            const adminProfile = createMockProfile(PermissionGroup.ADMIN);
            expect(getDefaultRoute(adminProfile)).toBe('/');
        });
    });

    describe('getMatchingProtectedRoute', () => {
        it('matches exact routes', () => {
            expect(getMatchingProtectedRoute('/chat')).toBe('/chat');
        });

        it('maps wildcard route patterns to the base route', () => {
            expect(getMatchingProtectedRoute('/insights/faq/123')).toBe('/insights/faq');
            expect(getMatchingProtectedRoute('/onboarding/step-2')).toBe('/onboarding');
        });

        it('returns null for unknown routes', () => {
            expect(getMatchingProtectedRoute('/unknown-route')).toBeNull();
        });

        it('matches /settings and /profile paths', () => {
            expect(getMatchingProtectedRoute('/settings')).toBe('/settings');
            expect(getMatchingProtectedRoute('/profile')).toBe('/profile');
        });
    });

    describe('/settings and /profile permissions', () => {
        const ALL_GROUPS: PermissionGroup[] = [
            PermissionGroup.USER,
            PermissionGroup.PM,
            PermissionGroup.HR,
            PermissionGroup.ADMIN,
        ];

        it('allows every group to access /settings and /profile', () => {
            for (const group of ALL_GROUPS) {
                const profile = createMockProfile(group);
                expect(canAccessRoute(profile, '/settings')).toBe(true);
                expect(canAccessRoute(profile, '/profile')).toBe(true);
            }
        });
    });
});
