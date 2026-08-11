import { useEffect, useMemo, useState } from "react";
import { Plug, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { ApiError } from "../../../services/apiClient";
import {
  projectService,
  type AdminProjectDetails,
  type ProjectSource,
} from "../../../services/projectService";
import { ProjectInsightsPanel } from "./ProjectInsightsPanel";
import { EMPTY_INSIGHTS, useProjectInsights } from "../useProjectInsights";

type ProjectInsightsCardProps = {
  /** The project to describe. Everything else is fetched from it. */
  projectId: string;
  /** Rendered above the rows; omit for a card that sits under its own heading. */
  title?: string;
  className?: string;
};

/** Sources connected to a project, coloured by how healthy they are. */
function sourceVariant(status: ProjectSource["status"]) {
  switch (status) {
    case "CONNECTED":
      return "success" as const;

    case "FAILED":
    case "ERROR":
      return "danger" as const;

    case "DISABLED":
    case "DISCONNECTED":
      return "neutral" as const;

    default:
      return "warning" as const;
  }
}

/** What the last finished request produced, and which project it was about. */
type LoadedProject = {
  projectId: string;
  project: AdminProjectDetails | null;
  error: string | null;
};

/**
 * Everything true about one project, in a single column: how many people are on
 * it, which project roles are in use, what is connected to it, and the figures
 * that would otherwise mean visiting Data Ingestion, Onboarding and the
 * Knowledge Base one after another.
 *
 * Self-contained on purpose. It was extracted from the Project Management tab
 * when that tab was dropped, and the point of the extraction is that it can be
 * hung anywhere a project id is in scope without the host having to know which
 * five endpoints it takes to fill in. The host passes an id; the card owns the
 * loading, the failures and the layout.
 *
 * Partial failure is normal here rather than exceptional: the four insight
 * figures come from three other modules and each is allowed to go missing on
 * its own. A block whose request failed is left out entirely instead of
 * rendering a zero, because "nothing to do" and "could not ask" must not look
 * alike. Only the project itself failing to load is worth an error state — the
 * card would otherwise have nothing to be about.
 */
export function ProjectInsightsCard({
  projectId,
  title,
  className = "",
}: ProjectInsightsCardProps) {
  // One state for the outcome rather than a `project`/`loading`/`error` trio.
  // Carrying the id it belongs to is what makes "loading" derivable: a result
  // for a different project than the one asked for is by definition stale, so
  // switching projects shows the loading state without an effect having to
  // reset a flag first.
  const [loaded, setLoaded] = useState<LoadedProject | null>(null);

  // Keyed by project id, so a single project is just a record of one. Sharing
  // the hook with any future multi-project host keeps one definition of what
  // these figures mean.
  const insights = useProjectInsights(projectId);

  useEffect(() => {
    let active = true;

    projectService
      .getAccessibleProject(projectId)
      .then((details) => {
        if (active) setLoaded({ projectId, project: details, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;

        setLoaded({
          projectId,
          project: null,
          error: error instanceof ApiError ? error.message : "This project could not be loaded.",
        });
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const loading = loaded?.projectId !== projectId;
  const project = loading ? null : loaded.project;
  const loadError = loading ? null : loaded.error;

  const rolesInUse = useMemo(
    () => [...new Set((project?.users ?? []).flatMap((user) => user.projectRoles))].sort(),
    [project],
  );

  if (loading) {
    return (
      <section className={`rounded-2xl border border-app-border bg-app-surface p-4 ${className}`}>
        <p className="text-sm text-app-text-muted">Loading project...</p>
      </section>
    );
  }

  if (loadError || !project) {
    return (
      <section
        className={`rounded-2xl border border-app-danger-border bg-app-surface p-4 ${className}`}
      >
        <p className="text-sm text-app-danger-text">
          {loadError ?? "This project could not be loaded."}
        </p>
      </section>
    );
  }

  const memberCount = project.users.length;

  return (
    <section
      aria-label={`${project.name} details`}
      className={`rounded-2xl border border-app-border bg-app-surface p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-app-border pb-2.5">
        <h3 className="text-base font-semibold text-app-text">{title ?? project.name}</h3>

        <span className="flex items-center gap-1.5 text-xs text-app-text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      <dl className="flex min-w-0 flex-col gap-2.5">
        {project.description && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="shrink-0 text-xs font-medium tracking-wide text-app-text-muted uppercase">
              About
            </dt>
            <dd className="min-w-0 text-sm text-app-text-muted">{project.description}</dd>
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <dt className="shrink-0 text-xs font-medium tracking-wide text-app-text-muted uppercase">
            Roles
          </dt>
          <dd className="flex min-w-0 flex-wrap gap-1.5">
            {rolesInUse.length === 0 ? (
              <span className="text-sm text-app-text-muted">None assigned yet</span>
            ) : (
              rolesInUse.map((role) => (
                <Badge key={role} variant="neutral">
                  {role}
                </Badge>
              ))
            )}
          </dd>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <dt className="shrink-0 text-xs font-medium tracking-wide text-app-text-muted uppercase">
            Sources
          </dt>
          <dd className="flex min-w-0 flex-wrap gap-1.5">
            {project.sources.length === 0 ? (
              <span className="text-sm text-app-text-muted">Nothing connected</span>
            ) : (
              project.sources.map((source) => (
                <Badge key={source.id} variant={sourceVariant(source.status)}>
                  <Plug className="mr-1.5 h-3 w-3" aria-hidden="true" />
                  {source.name}
                </Badge>
              ))
            )}
          </dd>
        </div>

        <ProjectInsightsPanel insights={insights[projectId] ?? EMPTY_INSIGHTS} />
      </dl>
    </section>
  );
}
