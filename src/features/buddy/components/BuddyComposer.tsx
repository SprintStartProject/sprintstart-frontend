import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useAutoResize } from "../../../components/ui/useAutoResize";

type BuddyComposerProps = {
  draft: string;
  setDraft: (value: string) => void;
  handleSubmit: (event: React.FormEvent) => void;
  /** Composer placeholder — "Type your answer…" while the buddy is intaking. */
  placeholder?: string;
};

/**
 * The buddy's message box: the bottom band of the conversation card.
 *
 * One rounded surface holds the field and the send button and takes the focus ring as a unit —
 * the composer shape the chat page already draws, so the two places you type at a model in this
 * app are not two different controls. This is the composite case the standards carve out of
 * "every text field is `ui/Textarea`": the box is shared, so the field inside it is borderless
 * and borrows only the growing behaviour, via `useAutoResize`.
 *
 * The inner width matches the thread's above it, so the box lines up with the bubbles rather
 * than with the card's edges.
 */
export function BuddyComposer({
  draft,
  setDraft,
  handleSubmit,
  placeholder = "Ask your buddy anything...",
}: BuddyComposerProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // One line at rest, six at most — past that it scrolls rather than eating the thread.
  useAutoResize({ ref: fieldRef, value: draft, minRows: 1, maxRows: 6 });

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Enter also *commits* an IME candidate — a compose-key 'ü', or any CJK input. Sending
    // there would submit a half-written word with no way to get it back.
    if (event.nativeEvent.isComposing) return;
    // Same condition as the send button being enabled, so the two cannot disagree about
    // whether there is anything to send.
    if (!draft.trim()) return;

    event.preventDefault();
    // Through the form rather than a callback of its own: `onSubmit` stays the single place a
    // message is sent from, however it was triggered.
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div className="shrink-0 border-t border-app-border-muted bg-app-bg/40 px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="mx-auto w-full max-w-5xl">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl border border-app-border-muted bg-app-surface-muted p-2 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
        >
          <textarea
            ref={fieldRef}
            aria-label="Message"
            value={draft}
            rows={1}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm text-app-text outline-none placeholder:text-app-text-disabled"
          />

          <Button
            type="submit"
            variant="primary"
            iconOnly
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-2 px-1 text-xs text-app-text-disabled">
          <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-medium">Shift</kbd> +{" "}
          <kbd className="font-sans font-medium">Enter</kbd> for a new line
        </p>
      </div>
    </div>
  );
}
