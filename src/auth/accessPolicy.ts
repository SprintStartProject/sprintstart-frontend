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
    | '/insights/knowledge-gaps'
    | '/settings'
    | '/profile';

const ALL_GROUPS: readonly PermissionGroup[] = [
    PermissionGroup.USER,
    PermissionGroup.PM,
    PermissionGroup.HR,
    PermissionGroup.ADMIN,
];

const routePermissions: Record<AppRoute, readonly PermissionGroup[]> = {
    '/': ALL_GROUPS,
    '/chat': ALL_GROUPS,
    '/knowledge-base': ALL_GROUPS,
    '/onboarding': ALL_GROUPS,
    '/data-ingestion': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/admin': [PermissionGroup.HR, PermissionGroup.ADMIN],
    '/pm-dashboard': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/team-management': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/insights/faq': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/insights/knowledge-gaps': [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
    '/settings': ALL_GROUPS,
    '/profile': ALL_GROUPS,
};

/**
 * Routes that a PM may only reach for a project they manage. All of them are scoped to
 * the globally selected project, so holding the PM role while being a mere member of
 * that project is not enough. Admins and HR are gated by role alone and are unaffected
 * by this list.
 *
 * The insights and team routes belong here for the same reason as the dashboard: they
 * show the selected project's questions, documentation gaps and members. A PM who is
 * only a member of that project has no business managing it, and the backend now
 * enforces exactly this through `@projectAuth.canAccessProject` — leaving the entries
 * in the sidebar would only produce 403s.
 */
const MANAGER_ASSIGNMENT_ROUTES: readonly AppRoute[] = [
    '/pm-dashboard',
    '/data-ingestion',
    '/team-management',
    '/insights/faq',
    '/insights/knowledge-gaps',
];

const routePrefixes: Partial<Record<AppRoute, readonly string[]>> = {
    '/chat': ['/chat/'],
    '/onboarding': ['/onboarding/'],
    '/team-management': ['/team/'],
    '/insights/faq': ['/insights/faq/'],
    '/insights/knowledge-gaps': ['/insights/knowledge-gaps/'],
};

/**
 * Decides whether a profile may access a route.
 *
 * `managesSelectedProject` is only consulted for the PM role on the
 * manager-scoped routes: a PM who is a mere member of the selected project
 * cannot reach the PM dashboard or data ingestion. It defaults to `false` so
 * callers without project context stay on the strict side, and it never widens
 * access for other roles.
 */
export function canAccessRoute(
    profile: UserProfile | null,
    route: AppRoute,
    managesSelectedProject = false,
): boolean {
    if (!profile) {
        return false;
    }

    if (!routePermissions[route].includes(profile.permissionGroup)) {
        return false;
    }

    if (
        profile.permissionGroup === PermissionGroup.PM &&
        MANAGER_ASSIGNMENT_ROUTES.includes(route)
    ) {
        return managesSelectedProject;
    }

    return true;
}

/**
 * Whether the onboarding experience is still available to this user.
 *
 * Onboarding is a one-time journey: once the user has completed it (i.e. passed the
 * final knowledge check and been promoted to an existing member), the `/onboarding`
 * routes and the sidebar entry are hidden. Independent of the permission group.
 */
export function isOnboardingAccessible(profile: UserProfile | null): boolean {
    return !!profile && !profile.hasCompletedOnboarding;
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
