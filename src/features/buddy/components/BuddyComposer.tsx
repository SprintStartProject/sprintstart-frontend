import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useAutoResize } from "../../../components/ui/useAutoResize";

type BuddyComposerProps = {
  draft: string;
  setDraft: (value: string) => void;
  /**
   * Submits the box. Returns whether a turn was actually started: `false` when the caller
   * swallowed the submission (an easter-egg phrase, an empty draft), which is what keeps the
   * caret here instead of handing it off on a send that never happened — see `submit`.
   */
  handleSubmit: (event: React.FormEvent) => boolean;
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
  /**
   * Whether the buddy is still writing (thinking dots or streaming text).
   *
   * Used for one thing: the caret comes back to this box when the answer
   * finishes, undoing the deliberate blur a send performs (see `submit`).
   * The chat page runs the same two-way dance — see `ChatPage`'s focus
   * effect — and for the same reason: Space starts the dino waiting-game
   * only while nothing is focused, so a box that keeps the caret after a
   * send would quietly make that egg unreachable on this surface.
   */
  busy?: boolean;
  /**
   * Whether the dino waiting-game is open. The caret is held back while it is: the game
   * ignores keys aimed at text fields, so a refocus mid-run (the reply arriving) would kill
   * the dino, deaden Escape and type Spaces in here. Closing the game hands the caret back.
   */
  gameActive?: boolean;
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
  busy = false,
  gameActive = false,
}: BuddyComposerProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Set when *this* composer gave up the caret on a send, so the refocus
  // below never reaches for focus it never had: the dock mounts on every
  // page, and a composer that grabbed the caret on its own would steal it
  // from whatever the hire was actually typing in.
  const handedOffCaretRef = useRef(false);

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

  // The mirror of the blur in `submit`: once the buddy has stopped writing, the caret comes
  // back so a follow-up question does not need a click first. Skipped when somebody else holds
  // focus, so this never pulls the caret out of a field the hire moved to in the meantime.
  useEffect(() => {
    if (busy || gameActive || !handedOffCaretRef.current) return;
    handedOffCaretRef.current = false;
    const field = fieldRef.current;
    if (!field) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    field.focus();
  }, [busy, gameActive]);

  /**
   * Sends, then hands the caret back to the page.
   *
   * Space opens the dino waiting-game while the buddy works, and the trigger refuses to fire
   * while a text field holds focus — otherwise it would eat the space bar. The chat page solves
   * this by blurring its composer on submit; this box said nothing about focus, so the game was
   * only reachable after clicking away from it. Pressing Escape or clicking the thread still
   * works too: this only makes the documented gesture (just press Space) true here.
   *
   * Only a submission that started a turn counts. An egg phrase is swallowed by the caller —
   * there is no turn to play a game under, and the caret belongs in the box the hire is still
   * typing in, not handed away and left to come back on its own (which it never would: the
   * refocus below hangs off `busy` flipping, and nothing ever became busy).
   */
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!handleSubmit(event)) return;
    const field = fieldRef.current;
    if (field && document.activeElement === field) {
      handedOffCaretRef.current = true;
      field.blur();
    }
  };

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
        onSubmit={submit}
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
