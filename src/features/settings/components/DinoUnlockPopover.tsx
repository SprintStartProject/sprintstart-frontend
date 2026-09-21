import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { centralSpringToken } from "../../../styles/tokens";

type DinoUnlockPopoverProps = {
  /** The current toast message from useDinoEasterEgg, or null when hidden. */
  toast: string | null;
  /** Optional custom CSS classes for the container. */
  className?: string;
};

/**
 * Anchored speech-bubble popover displayed directly below the Settings icon
 * when the dino easter egg is toggled (triple-click).
 *
 * Replaces the disconnected bottom-screen solid blue toast with an organic,
 * theme-adaptive frosted bubble featuring a styled keyboard badge and spring
 * enter/exit transitions.
 */
export function DinoUnlockPopover({ toast, className = "" }: DinoUnlockPopoverProps) {
  const prefersReducedMotion = useReducedMotion();

  const isUnlock = Boolean(toast && (toast.includes("press Space") || toast.includes("shh")));
  const isLock = Boolean(toast && toast.includes("saw nothing"));

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0, transition: { duration: 0.15 } }
              : { opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.15, ease: "easeIn" } }
          }
          transition={centralSpringToken}
          className={`pointer-events-none absolute top-full left-0 z-50 mt-2.5 w-max max-w-[calc(100vw-2rem)] select-none ${className}`}
        >
          <div className="relative flex items-center gap-2 rounded-2xl border border-app-border/80 bg-app-surface/95 px-3.5 py-2 text-xs font-medium text-app-text shadow-lg shadow-black/10 backdrop-blur-md dark:border-app-border dark:bg-app-surface/90">
            {/* Upward caret arrow pointing to the cogwheel icon above */}
            <div
              aria-hidden="true"
              className="absolute -top-1 left-2.5 size-2 rotate-45 border-t border-l border-app-border/80 bg-app-surface dark:border-app-border"
            />

            {isUnlock ? (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm leading-none" role="img" aria-label="shh">
                  🤫
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-app-text">
                  <span>shh... press</span>
                  <kbd className="inline-flex items-center rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-app-text shadow-2xs">
                    Space
                  </kbd>
                  <span className="text-app-text-muted">{"whenever you're waiting"}</span>
                </span>
              </div>
            ) : isLock ? (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm leading-none" role="img" aria-label="peeking">
                  🫣
                </span>
                <span className="text-xs font-medium whitespace-nowrap text-app-text">
                  you saw nothing...
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium whitespace-nowrap text-app-text">{toast}</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
