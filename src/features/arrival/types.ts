/**
 * Arrival steps: the things that have to be true before a hire can work.
 *
 * Accounts, access grants, a machine that builds. Onboarding assumed a hire already had all of it —
 * the GitHub username is a free-text field with no step behind it that gets you an account — so
 * somebody who could not clone the repository still got pointed at a task they could not start.
 *
 * Nothing here gates anything. An outstanding step changes what a hire is shown, never what
 * they may do. Being blocked by your employer must not also mean being blocked by the tool.
 */

/**
 * How a step was established, or how it is meant to be.
 *
 * Shared with the contribution stream deliberately, and the rule travels with it: rigor is never
 * blended in a readout. A step the system observed and a step somebody ticked are different
 * facts, and averaging them into one completion figure is exactly the defect that made the old
 * onboarding's progress number meaningless.
 *
 * `ATTESTED` exists in the backend enum as a slot for a named colleague confirming; nothing writes
 * it for arrival steps yet.
 */
export type Rigor = "OBSERVED" | "ATTESTED" | "DECLARED";

/** One arrival step, and whether this hire has settled it. */
export type ArrivalStep = {
  /** Stable key the step is known by. State is stored against this, so it never changes. */
  key: string;
  /** Null for a company-wide step; set when a project added it. */
  projectId: string | null;
  /**
   * The project's name, to group the hire's list under. Null for a company-wide step — and also
   * null on the authoring read, where the caller named the scope in its own request.
   *
   * A hire's list is a union across every project they are on, so without this somebody on two
   * projects sees *"Request staging access"* twice with nothing to tell the two apart. An id
   * cannot be a heading.
   */
  projectName: string | null;
  title: string;
  description: string | null;
  /** Where to go to actually do it, when there is such a place. */
  href: string | null;
  position: number;
  /** How this step is settled: `OBSERVED` by the system, or `DECLARED` by the hire. */
  settledBy: Rigor;
  /**
   * Whether the hire may settle this themselves, or only the system can.
   *
   * Not a synonym for `settledBy === 'DECLARED'`, and reading it as one is a real bug.
   * *"My machine builds"* is observable but never refutable, and the evidence lands days after it
   * mattered — so the hire's word is accepted even though a derivation exists. The GitHub check is
   * the opposite: definitive when it answers, so letting somebody tick it would let them declare
   * away the one fact their work being credited depends on. Same table, opposite answers.
   *
   * This is what gates the confirm button, because the backend rejects a confirmation it forbids
   * and an affordance whose only outcome is an error is worse than none.
   */
  selfConfirmable: boolean;
  settled: boolean;
  settledAt: string | null;
  /** How it was actually established for this hire; null while unsettled. */
  rigor: Rigor | null;
};

/**
 * The caller's steps, counted by how each was established.
 *
 * There is no total and no percentage, deliberately. See [Rigor]. A readout says
 * *"5 confirmed · 2 you told us · 2 outstanding"*, never one number standing for "how done are you".
 */
export type MyArrival = {
  steps: ArrivalStep[];
  /** Settled because the system observed it. */
  observedCount: number;
  /** Settled because the hire said so. */
  declaredCount: number;
  /** Not settled yet — a normal day-one state, not an error. */
  outstandingCount: number;
};

/**
 * A step the system knows how to check for itself, offered to whoever authors the list.
 *
 * The backend binds a step to its derivation by its `key`, so typing a catalog key into the
 * ordinary add form silently produces a derived step. Nothing is seeded — an admin adds the
 * ones their organisation wants.
 */
export type DerivableArrivalStep = {
  key: string;
  /** Suggested wording; the author may change it after adding. */
  suggestedTitle: string;
  suggestedDescription: string;
  /** Whether the hire may *also* settle it themselves — see `ArrivalStep.selfConfirmable`. */
  selfConfirmable: boolean;
  /** Whether this step is already on the list. */
  added: boolean;
};

/** Creating a step. Omitting `projectId` means company-wide, which is the usual case. */
export type CreateArrivalStepRequest = {
  key: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  href?: string | null;
  position?: number;
  settledBy?: Rigor;
};

/**
 * Updating a step. Omitted fields are left alone.
 *
 * No `key`: a hire's state points at it, so renaming one would orphan every record of having done
 * the step while leaving the row looking healthy.
 */
export type UpdateArrivalStepRequest = {
  title?: string;
  description?: string | null;
  href?: string | null;
  position?: number;
  settledBy?: Rigor;
};
