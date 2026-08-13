import { ApiError } from "../../services/apiClient";
import { projectService } from "../../services/projectService";
import type { ProjectManager } from "../../services/projectService";
import type { ProjectUser } from "./types";

/**
 * Turns a failed manager assignment into an actionable message.
 *
 * The backend only accepts a manager who already holds the global PM role and
 * otherwise answers with a bare 400, which would surface to the admin as an
 * opaque "Bad request". The UI already blocks this case up front, so this is a
 * safety net that still names the concrete next step if the request slips
 * through (e.g. the user lost the role between load and save).
 */
function toManagerAssignmentError(error: unknown): Error {
  if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
    return new Error(
      "This user must have the Project Manager (PM) role before they can be assigned as project manager.",
    );
  }

  return error instanceof Error ? error : new Error("The project manager could not be assigned.");
}

/**
 * Pending people changes, expressed as a diff against a server snapshot.
 *
 * `snapshotKey` fingerprints the server state the diff was computed against, so
 * data arriving from elsewhere automatically invalidates a stale draft instead
 * of being silently applied on top of it. Same idiom as `ConnectorSourcesSection`.
 *
 * `managerId` is `undefined` while untouched, which is distinct from `null` —
 * the latter means "clear the manager assignment".
 */
export type PeopleDraft = {
  snapshotKey: string;
  addedUserIds: Set<string>;
  removedUserIds: Set<string>;
  managerId: string | null | undefined;
};

export function buildPeopleSnapshotKey(
  members: ProjectUser[],
  manager: ProjectManager | null,
): string {
  const memberIds = members
    .map((member) => member.id)
    .sort()
    .join(",");

  return `${memberIds}|${manager?.id ?? ""}`;
}

export function createEmptyPeopleDraft(snapshotKey: string): PeopleDraft {
  return {
    snapshotKey,
    addedUserIds: new Set(),
    removedUserIds: new Set(),
    managerId: undefined,
  };
}

/** Returns the draft if it still matches the snapshot, otherwise an empty one. */
export function resolvePeopleDraft(draft: PeopleDraft, snapshotKey: string): PeopleDraft {
  return draft.snapshotKey === snapshotKey ? draft : createEmptyPeopleDraft(snapshotKey);
}

export function countPeopleChanges(draft: PeopleDraft): number {
  return (
    draft.addedUserIds.size + draft.removedUserIds.size + (draft.managerId === undefined ? 0 : 1)
  );
}

/** Stages a user for assignment, or cancels a staged removal. */
export function stageAddUser(draft: PeopleDraft, userId: string): PeopleDraft {
  const addedUserIds = new Set(draft.addedUserIds);
  const removedUserIds = new Set(draft.removedUserIds);

  if (removedUserIds.has(userId)) {
    removedUserIds.delete(userId);
  } else {
    addedUserIds.add(userId);
  }

  return { ...draft, addedUserIds, removedUserIds };
}

/** Toggles a user between staged-for-removal and unchanged. */
export function stageToggleRemoveUser(draft: PeopleDraft, userId: string): PeopleDraft {
  const addedUserIds = new Set(draft.addedUserIds);
  const removedUserIds = new Set(draft.removedUserIds);

  if (addedUserIds.has(userId)) {
    addedUserIds.delete(userId);
  } else if (removedUserIds.has(userId)) {
    removedUserIds.delete(userId);
  } else {
    removedUserIds.add(userId);
  }

  return { ...draft, addedUserIds, removedUserIds };
}

export function stageManager(draft: PeopleDraft, managerId: string | null): PeopleDraft {
  return { ...draft, managerId };
}

/**
 * Applies a people draft to the backend.
 *
 * The order is load-bearing: additions run first so a newly added person can be
 * promoted in the same save, and removals run last because the backend rejects
 * removing whoever currently manages the project.
 */
export async function applyPeopleChanges(projectId: string, draft: PeopleDraft): Promise<void> {
  if (draft.addedUserIds.size > 0) {
    await projectService.assignUsersToProject(projectId, {
      userIds: [...draft.addedUserIds],
    });
  }

  if (draft.managerId !== undefined) {
    if (draft.managerId === null) {
      await projectService.clearProjectManager(projectId);
    } else {
      try {
        await projectService.setProjectManager(projectId, draft.managerId);
      } catch (error) {
        throw toManagerAssignmentError(error);
      }
    }
  }

  for (const userId of draft.removedUserIds) {
    await projectService.removeUserFromProject(projectId, userId);
  }
}
