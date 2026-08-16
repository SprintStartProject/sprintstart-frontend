import { AlertTriangle, CheckCircle2, Info, Undo2, X, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import type { Toast, ToastVariant } from "../../context/ToastContext";
import { centralSpringToken } from "../../styles/tokens";

/**
 * Per-variant look, wired entirely to the semantic colour tokens so light/dark
 * follow the theme for free (see `styles/index.css`):
 *
 * - `card` paints the whole surface — a soft tinted background, a matching
 *   border, and text in the variant's readable ink. Because the text colour is
 *   set here, the icon, the close button and the undo action all inherit it via
 *   `currentColor`, so a toast reads as one coherent colour instead of four.
 * - `bar` is the solid, saturated end of the scale, used only for the thin
 *   countdown bar so it stays legible on top of the soft `card` tint.
 * - `glow` is that same solid colour as a raw CSS variable, fed into the bar's
 *   `box-shadow` so the countdown reads as a softly lit strip rather than a
 *   flat rule — a small nod to the app's rocket/exhaust motif.
 * - `assertive` maps to the ARIA role: warnings and errors interrupt
 *   (`role="alert"`), info and success wait their turn (`role="status"`).
 */
const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: LucideIcon; card: string; bar: string; glow: string; assertive: boolean }
> = {
  info: {
    icon: Info,
    card: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
    bar: "bg-app-brand",
    glow: "var(--brand)",
    assertive: false,
  },
  success: {
    icon: CheckCircle2,
    card: "border-app-success-border bg-app-success-bg text-app-success-text",
    bar: "bg-app-success-solid",
    glow: "var(--success-solid)",
    assertive: false,
  },
  warning: {
    icon: AlertTriangle,
    card: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
    bar: "bg-app-warning-solid",
    glow: "var(--warning-solid)",
    assertive: true,
  },
  error: {
    icon: XCircle,
    card: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
    bar: "bg-app-danger-solid",
    glow: "var(--danger-solid)",
    assertive: true,
  },
};

// Static class strings kept as single-line constants (not inline, multi-line
// concatenations) so the formatter can't split them and drop a join space,
// which would silently fuse two Tailwind classes into one dead token.
const CARD_CLASSES =
  "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-sm";
const ACTION_CLASSES =
  "mt-1.5 inline-flex w-fit items-center gap-1 rounded-lg text-sm font-semibold underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none";
const CLOSE_CLASSES =
  "-mt-0.5 -mr-1 shrink-0 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none";
const VIEWPORT_CLASSES =
  "pointer-events-none fixed inset-x-4 top-[72px] z-[200] flex flex-col items-end gap-3 sm:inset-x-auto sm:top-4 sm:right-4 sm:w-full sm:max-w-sm";

/**
 * A single toast card.
 *
 * It owns its own dismissal: a timer set to the toast's `duration` calls
 * `onDismiss` when it elapses, and a thin bar animates down in lockstep to show
 * how long is left. Both pause while the pointer (or keyboard focus) is on the
 * card, then resume from where they stopped — so a user reading a long error is
 * never robbed of it mid-sentence. A `duration` of `Infinity`/`0` makes the
 * toast sticky: no timer, no bar, only the close button dismisses it.
 *
 * Keeping the timer here rather than in the provider is what makes hover-pause
 * cheap — the provider would otherwise have to track wall-clock time for every
 * open toast just to answer "how much is left on this one".
 */
function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const prefersReducedMotion = useReducedMotion();
  const progress = useAnimationControls();
  const config = VARIANT_CONFIG[toast.variant];
  const Icon = config.icon;

  const duration = toast.duration ?? 5000;
  const sticky = !Number.isFinite(duration) || duration <= 0;

  // `remainingRef` is the source of truth for time left; `startedAtRef` marks
  // when the current run began so a pause can subtract the elapsed slice.
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (sticky || remainingRef.current <= 0) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    if (!prefersReducedMotion) {
      // Animate `width` rather than `scaleX`: a scaled bar would squash its
      // rounded right cap into a flat oval as it shrinks, whereas a width
      // tween keeps the cap a true semicircle the whole way down.
      void progress.start({
        width: "0%",
        transition: { duration: remainingRef.current / 1000, ease: "linear" },
      });
    }
  }, [sticky, onDismiss, toast.id, prefersReducedMotion, progress]);

  const pause = useCallback(() => {
    if (sticky) return;
    clearTimer();
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    progress.stop();
  }, [sticky, clearTimer, progress]);

  // Start the countdown on mount and tear the timer down on unmount. All the
  // callbacks are stable (useCallback over stable deps), so this runs once.
  useEffect(() => {
    if (sticky) return;
    if (!prefersReducedMotion) progress.set({ width: "100%" });
    resume();
    return clearTimer;
  }, [sticky, prefersReducedMotion, progress, resume, clearTimer]);

  const handleAction = () => {
    toast.action?.onClick();
    onDismiss(toast.id);
  };

  return (
    <motion.li
      layout
      role={config.assertive ? "alert" : "status"}
      aria-atomic="true"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 64, scale: 0.95 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 64, scale: 0.9, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
      }
      transition={centralSpringToken}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`${CARD_CLASSES} ${config.card}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-snug font-semibold break-words">{toast.message}</p>
        {toast.description && (
          <p className="text-sm leading-snug break-words opacity-80">{toast.description}</p>
        )}
        {toast.action && (
          <button type="button" onClick={handleAction} className={ACTION_CLASSES}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className={CLOSE_CLASSES}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {!sticky && !prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ width: "100%" }}
          animate={progress}
          // `box-shadow` (not a Tailwind class) so the glow colour can come
          // straight from the variant's solid token; the card's `overflow-hidden`
          // trims the bloom to the rounded rect, leaving a soft upward-lit strip.
          // Anchored left with `rounded-r-full` so only the shrinking (right)
          // end is capped; the left end sits flush in the card's corner.
          style={{ boxShadow: `0 0 8px 0 ${config.glow}` }}
          className={`absolute bottom-0 left-0 h-0.5 rounded-r-full ${config.bar}`}
        />
      )}
    </motion.li>
  );
}

/**
 * The fixed, portalled region that stacks the live toasts.
 *
 * Rendered by {@link ToastProvider}; not meant to be used on its own. It portals
 * to `document.body` so it escapes any transformed or clipped ancestor and can
 * truly pin to the viewport corner. Position is top-right on desktop; on narrow
 * screens it spans the width and drops below the mobile top bar (`top-[72px]`)
 * so it never covers the header controls. The list is `pointer-events-none` so
 * clicks fall through the gaps between cards to the page; each card re-enables
 * pointer events for itself.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <ol aria-label="Notifications" className={VIEWPORT_CLASSES}>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </ol>,
    document.body,
  );
}
