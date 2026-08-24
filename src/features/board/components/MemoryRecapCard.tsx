import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, MemoryRecapContent } from "../types";

type MemoryRecapCardProps = {
  content: MemoryRecapContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

/**
 * What the buddy remembers about the hire.
 *
 * The conversation opens fresh every visit and this memory is what carries continuity across the
 * gap — so until now the hire could not see what their mentor thinks it knows about them, let alone
 * say it was wrong. This card is that memory made visible.
 *
 * It is the only card whose words a model wrote, and it says so. The framing is deliberate: "your
 * buddy's notes", attributed, in the mentor's voice — not "about you" in the app's voice, which
 * would present a model's summary as a record. And it invites correction, because the hire is the
 * only one who can tell whether it is right.
 */
export function MemoryRecapCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
}: MemoryRecapCardProps) {
  const { memory, messagesRemembered } = content;

  return (
    <BoardCardFrame
      title="What your buddy remembers"
      card={card}
      subtitle={
        memory
          ? `From ${messagesRemembered} ${messagesRemembered === 1 ? "message" : "messages"} so far`
          : undefined
      }
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    >
      {memory ? (
        <>
          <blockquote className="border-l-2 border-app-border pl-3 text-sm whitespace-pre-wrap text-app-text-muted italic">
            {memory}
          </blockquote>
          <p className="mt-2 text-xs text-app-text-muted">
            Your buddy&apos;s own notes, not a record — it picks up from these next time you talk.
            If something here is wrong, tell it.
          </p>
        </>
      ) : (
        <EmptyState size="sm">
          Nothing yet — your buddy starts remembering after your first conversation.
        </EmptyState>
      )}

      <AskTheBuddy
        question={
          memory
            ? "Can you tell me more about what you remember from our conversations?"
            : "Hi — can you tell me where I should start?"
        }
        label={memory ? "Ask about this, or correct it" : "Start a conversation"}
      />
    </BoardCardFrame>
  );
}
