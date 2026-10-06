type DinoPlayHintProps = {
  /** Opens the waiting game — the same opening the Space trigger performs. */
  onPlay: () => void;
  /** Optional layout classes from the host (spacing, alignment). */
  className?: string;
};

/**
 * The "pass the time" invitation for waits that run long enough to play in —
 * minutes, not seconds. It is a real button on purpose: a hardware keyboard
 * used to be the only way in (Space), which left every touch user looking at
 * a hint they could not act on.
 *
 * Phones only, below `sm`: on anything wider the Space key is the way in and
 * the game opens silently — the hint shows nowhere there. Hosts render it
 * only while their wait is armed and the game is not already open.
 */
export function DinoPlayHint({ onPlay, className = "" }: DinoPlayHintProps) {
  return (
    <button
      type="button"
      onClick={onPlay}
      data-testid="dino-play-hint"
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text sm:hidden ${className}`}
    >
      <span aria-hidden="true">🦖</span>
      <span>Pass the time</span>
    </button>
  );
}
