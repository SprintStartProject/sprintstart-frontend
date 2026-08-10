import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Folder, Loader2, Trash2 } from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { SaveButton } from "../../../components/ui/SaveButton";
import { projectService } from "../../../services/projectService";
import { getProjectEditFormState, getProjectSourcesCount, getProjectUsersCount } from "../data";
import {
  applyPeopleChanges,
  buildPeopleSnapshotKey,
  countPeopleChanges,
  createEmptyPeopleDraft,
  resolvePeopleDraft,
  type PeopleDraft,
} from "../peopleDraft";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectEditFormState,
  ProjectOverview,
  ProjectUser,
} from "../types";
import { AccessBadge } from "./Badges";
import { ProjectPeopleSection } from "./ProjectPeopleSection";
import { Section } from "./Section";
import { SourceList } from "./SourceList";

type ProjectDetailsDrawerProps = {
  project: ProjectOverview;
  availableUsers?: AdminUser[];
  isOpen: boolean;
  /** Whether the viewer may assign managers and delete the project (admins). */
  canManageLifecycle?: boolean;
  onClose: () => void;
  onOpenSourceDetails?: (projectId: string, sourceId: string) => void;
  onProjectUpdated?: (updatedProject: AdminProjectDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
};

const EMPTY_PROJECT_USERS: ProjectUser[] = [];

function isSameDetails(left: ProjectEditFormState, right: ProjectEditFormState) {
  return left.name === right.name && left.description === right.description;
}

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
export function ProjectDetailsDrawer({
  project,
  availableUsers = [],
  isOpen,
  canManageLifecycle = false,
  onClose,
  onOpenSourceDetails,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectDetailsDrawerProps) {
  const nameInputId = useId();
  const descriptionInputId = useId();

  const [projectDetails, setProjectDetails] = useState<AdminProjectDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");

  const [draftProject, setDraftProject] = useState<ProjectEditFormState>(() =>
    getProjectEditFormState(project),
  );
  const [peopleDraft, setPeopleDraft] = useState<PeopleDraft>(() => createEmptyPeopleDraft(""));
  // Tracks whether the detail fields were touched, so the initial fetch can
  // populate them without clobbering in-progress edits.
  const hasEditedDetailsRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    void projectService
      .getProjectById(project.id)
      .then((nextProjectDetails) => {
        if (!isMounted) return;

        setProjectDetails(nextProjectDetails);
        setDetailsError("");
        // Only adopt server values into the draft while the user has not typed,
        // so the arriving response cannot overwrite their edits.
        if (!hasEditedDetailsRef.current) {
          setDraftProject(getProjectEditFormState(nextProjectDetails));
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setProjectDetails(null);
        setDetailsError(
          error instanceof Error ? error.message : "Project details could not be loaded.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, project.id]);

  const visibleProject = projectDetails ?? project;
  const visibleUsers = projectDetails?.users ?? EMPTY_PROJECT_USERS;
  const memberCount = getProjectUsersCount(visibleProject);
  const sourceCount = getProjectSourcesCount(visibleProject);

  const savedDetails = getProjectEditFormState(visibleProject);
  const hasDetailsChanges = !isSameDetails(draftProject, savedDetails);

  const peopleSnapshotKey = buildPeopleSnapshotKey(visibleUsers, projectDetails?.manager ?? null);
  const activePeopleDraft = resolvePeopleDraft(peopleDraft, peopleSnapshotKey);
  const peopleChangeCount = countPeopleChanges(activePeopleDraft);

  const pendingChangeCount = peopleChangeCount + (hasDetailsChanges ? 1 : 0);
  const hasPendingChanges = pendingChangeCount > 0;

  const isLoadingDetails = isOpen && !projectDetails && !detailsError;
  const hasDetailsError = Boolean(detailsError);

  const resetDrafts = (source: AdminProjectDetails | ProjectOverview) => {
    hasEditedDetailsRef.current = false;
    setDraftProject(getProjectEditFormState(source));
    setPeopleDraft(createEmptyPeopleDraft(""));
  };

  const closeDrawer = () => {
    setSaveErrorMessage("");
    onClose();
  };

  const discardChanges = () => {
    setSaveErrorMessage("");
    resetDrafts(visibleProject);
  };

  const updateDraftField = (field: keyof ProjectEditFormState, value: string) => {
    hasEditedDetailsRef.current = true;
    setSaveErrorMessage("");
    setDraftProject((current) => ({ ...current, [field]: value }));
  };

  const applyProjectUpdate = (updatedProject: AdminProjectDetails) => {
    setProjectDetails(updatedProject);
    onProjectUpdated?.(updatedProject);
  };

  const saveChanges = async () => {
    if (hasDetailsChanges && !draftProject.name.trim()) {
      setSaveErrorMessage("Project name is required.");
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage("");

    try {
      if (hasDetailsChanges) {
        await projectService.updateProject(project.id, {
          name: draftProject.name.trim(),
          description: draftProject.description.trim(),
        });
      }

      if (peopleChangeCount > 0) {
        await applyPeopleChanges(project.id, activePeopleDraft);
      }

      // Refetch rather than merging locally: people changes touch membership,
      // manager and the source list's counts at once.
      const updatedProject = await projectService.getProjectById(project.id);
      applyProjectUpdate(updatedProject);
      resetDrafts(updatedProject);
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error ? error.message : "Project changes could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteProject = async () => {
    setIsDeleting(true);
    setDeleteErrorMessage("");

    try {
      await projectService.deleteProject(project.id);
      setIsDeleteDialogOpen(false);
      onProjectDeleted?.(project.id);
      onClose();
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error ? error.message : "Project could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DetailsSideDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        // The header carries the project's identity, so the body never repeats
        // the name as a heading or the counts as tiles.
        title={draftProject.name || visibleProject.name}
        closeAriaLabel="Close project details"
        widthClassName="w-full sm:w-[min(94vw,34rem)] lg:w-[min(72vw,58rem)]"
        leading={
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand">
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
        footer={
          hasPendingChanges ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-app-text">
                {pendingChangeCount} unsaved change
                {pendingChangeCount === 1 ? "" : "s"}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={discardChanges} disabled={isSaving}>
                  Discard
                </Button>

                <SaveButton
                  dirty={hasPendingChanges}
                  saving={isSaving}
                  onClick={() => void saveChanges()}
                />
              </div>
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
            <p className="text-sm text-app-danger-text">{detailsError}</p>
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
                  <p className="mt-1 text-sm text-app-danger-text">{saveErrorMessage}</p>
                </div>
              )}

              <p className="mb-4 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
                Details
              </p>

              <div className="space-y-4">
                <Field label="Name" controlId={nameInputId} disabled={isSaving}>
                  <Input
                    value={draftProject.name}
                    onChange={(event) => updateDraftField("name", event.target.value)}
                  />
                </Field>

                <Field label="Description" controlId={descriptionInputId} disabled={isSaving}>
                  <Textarea
                    value={draftProject.description}
                    onChange={(event) => updateDraftField("description", event.target.value)}
                    minRows={4}
                    maxRows={12}
                    placeholder="No project description yet."
                  />
                </Field>
              </div>
            </Section>

            <Section>
              <ProjectPeopleSection
                members={visibleUsers}
                manager={projectDetails?.manager ?? null}
                availableUsers={availableUsers}
                canAssignManager={canManageLifecycle}
                disabled={isSaving}
                snapshotKey={peopleSnapshotKey}
                draft={activePeopleDraft}
                onDraftChange={setPeopleDraft}
              />
            </Section>

            <Section>
              <p className="mb-3 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
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

            {canManageLifecycle && (
              <Section>
                <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-5">
                  <p className="text-xs font-semibold tracking-wide text-app-danger-text uppercase">
                    Danger zone
                  </p>
                  <p className="mt-2 text-sm text-app-danger-text">
                    Deleting a project removes it and all of its user assignments. Connected sources
                    are kept and stay available to other projects.
                  </p>

                  <Button
                    variant="dangerSoft"
                    onClick={() => {
                      setDeleteErrorMessage("");
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={isSaving}
                    icon={<Trash2 className="h-4 w-4" />}
                    className="mt-4"
                  >
                    Delete project
                  </Button>
                </div>
              </Section>
            )}
          </>
        )}
      </DetailsSideDrawer>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        title="Delete project?"
        description={
          <>
            <span className="font-semibold text-app-text">{visibleProject.name}</span> and its{" "}
            {memberCount} user assignment
            {memberCount === 1 ? "" : "s"} are deleted permanently. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        loadingLabel="Deleting..."
        errorMessage={deleteErrorMessage}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void confirmDeleteProject()}
      />
    </>
  );
}
