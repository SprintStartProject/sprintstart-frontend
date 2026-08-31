import { Suspense, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useScrollLock } from "../../../components/ui/useScrollLock";
import { getModalDialogVariants, modalBackdropVariants } from "../../../styles/tokens";
import { EGG_REGISTRY, type EggId } from "../registry";

type EggModalShellProps = {
  /** Which registered egg to show. Unknown ids render nothing. */
  eggId: EggId;
  /** When true, the modal is visible and the lazily-loaded game mounts. */
  open: boolean;
  /** Called when the user requests to close (Esc, exit button, overlay click). */
  onClose: () => void;
};

/**
 * The one modal wrapper behind every modal easter egg — replaces the old
 * per-game DinoGameModal / SpaceInvadersModal / Game2048Modal trio, whose
 * backdrop, spring animation and scroll lock were three copies of the
 * same file with a different aria-label. The game arrives through
 * {@link EGG_REGISTRY} as a lazy chunk: none of the game code loads until
 * an egg is actually opened.
 *
 * Two shapes fall out of the registry:
 *
 * - Canvas games (dino, invaders) own their keyboard and already draw
 *   their score / "Esc ✕" chrome on top of the canvas and call their
 *   `onExit` prop on Escape — so this shell adds no header and no Escape
 *   listener of its own (a second handler would double-fire).
 *
 * - The iframe game (2048) is a vanilla-JS page with no React props, so
 *   the shell renders a titled header bar with a close button and listens
 *   for Escape on the parent window; the frame's own same-origin listener
 *   (see {@link Game2048Frame}) covers presses inside the iframe — the two
 *   never double-fire because keydowns in a focused iframe don't bubble out.
 *
 * Not the shared `Modal`: games own the keyboard, and Modal's focus trap
 * would fight them for the arrow keys. The one thing every overlay needs
 * regardless — the page behind it holding still — comes from
 * `useScrollLock`.
 */
export function EggModalShell({ eggId, open, onClose }: EggModalShellProps) {
  const egg = EGG_REGISTRY[eggId];

  useScrollLock(open);
  const prefersReducedMotion = useReducedMotion();
  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

  // Close on Escape while focus is outside the iframe (header bar, close
  // button, or before the frame has loaded). Canvas games handle Escape
  // themselves via `onExit`. The ref keeps the latest callback without
  // re-subscribing; calling it inside the handler (not during render)
  // stays clear of the set-state-in-effect rule.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !egg || egg.kind !== "iframe") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, egg]);

  if (!egg) return null;

  const Game = egg.component;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
          variants={modalBackdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={egg.label}
        >
          <motion.div
            className={`relative max-w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl ${
              egg.kind === "iframe" ? "flex max-h-[90vh] flex-col" : ""
            }`}
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* One Suspense around every branch: all registry components are
                lazy, and an unsuspended lazy child would tear down the tree. */}
            <Suspense fallback={<div className="h-64 w-[680px]" aria-hidden="true" />}>
              {egg.kind === "iframe" ? (
                <>
                  {/* Header bar for the iframe game (canvas games draw their own chrome). */}
                  <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
                    <h2 id={`${eggId}-title`} className="text-lg font-semibold text-app-text">
                      {egg.label}
                    </h2>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={`Close ${egg.label}`}
                      data-testid="game2048-close"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <Game onExit={onClose} />
                </>
              ) : (
                <Game onExit={onClose} />
              )}
            </Suspense>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
