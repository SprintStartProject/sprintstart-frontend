import { useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, Edit, FileText, Trash2 } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { adminUserService } from "../../../services/adminUserService";
import { projectService } from "../../../services/projectService";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import {
  getAvailableProjects,
  getDisplayName,
  getDraftDisplayName,
  getPermissionGroupVariant,
  getUserEditFormState,
  PERMISSION_GROUP_OPTIONS,
  resolveUserProjects,
} from "../data";
import {
  canJoinMultipleProjects,
  getProjectsLeftOnMove,
  getRoleDowngradeConflicts,
} from "../projectMove";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type {
  AdminUser,
  DrawerBackLink,
  ProjectOverview,
  ProjectSummary,
  UpdateAdminUserRequest,
  UserEditFormState,
} from "../types";
import { AccessBadge } from "./Badges";
import { DetailRow } from "./DetailRow";
import { DrawerBackButton } from "./DrawerBackButton";
import { DrawerCard } from "../../../components/ui/DrawerCard";
import { EditableDetailRow } from "./EditableDetailRow";
import { EditableSelectDetailRow } from "./EditableSelectDetailRow";
import { MultiProjectAssignment } from "./MultiProjectAssignment";
import { SingleProjectAssignment } from "./SingleProjectAssignment";
import { UserStatusSection } from "./UserStatusSection";

type UserDetailsDrawerProps = {
  user: AdminUser;
  /**
   * Every project with its manager, member and source counts. The drawer shows
   * these for the user's own projects and offers the rest in the picker.
   */
  projects: ProjectOverview[];
  /** The user directory, to give a project's manager the same avatar as elsewhere. */
  users?: AdminUser[];
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectDetails: (projectId: string) => void;
  /** Shown when the drawer was opened from another one, e.g. from a project's members. */
  back?: DrawerBackLink;
  onUserUpdated: (updatedUser: AdminUser) => void;
  onRequestDelete: (user: AdminUser) => void;
  /**
   * Called after an assignment removed the user from other projects. Those
   * projects' member lists are held elsewhere on the page and are stale by then,
   * so the parent is expected to reload them.
   */
  onMembershipsMoved?: () => void;
};

/** A pending assignment that would take the user out of other projects. */
type PendingMove = {
  targetName: string;
  leaving: ProjectSummary[];
};

type DraftUserState = {
  userId: string;
  draftUser: UserEditFormState;
};

type SaveErrorState = {
  userId: string;
  message: string;
};

function ReadonlyEditRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <span className="text-sm text-app-text-muted">{label}</span>
      <span
        className={`text-sm font-medium wrap-break-word text-app-text ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * One user in the admin page's side drawer: profile fields, permission group, account access and
 * project memberships, with an edit mode and the delete action.
 *
 * Edits are held in a draft until saved; a failed save is reported as a toast, the inline errors
 * are only the field validation. Assigning a project that would take a regular user out of their
 * other projects (see `getProjectsLeftOnMove`) asks first, and `onMembershipsMoved` tells the
 * page to reload the member lists that changed.
 */
export function UserDetailsDrawer({
  user,
  projects,
  users = [],
  isOpen,
  onClose,
  onOpenProjectDetails,
  back,
  onUserUpdated,
  onRequestDelete,
  onMembershipsMoved,
}: UserDetailsDrawerProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  // `saveError` now only carries the inline field validation (email / group
  // required); the save request's own failure is surfaced as a toast.
  const [saveError, setSaveError] = useState<SaveErrorState | null>(null);
  const toast = useToast();
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  // Settles the promise `confirmAssign` handed to the project panel, so the
  // panel waits for the dialog's answer before it assigns anything.
  const moveDecisionRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [draftUserState, setDraftUserState] = useState<DraftUserState>(() => ({
    userId: user.id,
    draftUser: getUserEditFormState(user),
  }));

  const isEditing = isOpen && editingUserId === user.id;
  const isSaving = savingUserId === user.id;
  const saveErrorMessage = saveError?.userId === user.id ? saveError.message : "";

  const draftUser =
    draftUserState.userId === user.id ? draftUserState.draftUser : getUserEditFormState(user);

  const availableProjects = useMemo(() => getAvailableProjects(projects), [projects]);
  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);

  const enrichedAssignedProjects = useMemo(
    () =>
      user.projects.map((userProject) => {
        const match = availableProjects.find((p) => p.id === userProject.id);
        return match ?? userProject;
      }),
    [user.projects, availableProjects],
  );

  const assignedUserProjects = useMemo(
    () => resolveUserProjects(enrichedAssignedProjects, projects),
    [enrichedAssignedProjects, projects],
  );

  // The view follows the stored role, not the draft: the assignment is saved
  // immediately, so it has to match what the backend currently enforces.
  const canHaveSeveralProjects = canJoinMultipleProjects(user.permissionGroup);

  const downgradeConflicts = isEditing
    ? getRoleDowngradeConflicts(user, projects, draftUser.permissionGroup)
    : null;

  const visibleTitle = isEditing ? getDraftDisplayName(user, draftUser) : getDisplayName(user);

  const visiblePermissionGroup = isEditing ? draftUser.permissionGroup : user.permissionGroup;

  const visibleEnabled = isEditing ? draftUser.enabled : user.enabled;

  const settleMove = (confirmed: boolean) => {
    moveDecisionRef.current?.(confirmed);
    moveDecisionRef.current = null;
    setPendingMove(null);
  };

  const closeDrawer = () => {
    settleMove(false);
    setEditingUserId(null);
    setSaveError(null);
    onClose();
  };

  const startEditing = () => {
    setDraftUserState({
      userId: user.id,
      draftUser: getUserEditFormState(user),
    });
    setSaveError(null);
    setEditingUserId(user.id);
  };

  const cancelEditing = () => {
    setDraftUserState({
      userId: user.id,
      draftUser: getUserEditFormState(user),
    });
    setSaveError(null);
    setEditingUserId(null);
  };

  const updateDraftField = (field: Exclude<keyof UserEditFormState, "enabled">, value: string) => {
    setDraftUserState((currentDraftUserState) => {
      const currentDraftUser =
        currentDraftUserState.userId === user.id
          ? currentDraftUserState.draftUser
          : getUserEditFormState(user);

      return {
        userId: user.id,
        draftUser: {
          ...currentDraftUser,
          [field]: value,
        },
      };
    });
  };

  const updateDraftEnabled = (enabled: boolean) => {
    setDraftUserState((currentDraftUserState) => {
      const currentDraftUser =
        currentDraftUserState.userId === user.id
          ? currentDraftUserState.draftUser
          : getUserEditFormState(user);

      return {
        userId: user.id,
        draftUser: {
          ...currentDraftUser,
          enabled,
        },
      };
    });
  };

  const getProjectSummariesById = (projectIds: Set<string>) => {
    const projectsById = new Map(
      [...availableProjects, ...enrichedAssignedProjects].map((project) => [project.id, project]),
    );

    return Array.from(projectIds)
      .map(
        (projectId) =>
          projectsById.get(projectId) ?? {
            id: projectId,
            name: `Project ${projectId.slice(0, 8)}`,
          },
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  };

  const getProjectsLeft = (targetProjectId: string) =>
    getProjectsLeftOnMove({ ...user, projects: enrichedAssignedProjects }, targetProjectId);

  const confirmProjectAssignment = (projectId: string): Promise<boolean> => {
    const leaving = getProjectsLeft(projectId);
    if (leaving.length === 0) return Promise.resolve(true);

    const targetName =
      availableProjects.find((project) => project.id === projectId)?.name ??
      `Project ${projectId.slice(0, 8)}`;

    return new Promise((resolve) => {
      moveDecisionRef.current = resolve;
      setPendingMove({ targetName, leaving });
    });
  };

  const assignProjectToUser = async (projectId: string) => {
    const leaving = getProjectsLeft(projectId);

    await projectService.assignUsersToProject(projectId, {
      userIds: [user.id],
    });

    // A regular user is moved, not added: the backend drops the old
    // memberships, so the list is replaced rather than extended.
    const leavingIds = new Set(leaving.map((project) => project.id));
    const nextProjectIds = new Set(
      enrichedAssignedProjects
        .map((project) => project.id)
        .filter((assignedId) => !leavingIds.has(assignedId)),
    );
    nextProjectIds.add(projectId);

    // `projectIds` is what the enrichment on the next full load reads, so both
    // have to move together or the optimistic change would be undone by it.
    onUserUpdated({
      ...user,
      projects: getProjectSummariesById(nextProjectIds),
      projectIds: [...nextProjectIds],
    });

    if (leaving.length > 0) onMembershipsMoved?.();
  };

  const removeProjectFromUser = async (projectId: string) => {
    await projectService.removeUserFromProject(projectId, user.id);

    const nextProjectIds = new Set(enrichedAssignedProjects.map((project) => project.id));
    nextProjectIds.delete(projectId);

    onUserUpdated({
      ...user,
      projects: getProjectSummariesById(nextProjectIds),
      projectIds: [...nextProjectIds],
    });
  };

  const saveUserChanges = async () => {
    const request: UpdateAdminUserRequest = {
      email: draftUser.email.trim(),
      firstName: draftUser.firstName.trim(),
      lastName: draftUser.lastName.trim(),
      permissionGroup: draftUser.permissionGroup.trim(),
    };

    if (!request.email) {
      setSaveError({
        userId: user.id,
        message: "Email is required.",
      });
      return;
    }

    if (!request.permissionGroup) {
      setSaveError({
        userId: user.id,
        message: "Permission group is required.",
      });
      return;
    }

    setSavingUserId(user.id);
    setSaveError(null);

    try {
      let updatedUser = await adminUserService.updateUser(user.id, request);

      if (draftUser.enabled !== user.enabled) {
        updatedUser = await adminUserService.updateUserEnabled(user.id, {
          enabled: draftUser.enabled,
        });
      }

      updatedUser = { ...updatedUser, projects: enrichedAssignedProjects };

      onUserUpdated(updatedUser);
      setDraftUserState({
        userId: updatedUser.id,
        draftUser: getUserEditFormState(updatedUser),
      });
      setEditingUserId(null);
      toast.success("User saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the user changes.");
    } finally {
      setSavingUserId((currentSavingUserId) =>
        currentSavingUserId === user.id ? null : currentSavingUserId,
      );
    }
  };

  return (
    <DetailsSideDrawer
      isOpen={isOpen}
      onClose={closeDrawer}
      title={visibleTitle}
      leading={
        <div className="flex shrink-0 items-center justify-center">
          {/* Smaller on mobile; original size from sm up. Same seed → identical
              avatar, just rendered at two sizes. */}
          <span className="sm:hidden">
            <UserAvatar
              profileIcon={user.profileIcon}
              fallbackName={`${user.firstName} ${user.lastName}`.trim()}
              seed={user.id}
              size={48}
            />
          </span>
          <span className="hidden sm:inline-flex">
            <UserAvatar
              profileIcon={user.profileIcon}
              fallbackName={`${user.firstName} ${user.lastName}`.trim()}
              seed={user.id}
              size={64}
            />
          </span>
        </div>
      }
      badge={
        <AccessBadge variant={getPermissionGroupVariant(visiblePermissionGroup)}>
          {visiblePermissionGroup}
        </AccessBadge>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {back && <DrawerBackButton back={back} />}

          <Button
            variant="secondary"
            onClick={startEditing}
            disabled={isEditing || isSaving}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit User
          </Button>

          <Button
            variant="dangerGhost"
            iconOnly
            onClick={() => onRequestDelete(user)}
            disabled={isSaving}
            aria-label={`Delete ${getDisplayName(user)}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
      footer={
        isEditing ? (
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:justify-end">
            <Button variant="secondary" onClick={cancelEditing} disabled={isSaving}>
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={() => void saveUserChanges()}
              loading={isSaving}
              icon={<Check className="h-4 w-4" />}
            >
              Save
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <UserStatusSection
          isEditing={isEditing}
          enabled={visibleEnabled}
          onboardingCompleted={user.hasCompletedOnboarding}
          disabled={isSaving}
          onEnabledChange={updateDraftEnabled}
          index={0}
        />

        <DrawerCard label="Details" icon={FileText} index={1}>
          {saveErrorMessage && (
            <div className="mb-5 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-app-danger-text">
                <AlertCircle className="h-4 w-4" />
                User changes could not be saved
              </div>
              <p className="mt-1 text-sm text-app-danger-text">{saveErrorMessage}</p>
            </div>
          )}

          {isEditing ? (
            <div>
              <ReadonlyEditRow label="Username" value={user.username} />
              <EditableDetailRow
                label="Email"
                value={draftUser.email}
                onChange={(value) => updateDraftField("email", value)}
                type="email"
                autoComplete="email"
              />
              <EditableDetailRow
                label="First name"
                value={draftUser.firstName}
                onChange={(value) => updateDraftField("firstName", value)}
                autoComplete="given-name"
              />
              <EditableDetailRow
                label="Last name"
                value={draftUser.lastName}
                onChange={(value) => updateDraftField("lastName", value)}
                autoComplete="family-name"
              />
              <EditableSelectDetailRow
                label="Role"
                value={draftUser.permissionGroup}
                onChange={(value) => updateDraftField("permissionGroup", value)}
                options={PERMISSION_GROUP_OPTIONS}
              />
              <ReadonlyEditRow label="User ID" value={user.id} mono />

              {downgradeConflicts && (
                <div
                  role="status"
                  className="mt-3 rounded-2xl border border-app-warning-border bg-app-warning-bg p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-app-warning-text">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    This role change leaves conflicts behind
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-app-warning-text">
                    {downgradeConflicts.projectCount > 0 && (
                      <li>
                        {getDisplayName(user)} is in {downgradeConflicts.projectCount} projects.
                        Users may only be in one, but the extra memberships stay until you remove
                        them.
                      </li>
                    )}
                    {downgradeConflicts.managedProjects.length > 0 && (
                      <li>
                        {getDisplayName(user)} manages{" "}
                        {downgradeConflicts.managedProjects
                          .map((project) => project.name)
                          .join(", ")}
                        . Managers need the Project Manager role, so reassign the manager
                        afterwards.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <dl>
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Username" value={user.username} />
              <DetailRow label="First name" value={user.firstName} />
              <DetailRow label="Last name" value={user.lastName} />
              <DetailRow label="Role" value={user.permissionGroup} />
              <DetailRow label="User ID" value={user.id} mono />
            </dl>
          )}
        </DrawerCard>

        <DrawerCard bare index={2}>
          {canHaveSeveralProjects ? (
            <MultiProjectAssignment
              user={user}
              assignedProjects={assignedUserProjects}
              allProjects={projects}
              usersById={usersById}
              isAdmin={user.permissionGroup.trim().toUpperCase() === "ADMIN"}
              onOpenProjectDetails={onOpenProjectDetails}
              onAssignProject={assignProjectToUser}
              confirmAssign={confirmProjectAssignment}
              onRemoveProject={removeProjectFromUser}
            />
          ) : (
            <SingleProjectAssignment
              user={user}
              assignedProjects={assignedUserProjects}
              allProjects={projects}
              usersById={usersById}
              onOpenProjectDetails={onOpenProjectDetails}
              onAssignProject={assignProjectToUser}
              confirmAssign={confirmProjectAssignment}
              onRemoveProject={removeProjectFromUser}
            />
          )}
        </DrawerCard>
      </div>

      <AlertDialog
        isOpen={pendingMove !== null}
        variant="danger"
        title={pendingMove ? `Move to ${pendingMove.targetName}?` : "Move user?"}
        description={
          pendingMove
            ? `${getDisplayName(user)} will be removed from ${pendingMove.leaving
                .map((project) => project.name)
                .join(", ")}. Project roles and onboarding progress will be reset.`
            : undefined
        }
        confirmLabel="Move user"
        onClose={() => settleMove(false)}
        onConfirm={() => settleMove(true)}
      />
    </DetailsSideDrawer>
  );
}
