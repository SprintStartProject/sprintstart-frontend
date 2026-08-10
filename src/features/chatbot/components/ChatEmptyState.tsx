import { SleepyBot } from "./SleepyBot";

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
 * Centered welcome state shown when the user opens `/chat` with no chatId
 * (a fresh conversation). The suggestion chips prefill the composer rather
 * than sending immediately, so the user can edit before submitting.
 */
export function ChatEmptyState({ onPickSuggestion }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-5 rounded-2xl bg-app-brand-soft p-4 ring-1 ring-app-brand-border">
        <SleepyBot size={44} className="text-app-brand-text" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-app-text sm:text-3xl">
        How can I help you today?
      </h1>

      <p className="mb-6 max-w-md text-sm text-app-text-muted">
        Ask anything about your project&apos;s codebase, documentation, or onboarding process.
      </p>

      <div className="flex max-w-xl flex-wrap justify-center gap-2">
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
    </div>
  );
}
