import { useEffect, useRef } from "react";
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
  /** Drops the keyboard hint under the box, for the dock where the room is better spent. */
  compact?: boolean;
  /**
   * Puts the caret in the box on mount, behind whatever is already in it.
   *
   * For the full page, which a hire opens in order to type. The caret goes *behind* the text
   * because a textarea focused with a value starts it at position 0 — a draft handed over from
   * the dock would otherwise be typed in front of.
   */
  focusOnMount?: boolean;
};

/**
 * The box you answer the buddy in, shared by the dock and the full page.
 *
 * One rounded surface holds the field and the send button and takes the focus ring as a unit —
 * the composer shape the chat page already draws, so the two places you type at a model in this
 * app are not two different controls. This is the composite case the standards carve out of
 * "every text field is `ui/Textarea`": the box is shared, so the field inside it is borderless
 * and borrows only the growing behaviour, via `useAutoResize`.
 *
 * It draws no band of its own — no border, no background, no page padding. Each surface frames
 * it: the page's card gives it a bottom band, the dock hands it to `SidePanel`'s footer. Owning
 * the frame here is what previously put two `border-t`s across the dock.
 */
export function BuddyComposer({
  draft,
  setDraft,
  handleSubmit,
  placeholder = "Ask your buddy anything...",
  compact = false,
  focusOnMount = false,
}: BuddyComposerProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // One line at rest, six at most — past that it scrolls rather than eating the thread.
  useAutoResize({ ref: fieldRef, value: draft, minRows: 1, maxRows: 6 });

  // Mount only: focus is the hire's from there, and stealing it back on every draft change
  // would fight them the moment they clicked anywhere else.
  useEffect(() => {
    if (!focusOnMount) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [focusOnMount]);

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
    <div className="min-w-0">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-1.5 rounded-xl border border-app-border-muted bg-app-surface-muted p-1.5 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
      >
        <textarea
          ref={fieldRef}
          aria-label="Message"
          value={draft}
          rows={1}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm text-app-text outline-none placeholder:text-app-text-disabled"
        />

        <Button
          type="submit"
          variant="primary"
          // `sm`, not the default: the send button sets the height of the whole bar, and at
          // `md` (44px) plus the frame's padding the composer was a good deal taller than the
          // one line it usually holds.
          size="sm"
          iconOnly
          aria-label="Send message"
          disabled={!draft.trim()}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      {!compact && (
        <p className="mt-1.5 px-1 text-[11px] text-app-text-disabled">
          <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-medium">Shift</kbd> +{" "}
          <kbd className="font-sans font-medium">Enter</kbd> for a new line
        </p>
      )}
    </div>
  );
}
