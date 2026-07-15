import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit,
  Folder,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { projectService } from "../../../services/projectService";
import {
  getProjectEditFormState,
  getProjectSourcesCount,
  getProjectUsersCount,
} from "../data";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectEditFormState,
  ProjectOverview,
  ProjectUser,
} from "../types";
import { AccessBadge } from "./Badges";
import { EditableDetailRow } from "./EditableDetailRow";
import { ProjectUserList } from "./ProjectUserList";
import { Section } from "./Section";
import { SourceList } from "./SourceList";

type ProjectDetailsDrawerProps = {
  project: ProjectOverview;
  availableUsers?: AdminUser[];
  isOpen: boolean;
  onClose: () => void;
  onOpenSourceDetails?: (projectId: string, sourceId: string) => void;
  onProjectUpdated?: (updatedProject: AdminProjectDetails) => void;
};

type ProjectDetailsError = {
  projectId: string;
  message: string;
};

type DraftProjectState = {
  projectId: string;
  draftProject: ProjectEditFormState;
};

type SaveErrorState = {
  projectId: string;
  message: string;
};

const EMPTY_PROJECT_USERS: ProjectUser[] = [];

function getAvailableUserDisplayName(user: AdminUser) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email
  );
}

function matchesUserSearch(user: AdminUser, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return false;

  return [
    user.id,
    user.username,
    user.email,
    user.firstName,
    user.lastName,
    getAvailableUserDisplayName(user),
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

export function ProjectDetailsDrawer({
  project,
  availableUsers = [],
  isOpen,
  onClose,
  onOpenSourceDetails,
  onProjectUpdated,
}: ProjectDetailsDrawerProps) {
  const descriptionInputId = useId();
  const [projectDetails, setProjectDetails] =
    useState<AdminProjectDetails | null>(null);
  const [detailsError, setDetailsError] = useState<ProjectDetailsError | null>(
    null,
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveErrorState | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [userAssignmentError, setUserAssignmentError] = useState("");
  const [draftProjectState, setDraftProjectState] = useState<DraftProjectState>(
    () => ({
      projectId: project.id,
      draftProject: getProjectEditFormState(project),
    }),
  );

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const projectId = project.id;

    void projectService
      .getProjectById(projectId)
      .then((nextProjectDetails) => {
        if (!isMounted) return;

        setProjectDetails(nextProjectDetails);
        setDetailsError(null);
        setUserAssignmentError("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setProjectDetails(null);
        setDetailsError({
          projectId,
          message:
            error instanceof Error
              ? error.message
              : "Project details could not be loaded.",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, project.id]);

  const currentProjectDetails =
    projectDetails?.id === project.id ? projectDetails : null;

  const currentDetailsError =
    detailsError?.projectId === project.id ? detailsError.message : "";

  const visibleProject = currentProjectDetails ?? project;
  const visibleUsers = currentProjectDetails?.users ?? EMPTY_PROJECT_USERS;
  const isEditing = isOpen && editingProjectId === project.id;
  const isSaving = savingProjectId === project.id;
  const saveErrorMessage =
    saveError?.projectId === project.id ? saveError.message : "";
  const draftProject =
    draftProjectState.projectId === project.id
      ? draftProjectState.draftProject
      : getProjectEditFormState(visibleProject);
  const visibleProjectName = isEditing
    ? draftProject.name
    : visibleProject.name;
  const memberCount = getProjectUsersCount(visibleProject);
  const sourceCount = getProjectSourcesCount(visibleProject);

  const assignedUserIds = useMemo(
    () => new Set(visibleUsers.map((user) => user.id)),
    [visibleUsers],
  );

  const userOptions = useMemo(() => {
    return availableUsers
      .filter((user) => !assignedUserIds.has(user.id))
      .filter((user) => matchesUserSearch(user, userSearch))
      .slice(0, 8);
  }, [assignedUserIds, availableUsers, userSearch]);

  const isLoadingDetails =
    isOpen && !currentProjectDetails && !currentDetailsError;

  const hasDetailsError = Boolean(currentDetailsError);
  const hasPendingUserChange = pendingUserId !== null;

  const closeDrawer = () => {
    setEditingProjectId(null);
    setSaveError(null);
    setUserAssignmentError("");
    setUserSearch("");
    onClose();
  };

  const startEditing = () => {
    setDraftProjectState({
      projectId: project.id,
      draftProject: getProjectEditFormState(visibleProject),
    });
    setSaveError(null);
    setEditingProjectId(project.id);
  };

  const cancelEditing = () => {
    setDraftProjectState({
      projectId: project.id,
      draftProject: getProjectEditFormState(visibleProject),
    });
    setSaveError(null);
    setEditingProjectId(null);
  };

  const updateDraftField = (
    field: keyof ProjectEditFormState,
    value: string,
  ) => {
    setDraftProjectState((currentDraftProjectState) => {
      const currentDraftProject =
        currentDraftProjectState.projectId === project.id
          ? currentDraftProjectState.draftProject
          : getProjectEditFormState(visibleProject);

      return {
        projectId: project.id,
        draftProject: {
          ...currentDraftProject,
          [field]: value,
        },
      };
    });
  };

  const updateProjectUsers = (users: ProjectUser[]) => {
    if (!currentProjectDetails) return;

    const updatedProject = {
      ...currentProjectDetails,
      users,
    };

    setProjectDetails(updatedProject);
    onProjectUpdated?.(updatedProject);
  };

  const addUserToProject = async (userId: string) => {
    if (!currentProjectDetails || hasPendingUserChange) return;

    setPendingUserId(userId);
    setUserAssignmentError("");

    try {
      const users = await projectService.assignUsersToProject(project.id, {
        userIds: [userId],
      });

      updateProjectUsers(users);
      setUserSearch("");
    } catch (error) {
      setUserAssignmentError(
        error instanceof Error
          ? error.message
          : "User assignment could not be saved.",
      );
    } finally {
      setPendingUserId(null);
    }
  };

  const removeUserFromProject = async (userId: string) => {
    if (!currentProjectDetails || hasPendingUserChange) return;

    setPendingUserId(userId);
    setUserAssignmentError("");

    try {
      await projectService.removeUserFromProject(project.id, userId);
      updateProjectUsers(
        currentProjectDetails.users.filter((user) => user.id !== userId),
      );
    } catch (error) {
      setUserAssignmentError(
        error instanceof Error
          ? error.message
          : "User assignment could not be removed.",
      );
    } finally {
      setPendingUserId(null);
    }
  };

  const saveProjectChanges = async () => {
    const request = {
      name: draftProject.name.trim(),
      description: draftProject.description.trim(),
    };

    if (!request.name) {
      setSaveError({
        projectId: project.id,
        message: "Project name is required.",
      });
      return;
    }

    setSavingProjectId(project.id);
    setSaveError(null);

    try {
      const updatedProject = await projectService.updateProject(
        project.id,
        request,
      );

      setProjectDetails(updatedProject);
      setDraftProjectState({
        projectId: updatedProject.id,
        draftProject: getProjectEditFormState(updatedProject),
      });
      onProjectUpdated?.(updatedProject);
      setEditingProjectId(null);
    } catch (error) {
      setSaveError({
        projectId: project.id,
        message:
          error instanceof Error
            ? error.message
            : "Project changes could not be saved.",
      });
    } finally {
      setSavingProjectId((currentSavingProjectId) =>
        currentSavingProjectId === project.id ? null : currentSavingProjectId,
      );
    }
  };

  return (
    <DetailsSideDrawer
      isOpen={isOpen}
      onClose={closeDrawer}
      title={visibleProjectName}
      closeAriaLabel="Close project details"
      widthClassName="w-full sm:w-[min(94vw,34rem)] lg:w-[min(72vw,58rem)]"
      leading={
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-text-muted">
          <Folder className="h-6 w-6" />
        </div>
      }
      badge={
        <>
          <AccessBadge variant="neutral">
            {memberCount > 0 ? `${memberCount} members` : "No members"}
          </AccessBadge>
          <AccessBadge variant={sourceCount > 0 ? "success" : "neutral"}>
            {sourceCount > 0 ? `${sourceCount} sources` : "No sources"}
          </AccessBadge>
        </>
      }
      actions={
        <button
          type="button"
          onClick={startEditing}
          disabled={
            isEditing || isSaving || isLoadingDetails || hasDetailsError
          }
          className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Edit className="h-4 w-4" />
          Edit Project
        </button>
      }
      footer={
        isEditing ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void saveProjectChanges()}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-brand bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:border-app-brand-hover hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        ) : undefined
      }
    >
      {isLoadingDetails ? (
        <div className="flex min-h-72 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-app-text-muted">
            <Loader2 className="h-7 w-7 animate-spin text-app-brand" />
            <p className="text-sm">Loading project details...</p>
          </div>
        </div>
      ) : hasDetailsError ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-danger-text">
            <AlertCircle className="h-4 w-4" />
            Project details could not be loaded
          </div>
          <p className="text-sm text-app-danger-text">{currentDetailsError}</p>
        </div>
      ) : (
        <>
          <Section>
            {saveErrorMessage && (
              <div className="mb-5 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-app-danger-text">
                  <AlertCircle className="h-4 w-4" />
                  Project changes could not be saved
                </div>
                <p className="mt-1 text-sm text-app-danger-text">
                  {saveErrorMessage}
                </p>
              </div>
            )}

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
              Description
            </p>
            {isEditing ? (
              <div className="space-y-3">
                <EditableDetailRow
                  label="Name"
                  value={draftProject.name}
                  onChange={(value) => updateDraftField("name", value)}
                />
                <div className="grid grid-cols-1 items-start gap-1 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                  <label
                    htmlFor={descriptionInputId}
                    className="pt-2 text-sm text-app-text-muted"
                  >
                    Description
                  </label>
                  <textarea
                    id={descriptionInputId}
                    value={draftProject.description}
                    onChange={(event) =>
                      updateDraftField("description", event.target.value)
                    }
                    rows={5}
                    className="min-h-28 w-full resize-y rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-medium leading-relaxed text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-app-text-muted">
                {visibleProject.description ||
                  "No project description available yet."}
              </p>
            )}
          </Section>

          <Section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
              Connected sources
            </p>
            <SourceList
              sources={visibleProject.sources}
              onOpenSourceDetails={
                onOpenSourceDetails
                  ? (sourceId) => onOpenSourceDetails(project.id, sourceId)
                  : undefined
              }
            />
          </Section>

          <Section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                  Assigned users
                </p>
                <p className="mt-1 text-sm text-app-text-muted">
                  Search and click a user to add them. Changes are saved
                  immediately.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-app-border bg-app-surface-muted p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search users to add..."
                  disabled={hasPendingUserChange}
                  className="h-10 w-full rounded-xl border border-app-border bg-app-surface pl-10 pr-3 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {userSearch.trim() && (
                <div className="mt-3 max-h-64 space-y-1 overflow-auto">
                  {userOptions.length > 0 ? (
                    userOptions.map((user) => {
                      const displayName = getAvailableUserDisplayName(user);
                      const isPending = pendingUserId === user.id;

                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => void addUserToProject(user.id)}
                          disabled={hasPendingUserChange}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <UserAvatar
                            size={32}
                            profileIcon={user.profileIcon}
                            fallbackName={displayName}
                            seed={user.id}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-app-text">
                              {displayName}
                            </span>
                            <span className="block truncate text-xs text-app-text-muted">
                              {user.email || user.username}
                            </span>
                          </span>
                          {isPending ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-text-muted" />
                          ) : (
                            <UserPlus className="h-4 w-4 shrink-0 text-app-text-muted" />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-3 text-sm text-app-text-muted">
                      No unassigned users found.
                    </p>
                  )}
                </div>
              )}
            </div>

            {userAssignmentError && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{userAssignmentError}</span>
              </div>
            )}

            <ProjectUserList
              users={visibleUsers}
              pendingUserId={pendingUserId}
              onRemoveUser={(userId) => void removeUserFromProject(userId)}
            />
          </Section>
        </>
      )}
    </DetailsSideDrawer>
  );
}
