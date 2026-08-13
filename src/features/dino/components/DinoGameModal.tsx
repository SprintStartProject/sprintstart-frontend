import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useScrollLock } from "../../../components/ui/useScrollLock";
import { getModalDialogVariants, modalBackdropVariants } from "../../../styles/tokens";
import { DinoGame } from "../../chatbot/components/DinoGame";

/**
 * Props for {@link DinoGameModal}.
 */
interface DinoGameModalProps {
  /** When true, the modal is visible and the dino runner is mounted. */
  open: boolean;
  /**
   * Called when the user requests to close (overlay click, or via the
   * DinoGame's own Esc / exit button — DinoGame calls `onExit` on Escape
   * and on its in-game "Esc ✕" button, which we route here).
   */
  onClose: () => void;
}

/**
 * Dashboard easter-egg wrapper that mounts the existing {@link DinoGame}
 * runner inside a Framer Motion modal.
 *
 * Unlike {@link Game2048Modal}, this wrapper has no header bar and no
 * modal-level Escape listener: {@link DinoGame} already renders its own
 * score / "Esc ✕" overlay on top of the canvas and calls `onExit` on
 * Escape, so adding a second header or Esc handler would duplicate chrome
 * and double-fire on Esc. Bypasses the `dinoUnlocked` localStorage gate —
 * the dashboard chord is a true easter egg, always available.
 */
export function DinoGameModal({ open, onClose }: DinoGameModalProps) {
  // Not a `Modal`: the game owns the keyboard, and Modal's focus trap
  // would fight it for the arrow keys. The one thing every overlay needs
  // regardless is the page behind it holding still.
  useScrollLock(open);

  const prefersReducedMotion = useReducedMotion();
  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

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
          aria-label="Dino game"
        >
          <motion.div
            className="relative w-[680px] max-w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <DinoGame onExit={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
