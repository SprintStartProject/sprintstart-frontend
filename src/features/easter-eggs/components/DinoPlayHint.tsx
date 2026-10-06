import { useEffect } from "react";

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
 * Shown where there is no keyboard to press Space on — below `sm`, or on any
 * coarse pointer at any width, so landscape phones and tablets are covered
 * too — and hidden on wide fine-pointer viewports, where Space is the way in
 * and the game opens silently. Hosts render it only while their wait is
 * armed and the game is not already open.
 *
 * It preloads the game chunk on mount: the hint is on screen for minutes, so
 * the tap should rarely meet a cold chunk — and the chunk still stays off the
 * boot path, because a hint only exists once a wait is long enough to play in.
 */
export function DinoPlayHint({ onPlay, className = "" }: DinoPlayHintProps) {
  useEffect(() => {
    // Fire and forget: a failed preload is the same failure the lazy import
    // on open reports, and the boundary there handles it.
    import("./DinoGame").catch(() => {
      /* handled where the game is opened */
    });
  }, []);

  return (
    <button
      type="button"
      onClick={onPlay}
      data-testid="dino-play-hint"
      className={`hidden min-h-11 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text max-sm:flex pointer-coarse:flex ${className}`}
    >
      <span aria-hidden="true">🦖</span>
      <span>Pass the time</span>
    </button>
  );
}
