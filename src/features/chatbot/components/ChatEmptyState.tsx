import { SleepyBot } from "../../buddy/components/SleepyBot";

const SUGGESTIONS = [
  "How do I set up the project locally?",
  "Explain the onboarding flow",
  "Where is the authentication handled?",
];

type ChatEmptyStateProps = {
  /** Called when the user clicks a suggestion chip. */
  onPickSuggestion: (text: string) => void;
};

/**
 * Heading, description and suggestion chips — everything below the bot.
 * Pulled out so it can be rendered twice: once for real, once as an invisible
 * mirror above the bot (see `ChatEmptyState`).
 */
function SupportingContent({ onPickSuggestion }: ChatEmptyStateProps) {
  return (
    <>
      <h1 className="mb-2 shrink-0 text-2xl font-bold text-app-text sm:text-3xl">
        How can I help you today?
      </h1>

      <p className="mb-6 max-w-md shrink-0 text-sm text-app-text-muted">
        Ask anything about your project&apos;s codebase, documentation, or onboarding process.
      </p>

      <div className="flex max-w-xl shrink-0 flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPickSuggestion(s)}
            className="rounded-full border border-app-border-muted bg-app-surface px-3.5 py-1.5 text-xs text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text"
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Centered welcome state shown when the user opens `/chat` with no chatId
 * (a fresh conversation). The suggestion chips prefill the composer rather
 * than sending immediately, so the user can edit before submitting.
 */
export function ChatEmptyState({ onPickSuggestion }: ChatEmptyStateProps) {
  return (
    // `min-h-0` so the column is the scroller's height and no taller, which is what lets the
    // mirror below give way; `justify-center-safe` so that if the real content alone is still
    // taller, it overflows downwards into the scroller rather than off the top, where nothing
    // can scroll back to it. That was the narrow-window bug: the chips stacked, the mirror
    // doubled their height, and the centred column cut off its own top.
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center-safe p-5 text-center sm:p-8">
      {/* An invisible copy of the heading/description/chips, stacked
          above the bot. `justify-center` centres this whole column, and
          the bot is its first, much shorter element — with real content
          only *below* it, centring the column leaves the bot sitting
          well above the true middle (by roughly half the height of
          everything under it). Mirroring that height above makes the
          column symmetric around the bot, so centring the column
          centres the bot instead — exactly, at any viewport height and
          however the chips happen to wrap, since the mirror is the same
          markup under the same width constraints.
          `invisible` (not `opacity-0`) is what keeps it out of the
          accessibility tree and out of tab order, so it is not a second
          heading or a second set of buttons to anyone but the layout
          engine. The margin matches the real gap below the bot — the
          symmetry only holds if the space *above* the mirror's height is
          the same as the space *below* the real content's twin. */}
      {/* It shrinks first, and to nothing if it must (`min-h-0`): the symmetry is worth having
          while there is room for it, and none of what is real should be squeezed out for it.
          Everything after it keeps its size (`shrink-0`). */}
      <div aria-hidden="true" className="invisible -mb-2 min-h-0 shrink overflow-hidden">
        <SupportingContent onPickSuggestion={onPickSuggestion} />
      </div>

      {/* Same size as the dashboard widget's bot — one character, one
          scale, wherever it shows up. No badge behind it here: the page
          is already centred and quiet, and a ring around a 76px bot
          would compete with the heading for the first thing you see.
          Negative margin, not just a small positive one: the SVG's own
          viewBox leaves roughly 10px of empty space below the drawn
          glyph, and the inline element itself carries a few more of
          baseline slack — a positive margin only ever adds to that fixed
          gap, which is why shrinking it here used to barely register.
          Pulling the heading up into that dead space is what actually
          closes the distance. */}
      <div className="-mb-2 shrink-0">
        <SleepyBot size={76} tracksPointer className="text-app-brand-text" />
      </div>

      <SupportingContent onPickSuggestion={onPickSuggestion} />
    </div>
  );
}
