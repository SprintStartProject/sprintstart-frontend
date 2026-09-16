import { matchPath } from "react-router-dom";

/**
 * Every address the PM workspace answers.
 *
 * Its own module, apart from `PmWorkspace`, because the eagerly loaded shell needs it too (the
 * page transition keys the whole workspace as one page) and importing it from the workspace
 * would pull every PM section into the main bundle.
 */
export const PM_WORKSPACE_PATHS = [
  "/pm-dashboard",
  "/team-management",
  "/team/:userId",
  "/insights/knowledge-requests",
  "/insights/onboarding",
  "/insights/faq/:groupId?",
  "/insights/knowledge-gaps/:gapId?",
] as const;

/**
 * The search parameters the two sections with a tab bar of their own keep their tab in — read by
 * those sections and written by the workspace's swipe.
 */
export const TEAM_TAB_PARAM = "tab";
export const INBOX_VIEW_PARAM = "view";

export function isPmWorkspacePath(pathname: string): boolean {
  return PM_WORKSPACE_PATHS.some((pattern) => matchPath(pattern, pathname) !== null);
}
