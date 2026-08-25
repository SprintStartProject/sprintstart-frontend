import type { ReactNode } from "react";
import type { BuddySuggestion } from "../../../services/buddyService";

type BuddySuggestionChipsProps = {
  suggestions: BuddySuggestion[];
  /** Puts the chip's question in the composer. Never sends it — see below. */
  onPick: (question: string) => void;
  /** Small print above the row. Omitted where the surrounding copy already says it. */
  heading?: string;
  /** Rendered at the end of the heading row — the dock's dismiss control. */
  headingAction?: ReactNode;
  /**
   * Tighter type and padding, and at most [COMPACT_LIMIT] of them.
   *
   * For the dock, where the full row took about half the window: five wrapped chips at reading
   * size left the conversation with the other half, which is the wrong way round for a
   * conversation window.
   */
  compact?: boolean;
};

/** How many chips the compact row shows before it stops. */
const COMPACT_LIMIT = 3;

/**
 * The row of things this hire could usefully ask.
 *
 * It fills the composer and does not send. Clicking writes the question into the box and
 * the hire presses send, so the words stay theirs and they can edit first.
 *
 * Nothing here calls a tool. A chip asks a question; if an action follows, the mentor
 * proposes it and the hire confirms it. A control that ran an action directly is the one shape the
 * board's design has rejected.
 *
 * The list is not written here. `useBuddySuggestions` reads it from the backend, which
 * derives it from the tools mounted for *this* hire — a hardcoded list offers a Scrum Master a
 * pull-request question.
 */
export function BuddySuggestionChips({
  suggestions,
  onPick,
  heading,
  headingAction,
  compact = false,
}: BuddySuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  const shown = compact ? suggestions.slice(0, COMPACT_LIMIT) : suggestions;

  return (
    <div data-testid="buddy-suggestions">
      {(heading || headingAction) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {heading && (
            <p className="text-[11px] font-medium tracking-wide text-app-text-muted uppercase">
              {heading}
            </p>
          )}
          {headingAction}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {shown.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.question)}
            className={`rounded-full border border-app-border bg-app-surface text-app-text transition-colors hover:border-app-brand hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            }`}
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
