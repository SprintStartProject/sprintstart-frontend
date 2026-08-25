/**
 * The numbers onboarding is judged on, as the backend derives them. Every timestamp and gap is
 * nullable: "hasn't happened yet" is the normal state of a hire mid-ramp, and is a different
 * thing from zero.
 *
 * Deliberately no completion percentages. Progress is what somebody has proven, not how far
 * through a list they are.
 */

/** One hire's onboarding as a sequence of moments and the gaps between them. */
export type HireTimeline = {
  userId: string;
  displayName: string;
  /** Null when no GitHub login is declared, so none of their pull requests can be attributed. */
  githubLogin: string | null;
  /** Null for assignments made before joining was recorded — "clock unknown", not "joined now". */
  joinedAt: string | null;
  firstTaskClaimedAt: string | null;
  /** When they first put work up for somebody else to look at, whatever kind of work it is. */
  firstContributionOpenedAt: string | null;
  firstResponseAt: string | null;
  /** When their first piece of work was accepted through the team's normal quality bar. */
  firstContributionAcceptedAt: string | null;
  /** Joined → first accepted contribution, in hours. The north star, per hire. */
  hoursToFirstAcceptedContribution: number | null;
  /** Opened → first response on their first contribution, in hours. */
  hoursToFirstResponse: number | null;
  acceptedContributionCount: number;
  /** Submitted and still waiting on somebody else. */
  openContributionCount: number;
  /** Their longest contribution currently waiting on anyone, in hours. */
  longestOpenWaitHours: number | null;
  stalled: boolean;
  /** What the stall is attributed to, in plain words; null when not stalled. */
  stalledReason: string | null;
};

/** A project's onboarding health: medians throughout, plus every hire's timeline. */
export type ProjectOnboardingMetrics = {
  projectId: string;
  memberCount: number;
  /**
   * Members with no declared GitHub login — their pull requests cannot be attributed.
   *
   * Narrower than the name reads: somebody who declared a tracker name but no GitHub login has
   * attributable work and is still counted here. Widening it is a behaviour change, not a rename.
   */
  unattributableMemberCount: number;
  hiresWithAcceptedContribution: number;
  medianHoursToFirstAcceptedContribution: number | null;
  medianHoursToFirstResponse: number | null;
  /** The slow tail of review latency, where the barrier actually bites. */
  p90HoursToFirstResponse: number | null;
  stalledCount: number;
  waitingOnResponseCount: number;
  hires: HireTimeline[];
};

/**
 * Why one particular hire needs a human today (`GET /metrics/projects/{id}/attention`).
 *
 * The reason states whose move it is: a pull request kept waiting is somebody else's move,
 * not the hire's; a stall is the hire's. Reporting both as *the hire is behind* points the
 * attention at the one person who cannot fix it.
 */
export type AttentionItem = {
  hireId: string;
  hireName: string;
  reason: string;
  severity: AttentionSeverity;
  /** How long this has been true, in days — the thing that makes it urgent or not. */
  days: number;
};

export type AttentionSeverity = "BLOCKED" | "DRIFTING";

/** Who on the project is waiting or stalling, worst first. */
export type ProjectAttention = {
  projectId: string;
  memberCount: number;
  items: AttentionItem[];
};
