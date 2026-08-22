export const PermissionGroup = {
  USER: "USER",
  PM: "PM",
  HR: "HR",
  ADMIN: "ADMIN",
} as const;
export type PermissionGroup = (typeof PermissionGroup)[keyof typeof PermissionGroup];

export const DocumentStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export type DocumentMetadata = {
  id: string;
  name: string;
  mime: string;
  size?: number;
  status: DocumentStatus;
  uploadDate: string;
};

export type UploadResult = {
  id: string;
  filename: string;
  status: "ok" | "failed";
  error?: string;
};

export interface ProjectRoleSummary {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  authId: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  projectRoles: ProjectRoleSummary[];
  projectIds: string[];
  permissionGroup: PermissionGroup;
  enabled: boolean;
  profileIcon: string | null;
  hasCompletedOnboarding: boolean;
  /**
   * The GitHub account this user contributes as, lower-cased, or null if they
   * haven't declared one. Artifact-tier onboarding checks attribute a submitted
   * pull request to its author, so a hire can't pass one without this set.
   */
  githubLogin?: string | null;
  /**
   * How the login was established. Nothing here proves account ownership --
   * `SELF_DECLARED` is the user's own claim, `PM_CONFIRMED` was set by a PM.
   */
  githubLoginSource?: GithubLoginSource | null;
  /**
   * What GitHub said about whether `githubLogin` exists, or null when nobody
   * has an answer.
   *
   * Null is not a negative. It covers three cases that need no distinguishing
   * because the action for all of them is the same -- try again later: never
   * checked, checked and GitHub would not say, and no login declared at all.
   * Only a definitive answer is ever recorded, and rendering null as "not found"
   * would tell somebody their perfectly good username does not exist.
   *
   * Cleared whenever the login changes, so a verdict never outlives the value it
   * was about. It is written by the arrival step check, not by saving a profile.
   */
  githubLoginVerification?: GithubLoginVerification | null;
  /** When that verdict was reached. Null exactly when the verdict is. */
  githubLoginVerifiedAt?: string | null;
  /**
   * The name this user appears under in a connected issue tracker, or null if
   * they haven't declared one.
   *
   * The tracker counterpart of `githubLogin`, and what lets work that never
   * becomes a pull request be *observed* rather than vouched for: an issue
   * assigned to this name and moved to done by somebody else is evidence nobody
   * had to attest.
   *
   * No verification field beside it, and that is not an omission. GitHub can
   * be asked whether an account exists; a tracker renders whatever name a person
   * set, so "does this name exist" has no answer worth showing. The risk it does
   * carry -- a namesake in the tracker -- is one no check would catch.
   */
  jiraDisplayName?: string | null;
}

export type GithubLoginSource = "SELF_DECLARED" | "PM_CONFIRMED";

/**
 * Whether the declared GitHub account exists.
 *
 * Worth surfacing because this value is what artifact verification compares a
 * pull request's author against: a typo does not fail loudly, it silently stops
 * crediting work the hire really did, while leaving them reading as calm rather
 * than blocked.
 */
export type GithubLoginVerification = "VERIFIED" | "NOT_FOUND";
