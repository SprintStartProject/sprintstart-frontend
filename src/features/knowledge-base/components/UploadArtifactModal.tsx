import { useState, useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getModalDialogVariants, modalBackdropVariants } from '../../../styles/tokens';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { UploadArtifactPanel } from './UploadArtifactPanel';

/**
 * Props for the UploadArtifactModal component.
 */
interface UploadArtifactModalProps {
    isOpen: boolean;
    /** Closes the modal and resets upload state in the parent. */
    onClose: () => void;
    /** Project scope the uploaded files will be ingested into. */
    projectId: string;
    /** Fired once a batch fully succeeds, so the parent can refetch the list. */
    onUploadSuccess?: () => void;
    /** Heading text; the Data Ingestion flow presents this as "Upload Files". */
    title?: string;
}

/**
 * UploadArtifactModal
 *
 * Orchestrates the batch upload process of user documents into the knowledge base.
 * Provides feedback on success or failure for each individual file ingested. The
 * component must stay mounted while open so its exit animation can play — the parent
 * wraps it in `<AnimatePresence>` and toggles `isOpen`.
 */
export function UploadArtifactModal({ isOpen, onClose, projectId, onUploadSuccess, title = 'Upload Artifacts' }: UploadArtifactModalProps) {
    const prefersReducedMotion = useReducedMotion();
    const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

    const [isUploading, setIsUploading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const titleId = useId();

    // Focus trap + Esc-to-close + focus restore. Mirrors the SidePanel pattern so
    // the modal is keyboard-accessible (WCAG 2.1 AA) and consistent with the drawer.
    useEffect(() => {
        if (!isOpen) {
            previouslyFocusedRef.current?.focus();
            return;
        }

        previouslyFocusedRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const animationFrameId = window.requestAnimationFrame(() => {
            const modal = modalRef.current;
            if (!modal) return;
            const focusable = modal.querySelector<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            (focusable ?? modal).focus();
        });

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && !isUploading) {
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const modal = modalRef.current;
            if (!modal) return;

            const focusableElements = Array.from(
                modal.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            ).filter((el) => !el.hasAttribute('aria-hidden'));

            if (focusableElements.length === 0) {
                event.preventDefault();
                modal.focus();
                return;
            }

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, isUploading]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={modalBackdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isUploading) onClose();
                    }}
                >
                    <motion.div
                        ref={modalRef}
                        variants={dialogVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-2xl rounded-2xl bg-app-bg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
                        data-testid="upload-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                    >
                        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
                            <h2 id={titleId} className="text-xl font-semibold text-app-text">{title}</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                onClick={onClose}
                                disabled={isUploading}
                                aria-label="Close upload modal"
                                data-testid="upload-modal-close"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <UploadArtifactPanel
                                projectId={projectId}
                                onUploadSuccess={onUploadSuccess}
                                onFinished={onClose}
                                onUploadingChange={setIsUploading}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
