import type { BuddySuggestion } from "../../../services/buddyService";

type BuddySuggestionChipsProps = {
  suggestions: BuddySuggestion[];
  /** Puts the chip's question in the composer. Never sends it — see below. */
  onPick: (question: string) => void;
  /** Small print above the row. Omitted where the surrounding copy already says it. */
  heading?: string;
  /**
   * Which way the row and its heading line up. `start` for a row sitting above a composer;
   * `center` for the welcome column, where a left-aligned row under a centred greeting is the
   * one thing that makes the whole column look accidentally off-centre.
   */
  align?: "start" | "center";
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
export function BuddySuggestionChips({
  suggestions,
  onPick,
  heading,
  align = "start",
}: BuddySuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  const isCentered = align === "center";

  return (
    <div data-testid="buddy-suggestions" className={isCentered ? "text-center" : ""}>
      {heading && (
        <p className="mb-3 text-xs font-medium tracking-wide text-app-text-muted uppercase">
          {heading}
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${isCentered ? "justify-center" : ""}`}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.question)}
            className="rounded-full border border-app-border-muted bg-app-surface px-3.5 py-1.5 text-sm text-app-text-muted shadow-sm transition-colors hover:border-app-brand-border hover:bg-app-surface-hover hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
