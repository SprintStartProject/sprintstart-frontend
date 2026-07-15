import { describe, it, expect } from 'vitest';
import { canAccessRoute, getDefaultRoute, getMatchingProtectedRoute } from '../../../src/auth/accessPolicy';
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
    });
});
