import type { BuddySuggestion } from "../../../services/buddyService";

type BuddySuggestionChipsProps = {
  suggestions: BuddySuggestion[];
  /** Puts the chip's question in the composer. Never sends it — see below. */
  onPick: (question: string) => void;
  /** Small print above the row. Omitted where the surrounding copy already says it. */
  heading?: string;
};

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
export function BuddySuggestionChips({ suggestions, onPick, heading }: BuddySuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div data-testid="buddy-suggestions">
      {heading && (
        <p className="mb-2 text-xs font-medium tracking-wide text-app-text-muted uppercase">
          {heading}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.question)}
            className="rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-sm text-app-text transition-colors hover:border-app-brand hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
