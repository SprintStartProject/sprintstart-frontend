import { useState } from "react";
import { useToast } from "../../../../context/useToast";
import { projectService, type AdminProjectDetails } from "../../../../services/projectService";
import {
  connectDraftSources,
  connectOutcomeDescription,
  hasFailedSources,
  type DraftSource,
} from "./addSourceKit";
import type { WizardDraft } from "./useWizardDraft";
import { isNameClashMessage, type WizardPhase } from "./wizardRules";

type CreateInput = {
  draft: WizardDraft;
  trimmedName: string;
  isNameValid: boolean;
  /** How many picked members would be moved out of other projects. */
  movedCount: number;
  setPhase: (phase: WizardPhase) => void;
  /** The project is saved and nothing is left to show: clear the wizard and close it. */
  onFinish: () => void;
  onProjectCreated: (project: AdminProjectDetails) => void;
  onMembershipsMoved?: () => void;
};

type CreateProject = {
  isSubmitting: boolean;
  create: () => Promise<void>;
  retrySource: (sourceId: string) => Promise<void>;
};

/** Creates the project and assigns its people. Guarded so a retry never creates a second project. */
async function ensureProject(input: CreateInput): Promise<string> {
  const { draft } = input;
  if (draft.createdProjectId) return draft.createdProjectId;

  const project = await projectService.createProject({
    name: input.trimmedName,
    description: draft.description.trim() || undefined,
    industry: draft.industry.trim() || undefined,
  });

  // Members before the manager: assigning a manager also makes them a member,
  // so the reverse order would depend on the id order.
  let members = project.users;
  if (draft.selectedUserIds.size > 0) {
    members = await projectService.assignUsersToProject(project.id, {
      userIds: [...draft.selectedUserIds],
    });

    if (input.movedCount > 0) input.onMembershipsMoved?.();
  }

  // Setting the manager returns the full, backend-authoritative details
  // (manager plus the complete member list), so prefer that response. Without
  // a manager, the created-project response predates the member assignment, so
  // the members are folded back in before the page adds it to its list.
  const finalProject = draft.managerId
    ? await projectService.setProjectManager(project.id, draft.managerId)
    : { ...project, users: members };

  draft.setCreatedProjectId(project.id);
  input.onProjectCreated(finalProject);

  return project.id;
}

type Toast = ReturnType<typeof useToast>;

function reportConnected(toast: Toast, connected: DraftSource[]): void {
  if (hasFailedSources(connected)) {
    // The project is saved; the failed rows stay on the provisioning screen
    // with a retry. The per-source rows show which failed; the toast sums up.
    toast.warning("Project created", { description: "Some sources couldn't be connected." });
  } else {
    toast.success("Project created", { description: connectOutcomeDescription(connected) });
  }
}

function reportRetried(toast: Toast, retried: DraftSource[]): void {
  if (hasFailedSources(retried)) {
    toast.error("Couldn't connect the source.");
  } else {
    toast.success("Source connected", { description: connectOutcomeDescription(retried) });
  }
}

/**
 * The commit and the per-source retry. The commit drives the provisioning screen, the one place real
 * work happens; because creating the project and connecting its sources are separate calls, a
 * source failure cannot roll the project back, so a retry reuses the already-created project.
 */
export function useCreateProject(input: CreateInput): CreateProject {
  const { draft, setPhase } = input;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const reportFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Couldn't create the project.";

    // A name clash the client list missed comes back here (the project was
    // never created). Send the user to Details with the field flagged rather
    // than only flashing a toast they have to decode.
    if (!draft.createdProjectId && isNameClashMessage(message)) {
      setPhase("details");
      draft.setNameTouched(true);
      draft.setNameServerError("A project with this name already exists.");
    } else {
      toast.error(message);
    }
  };

  const create = async () => {
    if (isSubmitting) return;

    // A shortcut ("Create, skip review") could fire with an invalid name; send
    // the user back to Details with the error rather than failing silently.
    if (!input.isNameValid) {
      setPhase("details");
      draft.setNameTouched(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const projectId = await ensureProject(input);

      if (draft.sources.length === 0) {
        input.onFinish();
        toast.success("Project created");
        return;
      }

      setPhase("provisioning");
      reportConnected(toast, await connectDraftSources(projectId, draft.sources, draft.setSources));
    } catch (error) {
      reportFailure(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const retrySource = async (sourceId: string) => {
    const source = draft.sources.find((current) => current.id === sourceId);
    if (!source || !draft.createdProjectId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const retried = await connectDraftSources(draft.createdProjectId, [source], (progress) =>
        draft.setSources((current) =>
          current.map(
            (currentSource) =>
              progress.find((entry) => entry.id === currentSource.id) ?? currentSource,
          ),
        ),
      );

      reportRetried(toast, retried);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, create, retrySource };
}
