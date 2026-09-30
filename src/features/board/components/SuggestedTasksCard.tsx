import { ExternalLink, Sparkles } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { Marked } from "./Marked";
import { useCardMarks } from "../marks/useCardMarks";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { AddTaskToBoard } from "./AddTaskToBoard";
import { GrabTaskButton } from "../../task-pool/components/GrabTaskButton";
import type { BoardCard, SuggestedTasksContent } from "../types";

type SuggestedTasksCardProps = {
  content: SuggestedTasksContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  /** Told when the hire makes a checklist out of one of these, so the board can re-read itself. */
  onCardAdded?: () => void;
};

/**
 * Good next tasks, best first.
 *
 * The reasons are rendered and the score is not — the ranker was built to explain itself in one
 * line per signal, and a number is not something a hire can act on. The order already carries
 * everything a score would say.
 *
 * Grabbing is a button here, with its own confirm step (see `GrabTaskButton`). It used to be
 * buddy-only — "I want to work on this" opened the conversation and the mentor proposed the claim —
 * but a hire who already knows what they want should not need a conversation to say so. The buddy
 * is still one press away, for the hire who wants a second opinion first.
 */
export function SuggestedTasksCard({
  content,
  card,
  onDismiss,
  dismissing,
  onCardAdded,
}: SuggestedTasksCardProps) {
  // Matched by their words: this list is re-ranked on every board read, so a highlight cannot be
  // pinned to a position. A reason the hire marked stays marked while it is still being given.
  const marks = useCardMarks().marksFor(card.id);

  return (
    <BoardCardFrame
      icon={Sparkles}
      title="Good next tasks"
      card={card}
      subtitle={content.tasks.length > 0 ? "From your starter work, best fit first" : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {content.tasks.length === 0 ? (
        <EmptyState size="sm">
          No starter tasks are ready for you yet. Your PM approves the ones that fit your role — ask
          your buddy if you want something to get started on in the meantime.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {content.tasks.map((task) => (
            <li key={task.taskId} className="rounded-xl border border-app-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-app-text">
                  <Marked text={task.title} marks={marks} cardId={card.id} />
                </p>
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
              {/* Grabbing is the commitment — it aims the hire's whole plan at the task. Keeping it
                  is a working copy on their own board that claims nothing, for a hire who is not
                  ready to commit but wants to find the task again. */}
              <div className="flex flex-wrap items-center gap-x-3">
                <div className="mt-3">
                  <GrabTaskButton taskId={task.taskId} title={task.title} />
                </div>
                <AskTheBuddy
                  question={`Is "${task.title}" a good fit for me? What would I need to know before I start?`}
                  label="Is this a good fit?"
                />
                <div className="mt-3">
                  <AddTaskToBoard title={task.title} url={task.url} onAdded={onCardAdded} />
                </div>
              </div>
              {task.reasons.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {task.reasons.map((reason) => (
                    <li key={reason} className="text-xs text-app-text-muted">
                      · <Marked text={reason} marks={marks} cardId={card.id} />
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
