import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../../../components/ui/Button.tsx";
import { useScrollLock } from "../../../components/ui/useScrollLock.ts";
import { getModalDialogVariants, modalBackdropVariants } from "../../../styles/tokens.ts";
import { EGG_REGISTRY } from "../registry.ts";
import type { EggId } from "../registry.ts";
import { EggErrorBoundary } from "./EggErrorBoundary.tsx";

/** Everything Tab can land on inside the dialog, in document order. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

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
 * - Canvas games (Space Invaders) own their keyboard and already draw
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
 * whoever held it before when the dialog closes (if that element is still
 * in the document); focus cannot leave the dialog while it is open — Tab in
 * the parent chrome wraps, and focus that escapes any other way (tabbing
 * past the last control *inside* the 2048 iframe, whose keydowns this
 * window never sees) is pulled straight back. The canvas games never use
 * Tab, so neither mechanism fights them.
 * The one thing every overlay needs regardless — the page behind it
 * holding still — comes from `useScrollLock`.
 *
 * A game whose chunk fails to load (stale deploy, offline) is caught by
 * {@link EggErrorBoundary}: the modal explains and stays closable instead of
 * the error unmounting the whole app.
 */
export function EggModalShell({ eggId, open, onClose }: EggModalShellProps) {
  const egg = EGG_REGISTRY[eggId];

  useScrollLock(open);
  const prefersReducedMotion = useReducedMotion();
  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

  // Focus in on open, back to the opener on close, and never anywhere else
  // in between. The dialog carries `tabIndex={-1}` so it is programmatically
  // focusable without joining the page's Tab order.
  //
  // A *layout* effect on purpose: it runs before any child's passive effect,
  // so the opener is recorded before a game (e.g. the 2048 frame focusing
  // itself) can move focus — a plain effect here would, on a cached-chunk
  // reopen, record the game as the opener. Restoring happens in the cleanup,
  // i.e. the moment `open` flips false, and only onto an opener that is
  // still in the document: focusing a removed node is a silent no-op that
  // would strand keyboard users on <body>, so better not to pretend.
  //
  // The focusin guard is the half of the trap the Tab handler below cannot
  // provide: a Tab press inside the 2048 iframe is dispatched to the frame's
  // own document, so tabbing past the frame's last control moves focus onto
  // the page behind the overlay without this window ever seeing the key.
  // Focus landing outside the dialog is pulled back; where it landed tells
  // the direction — before the dialog in document order means the user went
  // backwards (wrap to the last focusable), anything else forwards (wrap to
  // the first). It lives in this same effect so the cleanup can remove it
  // *before* restoring focus; otherwise the restore itself — the dialog is
  // still in the DOM during its exit animation — would be pulled back in.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;

    const onFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      const target = e.target;
      if (!dialog || !(target instanceof Node) || dialog.contains(target)) return;
      const focusables = getFocusables(dialog);
      const wentBackwards = Boolean(
        target.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const next = wentBackwards ? focusables[focusables.length - 1] : focusables[0];
      (next ?? dialog).focus();
    };

    dialogRef.current?.focus();
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  // Tab wraps inside the dialog for presses the parent window sees (the
  // header close button, the dialog itself). Deliberately Tab-only: canvas
  // games bind arrows/w/s/space on the window. Presses inside the 2048
  // iframe never reach this handler — the focusin guard above covers those.
  // The focusable list includes the iframe itself, so one Tab from the
  // header close button walks into the frame.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog || !(e.target instanceof Node) || !dialog.contains(e.target)) return;

      const focusables = getFocusables(dialog);
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
            {/* Header bar for the iframe game (canvas games draw their own
                chrome). Outside the boundary and Suspense so the close
                button is there while the chunk loads and if it fails. */}
            {egg.kind === "iframe" && (
              <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
                <h2 className="text-lg font-semibold text-app-text">{egg.label}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={onClose}
                  aria-label={`Close ${egg.label}`}
                  data-testid={`${eggId}-close`}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}
            {/* All registry components are lazy: Suspense covers the fetch,
                the boundary covers a fetch that fails. The boundary only
                brings its own close controls where the header above does
                not already provide them. */}
            <EggErrorBoundary label={egg.label} onClose={onClose} ownsClose={egg.kind !== "iframe"}>
              <Suspense fallback={<EggLoadingFallback onLoadingChange={setGameLoading} />}>
                <Game onExit={onClose} />
              </Suspense>
            </EggErrorBoundary>
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
