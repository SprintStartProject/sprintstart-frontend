import type { AppRoute } from "../../auth/accessPolicy";

/**
 * The routes the buddy's app guide describes — a mirror of the page list in the backend's
 * `onboarding/service/AppGuide.kt`, which is what the `get_app_guide` tool reads from.
 *
 * The guide lives in the backend because it is filtered by the caller's role there, but it is a
 * description of *this* app, and it goes stale the moment a page changes here. This list is how a
 * change here notices: `appGuideRoutes.test.ts` fails when `accessPolicy.ts` has a route that is
 * neither in this list nor in {@link APP_GUIDE_EXCLUDED_ROUTES}. Making it pass means deciding —
 * describe the page in `AppGuide.kt` (and list it here), or exclude it here with a reason.
 *
 * Not checked automatically across the repos: adding a route here does not prove the backend
 * describes it. The two lists are kept in the same order as `AppGuide.kt` to make that review a
 * glance. Member profiles (`/team/:userId`) are described there too, under Team.
 */
export const APP_GUIDE_ROUTES: readonly AppRoute[] = [
  "/",
  "/board",
  "/buddy",
  "/knowledge-base",
  "/onboarding",
  "/settings",
  "/pm-dashboard",
  "/team-management",
  "/insights/onboarding",
  "/insights/faq",
  "/insights/knowledge-gaps",
  "/insights/knowledge-requests",
  "/data-ingestion",
  "/blueprints",
  "/hire-setup",
  "/admin",
];

/** Routes the guide leaves out on purpose, and why — each one a decision, not an oversight. */
export const APP_GUIDE_EXCLUDED_ROUTES: Partial<Record<AppRoute, string>> = {
  "/arrival-steps": "Redirects to /hire-setup?tab=arrival.",
  "/starter-work": "Redirects to /hire-setup?tab=starter.",
  "/profile": "Redirects to /settings.",
  "/chat": "The retired chat — both of its addresses redirect to /buddy.",
};
