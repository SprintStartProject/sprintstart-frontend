import { FolderKanban } from "lucide-react";
import { useProjectContext } from "../../projects/useProjectContext";
import { summarizeProjects } from "../organizationOverview";
import type { DashboardWidgetSize } from "../layout/types";
import { WidgetBar } from "./WidgetBar";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

const NAMED_UNMANAGED_COUNT = 3;

/**
 * Every project in the organization — the admin's half of the dashboard.
 *
 * Derived from the listing {@link useProjectContext} already holds for an admin, so the card
 * costs no request, reloads with the project switcher, and can never disagree with it.
 *
 * Only offered to an ADMIN, and the reason is the data rather than the job title: the
 * listing comes from `/api/v1/admin/projects`, which the backend restricts to ADMIN. HR's
 * copy degrades to the self-service one, without managers or members, and summing that would
 * report "every project unmanaged" with full confidence.
 *
 * At half a row the card names the unowned projects instead of only counting them, because
 * a count is something to worry about and a name is something to act on.
 */
export function ProjectOverviewWidget({ size }: { size: DashboardWidgetSize }) {
  const { projects, isLoading, errorMessage } = useProjectContext();

  const overview = summarizeProjects(projects);
  const unmanagedNames = projects
    .filter((project) => !project.manager)
    .map((project) => project.name);
  const namedUnmanaged = unmanagedNames.slice(0, NAMED_UNMANAGED_COUNT);
  const hiddenUnmanaged = unmanagedNames.length - namedUnmanaged.length;

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
      actionLabel="Open projects"
      to="/admin?tab=projects"
      isLoading={isLoading}
      errorMessage={errorMessage ? "Could not load the project overview." : null}
    >
      {size === "small" ? (
        <WidgetMetrics icon={FolderKanban} metrics={metrics} />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
          <WidgetMetrics icon={FolderKanban} metrics={metrics.slice(0, 2)} />

          <div className="flex flex-col justify-center gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Ownership
              </p>
              <WidgetBar
                segments={[
                  {
                    label: "yours",
                    value: overview.managedByYouCount,
                    className: "bg-app-brand",
                  },
                  {
                    label: "other managers",
                    value:
                      overview.projectCount - overview.managedByYouCount - overview.unmanagedCount,
                    className: "bg-app-success-solid",
                  },
                  {
                    label: "unowned",
                    value: overview.unmanagedCount,
                    className: "bg-app-warning-solid",
                  },
                ]}
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Without a manager
              </p>

              {namedUnmanaged.length === 0 ? (
                <p className="text-xs text-app-text-muted">Every project is assigned.</p>
              ) : (
                <ul className="space-y-1">
                  {namedUnmanaged.map((name) => (
                    <li key={name} className="truncate text-xs font-medium text-app-text">
                      {name}
                    </li>
                  ))}

                  {hiddenUnmanaged > 0 && (
                    <li className="text-xs text-app-text-muted">and {hiddenUnmanaged} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
