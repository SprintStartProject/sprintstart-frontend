import type { ProjectManager } from "../../../../services/projectService";
import { getDisplayName } from "../../data";
import type { getMovedUsers } from "../../projectMove";
import type { AdminUser } from "../../types";
import { sortOwnerOptions } from "./addSourceKit";
import type { ReviewPerson } from "./steps/WizardReviewStep";

/** The four editable steps plus the terminal provisioning screen. */
export type WizardPhase = "details" | "members" | "sources" | "review" | "provisioning";

export const STEP_LABELS = ["Details", "Members", "Sources", "Review"];

const STEP_PHASES = ["details", "members", "sources", "review"] as const;

export const STEP_INDEX: Record<Exclude<WizardPhase, "provisioning">, number> = {
  details: 0,
  members: 1,
  sources: 2,
  review: 3,
};

type NameState = {
  trimmedName: string;
  isNameValid: boolean;
  nameError: string;
};

/**
 * What the Details step shows about the name. A case-insensitive clash with an existing project
 * counts only once something is typed; a conflict the backend reported at commit takes precedence
 * over both other messages; "required" appears only after the field was left or Continue was tried,
 * so the step never opens already showing red.
 */
export function nameState(
  name: string,
  existingProjectNames: string[],
  touched: boolean,
  serverError: string,
): NameState {
  const trimmedName = name.trim();
  const collision =
    trimmedName.length > 0 &&
    existingProjectNames.some(
      (existing) => existing.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

  let nameError = "";
  if (serverError) nameError = serverError;
  else if (collision) nameError = "A project with this name already exists.";
  else if (touched && trimmedName.length === 0) nameError = "Name is required.";

  return { trimmedName, isNameValid: trimmedName.length > 0 && !collision, nameError };
}

/** Whether the backend's message says the name is taken — a clash the client list missed. */
export function isNameClashMessage(message: string): boolean {
  return /name.*(exist|taken|already|duplicate)/i.test(message);
}

type DraftFields = {
  name: string;
  description: string;
  industry: string;
  managerId: string;
  selectedUserIds: ReadonlySet<string>;
  sourceCount: number;
};

/**
 * Anything the user has drafted that a close would throw away. The provisioning screen is excluded
 * by the caller — the project already exists there, so there is nothing to discard.
 */
export function isDraftDirty(draft: DraftFields): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.description.trim().length > 0 ||
    draft.industry.trim().length > 0 ||
    Boolean(draft.managerId) ||
    draft.selectedUserIds.size > 0 ||
    draft.sourceCount > 0
  );
}

/**
 * The manager for Review, resolved from the user directory when possible so the avatar matches the
 * one shown elsewhere; the manager-candidate list has no profile icon, so a candidate-only manager
 * falls back to a name-seeded one.
 */
export function resolveReviewManager(
  users: AdminUser[],
  candidates: ProjectManager[],
  managerId: string,
): ReviewPerson | null {
  if (!managerId) return null;

  const fromDirectory = users.find((user) => user.id === managerId);
  if (fromDirectory) {
    return {
      id: fromDirectory.id,
      name: getDisplayName(fromDirectory),
      profileIcon: fromDirectory.profileIcon,
    };
  }

  const candidate = candidates.find((current) => current.id === managerId);
  if (!candidate) return null;

  const fullName = `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim();
  return { id: candidate.id, name: fullName || candidate.username };
}

/** Members shown on Review, excluding the manager (rendered separately there). */
export function resolveReviewMembers(
  users: AdminUser[],
  selectedUserIds: ReadonlySet<string>,
  managerId: string,
  movedUsers: ReturnType<typeof getMovedUsers>,
): ReviewPerson[] {
  const leavingByUserId = new Map(
    movedUsers.map(({ user, leaving }) => [user.id, leaving.map((project) => project.name)]),
  );

  return users
    .filter((user) => selectedUserIds.has(user.id) && user.id !== managerId)
    .map((user) => ({
      id: user.id,
      name: getDisplayName(user),
      profileIcon: user.profileIcon,
      movedFrom: leavingByUserId.get(user.id),
    }));
}

/** Everyone the project is created with: the ticked members, plus the manager, who becomes one. */
export function memberCountOf(selectedUserIds: ReadonlySet<string>, managerId: string): number {
  return selectedUserIds.size + (managerId && !selectedUserIds.has(managerId) ? 1 : 0);
}

/**
 * Who a staged repository can be handed to: the people this project is being created with. The
 * whole directory would be the wrong list — an owner who is not on the project cannot be told about
 * the gap, and the Members step is right behind this one, so a missing name is a step back rather
 * than a dead end. The manager is included even when they were not ticked as a member, because
 * setting them as manager makes them one.
 */
export function ownerOptionsFor(
  users: AdminUser[],
  selectedUserIds: ReadonlySet<string>,
  managerId: string,
) {
  return sortOwnerOptions(
    users
      .filter((user) => selectedUserIds.has(user.id) || user.id === managerId)
      .map((user) => ({ value: user.id, label: getDisplayName(user) })),
  );
}

export function previousPhase(phase: WizardPhase): WizardPhase {
  if (phase === "members") return "details";
  if (phase === "sources") return "members";
  if (phase === "review") return "sources";
  return phase;
}

export function nextPhase(phase: WizardPhase): WizardPhase {
  if (phase === "details") return "members";
  if (phase === "members") return "sources";
  if (phase === "sources") return "review";
  return phase;
}

/** The step the stepper's index names, or null for an index outside the four. */
export function phaseAtStep(index: number): WizardPhase | null {
  return STEP_PHASES[index] ?? null;
}

/** The stepper position: provisioning stays on the last step. */
export function stepIndexOf(phase: WizardPhase): number {
  return phase === "provisioning" ? STEP_INDEX.review : STEP_INDEX[phase];
}

type AddFormView = { isOpen: boolean; step: string };

/**
 * Announced to screen readers on every screen change, and used as the target for focus so keyboard
 * users land at the top of the new content rather than keeping focus on the footer button they just
 * pressed.
 */
export function screenAnnouncementFor(phase: WizardPhase, addForm: AddFormView): string {
  if (phase === "provisioning") return "Creating project";
  if (addForm.isOpen) {
    return addForm.step === "type"
      ? "Add a source: choose a type"
      : "Add a source: enter the details";
  }
  const index = stepIndexOf(phase);
  return `Step ${index + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[index]}`;
}

export function skipLabelFor(sourceCount: number): string {
  return sourceCount === 0 ? "Create without sources" : "Create, skip review";
}
