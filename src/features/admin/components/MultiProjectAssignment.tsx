import { useMemo, useState } from "react";
import { Info, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { getDisplayName, type UserProject } from "../data";
import { useProjectAssignmentActions } from "../hooks/useProjectAssignmentActions";
import { getManagedProjectIds } from "../projectMove";
import { AssignedProjectCard } from "./AssignedProjectCard";
import { ProjectPicker } from "./ProjectPicker";
import type { ProjectAssignmentViewProps } from "./SingleProjectAssignment";

type MultiProjectAssignmentProps = ProjectAssignmentViewProps & {
  /** Admins can open every project regardless of membership; the view says so. */
  isAdmin: boolean;
};

/**
 * Project assignment for a project manager or admin, who may be in several
 * projects.
 *
 * Projects they manage are listed apart from those they are only a member of,
 * and cannot be removed here: a manager leaves a project by being replaced as
 * manager first. A project the user manages is shown even if the user is not on
 * its member list, since the manager role is what counts.
 */
export function MultiProjectAssignment({
  user,
  assignedProjects,
  allProjects,
  usersById,
  isAdmin,
  onOpenProjectDetails,
  onAssignProject,
  confirmAssign,
  onRemoveProject,
}: MultiProjectAssignmentProps) {
  const { pendingProjectId, isBusy, assign, remove } = useProjectAssignmentActions({
    onAssignProject,
    onRemoveProject,
    confirmAssign,
  });
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<UserProject | null>(null);

  const name = getDisplayName(user);

  const { managedProjects, memberProjects } = useMemo(() => {
    const managedIds = getManagedProjectIds(allProjects, user.id);

    return {
      managedProjects: allProjects
        .filter((project) => managedIds.has(project.id))
        .map((project): UserProject => ({ id: project.id, name: project.name, overview: project })),
      memberProjects: assignedProjects.filter((project) => !managedIds.has(project.id)),
    };
  }, [allProjects, assignedProjects, user.id]);

  // A managed project that is not on the user's own list still counts as taken,
  // or the picker would offer it as something to add.
  const excludedIds = useMemo(
    () => new Set([...assignedProjects, ...managedProjects].map((project) => project.id)),
    [assignedProjects, managedProjects],
  );

  const totalCount = managedProjects.length + memberProjects.length;
  const isLastProject = totalCount === 1;

  const requestRemoval = (project: UserProject) => {
    if (isLastProject) {
      setProjectPendingRemoval(project);
      return;
    }

    void remove(project.id);
  };

  const confirmRemoval = async () => {
    if (!projectPendingRemoval) return;

    if (await remove(projectPendingRemoval.id)) setProjectPendingRemoval(null);
  };

  const renderCard = (project: UserProject, isManaged: boolean) => (
    <AssignedProjectCard
      key={project.id}
      project={project}
      userId={user.id}
      hideManager={isManaged}
      usersById={usersById}
      onOpen={onOpenProjectDetails}
      action={
        <Button
          variant="dangerGhost"
          size="sm"
          iconOnly
          onClick={() => requestRemoval(project)}
          disabled={isBusy || isManaged}
          aria-label={
            isManaged
              ? `Remove ${project.name} — remove as manager first`
              : `Remove ${project.name}`
          }
          title={isManaged ? "Remove as manager first" : undefined}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    />
  );

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            Projects
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Manages {managedProjects.length} · Member of {memberProjects.length}. Changes are saved
            immediately.
          </p>
        </div>

        <ProjectPicker
          projects={allProjects}
          excludedIds={excludedIds}
          label="Add project"
          icon={<Plus className="h-4 w-4" />}
          title="Add to project"
          pendingProjectId={pendingProjectId}
          onSelect={assign}
        />
      </div>

      {isAdmin && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Admins can access every project. Membership only controls where they are listed as a
            member.
          </p>
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyState size="sm" title="No projects assigned">
          Add a project to assign this user to a project.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {managedProjects.length > 0 && (
            <section aria-label="Projects managed">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-app-text-muted">
                <span className="uppercase">Manages</span>
                {/* Outside the uppercase label, or the badge would read "MANAGER". */}
                <Badge variant="brand" size="sm" className="py-1">
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  Manager
                </Badge>
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {managedProjects.map((project) => renderCard(project, true))}
              </div>
            </section>
          )}

          {memberProjects.length > 0 && (
            <section aria-label="Projects joined as member">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
                Member of
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {memberProjects.map((project) => renderCard(project, false))}
              </div>
            </section>
          )}
        </div>
      )}

      <AlertDialog
        isOpen={projectPendingRemoval !== null}
        variant="danger"
        title={`Unassign ${name}?`}
        description={`${name} will no longer be in any project. Project roles and onboarding progress will be reset.`}
        confirmLabel="Unassign"
        isLoading={isBusy}
        loadingLabel="Removing..."
        onClose={() => setProjectPendingRemoval(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </div>
  );
}
