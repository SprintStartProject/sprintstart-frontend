import { AlertDialog } from "../../../components/ui/AlertDialog";
import { getDisplayName } from "../data";
import { CreateProjectWizard } from "../components/CreateProjectWizard";
import { ProjectDetailsDrawer } from "../components/ProjectDetailsDrawer";
import { SkillDetailsDrawer } from "../components/SkillDetailsDrawer";
import { UserDetailsDrawer } from "../components/UserDetailsDrawer";
import type { AdminInteractions } from "./useAdminInteractions";
import type { AdminSources } from "./useAdminSources";

type OverlayProps = { sources: AdminSources; interactions: AdminInteractions };

function UserDrawer({ sources, interactions }: OverlayProps) {
  const { data } = sources;
  const { drawers, sync } = interactions;

  if (!data.selectedUser) return null;

  return (
    <UserDetailsDrawer
      user={data.selectedUser}
      projects={data.projects}
      users={data.users}
      isOpen={drawers.isOpen}
      onClose={drawers.close}
      onOpenProjectDetails={drawers.openProjectFromUser}
      back={drawers.origin?.kind === "project" ? drawers.backLink : undefined}
      onUserUpdated={sync.handleUserUpdated}
      onRequestDelete={interactions.requestUserDelete}
      onMembershipsMoved={() => void data.refreshAdminData()}
    />
  );
}

function ProjectDrawer({ sources, interactions }: OverlayProps) {
  const { data, profile } = sources;
  const { drawers, sync } = interactions;

  if (!data.selectedProject) return null;

  // Keyed by project so every switch remounts the drawer with fresh state instead of carrying the
  // previous project's async results over.
  return (
    <ProjectDetailsDrawer
      key={data.selectedProject.id}
      project={data.selectedProject}
      availableUsers={data.users}
      isOpen={drawers.isOpen}
      canManageLifecycle={profile?.permissionGroup === "ADMIN"}
      onClose={drawers.close}
      onOpenSourceDetails={interactions.openSourceDetails}
      onOpenDataIngestion={interactions.openDataIngestion}
      onOpenUser={drawers.openUserFromProject}
      back={drawers.origin?.kind === "user" ? drawers.backLink : undefined}
      onProjectUpdated={sync.handleProjectUpdated}
      onProjectDeleted={sync.handleProjectDeleted}
      onMembershipsMoved={() => void data.refreshAdminData()}
    />
  );
}

function SkillDrawer({ sources, interactions }: OverlayProps) {
  const { pool } = sources;
  const { drawers } = interactions;

  if (!drawers.selectedSkill && !drawers.isCreatingSkill) return null;

  // Keyed the same way as the project drawer, so switching between two skills (or into create
  // mode) always starts from a fresh draft.
  return (
    <SkillDetailsDrawer
      key={drawers.selectedSkill?.id ?? "create-skill"}
      skill={drawers.selectedSkill}
      skills={pool.skills}
      roles={pool.roles}
      isOpen={drawers.isOpen}
      onClose={drawers.close}
      onSkillSaved={interactions.saveSkill}
    />
  );
}

/** The backdrop and the user, project and skill drawers over the page. */
export function AdminDrawerLayer({ sources, interactions }: OverlayProps) {
  const { selectedUser, selectedProject } = sources.data;
  const { drawers } = interactions;
  const anyOpen =
    selectedUser || selectedProject || drawers.selectedSkill || drawers.isCreatingSkill;

  return (
    <>
      {anyOpen && (
        <button
          type="button"
          aria-label="Close details overlay"
          onClick={drawers.close}
          className={`fixed inset-0 z-30 bg-app-overlay transition-opacity duration-300 ${
            drawers.isOpen ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <UserDrawer sources={sources} interactions={interactions} />
      <ProjectDrawer sources={sources} interactions={interactions} />
      <SkillDrawer sources={sources} interactions={interactions} />
    </>
  );
}

/** The confirmations for deleting one user or every ticked one. */
export function UserDeleteDialogs({ interactions }: { interactions: AdminInteractions }) {
  const { single, bulk, ticks } = interactions.removal;
  const count = ticks.selectedIds.size;

  return (
    <>
      <AlertDialog
        isOpen={Boolean(single.pending)}
        title="Delete user?"
        description={
          single.pending ? (
            <>
              Are you sure you want to delete <strong>{getDisplayName(single.pending)}</strong>?
              This action cannot be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete user"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={single.isDeleting}
        loadingLabel="Deleting..."
        errorMessage={single.error}
        onClose={single.cancel}
        onConfirm={() => void single.confirm()}
      />

      <AlertDialog
        isOpen={bulk.isOpen}
        title="Delete selected users?"
        description={
          <>
            Are you sure you want to delete <strong>{count}</strong>{" "}
            {count === 1 ? "selected user" : "selected users"}? This action cannot be undone.
          </>
        }
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={bulk.isDeleting}
        loadingLabel="Deleting..."
        errorMessage={bulk.error}
        onClose={bulk.cancel}
        onConfirm={() => void bulk.confirm()}
      />
    </>
  );
}

export function CreateWizard({ sources, interactions }: OverlayProps) {
  const { data } = sources;

  return (
    <CreateProjectWizard
      isOpen={interactions.wizard.isOpen}
      tokenNames={data.tokenNames}
      users={data.users}
      existingProjectNames={data.projects.map((project) => project.name)}
      onClose={interactions.wizard.close}
      onProjectCreated={interactions.sync.handleProjectCreated}
      onMembershipsMoved={() => void data.refreshAdminData()}
    />
  );
}
