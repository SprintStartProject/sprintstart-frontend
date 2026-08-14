import { ExternalLink } from "lucide-react";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, SuggestedTasksContent } from "../types";

type SuggestedTasksCardProps = {
  content: SuggestedTasksContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

/**
 * Good next tasks, best first.
 *
 * The reasons are rendered and the score is not — the ranker was built to explain itself in one
 * line per signal, and a number is not something a hire can act on. The order already carries
 * everything a score would say.
 *
 * Claiming is deliberately not a button here. It changes what the hire's whole plan aims at, so it
 * stays where every other onboarding-changing action is: proposed by the buddy, confirmed by the
 * hire, in the conversation.
 */
export function SuggestedTasksCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
}: SuggestedTasksCardProps) {
  return (
    <BoardCardFrame
      title="Good next tasks"
      card={card}
      subtitle={content.tasks.length > 0 ? "Best fit first" : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    >
      {content.tasks.length === 0 ? (
        <p className="text-sm text-app-text-muted">
          No starter tasks are ready for you yet. Your PM approves the ones that fit your role — ask
          your buddy if you want something to get started on in the meantime.
        </p>
      ) : (
        <ol className="space-y-3">
          {content.tasks.map((task) => (
            <li key={task.taskId} className="rounded-xl border border-app-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-app-text">{task.title}</p>
                {task.url && (
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-app-text-muted transition hover:text-app-text"
                    aria-label={`Open "${task.title}" on GitHub`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
              {/* Seeds the conversation rather than claiming here: claiming changes
                                what the hire's whole plan aims at, so it stays behind the mentor's
                                confirm button. */}
              <AskTheBuddy
                question={`I'd like to work on "${task.title}". Can you set that as my goal?`}
                label="I want to work on this"
              />
              {task.reasons.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {task.reasons.map((reason) => (
                    <li key={reason} className="text-xs text-app-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </BoardCardFrame>
  );
}
