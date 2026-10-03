import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronsLeft, KeyRound } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { useDialogFocus } from "../../../components/ui/useDialogFocus.ts";
import { useMediaQuery } from "../../../hooks/useMediaQuery.ts";

/**
 * Below this width the credential form stays inline (phone/tablet); at or above
 * it there is room to slide the wizard aside and show the companion beside it
 * with only a minimal loss of modal width.
 */
const DESKTOP_QUERY = "(min-width: 1280px)";

/** The button that opens a credential form. */
function TriggerButton({
  label,
  onClick,
  ref,
}: {
  label: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <Button
      ref={ref}
      variant="secondary"
      size="sm"
      onClick={onClick}
      icon={<KeyRound className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}

/**
 * A compact "nothing stored yet" chip shown beside a credential trigger button.
 * Styled after the warning toast (icon + warning ink) but pushed a touch more
 * yellow, so it reads as a small hint rather than a full-width banner.
 */
function MissingCredentialChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-yellow-400 bg-yellow-200 px-3 text-xs font-medium text-app-warning-text dark:border-yellow-400/50 dark:bg-yellow-400/15">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Gap between the wizard modal and the companion, and the companion's width. */
export const COMPANION_GAP = 16;
export const COMPANION_WIDTH = 360;
const VIEWPORT_MARGIN = 12;

/**
 * The desktop companion: a small modal-like card portalled to `<body>` and
 * positioned just to the right of the wizard modal, with a small gap. It is a
 * separate floating panel (no backdrop) so the wizard stays visible beside it,
 * and it slides in/out. Escape closes only the companion — a capture-phase
 * handler stops the event before the wizard modal's own Escape-to-close fires.
 *
 * Being portalled beside the wizard, it sits outside the wizard's Tab trap, so
 * it runs its own: focus moves in on open, Tab stays inside while open, and
 * focus returns to the trigger on close. Without that, a keyboard user who saved
 * a token was left with focus on `<body>`, and the next Tab landed on the page
 * underneath the wizard.
 *
 * The position is measured from the wizard dialog (found via `anchorRef`) and
 * re-measured on scroll/resize; it clamps into the viewport if the modal sits
 * too far right for the full gap.
 */
function CompanionModal({
  isOpen,
  onClose,
  title,
  anchorRef,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: -9999 });
  // Remembers the last applied top/left so the per-frame tracker only triggers a
  // re-render when the position actually moves.
  const lastPositionRef = useRef({ top: -9999, left: -9999 });

  const position = useCallback(() => {
    const dialog = anchorRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    const rect = dialog?.getBoundingClientRect();

    const top = rect ? rect.top : 80;
    let left = rect
      ? rect.right + COMPANION_GAP
      : window.innerWidth - VIEWPORT_MARGIN - COMPANION_WIDTH;
    // Keep it on-screen if the modal sits too far right for the full gap.
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - COMPANION_WIDTH;
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft);

    if (lastPositionRef.current.top === top && lastPositionRef.current.left === left) return;
    lastPositionRef.current = { top, left };

    setStyle({
      position: "fixed",
      top,
      left,
      width: COMPANION_WIDTH,
      maxHeight: window.innerHeight - top - VIEWPORT_MARGIN,
    });
  }, [anchorRef]);

  // Measure before paint so the card never flashes at the wrong spot, then keep
  // it glued to the wizard modal every frame while open — the modal's entrance
  // and its slide-left both move continuously, and staying flush with its top
  // edge means following that. `position` no-ops when nothing moved, so the loop
  // only ever costs a `getBoundingClientRect` per frame.
  useLayoutEffect(() => {
    if (!isOpen) return;

    lastPositionRef.current = { top: -9999, left: -9999 };

    let frame = 0;
    const loop = () => {
      position();
      frame = window.requestAnimationFrame(loop);
    };
    loop();

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  // Portal wraps AnimatePresence (not the reverse) — an AnimatePresence whose
  // child is a `createPortal(...)` drops it in the browser.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label={title}
          style={style}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="z-[70] flex flex-col overflow-hidden rounded-[22px] border border-app-border bg-app-bg shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-lg font-semibold text-app-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close credential form"
              className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Places a credential form either inline (phone) or in a small companion modal
 * to the right of the wizard (desktop), behind a trigger button, so a user with no
 * stored token/credential can create one without leaving the flow.
 *
 * On a phone the form opens inline in place (the trigger is replaced by it); on
 * a wider screen it opens in a right-hand drawer that slides in over the wizard
 * and closes itself once the token/credential is saved. The form owns save +
 * cancel; this only decides where it is shown. `renderForm` is given a `close`
 * callback to wire into the form's save/cancel, so the container closes on both —
 * and, since the form calls it after a save, the companion closes once the
 * token/credential is added.
 */
export function CredentialSlot({
  buttonLabel,
  panelTitle,
  renderForm,
  onCompanionOpenChange,
  missingLabel,
}: {
  buttonLabel: string;
  panelTitle: string;
  /**
   * `embedded` is true only when the form is rendered inside the desktop
   * companion — which already provides the card and title — so the form can
   * drop its own chrome and sit directly in the panel.
   */
  renderForm: (close: () => void, embedded: boolean) => ReactNode;
  /** Told when the desktop companion opens/closes, so the wizard can slide left. */
  onCompanionOpenChange?: (open: boolean) => void;
  /**
   * When set, a compact warning chip with this text is shown beside the trigger
   * button (e.g. "No token yet") — a hint that nothing is stored yet. Omit it
   * once a credential exists.
   */
  missingLabel?: string;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const close = () => setIsOpen(false);

  // Hand focus back to the trigger once the form closes (saved or cancelled).
  // The focused control was inside the form, so without this focus drops to
  // `<body>` and the next Tab escapes the wizard onto the page behind it. On
  // phone the trigger remounts in place of the inline form, hence the effect.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) triggerRef.current?.focus();
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const companionOpen = isDesktop && isOpen;
  useEffect(() => {
    onCompanionOpenChange?.(companionOpen);
    return () => onCompanionOpenChange?.(false);
  }, [companionOpen, onCompanionOpenChange]);

  if (!isDesktop) {
    // Phone: unchanged inline behaviour — the trigger is replaced by the
    // self-contained form card (its own chrome, so not embedded).
    return isOpen ? (
      <>{renderForm(close, false)}</>
    ) : (
      <div className="flex flex-wrap items-center gap-3">
        <TriggerButton ref={triggerRef} label={buttonLabel} onClick={() => setIsOpen(true)} />
        {missingLabel && <MissingCredentialChip label={missingLabel} />}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="flex flex-wrap items-center gap-3">
      <TriggerButton ref={triggerRef} label={buttonLabel} onClick={() => setIsOpen(true)} />
      {missingLabel && <MissingCredentialChip label={missingLabel} />}
      <CompanionModal isOpen={isOpen} onClose={close} title={panelTitle} anchorRef={anchorRef}>
        {renderForm(close, true)}
      </CompanionModal>
    </div>
  );
}
