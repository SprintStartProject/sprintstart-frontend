import { CONTRIBUTION_WORDING } from "../../../config/contributionWording";
import { AlertTriangle, CheckCircle2, Route } from "lucide-react";
import { formatMoment } from "../../onboarding-metrics/format";
import { momentLabel, pathSummary } from "../momentLabels";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, PathToFirstContributionContent } from "../types";

type PathCardProps = {
  content: PathToFirstContributionContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (cardId: string) => void;
};

/**
 * The path from joining to a first accepted piece of work.
 *
 * An unreached moment is a hollow dot and a dash — never a zero, because a milestone that has not
 * happened is not a milestone reached instantly.
 *
 * The stall reason is shown to the person in the stall, not only to their PM: a stall only somebody
 * else can see is a stall only somebody else can fix. It is framed as what is waiting, never as a
 * verdict on the hire.
 */
export function PathToFirstContributionCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
  collapsed,
  onToggleCollapsed,
}: PathCardProps) {
  const { acceptedCount, autonomyReachedAt, stalledReason } = content;

  return (
    <BoardCardFrame
      icon={Route}
      title="Your path here"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      subtitle={pathSummary(acceptedCount)}
    >
      <ol className="space-y-2">
        {content.moments.map((moment) => {
          const reached = moment.reachedAt !== null;
          return (
            <li key={moment.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  reached ? "bg-app-brand" : "border border-app-border-strong bg-transparent"
                }`}
              />
              <span
                className={`flex-1 text-sm ${reached ? "text-app-text" : "text-app-text-muted"}`}
              >
                {momentLabel(moment.key)}
              </span>
              <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
                {formatMoment(moment.reachedAt)}
              </span>
            </li>
          );
        })}
      </ol>

      {stalledReason && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-app-warning-bg/40 p-3 text-xs text-app-warning-text">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Something is waiting: {stalledReason}. Ask your buddy about it — this is the kind of
            thing a person unblocks in a minute.
          </span>
        </p>
      )}

      <AskTheBuddy
        question={
          stalledReason
            ? `Something seems stuck: ${stalledReason}. What should I do about it?`
            : `What is the next step for me toward my first ${CONTRIBUTION_WORDING.noun} here?`
        }
      />

      {autonomyReachedAt && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-app-success-bg/40 p-3 text-xs text-app-success-text">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            You worked unsupervised here on {formatMoment(autonomyReachedAt)} — a{" "}
            {CONTRIBUTION_WORDING.noun} accepted with no rework and no one stepping in. Onboarding
            ended that day.
          </span>
        </p>
      )}
    </BoardCardFrame>
  );
}
