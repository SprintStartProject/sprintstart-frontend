import { CONTRIBUTION_WORDING } from "../../../config/contributionWording";
import { AlertTriangle, Clock, GitMerge } from "lucide-react";
import type { HireTimeline } from "../types";
import { formatDuration, formatMoment } from "../format";

type HireTimelineCardProps = {
  hire: HireTimeline;
};

type Moment = { label: string; at: string | null };

/** Track nouns arrive bare ("change", "facilitated") so a slot at the start of a label capitalises. */
function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Hours between two moments, when both have happened. */
function gapHours(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60));
}

/**
 * One hire's onboarding timeline: joined → task claimed → work submitted → first
 * response → accepted, with the gap between each pair of moments that has actually
 * happened. An unreached moment is a hollow dot and a dash, never a zero.
 *
 * The moments are named from the hire's own track, because the numbers behind them are composed
 * from contributions of any kind — only the wire field names still say "pull request". A Scrum
 * Master reading "PR opened" over their own ceremonies learns nothing except that the tool was not
 * built for them.
 *
 * Response latency is framed as waiting *on somebody else's move* — not as the
 * hire being slow, because "receiving a response" is the barrier (R1) and the fix
 * is a conversation with whoever owes it.
 *
 * Known contract gaps: there is no "environment ready" moment, and the timeline carries no
 * reviewer identity, so the wait is attributed to "a reviewer" generically rather than by name.
 */
export function HireTimelineCard({ hire }: HireTimelineCardProps) {
  const {
    noun: contributionNoun,
    nounPlural: contributionNounPlural,
    verbPast: contributionVerbPast,
  } = CONTRIBUTION_WORDING;
  const moments: Moment[] = [
    { label: "Joined", at: hire.joinedAt },
    { label: "Task claimed", at: hire.firstTaskClaimedAt },
    { label: `${capitalise(contributionNoun)} started`, at: hire.firstContributionOpenedAt },
    { label: "First response", at: hire.firstResponseAt },
    { label: capitalise(contributionVerbPast), at: hire.firstContributionAcceptedAt },
  ];

  // Something is in flight, was started, but nobody has responded: the wait is on somebody else.
  const awaitingReview =
    hire.firstContributionOpenedAt !== null &&
    hire.firstResponseAt === null &&
    hire.openContributionCount > 0;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        hire.stalled
          ? "border-app-warning-border bg-app-warning-bg/30"
          : "border-app-border bg-app-surface"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-app-text">{hire.displayName}</p>
          {hire.githubLogin ? (
            <p className="text-xs text-app-text-muted">@{hire.githubLogin}</p>
          ) : (
            <p className="text-xs text-app-text-subtle">
              No GitHub login — work can&apos;t be attributed
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hire.acceptedContributionCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-app-success-bg px-2 py-0.5 text-xs font-medium text-app-success-text">
              <GitMerge className="h-3 w-3" aria-hidden="true" />
              {hire.acceptedContributionCount}{" "}
              {hire.acceptedContributionCount === 1 ? contributionNoun : contributionNounPlural}{" "}
              {contributionVerbPast}
            </span>
          )}
          {awaitingReview && hire.longestOpenWaitHours !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Waiting {formatDuration(hire.longestOpenWaitHours)} on a response
            </span>
          )}
        </div>
      </div>

      {/* Moment rail: reached moments are filled and dated; the gap to the next
                reached moment sits on the connector. */}
      <ol className="flex flex-wrap items-start gap-y-3">
        {moments.map((moment, index) => {
          const reached = moment.at !== null;
          const gap =
            index < moments.length - 1 ? gapHours(moment.at, moments[index + 1].at) : null;
          return (
            <li key={moment.label} className="flex items-center">
              <div className="flex flex-col items-center px-1 text-center">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    reached ? "bg-app-brand" : "border border-app-border bg-app-surface"
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`mt-1 text-[11px] font-medium ${
                    reached ? "text-app-text" : "text-app-text-subtle"
                  }`}
                >
                  {moment.label}
                </span>
                <span className="text-[11px] text-app-text-muted">{formatMoment(moment.at)}</span>
              </div>

              {index < moments.length - 1 && (
                <div className="flex min-w-[2.5rem] flex-col items-center px-1">
                  <span className="h-px w-full bg-app-border" aria-hidden="true" />
                  {gap !== null && (
                    <span className="mt-0.5 text-[10px] text-app-text-muted">
                      {formatDuration(gap)}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {hire.stalled && hire.stalledReason && (
        <div className="mt-3 flex items-start gap-2 border-t border-app-warning-border/50 pt-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-app-warning-solid"
            aria-hidden="true"
          />
          <p className="text-xs text-app-text">{hire.stalledReason}</p>
        </div>
      )}
    </div>
  );
}
