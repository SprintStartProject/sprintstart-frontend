import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Database, FileText, Tag, Trash2 } from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { SaveButton } from "../../../components/ui/SaveButton";
import { Spinner } from "../../../components/ui/Spinner";
import { useToast } from "../../../context/useToast";
import { projectService } from "../../../services/projectService";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import { ProjectIndustryPanel } from "../../projects/industry/ProjectIndustryPanel";
import {
  getDisplayName,
  getProjectEditFormState,
  getProjectSourcesCount,
  getProjectUsersCount,
  pluralize,
} from "../data";
import {
  applyPeopleChanges,
  buildPeopleSnapshotKey,
  countPeopleChanges,
  createEmptyPeopleDraft,
  resolvePeopleDraft,
  type PeopleDraft,
} from "../peopleDraft";
import { getMovedUsers } from "../projectMove";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectEditFormState,
  ProjectOverview,
  ProjectUser,
} from "../types";
import { AccessBadge } from "./Badges";
import { DrawerCard } from "./DrawerCard";
import { ProjectPeopleSection } from "./ProjectPeopleSection";
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
  /**
   * Called after a save that removed people from other projects. Those projects'
   * member lists are held elsewhere on the page and are stale by then, so the
   * parent is expected to reload them.
   */
  onMembershipsMoved?: () => void;
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
  onMembershipsMoved,
}: ProjectDetailsDrawerProps) {
  const nameInputId = useId();
  const descriptionInputId = useId();

  const [projectDetails, setProjectDetails] = useState<AdminProjectDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // `saveErrorMessage` now only carries the inline "name required" validation;
  // the save request's own failure is surfaced as a toast.
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const toast = useToast();

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

  // Staged additions that would take a regular user out of another project.
  const movedUsers = getMovedUsers(availableUsers, activePeopleDraft.addedUserIds, project.id);

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

  const requestSave = () => {
    if (hasDetailsChanges && !draftProject.name.trim()) {
      setSaveErrorMessage("Project name is required.");
      return;
    }

    if (movedUsers.length > 0) {
      setIsMoveDialogOpen(true);
      return;
    }

    void saveChanges();
  };

  const saveChanges = async () => {
    setIsMoveDialogOpen(false);
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
      toast.success("Project saved");

      if (movedUsers.length > 0) onMembershipsMoved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the project changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // Re-fetches and adopts the whole project, but only into `draftProject` -
  // never `resetDrafts`, which would also wipe the unrelated people draft.
  // The name/description draft itself is only replaced while untouched, so an
  // admin's in-progress edits (or queued people changes) survive a
  // re-evaluation rather than being silently discarded.
  const handleIndustryEvaluated = async () => {
    try {
      const updatedProject = await projectService.getProjectById(project.id);
      applyProjectUpdate(updatedProject);
      if (!hasEditedDetailsRef.current) {
        setDraftProject(getProjectEditFormState(updatedProject));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't refresh the project after evaluation.",
      );
    }
  };

  // Same reload-and-adopt approach as `handleIndustryEvaluated`, plus the
  // actual persist call. Rethrows so `ProjectIndustryPanel` keeps its edit
  // field open (with the typed value) for the user to retry.
  const handleSaveIndustry = async (industry: string) => {
    try {
      await projectService.setProjectIndustry(project.id, industry);
      const updatedProject = await projectService.getProjectById(project.id);
      applyProjectUpdate(updatedProject);
      if (!hasEditedDetailsRef.current) {
        setDraftProject(getProjectEditFormState(updatedProject));
      }
      toast.success(`Industry set to "${industry}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the project's industry.");
      throw error;
    }
  };

  const confirmDeleteProject = async () => {
    setIsDeleting(true);

    try {
      await projectService.deleteProject(project.id);
      setIsDeleteDialogOpen(false);
      onProjectDeleted?.(project.id);
      onClose();
      toast.success("Project deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the project.");
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
        leading={<ProjectMonogram projectId={project.id} name={visibleProject.name} size="lg" />}
        badge={
          <>
            <AccessBadge variant="neutral">
              {memberCount > 0 ? pluralize(memberCount, "member") : "No members"}
            </AccessBadge>
            <AccessBadge variant={sourceCount > 0 ? "success" : "neutral"}>
              {sourceCount > 0 ? pluralize(sourceCount, "source") : "No sources"}
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

              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                <Button variant="secondary" onClick={discardChanges} disabled={isSaving}>
                  Discard
                </Button>

                <SaveButton dirty={hasPendingChanges} saving={isSaving} onClick={requestSave} />
              </div>
            </div>
          ) : undefined
        }
      >
        {isLoadingDetails ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-app-text-muted">
              <Spinner size="lg" silent />
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
          <div className="space-y-4 sm:space-y-5">
            <DrawerCard label="Details" icon={FileText} index={0}>
              {saveErrorMessage && (
                <div className="mb-5 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-app-danger-text">
                    <AlertCircle className="h-4 w-4" />
                    Project changes could not be saved
                  </div>
                  <p className="mt-1 text-sm text-app-danger-text">{saveErrorMessage}</p>
                </div>
              )}

              <div className="space-y-4">
                <Field label="Name" controlId={nameInputId} required disabled={isSaving}>
                  <Input
                    value={draftProject.name}
                    onChange={(event) => updateDraftField("name", event.target.value)}
                  />
                </Field>

                <Field
                  label="Description"
                  controlId={descriptionInputId}
                  optional
                  disabled={isSaving}
                >
                  <Textarea
                    value={draftProject.description}
                    onChange={(event) => updateDraftField("description", event.target.value)}
                    minRows={4}
                    maxRows={12}
                    placeholder="No project description yet."
                  />
                </Field>
              </div>
            </DrawerCard>

            <DrawerCard label="Industry" icon={Tag} index={1}>
              <ProjectIndustryPanel
                projectId={project.id}
                industry={visibleProject.industry}
                industryConfidence={visibleProject.industryConfidence}
                industryCustom={visibleProject.industryCustom}
                canEvaluate={canManageLifecycle}
                canEdit={canManageLifecycle}
                onSave={handleSaveIndustry}
                disabled={isSaving}
                onEvaluated={() => void handleIndustryEvaluated()}
              />
            </DrawerCard>

            <DrawerCard index={2}>
              <ProjectPeopleSection
                projectId={project.id}
                members={visibleUsers}
                manager={projectDetails?.manager ?? null}
                availableUsers={availableUsers}
                canAssignManager={canManageLifecycle}
                disabled={isSaving}
                snapshotKey={peopleSnapshotKey}
                draft={activePeopleDraft}
                onDraftChange={setPeopleDraft}
              />
            </DrawerCard>

            <DrawerCard label="Connected sources" icon={Database} index={3}>
              <SourceList
                sources={visibleProject.sources}
                onOpenSourceDetails={
                  onOpenSourceDetails
                    ? (sourceId) => onOpenSourceDetails(project.id, sourceId)
                    : undefined
                }
              />
            </DrawerCard>

            {canManageLifecycle && (
              <DrawerCard label="Danger zone" variant="danger" index={4}>
                <p className="text-sm text-app-danger-text">
                  Deleting a project removes it and all of its user assignments. Connected sources
                  are kept and stay available to other projects.
                </p>

                <Button
                  variant="dangerSoft"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isSaving}
                  icon={<Trash2 className="h-4 w-4" />}
                  className="mt-4"
                >
                  Delete project
                </Button>
              </DrawerCard>
            )}
          </div>
        )}
      </DetailsSideDrawer>

      <AlertDialog
        isOpen={isMoveDialogOpen}
        variant="danger"
        title={movedUsers.length === 1 ? "Move 1 person?" : `Move ${movedUsers.length} people?`}
        description={
          <>
            <span className="block">
              These people are in other projects and will be removed from them. Their project roles
              and onboarding progress are reset.
            </span>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {movedUsers.map(({ user, leaving }) => (
                <li key={user.id}>
                  <span className="font-semibold text-app-text">{getDisplayName(user)}</span> (from{" "}
                  {leaving.map((left) => left.name).join(", ")})
                </li>
              ))}
            </ul>
          </>
        }
        confirmLabel="Move and save"
        onClose={() => setIsMoveDialogOpen(false)}
        onConfirm={() => void saveChanges()}
      />

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
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void confirmDeleteProject()}
      />
    </>
  );
}
