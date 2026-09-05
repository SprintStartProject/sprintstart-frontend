import { Brain } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { Marked } from "./Marked";
import { useCardMarks } from "../marks/useCardMarks";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, MemoryRecapContent } from "../types";

type MemoryRecapCardProps = {
  content: MemoryRecapContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
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
export function MemoryRecapCard({ content, card, onDismiss, dismissing }: MemoryRecapCardProps) {
  const { memory, messagesRemembered } = content;
  const marks = useCardMarks().marksFor(card.id);

  return (
    <BoardCardFrame
      icon={Brain}
      title="What your buddy remembers"
      card={card}
      subtitle={
        memory
          ? `From ${messagesRemembered} ${messagesRemembered === 1 ? "message" : "messages"} so far`
          : undefined
      }
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {memory ? (
        <>
          <blockquote className="border-l-2 border-app-border pl-3 text-sm whitespace-pre-wrap text-app-text-muted italic">
            {/* The recap is rewritten every time the buddy folds a visit, so its highlights are
                matched by their words rather than by where they were — see `marks/cardMarks.ts`.
                A sentence that survives the rewrite stays marked; one that does not, quietly
                stops being. */}
            <Marked text={memory} marks={marks} cardId={card.id} />
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
