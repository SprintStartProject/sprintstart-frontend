import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getModalDialogVariants, modalBackdropVariants } from "../../../styles/tokens";
import { SpaceInvaders } from "../../easter-eggs/components/SpaceInvaders.tsx";

/**
 * Props for {@link SpaceInvadersModal}.
 */
interface SpaceInvadersModalProps {
    /** When true, the modal is visible and the game is mounted. */
    open: boolean;
    /**
     * Called when the user requests to close (overlay click, or via the
     * SpaceInvaders' own Esc / exit button — SpaceInvaders calls `onExit`
     * on Escape and on its in-game "Esc ✕" button, which we route here).
     */
    onClose: () => void;
}

/**
 * Dashboard easter-egg wrapper that mounts the existing {@link SpaceInvaders}
 * game inside a Framer Motion modal.
 *
 * Mirrors {@link DinoGameModal}: no header bar and no modal-level Escape
 * listener — {@link SpaceInvaders} already renders its own score /
 * "Esc ✕" overlay on top of the canvas and calls `onExit` on Escape, so a
 * second header or Esc handler would duplicate chrome and double-fire on
 * Esc. Opened from the dashboard via the Ctrl+Shift+3 chord
 * ({@link useSpaceInvadersShortcut}); also reused by the 404 page.
 */
export function SpaceInvadersModal({ open, onClose }: SpaceInvadersModalProps) {
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
                    aria-label="Space Invaders game"
                >
                    <motion.div
                        className="relative max-w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
                        variants={dialogVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SpaceInvaders onExit={onClose} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
