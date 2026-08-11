import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useScrollLock } from "../../../components/ui/useScrollLock";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getModalDialogVariants, modalBackdropVariants } from "../../../styles/tokens";

/**
 * Props for {@link Game2048Modal}.
 */
interface Game2048ModalProps {
  /** When true, the modal is visible and the iframe is mounted. */
  open: boolean;
  /** Called when the user requests to close (Esc, overlay click, X button). */
  onClose: () => void;
}

/**
 * A modal wrapper that loads the self-contained 2048 game from
 * `/easter-eggs/2048.html` in an iframe.
 *
 * The game itself is vanilla JS — this component only provides the
 * surrounding chrome (backdrop, panel, close button, animations).
 * Theme/dark-mode is handled inside the iframe; the wrapper uses
 * SPRINTSTART's semantic tokens so the chrome blends in.
 *
 * Keyboard behaviour: the iframe is focused on load so arrow keys work
 * immediately (no click required). Escape closes the modal whether it's
 * pressed while the iframe has focus (listener attached inside the
 * iframe document — same-origin) or while focus is outside the iframe
 * (listener on the parent window). The two listeners don't double-fire
 * because keydown events inside a focused iframe don't bubble to the
 * parent document.
 */
export function Game2048Modal({ open, onClose }: Game2048ModalProps) {
  // Not a `Modal`: the game owns the keyboard, and Modal's focus trap
  // would fight it for the arrow keys. The one thing every overlay needs
  // regardless is the page behind it holding still.
  useScrollLock(open);

  const prefersReducedMotion = useReducedMotion();
  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Close on Escape when focus is outside the iframe (header, close
  // button, or before the iframe has loaded).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Once the iframe has loaded: focus it so arrow keys work without a
  // click, and attach an Esc listener inside the iframe document (key
  // events inside a focused iframe don't bubble out to the parent, so
  // the window listener above can't see them).
  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) return;

    win.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    doc.addEventListener("keydown", onKeyDown);
    // The iframe is unmounted on close (AnimatePresence exit), which
    // discards its contentDocument and the listener with it.
  };

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
          aria-labelledby="game2048-title"
        >
          <motion.div
            className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
              <h2 id="game2048-title" className="text-lg font-semibold text-app-text">
                2048
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close 2048 game"
                data-testid="game2048-close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            {/* Iframe: the game lives in public/easter-eggs/2048.html */}
            <iframe
              ref={iframeRef}
              src="/easter-eggs/2048.html"
              title="2048 game"
              loading="lazy"
              onLoad={handleIframeLoad}
              className="h-[675px] w-[510px] max-w-full border-0"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
