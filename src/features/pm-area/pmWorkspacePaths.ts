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

export function isPmWorkspacePath(pathname: string): boolean {
  return PM_WORKSPACE_PATHS.some((pattern) => matchPath(pattern, pathname) !== null);
}
