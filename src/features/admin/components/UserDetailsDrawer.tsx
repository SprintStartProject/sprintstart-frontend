import { useMemo, useState } from "react";
import { AlertCircle, Check, Edit, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { adminUserService } from "../../../services/adminUserService";
import { projectService } from "../../../services/projectService";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import {
  getDisplayName,
  getDraftDisplayName,
  getPermissionGroupVariant,
  getUserEditFormState,
  PERMISSION_GROUP_OPTIONS,
} from "../data";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type {
  AdminUser,
  ProjectSummary,
  UpdateAdminUserRequest,
  UserEditFormState,
} from "../types";
import { AccessBadge } from "./Badges";
import { DetailRow } from "./DetailRow";
import { EditableDetailRow } from "./EditableDetailRow";
import { EditableSelectDetailRow } from "./EditableSelectDetailRow";
import { ProjectAccessPanel } from "./ProjectAccessPanel";
import { Section } from "./Section";
import { UserStatusSection } from "./UserStatusSection";

type UserDetailsDrawerProps = {
  user: AdminUser;
  availableProjects: ProjectSummary[];
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectDetails: (projectId: string) => void;
  onUserUpdated: (updatedUser: AdminUser) => void;
  onRequestDelete: (user: AdminUser) => void;
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

export function UserDetailsDrawer({
  user,
  availableProjects,
  isOpen,
  onClose,
  onOpenProjectDetails,
  onUserUpdated,
  onRequestDelete,
}: UserDetailsDrawerProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  // `saveError` now only carries the inline field validation (email / group
  // required); the save request's own failure is surfaced as a toast.
  const [saveError, setSaveError] = useState<SaveErrorState | null>(null);
  const toast = useToast();
  const [draftUserState, setDraftUserState] = useState<DraftUserState>(() => ({
    userId: user.id,
    draftUser: getUserEditFormState(user),
  }));

  const isEditing = isOpen && editingUserId === user.id;
  const isSaving = savingUserId === user.id;
  const saveErrorMessage = saveError?.userId === user.id ? saveError.message : "";

  const draftUser =
    draftUserState.userId === user.id ? draftUserState.draftUser : getUserEditFormState(user);

  const enrichedAssignedProjects = useMemo(
    () =>
      user.projects.map((userProject) => {
        const match = availableProjects.find((p) => p.id === userProject.id);
        return match ?? userProject;
      }),
    [user.projects, availableProjects],
  );

  const visibleTitle = isEditing ? getDraftDisplayName(user, draftUser) : getDisplayName(user);

  const visiblePermissionGroup = isEditing ? draftUser.permissionGroup : user.permissionGroup;

  const visibleEnabled = isEditing ? draftUser.enabled : user.enabled;

  const closeDrawer = () => {
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

  const assignProjectToUser = async (projectId: string) => {
    await projectService.assignUsersToProject(projectId, {
      userIds: [user.id],
    });

    const nextProjectIds = new Set(enrichedAssignedProjects.map((project) => project.id));
    nextProjectIds.add(projectId);

    // `projectIds` is what the enrichment on the next full load reads, so both
    // have to move together or the optimistic change would be undone by it.
    onUserUpdated({
      ...user,
      projects: getProjectSummariesById(nextProjectIds),
      projectIds: [...nextProjectIds],
    });
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
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
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
      <UserStatusSection
        isEditing={isEditing}
        enabled={visibleEnabled}
        onboardingCompleted={user.hasCompletedOnboarding}
        disabled={isSaving}
        onEnabledChange={updateDraftEnabled}
      />

      <Section>
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
      </Section>

      <Section>
        <ProjectAccessPanel
          assignedProjects={enrichedAssignedProjects}
          availableProjects={availableProjects}
          onOpenProjectDetails={onOpenProjectDetails}
          onAssignProject={assignProjectToUser}
          onRemoveProject={removeProjectFromUser}
        />
      </Section>
    </DetailsSideDrawer>
  );
}
