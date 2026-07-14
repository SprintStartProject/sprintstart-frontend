import { PermissionGroup, type UserProfile } from '../services/types';

/**
 * Defines the Role-Based Access Control (RBAC) rules for the frontend application.
 * Manages which of the four permission groups (USER, PM, HR, ADMIN) can access specific routes.
 * Centralizing this ensures secure, predictable navigation flows based on user authority.
 */
export type AppRoute =
    | '/'
    | '/chat'
    | '/knowledge-base'
    | '/onboarding'
    | '/data-ingestion'
    | '/admin'
    | '/pm-dashboard'
    | '/team-management'
    | '/insights/faq'
    | '/insights/knowledge-gaps';

const routePermissions: Record<AppRoute, readonly PermissionGroup[]> = {
    '/': [PermissionGroup.USER, PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/chat': [PermissionGroup.USER, PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/knowledge-base': [
        PermissionGroup.USER,
        PermissionGroup.PM,
        PermissionGroup.HR,
        PermissionGroup.ADMIN,
    ],
    '/onboarding': [
        PermissionGroup.USER,
        PermissionGroup.PM,
        PermissionGroup.HR,
        PermissionGroup.ADMIN,
    ],
    '/data-ingestion': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/admin': [PermissionGroup.HR, PermissionGroup.ADMIN],
    '/pm-dashboard': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/team-management': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/insights/faq': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/insights/knowledge-gaps': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
};

const routePrefixes: Partial<Record<AppRoute, readonly string[]>> = {
    '/chat': ['/chat/'],
    '/onboarding': ['/onboarding/'],
    '/team-management': ['/team/'],
    '/insights/faq': ['/insights/faq/'],
    '/insights/knowledge-gaps': ['/insights/knowledge-gaps/'],
};

export function canAccessRoute(profile: UserProfile | null, route: AppRoute): boolean {
    if (!profile) {
        return false;
    }

    return routePermissions[route].includes(profile.permissionGroup);
}

export function getDefaultRoute(profile: UserProfile | null): AppRoute {
    if (!profile) {
        return '/';
    }

    if (canAccessRoute(profile, '/')) {
        return '/';
    }

    if (canAccessRoute(profile, '/admin')) {
        return '/admin';
    }

    if (canAccessRoute(profile, '/data-ingestion')) {
        return '/data-ingestion';
    }

    return '/';
}

export function getMatchingProtectedRoute(pathname: string): AppRoute | null {
    const routes = Object.keys(routePermissions) as AppRoute[];

    const exactMatch = routes.find((route) => route === pathname);

    if (exactMatch) {
        return exactMatch;
    }

    return (
        routes.find((route) =>
            routePrefixes[route]?.some((prefix) => pathname.startsWith(prefix)),
        ) ?? null
    );
}
