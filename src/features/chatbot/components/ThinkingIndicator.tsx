import { BotGlyph } from "./BotGlyph";
import { DinoGame } from "./DinoGame";
import { THINKING_LABELS, type ThinkingState } from "../constants";
import { dinoCompletionProps, type DinoTurnOutcome } from "../dinoOutcome";

type ThinkingIndicatorProps = {
  /** True while the assistant is working (before the first reply token arrives). */
  isThinking: boolean;
  /** Whether the dino easter-egg game is active (shown instead of the dots). */
  gameActive: boolean;
  /** The tool the backend currently reports it's running, if any. */
  thinkingState: string | null;
  /** Whether thoughts/reasoning are actively present (suppresses duplicate dots). */
  hasReasoning?: boolean;
  /** True if the turn finished (reply, stop or failure) while the game is still active. */
  replyReady?: boolean;
  /**
   * How the finished turn ended, so the game says "Stopped" / "Reply failed"
   * instead of "Reply ready" after a Stop or stream error.
   */
  turnOutcome?: DinoTurnOutcome;
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
  hasReasoning = false,
  replyReady = false,
  turnOutcome = null,
  onGameExit,
}: ThinkingIndicatorProps) {
  // If neither thinking nor game active, nothing to render.
  if (!isThinking && !gameActive) return null;

  // When the dino game is closed, streamed reasoning leaves the ReasoningPanel as the
  // visible carrier of the thinking state, so the bouncing dots are suppressed as
  // redundant. Residual gap, accepted: a tool label set *after* the reasoning (e.g.
  // "Searching knowledge base…") has no surface while the panel is open — the panel
  // does not render thinkingState, and these dots stay hidden. With the game open the
  // label shows here next to the game.
  if (hasReasoning && !gameActive) return null;

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
    // The game (score ticks ~12x/s) must not sit inside a live region, or a
    // screen reader re-reads it constantly. One concise, always-mounted status
    // carries the working state; DinoGame announces its own outcome.
    return (
      <div className="flex w-full gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <BotGlyph size={30} state="cheering" className="text-app-brand-text" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="sr-only" role="status" data-testid="thinking-status">
            {isThinking ? (label ?? "Thinking…") : ""}
          </span>

          <DinoGame onExit={onGameExit} {...dinoCompletionProps(replyReady, turnOutcome)} />

          {isThinking && (
            <div
              className="mt-2 flex w-max items-center gap-1 rounded-2xl border border-app-border-muted bg-app-surface-muted px-4 py-2.5 text-app-text"
              aria-hidden="true"
            >
              <span className="h-2 w-2 animate-bounce rounded-full bg-app-brand" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
              {label && <span className="animate-pulse pl-2 text-sm italic">{label}</span>}
            </div>
          )}
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
