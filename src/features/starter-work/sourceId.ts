/**
 * Turns an ingested issue's raw `sourceId` and `tracker` into the pieces a reader actually wants to
 * see, instead of one opaque string like `github:SprintStartProject/sprintstart-backend:ISSUE:103`.
 *
 * The number (`#103` for GitHub, a key like `ONB-2` for Jira) is the thing a person cites, so it
 * reads as a badge. Owner and repo are context, so they read as plain text. Nothing here parses
 * strictly: an id whose shape we do not recognise degrades to "no repo, last segment is the number"
 * rather than throwing, because a browsable row must never fail to render over a formatting guess.
 */

const TRACKER_LABELS: Record<string, string> = {
  GITHUB: "GitHub",
  JIRA: "Jira",
};

/** A tracker code (`GITHUB`) shown the way people write it (`GitHub`); unknown codes pass through. */
export function trackerLabel(tracker: string): string {
  return TRACKER_LABELS[tracker.toUpperCase()] ?? tracker;
}

/**
 * Whether a tracker code is one we render structured (GitHub/Jira) rather than a hand-authored
 * source. A task from an unknown tracker has no reliable number or repo to show, so it reads as
 * "Custom" instead. Kept here beside `trackerLabel` so the three cards that show source meta share
 * one definition rather than each re-deriving it.
 */
export function isKnownTracker(tracker: string): boolean {
  return tracker.toUpperCase() in TRACKER_LABELS;
}

export type ParsedSource = {
  /** `#103`, or a tracker key like `ONB-2`, or null when the id carries no trailing identifier. */
  numberLabel: string | null;
  owner: string | null;
  repo: string | null;
  /** `owner/repo` when both are present, for a single muted line. */
  repoLabel: string | null;
  /** The tracker code from the id's first segment (`GITHUB`); `""` when the id is empty. */
  trackerCode: string;
  /** Whether `trackerCode` is one we recognise, so number and repo are safe to show as badges. */
  hasKnownTracker: boolean;
  /**
   * What groups this source with the other issues from the same place: `owner/repo` for GitHub,
   * a Jira project key (`ONB` from `ONB-2`) for Jira, or null when the id carries neither —
   * a hand-authored task, say, which belongs to no project's corpus.
   */
  groupKey: string | null;
};

/** The Jira project key prefixing an issue key (`ONB` from `ONB-2`), or null when it doesn't match. */
function jiraProjectKey(issueKey: string): string | null {
  return /^([A-Za-z][A-Za-z0-9]*)-\d+$/.exec(issueKey)?.[1] ?? null;
}

const ISSUE_PREFIX_SEPARATOR = /^\s*[:\-–—]\s*/;

/**
 * Strips a redundant "Issue #103" (or "Issue ONB-2") lead-in from a title when it already restates
 * the source badge's own number — the badge already says it, so repeating it in the title is just
 * noise. Display only: callers keep showing the full, untouched title in a tooltip or the drawer.
 */
export function stripRedundantIssuePrefix(title: string, numberLabel: string | null): string {
  if (!numberLabel) return title;

  const trimmed = title.trim();
  const prefix = `issue ${numberLabel}`.toLowerCase();
  if (!trimmed.toLowerCase().startsWith(prefix)) return title;

  const rest = trimmed.slice(prefix.length).replace(ISSUE_PREFIX_SEPARATOR, "").trim();
  return rest || title;
}

export function parseCandidateSource(sourceId: string): ParsedSource {
  const parts = sourceId.split(":");
  const trackerCode = parts[0] ?? "";
  const repoSegment = parts.find((part) => part.includes("/")) ?? null;

  let owner: string | null = null;
  let repo: string | null = null;
  if (repoSegment) {
    const slash = repoSegment.indexOf("/");
    owner = repoSegment.slice(0, slash) || null;
    repo = repoSegment.slice(slash + 1) || null;
  }

  const last = parts.length > 0 ? parts[parts.length - 1] : "";
  let numberLabel: string | null = null;
  if (last && last !== repoSegment) {
    numberLabel = /^\d+$/.test(last) ? `#${last}` : last;
  }

  const repoLabel = owner && repo ? `${owner}/${repo}` : repoSegment;

  return {
    numberLabel,
    owner,
    repo,
    repoLabel,
    trackerCode,
    hasKnownTracker: isKnownTracker(trackerCode),
    groupKey: repoLabel ?? (numberLabel ? jiraProjectKey(numberLabel) : null),
  };
}
