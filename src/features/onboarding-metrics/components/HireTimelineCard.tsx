import { CONTRIBUTION_WORDING } from "../../../config/contributionWording";
import { Check, ChevronRight, Clock, GitMerge } from "lucide-react";
import type { HireTimeline } from "../types";
import { Badge } from "../../../components/ui/Badge";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { formatDuration, formatMoment } from "../format";
import { isAwaitingFirstResponse } from "../hireStatus";
import { gapHours, hireMoments } from "../moments";

type HireTimelineCardProps = {
  hire: HireTimeline;
  /** Opens the hire in the PM area's member side panel; without it the name is plain text. */
  onOpenMember?: (userId: string) => void;
};

/**
 * One hire's onboarding timeline: joined → task claimed → work submitted → first
 * response → accepted, with the gap between each pair of moments that has actually
 * happened. An unreached moment is a hollow, dashed dot and a dash, never a zero.
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
export function HireTimelineCard({ hire, onOpenMember }: HireTimelineCardProps) {
  const {
    noun: contributionNoun,
    nounPlural: contributionNounPlural,
    verbPast: contributionVerbPast,
  } = CONTRIBUTION_WORDING;
  const moments = hireMoments(hire);

  // Something is in flight, was started, but nobody has responded: the wait is on somebody else.
  const awaitingReview = isAwaitingFirstResponse(hire);

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors ${
        hire.stalled
          ? "border-app-orange-border bg-app-surface"
          : "border-app-border bg-app-surface"
      }`}
    >
      {/* Two columns: everything about the hire on the left, the status badges
          stacked in the top-right corner on the right. */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* Name row. */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-app-surface-muted">
              <UserAvatar size={40} fallbackName={hire.displayName} seed={hire.userId} />
            </span>
            <div className="min-w-0">
              {onOpenMember ? (
                <button
                  type="button"
                  onClick={() => onOpenMember(hire.userId)}
                  className="group inline-flex max-w-full items-center gap-1 rounded-md text-left text-base font-semibold text-app-text hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  <span className="truncate">{hire.displayName}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              ) : (
                <p className="truncate text-base font-semibold text-app-text">{hire.displayName}</p>
              )}
              {hire.stalled && hire.stalledReason && (
                <p className="text-xs font-medium text-app-orange-text">{hire.stalledReason}</p>
              )}
              {hire.githubLogin ? (
                <p className="text-xs text-app-text-muted">@{hire.githubLogin}</p>
              ) : (
                <p className="text-xs text-app-text-subtle">
                  No GitHub login — work can&apos;t be attributed
                </p>
              )}
            </div>
          </div>

          {/* Moment rail: a reached moment is a filled brand node with a tick; an
              unreached one is a dashed hollow node. The connector between two nodes
              fills brand only once the later moment is reached, and carries the gap. */}
          <ol className="mt-4 flex items-start overflow-x-auto pb-1">
            {moments.map((moment, index) => {
              const reached = moment.at !== null;
              const nextReached = index < moments.length - 1 && moments[index + 1].at !== null;
              const gap =
                index < moments.length - 1 ? gapHours(moment.at, moments[index + 1].at) : null;
              const StepIcon = moment.icon;
              return (
                <li key={moment.label} className="flex min-w-0 items-start">
                  <div className="flex w-20 shrink-0 flex-col items-center px-1 text-center">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        reached
                          ? "border-app-brand bg-app-brand text-white"
                          : "border-dashed border-app-border bg-app-surface text-app-text-subtle"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span
                      className={`mt-2 text-xs leading-tight font-medium ${
                        reached ? "text-app-text" : "text-app-text-subtle"
                      }`}
                    >
                      {moment.label}
                    </span>
                    <span className="mt-0.5 flex items-center gap-0.5 text-[11px] text-app-text-muted">
                      {reached && (
                        <Check className="h-3 w-3 text-app-success-solid" aria-hidden="true" />
                      )}
                      {formatMoment(moment.at)}
                    </span>
                  </div>

                  {index < moments.length - 1 && (
                    <div className="flex min-w-[3rem] flex-1 flex-col items-center pt-4">
                      <span
                        className={`h-0.5 w-full rounded-full ${
                          nextReached ? "bg-app-brand" : "bg-app-border"
                        }`}
                        aria-hidden="true"
                      />
                      {gap !== null && (
                        <span className="mt-1 text-[10px] font-medium text-app-text-muted">
                          {formatDuration(gap)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Right column: the two badges stacked in the top-right corner. */}
        {(hire.acceptedContributionCount > 0 ||
          (awaitingReview && hire.longestOpenWaitHours !== null)) && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {hire.acceptedContributionCount > 0 && (
              <Badge variant="success" className="gap-1.5">
                <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                {hire.acceptedContributionCount}{" "}
                {hire.acceptedContributionCount === 1 ? contributionNoun : contributionNounPlural}{" "}
                {contributionVerbPast}
              </Badge>
            )}
            {awaitingReview && hire.longestOpenWaitHours !== null && (
              <Badge variant="orange" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Waiting {formatDuration(hire.longestOpenWaitHours)} on a response
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
