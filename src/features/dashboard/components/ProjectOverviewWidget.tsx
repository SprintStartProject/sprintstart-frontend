import { FolderKanban } from "lucide-react";
import { useProjectContext } from "../../projects/useProjectContext";
import { summarizeProjects } from "../organizationOverview";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

/**
 * Every project in the organization, as three figures — the admin's half of the dashboard.
 *
 * Derived from the listing {@link useProjectContext} already holds for an admin, so the card
 * costs no request, reloads with the project switcher, and can never disagree with it.
 *
 * Only offered to an ADMIN, and the reason is the data rather than the job title: the
 * listing comes from `/api/v1/admin/projects`, which the backend restricts to ADMIN. HR's
 * copy degrades to the self-service one, without managers or members, and summing that
 * would report "every project unmanaged" with full confidence.
 */
export function ProjectOverviewWidget() {
  const { projects, isLoading, errorMessage } = useProjectContext();

  const overview = summarizeProjects(projects);

  const metrics: WidgetMetric[] = [
    {
      label: "Projects",
      value: overview.projectCount,
      hint: `${overview.managedByYouCount} managed by you`,
    },
    {
      label: "People assigned",
      value: overview.peopleCount,
      hint: "in at least one project",
    },
    {
      label: "Without a manager",
      value: overview.unmanagedCount,
      needsAttention: overview.unmanagedCount > 0,
      hint: overview.unmanagedCount > 0 ? "nobody is responsible" : "every project is assigned",
    },
  ];

  return (
    <WidgetShell
      icon={FolderKanban}
      title="Projects"
      actionLabel="Open access management"
      to="/admin"
      isLoading={isLoading}
      errorMessage={errorMessage ? "Could not load the project overview." : null}
    >
      <WidgetMetrics icon={FolderKanban} metrics={metrics} />
    </WidgetShell>
  );
}
