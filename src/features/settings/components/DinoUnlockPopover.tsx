import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getModalDialogVariants } from "../../../styles/tokens.ts";
import type { DinoToggleKind } from "../hooks/useDinoEasterEgg.ts";

type DinoUnlockPopoverProps = {
  /** Result of the latest toggle from `useDinoEasterEgg`, or null when hidden. */
  kind: DinoToggleKind | null;
  /** Optional custom CSS classes for the visual bubble container. */
  className?: string;
};

/**
 * Plain-text announcement per toggle result. Kept separate from the visual
 * copy (which splits the text around a `<kbd>` badge and adds an emoji) so
 * screen readers hear one clean sentence instead of fragments and emoji names.
 */
const ANNOUNCEMENT: Record<DinoToggleKind, string> = {
  unlocked: "shh... press Space whenever you're waiting",
  locked: "you saw nothing...",
};

/**
 * Anchored speech-bubble popover displayed directly below the Settings icon
 * when the dino easter egg is toggled (triple-click).
 *
 * Accessibility: live regions are only announced when their *content* changes
 * after they are already in the DOM, so the `role="status"` element is always
 * mounted (visually hidden) and only its text flips with `kind`. The animated
 * bubble is purely visual and `aria-hidden`, which also keeps the emoji and
 * the split `<kbd>` copy from being read twice.
 *
 * Copy is chosen from the explicit `kind` discriminant, never by matching
 * message text, so rewording can't silently swap the lock/unlock rendering.
 */
export function DinoUnlockPopover({ kind, className = "" }: DinoUnlockPopoverProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const variants = getModalDialogVariants(prefersReducedMotion);

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only" data-testid="dino-unlock-status">
        {kind ? ANNOUNCEMENT[kind] : ""}
      </span>

      <AnimatePresence>
        {kind && (
          <motion.div
            key={kind}
            aria-hidden="true"
            data-testid="dino-unlock-popover"
            data-kind={kind}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`pointer-events-none absolute top-full left-0 z-50 mt-2.5 w-max max-w-[calc(100vw-2rem)] select-none ${className}`}
          >
            <div className="relative flex items-center gap-2 rounded-2xl border border-app-border bg-app-surface px-3.5 py-2 text-xs font-medium text-app-text shadow-lg">
              {/* Upward caret arrow pointing to the cogwheel icon above */}
              <div className="absolute -top-1 left-2.5 size-2 rotate-45 border-t border-l border-app-border bg-app-surface" />

              {kind === "unlocked" ? (
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-sm leading-none"
                    data-testid="dino-unlock-emoji"
                  >
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
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-sm leading-none"
                    data-testid="dino-unlock-emoji"
                  >
                    🫣
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap text-app-text">
                    you saw nothing...
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
