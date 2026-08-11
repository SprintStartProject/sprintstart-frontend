import { BotGlyph } from "./BotGlyph";
import { DinoGame } from "./DinoGame";
import { THINKING_LABELS, type ThinkingState } from "../constants";

type ThinkingIndicatorProps = {
  /** True while the assistant is working (before the first token arrives). */
  isThinking: boolean;
  /** Whether the dino easter-egg game is active (shown instead of the dots). */
  gameActive: boolean;
  /** The tool the backend currently reports it's running, if any. */
  thinkingState: string | null;
  /** Called when the user exits the dino game. */
  onGameExit: () => void;
};

/**
 * Status indicator shown while the assistant is thinking. Two variants share
 * the same status label row: a tiny endless-runner easter egg, or the classic
 * three bouncing dots. The status copy is centralized in
 * {@link THINKING_LABELS} so the two variants never drift apart (D2).
 */
export function ThinkingIndicator({
  isThinking,
  gameActive,
  thinkingState,
  onGameExit,
}: ThinkingIndicatorProps) {
  if (!isThinking) return null;

  // Resolve the status label; unknown tool names fall back to no label.
  const state = thinkingState as ThinkingState | null;
  const label = state && state in THINKING_LABELS ? THINKING_LABELS[state] : null;

  const StatusDots = (
    <>
      <span className="size-2 animate-bounce rounded-full bg-app-brand" aria-hidden="true" />
      <span
        className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]"
        aria-hidden="true"
      />
      <span
        className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]"
        aria-hidden="true"
      />
      {label && <span className="animate-pulse pl-2 text-sm italic">{label}</span>}
    </>
  );

  if (gameActive) {
    return (
      <div className="flex w-full gap-3" role="status">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <BotGlyph size={30} state="cheering" className="text-app-brand-text" />
        </div>

        <div className="min-w-0 flex-1">
          <DinoGame onExit={onGameExit} />

          <div className="mt-2 flex w-max items-center gap-1 rounded-2xl border border-app-border-muted bg-app-surface-muted px-4 py-2.5 text-app-text">
            <span className="h-2 w-2 animate-bounce rounded-full bg-app-brand" aria-hidden="true" />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]"
              aria-hidden="true"
            />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]"
              aria-hidden="true"
            />
            {label && <span className="animate-pulse pl-2 text-sm italic">{label}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full gap-3" role="status">
      <div className="flex size-8 shrink-0 items-center justify-center">
        <BotGlyph size={30} state="thinking" className="text-app-brand-text" />
      </div>

      <div className="flex max-w-[85%] flex-col items-start">
        <div className="rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted px-4 py-2.5 text-app-text">
          <div className="flex items-center gap-1">{StatusDots}</div>
        </div>
      </div>
    </div>
  );
}
