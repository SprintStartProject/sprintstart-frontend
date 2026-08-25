import { ExternalLink, Target } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, CurrentTaskContent } from "../types";

type CurrentTaskCardProps = {
  content: CurrentTaskContent;
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
 * The task the hire is on.
 *
 * The subtitle distinguishes a task they *chose* from one they were *handed* — only one of those is
 * theirs to change their mind about, and being told which is which is the difference between "this
 * is your call" and "somebody assigned you this".
 *
 * With no task the card stays and says so, rather than disappearing: it vanishing when a goal is
 * cleared would read as the board losing things, and "you have nothing on" is usually the thing
 * worth fixing.
 */
export function CurrentTaskCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
  collapsed,
  onToggleCollapsed,
}: CurrentTaskCardProps) {
  const hasTask = content.taskId !== null;

  return (
    <BoardCardFrame
      icon={Target}
      title="What you're working on"
      card={card}
      subtitle={
        hasTask
          ? content.chosen
            ? "You picked this one"
            : "Handed to you as a first task"
          : undefined
      }
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      {hasTask ? (
        <div>
          <p className="text-sm font-medium text-app-text">{content.title}</p>
          {content.summary && <p className="mt-1 text-sm text-app-text-muted">{content.summary}</p>}
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

      {/* "How do I start this" is what makes the mentor offer to assemble the orientation
                packet, so the card needs no orientation action of its own. */}
      <AskTheBuddy
        question={
          hasTask
            ? `How do I get started on "${content.title ?? "my task"}"?`
            : "What would be a good task for me to pick up?"
        }
      />
    </BoardCardFrame>
  );
}
