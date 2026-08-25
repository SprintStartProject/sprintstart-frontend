import { ExternalLink, GitPullRequest } from "lucide-react";
import { formatDuration } from "../../onboarding-metrics/format";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, OpenPullRequestsContent } from "../types";

type OpenPullRequestsCardProps = {
  content: OpenPullRequestsContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
};

/** A wait long enough that it is worth saying out loud rather than just showing. */
const LONG_WAIT_HOURS = 48;

/**
 * The hire's still-open pull requests, longest-waiting first.
 *
 * A long wait is flagged as *the review* being outstanding, not as the hire being slow — receiving
 * a response is the barrier newcomers actually hit, and the fix is a conversation with a reviewer.
 *
 * Three states, and they are genuinely different: nothing open, something open, and "I can't tell"
 * — the last only when no GitHub username has been declared, which is the one of the three the hire
 * can fix themselves.
 */
export function OpenPullRequestsCard({
  content,
  card,
  onDismiss,
  dismissing,
}: OpenPullRequestsCardProps) {
  const { pullRequests, attributionMissing } = content;

  return (
    <BoardCardFrame
      icon={GitPullRequest}
      title="Your open pull requests"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
      subtitle={
        pullRequests.length > 0
          ? `${pullRequests.length} open`
          : attributionMissing
            ? undefined
            : "Nothing waiting on anyone"
      }
    >
      {attributionMissing ? (
        <EmptyState size="sm">
          No GitHub username on your profile yet, so I can&apos;t tell which pull requests are
          yours. Add it on your profile and this fills itself in.
        </EmptyState>
      ) : pullRequests.length === 0 ? (
        <EmptyState size="sm">
          Nothing open right now. When you open one it shows up here, with how long it has been
          waiting.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {pullRequests.map((pullRequest) => {
            const waiting = pullRequest.waitingHours;
            const longWait = waiting !== null && waiting >= LONG_WAIT_HOURS;
            return (
              <li
                key={pullRequest.artifactId}
                className={`rounded-xl border p-3 ${
                  longWait ? "border-app-warning-border bg-app-warning-bg/30" : "border-app-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm text-app-text">
                    <span className="font-medium tabular-nums">
                      {pullRequest.number ? `#${pullRequest.number}` : "PR"}
                    </span>{" "}
                    {pullRequest.title ?? "Untitled"}
                  </p>
                  {pullRequest.url && (
                    <a
                      href={pullRequest.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-app-text-muted transition hover:text-app-text"
                      aria-label={`Open pull request ${pullRequest.number ?? ""} on GitHub`}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>
                {waiting !== null && (
                  <p
                    className={`mt-1 text-xs ${
                      longWait ? "text-app-warning-text" : "text-app-text-muted"
                    }`}
                  >
                    Waiting {formatDuration(waiting)} for a first review
                    {longWait && " — worth a nudge, or ask your buddy who to ask"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!attributionMissing && (
        <AskTheBuddy
          question={
            pullRequests.length > 0
              ? "Is one of my pull requests stuck, and who should I ask about it?"
              : "What should I be working on so I have something open?"
          }
        />
      )}
    </BoardCardFrame>
  );
}
