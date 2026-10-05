import { MessageSquarePlus } from "lucide-react";

/**
 * "Start a new conversation", as a standing control on the buddy page.
 *
 * The second of two visible ways to do one thing — the third is the dock's own copy of this
 * control, floating over every other page: the **`Alt+N`** chord always works but is invisible
 * to anybody who has not been told about it, and this button is the one that is simply *there*,
 * which is what a hire looking for it will find.
 *
 * Floating over the transcript rather than sitting in the page header: the header is shared
 * with Chat, and a control that appeared and vanished as you crossed between the two halves
 * would undo what one shared header is for. Same chrome and same corner treatment as
 * `RailToggle`, on the opposite side, so the two never meet.
 *
 * Withdrawn mid-turn by its caller, for the reason `BuddyDock` withdraws its own copy:
 * `newConversation` clears the thread, but cannot call back a request already streaming into it.
 */
export function BuddyNewConversationButton({
  onClick,
  shortcut,
}: {
  onClick: () => void;
  /** Named in the tooltip so the chord is discoverable from the control it duplicates. */
  shortcut?: string;
}) {
  const label = "Start a new conversation";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={
        shortcut
          ? `${label} (${shortcut}) — your buddy keeps what it has learned about you`
          : `${label} — your buddy keeps what it has learned about you`
      }
      className="absolute top-3 right-2 z-30 shrink-0 rounded-xl border border-app-border bg-app-surface p-2 text-app-text-muted shadow-sm transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
