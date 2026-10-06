import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ListPlus, Send, Square, Wand2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useAutoResize } from "../../../components/ui/useAutoResize";
import { useBuddyDraft } from "../buddyDraftContext";
import type { BuddySessionFilters, QueuedBuddyMessage } from "../types";
import { isFilterRangeInvalid } from "../utils/filterRange";
import { BuddyFilterChips, BuddyFiltersButton } from "./BuddyComposerFilters";
import { BuddyQueuedMessages } from "./BuddyQueuedMessages";

type BuddyComposerProps = {
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
   * The retired chat surface ran the same two-way dance, and for the same
   * reason: Space starts the dino waiting-game
   * only while nothing is focused, so a box that keeps the caret after a
   * send would quietly make that egg unreachable on this surface.
   */
  busy?: boolean;
  /**
   * Whether a message turn is in flight — thinking about the hire's message or writing the
   * answer. While it is, Send queues the follow-up (see `queue`) and the Stop button appears
   * beside it when `onStop` is given. Armed from the first moment of the turn, not from the
   * first token: a slow or wedged turn has to be stoppable while it is still thinking, the
   * same way the retired chat surface's `isBusy` armed its Stop.
   */
  streaming?: boolean;
  /** Stops the in-flight reply — the composer shows Stop only when it is given. */
  onStop?: () => void;
  /**
   * The queue's data and actions — the composer shows the strip only when given one. While an
   * answer is being written the Send button queues instead of sending, so this is also what
   * makes that queue visible.
   */
  queue?: BuddyComposerQueue;
  /**
   * Retrieval filters for messages sent from here (sources + indexed date). The composer renders
   * no filter UI without them; the session owns the state so both surfaces share one set.
   */
  filters?: BuddySessionFilters;
  onFiltersChange?: (next: BuddySessionFilters) => void;
  /** Whether the mentor may act on messages sent from here; paired with the setter below. */
  capabilitiesEnabled?: boolean;
  onCapabilitiesChange?: (next: boolean) => void;
  /**
   * Bumped by the surface to put the caret in the box, behind its text — the page's `/` chord.
   * A counter rather than a callback ref, so the request crosses the memoised conversation as a
   * plain prop. `0` (the default) asks for nothing.
   */
  focusToken?: number;
  /**
   * Whether the dino waiting-game is open. The caret is held back while it is: the game
   * ignores keys aimed at text fields, so a refocus mid-run (the reply arriving) would kill
   * the dino, deaden Escape and type Spaces in here. Closing the game hands the caret back.
   */
  gameActive?: boolean;
};

/**
 * The queue strip's data and actions, bundled: the composer shows the strip only when given one.
 */
export type BuddyComposerQueue = {
  items: QueuedBuddyMessage[];
  /** True when Stop held the queue back — the strip offers to release it. */
  paused: boolean;
  /** Drops a queued message without sending it. */
  onRemove: (id: string) => void;
  /** Takes one back into the box for editing; returns its text (null if it went away first). */
  onPull: (id: string) => string | null;
  /** Releases a queue Stop paused, starting with the oldest message. */
  onSendQueued: () => void;
};

/**
 * The box you answer the buddy in, shared by the dock and the full page.
 *
 * One rounded surface holds the field and the send button and takes the focus ring as a unit —
 * one composer shape for both places you type at the buddy, so they are not two different
 * controls. This is the composite case the standards carve out of
 * "every text field is `ui/Textarea`": the box is shared, so the field inside it is borderless
 * and borrows only the growing behaviour, via `useAutoResize`.
 *
 * It draws no band of its own — no border, no background, no page padding. Each surface frames
 * it: the page's card gives it a bottom band, the dock hands it to `SidePanel`'s footer. Owning
 * the frame here is what previously put two `border-t`s across the dock.
 *
 * It reads the words from the shared composer (`useBuddyDraft`) rather than taking them as
 * props — the box is the one component a keystroke is *allowed* to re-render, and reading the
 * draft directly is what keeps that true: a surface passing `draft` down would be re-rendering
 * for every character it forwarded. See `BuddyDraftProvider`.
 */
export function BuddyComposer({
  placeholder = "Ask your buddy anything...",
  compact = false,
  focusOnMount = false,
  busy = false,
  streaming = false,
  onStop,
  queue,
  filters,
  onFiltersChange,
  capabilitiesEnabled = true,
  onCapabilitiesChange,
  focusToken = 0,
  gameActive = false,
}: BuddyComposerProps) {
  const { draft, setDraft, handleSubmit } = useBuddyDraft();
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

  useEffect(() => {
    if (focusToken === 0) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [focusToken]);

  /**
   * The last value the hire typed here, so a draft written *from outside* can be told apart.
   *
   * A suggestion chip, or "Ask your buddy about this step" while the dock is already open, sets the
   * draft without touching the box — and focus stayed on whatever was clicked. Pressing Enter then
   * re-clicked the chip instead of sending, so a filled-in question looked unsendable. Any draft
   * that did not come from typing takes the caret, behind the text, which is where it has to be for
   * Enter to send it and for typing to add to it.
   */
  const typedRef = useRef(draft);

  useEffect(() => {
    if (draft === typedRef.current) return;
    typedRef.current = draft;
    // Cleared after a send: nothing to hand over, and the caret is not wanted back mid-turn.
    if (!draft) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [draft]);

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

  /** A start-after-end window. Flagged in the popover and refused on submit — see `submit`. */
  const filtersInvalid = filters !== undefined && isFilterRangeInvalid(filters.from, filters.to);
  // Per instance: the dock and the page can both be mounted during the hand-off.
  const invalidRangeHintId = useId();

  /**
   * Sends, then hands the caret back to the page.
   *
   * Space opens the dino waiting-game while the buddy works, and the trigger refuses to fire
   * while a text field holds focus — otherwise it would eat the space bar. So the composer blurs
   * on submit; before it did, the game was only reachable after clicking away from it. Pressing Escape or clicking the thread still
   * works too: this only makes the documented gesture (just press Space) true here.
   *
   * Only a submission that started a turn counts. An egg phrase is swallowed by the caller —
   * there is no turn to play a game under, and the caret belongs in the box the hire is still
   * typing in, not handed away and left to come back on its own (which it never would: the
   * refocus below hangs off `busy` flipping, and nothing ever became busy).
   */
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    // An inverted window would go out unchecked and silently match nothing — nothing
    // downstream rejects it — so refusing here turns a dead search into a correction beside
    // the fields that caused it. Enter and the button both come through this one gate.
    if (filtersInvalid) return;
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
    // Mid-reply the same Enter queues the message behind the running answer instead of cutting
    // it off — the composer clears either way, and the strip keeps the message visible until
    // its turn comes. See `BuddyQueuedMessages`.
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
      {queue && (
        <BuddyQueuedMessages
          items={queue.items}
          paused={queue.paused}
          onRemove={queue.onRemove}
          onEdit={(id) => {
            const text = queue.onPull(id);
            if (text !== null) setDraft(text);
          }}
          onSendQueued={queue.onSendQueued}
        />
      )}

      {/* Not gated on `compact`: the dock sends with the same session filters, so it has to show
          them too — a narrowed search the hire cannot see is the one way a filter "loses" them
          knowledge. Only the popover needs the page's room (see `BuddyFiltersButton`). */}
      {filters && onFiltersChange && (
        <BuddyFilterChips filters={filters} onFiltersChange={onFiltersChange} />
      )}

      {/* Why Send is off. The popover says so beside the fields, but only while it is open — and
          the dock has no popover at all, so a range set on the page left the dock's Send disabled
          with nothing on screen to say why. Not an alert: the popover's own line already is one,
          and the same fault announced twice is noise. */}
      {filtersInvalid && (
        <p id={invalidRangeHintId} className="mb-2 px-1 text-xs text-app-danger-text">
          The date filter starts after it ends — fix or clear it to send.
        </p>
      )}

      <form
        onSubmit={submit}
        className="flex items-end gap-1.5 rounded-xl border border-app-border-muted bg-app-surface-muted p-1.5 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
      >
        {!compact && filters && onFiltersChange && (
          <BuddyFiltersButton filters={filters} onFiltersChange={onFiltersChange} />
        )}

        {onCapabilitiesChange && (
          <button
            type="button"
            aria-pressed={capabilitiesEnabled}
            // Named by its visible "Actions" — no `aria-label`: a spoken name that differs from
            // the one on screen leaves a voice-control user saying a word the button does not
            // answer to (WCAG 2.5.3). The title carries the longer explanation.
            title={
              capabilitiesEnabled
                ? "Mentor tools on — your buddy can act. Click for answers only."
                : "Answers only — click to let your buddy act again."
            }
            data-testid="buddy-capabilities-toggle"
            onClick={() => onCapabilitiesChange(!capabilitiesEnabled)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-all ${
              capabilitiesEnabled
                ? "border-app-brand-border-strong bg-app-brand/10 text-app-brand-text shadow-xs"
                : "border-app-border-muted bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
            }`}
          >
            <Wand2 size={14} aria-hidden="true" />
            <span>Actions</span>
          </button>
        )}

        <textarea
          ref={fieldRef}
          aria-label="Message"
          value={draft}
          rows={1}
          placeholder={placeholder}
          onChange={(event) => {
            typedRef.current = event.target.value;
            setDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base text-app-text outline-hidden placeholder:text-app-text-disabled sm:text-sm pointer-coarse:text-base"
        />

        {/* Stop and Send coexist while an answer is being written: Stop is "no more of this
            answer", Send is "yes, and then this one" — it queues the follow-up instead of
            cutting the answer off, which is the whole point of the queue. */}
        {streaming && onStop && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconOnly
            aria-label="Stop generation"
            onClick={onStop}
            className="max-sm:h-11 max-sm:w-11"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          // `sm`, not the default: the send button sets the height of the whole bar, and at
          // `md` (44px) plus the frame's padding the composer was a good deal taller than the
          // one line it usually holds.
          size="sm"
          iconOnly
          aria-label={streaming ? "Queue message" : "Send message"}
          title={streaming ? "Queued: it is sent once this answer finishes" : undefined}
          disabled={!draft.trim() || filtersInvalid}
          aria-describedby={filtersInvalid ? invalidRangeHintId : undefined}
          className="max-sm:h-11 max-sm:w-11"
        >
          {streaming ? (
            <ListPlus className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </form>

      {!compact && (
        <p className="mt-1.5 hidden px-1 text-xs text-app-text-disabled pointer-fine:block">
          <kbd className="font-sans font-medium">Enter</kbd>{" "}
          {streaming ? "to queue a follow-up" : "to send"} ·{" "}
          <kbd className="font-sans font-medium">Shift</kbd> +{" "}
          <kbd className="font-sans font-medium">Enter</kbd> for a new line
        </p>
      )}
    </div>
  );
}
