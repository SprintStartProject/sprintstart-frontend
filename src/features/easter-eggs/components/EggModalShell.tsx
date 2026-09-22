import { Suspense, useEffect, useRef, useState } from "react";
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
 * would fight them for the arrow keys. The focus contract this shell does
 * implement keeps hands off the keys the games use: focus lands on the
 * dialog itself when it opens (so a screen reader announces it and the
 * games' window-level keys work regardless of focus) and returns to
 * whoever held it before when the dialog closes; Tab wraps inside the
 * dialog — the canvas games never use it, and keydowns inside the 2048
 * iframe don't reach this window, so the trap cannot fight either surface.
 * The one thing every overlay needs regardless — the page behind it
 * holding still — comes from `useScrollLock`.
 */
export function EggModalShell({ eggId, open, onClose }: EggModalShellProps) {
  const egg = EGG_REGISTRY[eggId];

  useScrollLock(open);
  const prefersReducedMotion = useReducedMotion();
  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

  // Focus in on open, back to the opener on close. The dialog carries
  // `tabIndex={-1}` so it is programmatically focusable without joining the
  // page's Tab order. Restoring happens in the effect cleanup, i.e. the
  // moment `open` flips false — before the exit animation finishes, but the
  // return is what matters: focus never ends up on a removed node (the
  // trigger button would be unreachable to keyboard users otherwise).
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  // Tab wraps inside the dialog. Deliberately Tab-only: canvas games bind
  // arrows/w/s/space on the window, and a Tab press inside the 2048 iframe
  // is confined to the frame's document, so neither surface ever fights
  // this handler. The focusable list includes the iframe itself, so one Tab
  // from the header close button walks into the frame and the next wrap
  // brings focus back to the header.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog || !(e.target instanceof Node) || !dialog.contains(e.target)) return;

      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on Escape while focus is outside the iframe (header bar, close
  // button, or before the frame has loaded). Canvas games handle Escape
  // themselves via `onExit` — but only from the moment they mount, and the
  // chunk behind them arrives asynchronously: until then nothing else can
  // close the modal from the keyboard, so the shell takes the key for
  // exactly that window (`gameLoading` is raised by the fallback below,
  // which is mounted only while the chunk is still on the wire). The ref
  // keeps the latest callback without re-subscribing; calling it inside the
  // handler (not during render) stays clear of the set-state-in-effect rule.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [gameLoading, setGameLoading] = useState(false);
  const shellOwnsEscape = egg?.kind === "iframe" || gameLoading;

  useEffect(() => {
    if (!open || !egg || !shellOwnsEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, egg, shellOwnsEscape]);

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
            ref={dialogRef}
            tabIndex={-1}
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
            <Suspense fallback={<EggLoadingFallback onLoadingChange={setGameLoading} />}>
              {egg.kind === "iframe" ? (
                <>
                  {/* Header bar for the iframe game (canvas games draw their own chrome). */}
                  <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
                    <h2 className="text-lg font-semibold text-app-text">{egg.label}</h2>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={`Close ${egg.label}`}
                      data-testid={`${eggId}-close`}
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

/**
 * The Suspense fallback: an empty box exactly the size the games reserve.
 *
 * Its only other job is telling the shell that the chunk is still loading —
 * it is mounted precisely while `lazy()` is unresolved, which is the window
 * where Escape is still the shell's key to handle (see above). It reports
 * through the setter itself: a fresh closure per render would re-run this
 * component's effect and loop.
 */
function EggLoadingFallback({ onLoadingChange }: { onLoadingChange: (loading: boolean) => void }) {
  useEffect(() => {
    onLoadingChange(true);
    return () => onLoadingChange(false);
  }, [onLoadingChange]);

  return <div className="h-64 w-[680px]" aria-hidden="true" />;
}
