import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { getDisplayName, pluralize, type UserProject } from "../data";
import { useProjectAssignmentActions } from "../hooks/useProjectAssignmentActions";
import type { AdminUser, ProjectOverview } from "../types";
import { AssignedProjectCard } from "./AssignedProjectCard";
import { ProjectPicker } from "./ProjectPicker";

export type ProjectAssignmentViewProps = {
  user: AdminUser;
  assignedProjects: UserProject[];
  /** Every project, for the picker. */
  allProjects: ProjectOverview[];
  usersById: Map<string, AdminUser>;
  onOpenProjectDetails: (projectId: string) => void;
  onAssignProject: (projectId: string) => Promise<void>;
  /** Asked before a project is assigned; resolving `false` aborts silently. */
  confirmAssign?: (projectId: string) => Promise<boolean>;
  onRemoveProject: (projectId: string) => Promise<void>;
};

/**
 * Project assignment for a regular user, who belongs to exactly one project.
 *
 * Assigning another project is a move (the backend drops the old membership), so
 * the picker says what it replaces and the drawer confirms before it happens.
 * Removing the project is confirmed too: it resets the person's project roles
 * and onboarding progress. A user in several projects is a state the rules do
 * not allow — typically left behind by a role downgrade — and is shown as an
 * inconsistency to clean up rather than as a normal list.
 */
export function SingleProjectAssignment({
  user,
  assignedProjects,
  allProjects,
  usersById,
  onOpenProjectDetails,
  onAssignProject,
  confirmAssign,
  onRemoveProject,
}: ProjectAssignmentViewProps) {
  const { pendingProjectId, isBusy, assign, remove } = useProjectAssignmentActions({
    onAssignProject,
    onRemoveProject,
    confirmAssign,
  });
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<UserProject | null>(null);

  const name = getDisplayName(user);
  const assignedIds = useMemo(
    () => new Set(assignedProjects.map((project) => project.id)),
    [assignedProjects],
  );
  const hasMultiple = assignedProjects.length > 1;
  const isLastProject = assignedProjects.length === 1;

  const confirmRemoval = async () => {
    if (!projectPendingRemoval) return;

    if (await remove(projectPendingRemoval.id)) setProjectPendingRemoval(null);
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            Project
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Users belong to exactly one project. Assigning another project moves them. Changes are
            saved immediately.
          </p>
        </div>

        {assignedProjects.length > 0 && (
          <ProjectPicker
            projects={allProjects}
            excludedIds={assignedIds}
            label="Move to another project"
            icon={<ArrowRightLeft className="h-4 w-4" />}
            title="Move to project"
            hint={`Replaces ${assignedProjects.map((project) => project.name).join(", ")}`}
            pendingProjectId={pendingProjectId}
            onSelect={assign}
          />
        )}
      </div>

      {hasMultiple && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-app-warning-border bg-app-warning-bg p-4 text-sm text-app-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Users may only be in one project. {name} is in{" "}
            {pluralize(assignedProjects.length, "project")}. Remove the extra ones.
          </p>
        </div>
      )}

      {assignedProjects.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
          title="Not assigned to a project"
          size="sm"
          action={
            <ProjectPicker
              projects={allProjects}
              excludedIds={assignedIds}
              label="Assign project"
              icon={<Plus className="h-4 w-4" />}
              triggerVariant="primary"
              title="Assign to project"
              pendingProjectId={pendingProjectId}
              onSelect={assign}
            />
          }
        >
          {name} has no project yet, so project knowledge and onboarding are not available to them.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {assignedProjects.map((project) => (
            <AssignedProjectCard
              key={project.id}
              project={project}
              variant="detailed"
              userId={user.id}
              usersById={usersById}
              onOpen={onOpenProjectDetails}
              action={
                <Button
                  variant="dangerGhost"
                  size="sm"
                  iconOnly
                  onClick={() => setProjectPendingRemoval(project)}
                  disabled={isBusy}
                  aria-label={`Remove ${project.name}`}
                  title={isLastProject ? "Unassign from project" : "Remove from project"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        </div>
      )}

      <AlertDialog
        isOpen={projectPendingRemoval !== null}
        variant="danger"
        title={
          isLastProject
            ? `Unassign ${name}?`
            : `Remove ${name} from ${projectPendingRemoval?.name ?? "project"}?`
        }
        description={
          isLastProject
            ? `${name} will no longer be in any project. Project roles and onboarding progress will be reset.`
            : `${name} will be removed from ${projectPendingRemoval?.name ?? "this project"}. Project roles and onboarding progress will be reset.`
        }
        confirmLabel={isLastProject ? "Unassign" : "Remove"}
        isLoading={isBusy}
        loadingLabel="Removing..."
        onClose={() => setProjectPendingRemoval(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </div>
  );
}
