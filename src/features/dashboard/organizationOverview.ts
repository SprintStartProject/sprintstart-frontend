// ============================================================
// features/dashboard/organizationOverview.ts
// ============================================================
// Org-wide figures for the admin widgets, derived from the
// project listing the switcher already holds.
// ============================================================

import type { SelectableProject } from "../projects/ProjectContext";

export type OrganizationOverview = {
  projectCount: number;
  /** Projects the signed-in admin is the assigned manager of, not merely able to reach. */
  managedByYouCount: number;
  /** Distinct people across every project — somebody in three projects counts once. */
  peopleCount: number;
  /** Projects with nobody responsible for them. */
  unmanagedCount: number;
};

/**
 * Rolls the admin project listing up into the figures the projects widget shows.
 *
 * Pure, and deliberately fed from `ProjectContext` rather than fetching: the provider
 * already loads every project with its manager and members for an admin, so the summary
 * costs no request and follows the same reload.
 *
 * Only meaningful for a listing that carries those relations — see `ProjectOverviewWidget`
 * for why that means ADMIN and not HR. A listing without them summarises to "every project
 * unmanaged" rather than throwing, which is why the catalog's availability check, not this
 * function, is what keeps the wrong numbers off the dashboard.
 */
export function summarizeProjects(projects: readonly SelectableProject[]): OrganizationOverview {
  const peopleIds = new Set<string>();

  let managedByYouCount = 0;
  let unmanagedCount = 0;

  for (const project of projects) {
    for (const user of project.users) {
      peopleIds.add(user.id);
    }

    if (project.isManaged) managedByYouCount += 1;
    if (!project.manager) unmanagedCount += 1;
  }

  return {
    projectCount: projects.length,
    managedByYouCount,
    peopleCount: peopleIds.size,
    unmanagedCount,
  };
}
