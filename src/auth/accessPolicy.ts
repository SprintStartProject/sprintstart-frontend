import { PermissionGroup, type UserProfile } from "../services/types";

/**
 * Defines the Role-Based Access Control (RBAC) rules for the frontend application.
 * Manages which of the four permission groups (USER, PM, HR, ADMIN) can access specific routes.
 * Centralizing this ensures secure, predictable navigation flows based on user authority.
 */
export type AppRoute =
  | "/"
  | "/chat"
  | "/knowledge-base"
  | "/onboarding"
  | "/buddy"
  | "/board"
  | "/blueprints"
  | "/data-ingestion"
  | "/hire-setup"
  | "/arrival-steps"
  | "/starter-work"
  | "/admin"
  | "/pm-dashboard"
  | "/team-management"
  | "/insights/faq"
  | "/insights/knowledge-gaps"
  | "/insights/knowledge-requests"
  | "/insights/onboarding"
  | "/settings"
  | "/profile";

const ALL_GROUPS: readonly PermissionGroup[] = [
  PermissionGroup.USER,
  PermissionGroup.PM,
  PermissionGroup.HR,
  PermissionGroup.ADMIN,
];

const routePermissions: Record<AppRoute, readonly PermissionGroup[]> = {
  "/": ALL_GROUPS,
  "/chat": ALL_GROUPS,
  "/knowledge-base": ALL_GROUPS,
  "/onboarding": ALL_GROUPS,
  "/buddy": ALL_GROUPS,
  // The hire's own board. Same audience as the buddy: it is the durable half of the same
  // surface, and everybody onboards onto a project at some point.
  "/board": ALL_GROUPS,
  "/blueprints": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/data-ingestion": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  // Arrival authoring and Starter Work review, as tabs of one page. HR reads both; PM/ADMIN act
  // on them (enforced server-side too -- this only decides who sees the page). Worth revisiting:
  // paperwork and accounts are arguably HR's to own.
  "/hire-setup": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  // Retired in favour of `/hire-setup`; kept only as a redirect target, so the permissions here
  // are unused but left matching it in case anything still resolves the route directly.
  "/arrival-steps": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/starter-work": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/admin": [PermissionGroup.HR, PermissionGroup.ADMIN],
  "/pm-dashboard": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/team-management": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/insights/faq": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/insights/knowledge-gaps": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  // HR reads the escalation queue; answering (minting durable knowledge) is PM/ADMIN, enforced
  // server-side too -- this only decides who sees the page.
  "/insights/knowledge-requests": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/insights/onboarding": [PermissionGroup.PM, PermissionGroup.HR, PermissionGroup.ADMIN],
  "/settings": ALL_GROUPS,
  "/profile": ALL_GROUPS,
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
  "/pm-dashboard",
  "/data-ingestion",
  "/blueprints",
  "/team-management",
  "/insights/faq",
  "/insights/knowledge-gaps",
  "/insights/knowledge-requests",
  "/insights/onboarding",
];

const routePrefixes: Partial<Record<AppRoute, readonly string[]>> = {
  "/chat": ["/chat/"],
  "/onboarding": ["/onboarding/"],
  "/blueprints": ["/blueprints/"],
  "/team-management": ["/team/"],
  "/insights/faq": ["/insights/faq/"],
  "/insights/knowledge-gaps": ["/insights/knowledge-gaps/"],
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

  if (profile.permissionGroup === PermissionGroup.PM && MANAGER_ASSIGNMENT_ROUTES.includes(route)) {
    return managesSelectedProject;
  }

  return true;
}

/**
 * Whether the onboarding experience is available to this user.
 *
 * Onboarding is a one-time journey. An incomplete user can open the page even
 * before a path exists and explicitly start personalization there; a completed
 * user no longer sees or directly accesses the onboarding UI.
 */
export function isOnboardingAccessible(profile: UserProfile | null): boolean {
  return Boolean(profile && !profile.hasCompletedOnboarding);
}

/**
 * The route a user is sent to when there is no better target: after login without a stored
 * deep link, and whenever a guard turns them away from the page they asked for.
 *
 * Picks the first of `/`, `/admin` and `/data-ingestion` the profile may open. With the
 * current permissions every group may open `/`, so in practice this is the dashboard.
 * Without a profile it returns `/`, which `AuthGuard` then sends on to `/login`.
 */
export function getDefaultRoute(profile: UserProfile | null): AppRoute {
  if (!profile) {
    return "/";
  }

  if (canAccessRoute(profile, "/")) {
    return "/";
  }

  if (canAccessRoute(profile, "/admin")) {
    return "/admin";
  }

  if (canAccessRoute(profile, "/data-ingestion")) {
    return "/data-ingestion";
  }

  return "/";
}

/**
 * Every route the policy knows, at runtime. `AppRoute` is a type and vanishes on build, so anything
 * that has to enumerate the routes — the buddy's app-guide coverage test, say — reads this.
 */
export const APP_ROUTES = Object.keys(routePermissions) as AppRoute[];

/**
 * Maps a real pathname to the `AppRoute` whose permissions apply to it.
 *
 * Tries an exact match first, then the prefixes in `routePrefixes`, which is how dynamic
 * sub-routes such as `/chat/:id`, `/onboarding/:stepId` or `/team/:userId` inherit the
 * permissions of their parent route. Returns `null` for paths outside the access policy,
 * e.g. an unknown URL.
 */
export function getMatchingProtectedRoute(pathname: string): AppRoute | null {
  const routes = APP_ROUTES;

  const exactMatch = routes.find((route) => route === pathname);

  if (exactMatch) {
    return exactMatch;
  }

  return (
    routes.find((route) => routePrefixes[route]?.some((prefix) => pathname.startsWith(prefix))) ??
    null
  );
}
