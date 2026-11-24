import {
  getProjectEditFormState,
  getProjectSourcesCount,
  getProjectUsersCount,
  pluralize,
} from "../../data";
import {
  buildPeopleSnapshotKey,
  countPeopleChanges,
  resolvePeopleDraft,
  type PeopleDraft,
} from "../../peopleDraft";
import { getMovedUsers } from "../../projectMove";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectEditFormState,
  ProjectOverview,
  ProjectUser,
} from "../../types";

export const EMPTY_PROJECT_USERS: ProjectUser[] = [];

export function isSameDetails(left: ProjectEditFormState, right: ProjectEditFormState) {
  return left.name === right.name && left.description === right.description;
}

type DeriveInput = {
  project: ProjectOverview;
  projectDetails: AdminProjectDetails | null;
  draftProject: ProjectEditFormState;
  peopleDraft: PeopleDraft;
  availableUsers: AdminUser[];
};

/** Everything the drawer shows or decides that follows from the project, its drafts and the users. */
export function deriveDrawer(input: DeriveInput) {
  const { project, projectDetails, draftProject, peopleDraft, availableUsers } = input;

  const visibleProject = projectDetails ?? project;
  const visibleUsers = projectDetails?.users ?? EMPTY_PROJECT_USERS;
  const hasDetailsChanges = !isSameDetails(draftProject, getProjectEditFormState(visibleProject));

  const peopleSnapshotKey = buildPeopleSnapshotKey(visibleUsers, projectDetails?.manager ?? null);
  const activePeopleDraft = resolvePeopleDraft(peopleDraft, peopleSnapshotKey);
  const peopleChangeCount = countPeopleChanges(activePeopleDraft);
  const pendingChangeCount = peopleChangeCount + (hasDetailsChanges ? 1 : 0);

  return {
    visibleProject,
    visibleUsers,
    memberCount: getProjectUsersCount(visibleProject),
    sourceCount: getProjectSourcesCount(visibleProject),
    hasDetailsChanges,
    peopleSnapshotKey,
    activePeopleDraft,
    peopleChangeCount,
    pendingChangeCount,
    hasPendingChanges: pendingChangeCount > 0,
    // Staged additions that would take a regular user out of another project.
    movedUsers: getMovedUsers(availableUsers, activePeopleDraft.addedUserIds, project.id),
  };
}

export type Derived = ReturnType<typeof deriveDrawer>;

type SaveDecision = "name-required" | "confirm-move" | "save";

/** What pressing Save does: refuse a blank name, ask about people who leave other projects, or save. */
export function saveDecision(input: {
  hasDetailsChanges: boolean;
  name: string;
  movedCount: number;
}): SaveDecision {
  if (input.hasDetailsChanges && !input.name.trim()) return "name-required";
  return input.movedCount > 0 ? "confirm-move" : "save";
}

export function unsavedChangesLabel(count: number): string {
  return `${count} unsaved change${count === 1 ? "" : "s"}`;
}

export function memberBadgeLabel(count: number): string {
  return count > 0 ? pluralize(count, "member") : "No members";
}

export function sourceBadgeLabel(count: number): string {
  return count > 0 ? pluralize(count, "source") : "No sources";
}

export function moveDialogTitle(count: number): string {
  return count === 1 ? "Move 1 person?" : `Move ${count} people?`;
}

export function discardDescription(count: number): string {
  return `Leaving this project drops ${count === 1 ? "1 unsaved change" : `${count} unsaved changes`}.`;
}

/** The text of a failure, or the fallback when it is not an error. */
export function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
