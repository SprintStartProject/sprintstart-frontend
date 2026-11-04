import { useEffect, useRef, useState } from "react";
import { projectService } from "../../../../services/projectService";
import { getProjectEditFormState } from "../../data";
import { createEmptyPeopleDraft, type PeopleDraft } from "../../peopleDraft";
import type { AdminProjectDetails, ProjectEditFormState, ProjectOverview } from "../../types";
import { failureMessage } from "./drawerRules";

/**
 * The project as the server has it, and the drafts the admin stages against it.
 *
 * Expects to be mounted once per project, so all async state belongs to exactly one project and
 * needs no id tagging.
 */
export function useProjectForm(project: ProjectOverview, isOpen: boolean) {
  const [projectDetails, setProjectDetails] = useState<AdminProjectDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [draftProject, setDraftProject] = useState<ProjectEditFormState>(() =>
    getProjectEditFormState(project),
  );
  const [peopleDraft, setPeopleDraft] = useState<PeopleDraft>(() => createEmptyPeopleDraft(""));
  // Tracks whether the detail fields were touched, so the initial fetch can populate them without
  // clobbering in-progress edits.
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
        // Only adopt server values into the draft while the user has not typed, so the arriving
        // response cannot overwrite their edits.
        if (!hasEditedDetailsRef.current) {
          setDraftProject(getProjectEditFormState(nextProjectDetails));
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setProjectDetails(null);
        setDetailsError(failureMessage(error, "Project details could not be loaded."));
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, project.id]);

  const resetDrafts = (source: AdminProjectDetails | ProjectOverview) => {
    hasEditedDetailsRef.current = false;
    setDraftProject(getProjectEditFormState(source));
    setPeopleDraft(createEmptyPeopleDraft(""));
  };

  const updateDraftField = (field: keyof ProjectEditFormState, value: string) => {
    hasEditedDetailsRef.current = true;
    setDraftProject((current) => ({ ...current, [field]: value }));
  };

  /**
   * Adopts the whole project into `draftProject` — never `resetDrafts`, which would also wipe the
   * unrelated people draft. The name/description draft itself is only replaced while untouched, so
   * an admin's in-progress edits (or queued people changes) survive a re-evaluation rather than
   * being silently discarded.
   */
  const adoptIfUntouched = (updated: AdminProjectDetails) => {
    if (!hasEditedDetailsRef.current) {
      setDraftProject(getProjectEditFormState(updated));
    }
  };

  return {
    projectDetails,
    setProjectDetails,
    detailsError,
    draftProject,
    peopleDraft,
    setPeopleDraft,
    resetDrafts,
    updateDraftField,
    adoptIfUntouched,
  };
}

export type ProjectForm = ReturnType<typeof useProjectForm>;
