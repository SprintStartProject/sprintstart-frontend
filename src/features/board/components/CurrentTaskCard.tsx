import { AlertTriangle, ExternalLink, Target } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { Marked } from "./Marked";
import { useCardMarks } from "../marks/useCardMarks";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { AddTaskToBoard } from "./AddTaskToBoard";
import type { BoardCard, CurrentTaskContent } from "../types";

type CurrentTaskCardProps = {
  content: CurrentTaskContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  /** Told when the hire makes a checklist out of this task, so the board can re-read itself. */
  onCardAdded?: () => void;
};

/**
 * The task the hire is on.
 *
 * The subtitle distinguishes a task they *chose* from one they were *handed* — only one of those is
 * theirs to change their mind about, and being told which is which is the difference between "this
 * is your call" and "somebody assigned you this".
 *
 * With no task the card stays and says so, rather than disappearing: it vanishing when a goal is
 * cleared would read as the board losing things, and "you have nothing on" is usually the thing
 * worth fixing.
 *
 * A task whose issue was closed where it lives also stays, rather than disappearing or quietly
 * looking current: the task block is kept but muted, a warning stripe above it says what happened
 * and where to go next, and the buddy question is repointed at picking a new one. Silently
 * dropping the card would leave the hire still thinking this is their goal.
 */
export function CurrentTaskCard({
  content,
  card,
  onDismiss,
  dismissing,
  onCardAdded,
}: CurrentTaskCardProps) {
  const hasTask = content.taskId !== null;
  const closed = hasTask && content.closedAtSource;
  // A live card, so its highlights are matched by their words rather than written into the text —
  // see `marks/cardMarks.ts`. The title and the summary are re-read from the tracker on every
  // board load, and a sentence that survives that stays marked.
  const marks = useCardMarks().marksFor(card.id);

  return (
    <BoardCardFrame
      icon={Target}
      title="What you're working on"
      card={card}
      subtitle={hasTask ? (closed ? "Closed where it lives" : "You picked this one") : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {hasTask ? (
        <div>
          {closed && (
            <p className="flex items-start gap-2 rounded-xl bg-app-warning-bg/40 p-3 text-xs text-app-warning-text">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                This issue was closed where it lives. Pick a new task from the &quot;Good next
                tasks&quot; card.
              </span>
            </p>
          )}
          <p
            className={`text-sm font-medium ${closed ? "mt-3 text-app-text-muted line-through" : "text-app-text"}`}
          >
            <Marked text={content.title ?? ""} marks={marks} cardId={card.id} />
          </p>
          {content.summary && (
            <p className="mt-1 text-sm text-app-text-muted">
              <Marked text={content.summary} marks={marks} cardId={card.id} />
            </p>
          )}
          {content.url && (
            <a
              href={content.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-app-brand-text hover:underline"
            >
              Read the issue
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      ) : (
        <EmptyState size="sm">
          Nothing claimed yet. Ask your buddy what would be a good one to pick up — they can suggest
          tasks that fit what you&apos;ve already shown.
        </EmptyState>
      )}

      {/* A working copy of the task, on the hire's own board, that they may break down and tick
          off. This card is a live read they cannot edit, and the steps somebody thinks up while
          reading a task have to go somewhere. It changes nothing about the task — see
          `generation/taskChecklist.ts`. */}
      {hasTask && content.title && (
        <div className="mt-3">
          <AddTaskToBoard
            title={content.title}
            summary={content.summary}
            url={content.url}
            onAdded={onCardAdded}
            // This card asks the mentor for first steps in its own words below. A second button
            // opening the same conversation with the same question is one button too many.
            offerToAsk={false}
          />
        </div>
      )}

      {/* "How do I start this" is what makes the mentor offer to assemble the orientation
                packet, so the card needs no orientation action of its own.

                It asks for a checklist, which is not decoration: a task that states no steps of
                its own gets them here or nowhere, and the offer to keep a reply as a card only
                appears under a reply that holds a list. See `AddTaskToBoard`. */}
      <AskTheBuddy
        question={
          closed
            ? `My task "${content.title ?? "my task"}" was closed. Which one should I take instead?`
            : hasTask
              ? `How do I get started on "${content.title ?? "my task"}"? A short checklist of first steps would help.`
              : "What would be a good task for me to pick up?"
        }
        label={closed ? "Help me pick another one" : undefined}
      />
    </BoardCardFrame>
  );
}
