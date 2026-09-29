/**
 * How a waited-for assistant turn ended. `null` while it is still running.
 */
export type DinoTurnOutcome = "done" | "stopped" | "failed" | null;

/** The subset of DinoGame props that describe the finished turn. */
export type DinoCompletionProps = {
  replyReady: boolean;
  completionLabel?: string;
  completionTone?: "success" | "neutral" | "danger";
  continueLabel?: string;
};

/**
 * Maps a finished turn onto the dino game's completion badge.
 *
 * Why: the game used to say "Reply ready" whenever the busy flags dropped, so a
 * Stop or a failed stream was announced as a successful reply. The label (not
 * just the badge colour) carries the outcome so it also reads correctly for
 * colour-blind and screen-reader users.
 *
 * @param finished True once the turn is no longer thinking/streaming.
 * @param outcome  How it ended; `null` (unknown) falls back to "Reply ready".
 */
export function dinoCompletionProps(
  finished: boolean,
  outcome: DinoTurnOutcome,
): DinoCompletionProps {
  if (!finished) return { replyReady: false };
  if (outcome === "stopped") {
    return {
      replyReady: true,
      completionLabel: "Stopped",
      completionTone: "neutral",
      continueLabel: "Back to chat",
    };
  }
  if (outcome === "failed") {
    return {
      replyReady: true,
      completionLabel: "Reply failed",
      completionTone: "danger",
      continueLabel: "Back to chat",
    };
  }
  return { replyReady: true };
}
