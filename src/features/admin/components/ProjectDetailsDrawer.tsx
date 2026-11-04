import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import type { AdminProjectDetails, AdminUser, DrawerBackLink, ProjectOverview } from "../types";
import { DrawerBackButton } from "./DrawerBackButton";
import { DrawerBody } from "./projectDrawer/DrawerBody";
import { DrawerDialogs } from "./projectDrawer/DrawerDialogs";
import { DrawerBadges, UnsavedFooter } from "./projectDrawer/DrawerParts";
import { ProjectMonogram } from "./projectDrawer/projectsKit";
import { useProjectDrawer } from "./projectDrawer/useProjectDrawer";

type ProjectDetailsDrawerProps = {
  project: ProjectOverview;
  availableUsers?: AdminUser[];
  isOpen: boolean;
  /** Whether the viewer may assign managers and delete the project (admins). */
  canManageLifecycle?: boolean;
  onClose: () => void;
  onOpenSourceDetails?: (projectId: string, sourceId: string) => void;
  /** Opens the Data Ingestion page for this project; the shortcut is hidden without it. */
  onOpenDataIngestion?: (projectId: string) => void;
  /** Opens a member's user details; members are not clickable without it. */
  onOpenUser?: (userId: string) => void;
  /** Shown when the drawer was opened from another one, e.g. from a user's projects. */
  back?: DrawerBackLink;
  onProjectUpdated?: (updatedProject: AdminProjectDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
  /**
   * Called after a save that removed people from other projects. Those projects'
   * member lists are held elsewhere on the page and are stale by then, so the
   * parent is expected to reload them.
   */
  onMembershipsMoved?: () => void;
};

/**
 * Side drawer showing and editing one project.
 *
 * Everything is directly editable — there is no separate edit mode. Changes to
 * the project's details and to its people are staged into one draft and applied
 * together from the footer, so the drawer has a single save affordance.
 *
 * Expects to be remounted per project via a `key` on the call site, so all
 * async state below belongs to exactly one project and needs no id tagging.
 */
export function ProjectDetailsDrawer(props: ProjectDetailsDrawerProps) {
  const { project, isOpen, back } = props;
  const availableUsers = props.availableUsers ?? [];
  const { form, derived, actions, guard, updateField } = useProjectDrawer({
    project,
    availableUsers,
    isOpen,
    onClose: props.onClose,
    onProjectUpdated: props.onProjectUpdated,
    onProjectDeleted: props.onProjectDeleted,
    onMembershipsMoved: props.onMembershipsMoved,
  });

  return (
    <>
      <DetailsSideDrawer
        isOpen={isOpen}
        onClose={actions.closeDrawer}
        // The header carries the project's identity, so the body never repeats
        // the name as a heading or the counts as tiles.
        title={form.draftProject.name || derived.visibleProject.name}
        closeAriaLabel="Close project details"
        widthClassName="w-full sm:w-[min(94vw,34rem)] lg:w-[min(72vw,58rem)]"
        leading={
          <ProjectMonogram projectId={project.id} name={derived.visibleProject.name} size="lg" />
        }
        actions={
          back ? (
            <DrawerBackButton back={{ ...back, onBack: () => guard.leaveDrawer(back.onBack) }} />
          ) : undefined
        }
        badge={
          <DrawerBadges
            project={derived.visibleProject}
            memberCount={derived.memberCount}
            sourceCount={derived.sourceCount}
          />
        }
        footer={
          derived.hasPendingChanges ? (
            <UnsavedFooter derived={derived} actions={actions} />
          ) : undefined
        }
      >
        <DrawerBody
          project={project}
          availableUsers={availableUsers}
          canManageLifecycle={props.canManageLifecycle ?? false}
          form={form}
          derived={derived}
          actions={actions}
          isLoading={isOpen && !form.projectDetails && !form.detailsError}
          onUpdateField={updateField}
          leaveDrawer={guard.leaveDrawer}
          onOpenSourceDetails={props.onOpenSourceDetails}
          onOpenDataIngestion={props.onOpenDataIngestion}
          onOpenUser={props.onOpenUser}
        />
      </DetailsSideDrawer>

      <DrawerDialogs derived={derived} actions={actions} guard={guard} />
    </>
  );
}
