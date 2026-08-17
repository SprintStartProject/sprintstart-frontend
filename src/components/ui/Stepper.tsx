import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { centralSpringToken } from "../../styles/tokens";

type StepperProps = {
  /** Ordered step labels. */
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
  /**
   * When given, every already-completed step (index &lt; current) becomes a
   * button that jumps back to it. Forward steps stay inert — advancing still
   * goes through the wizard's own validation, so the stepper only ever moves
   * backwards.
   */
  onStepSelect?: (index: number) => void;
};

/** Tween used for the connector fill; matches the app's page-transition easing. */
const FILL_TRANSITION = { duration: 0.4, ease: [0.32, 0.72, 0, 1] } as const;

/**
 * An animated inline progress indicator: numbered discs joined by connector
 * tracks that fill with the brand colour as progress flows into each step.
 *
 * Everything animates smoothly rather than snapping between states:
 * - the connector before a reached step fills left-to-right,
 * - a disc morphs its fill/border/ink via a colour transition and its number
 *   cross-fades to a check the moment it completes,
 * - the current disc lifts slightly and gains a soft brand halo.
 *
 * Purely presentational — the parent owns which step is active. Respects
 * `prefers-reduced-motion` by dropping the movement while keeping the states.
 */
export function Stepper({ steps, current, onStepSelect }: StepperProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <ol className="flex flex-wrap items-center gap-y-1" aria-label="Progress">
      {steps.map((label, index) => {
        const isCompleted = index < current;
        const isCurrent = index === current;
        const isActive = isCompleted || isCurrent;
        // The connector leading into this step is filled once progress has
        // reached it (i.e. the previous step is done).
        const isReached = index <= current;
        // Only completed steps jump back; the current and any future step stay
        // inert so forward motion keeps going through the wizard's validation.
        const isNavigable = Boolean(onStepSelect) && isCompleted;

        const stepBody = (
          <>
            <span className="relative flex h-6 w-6 items-center justify-center">
              {/* Soft brand halo behind the current disc. */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-app-brand/20"
                initial={false}
                animate={{
                  opacity: isCurrent ? 1 : 0,
                  scale: isCurrent && !prefersReducedMotion ? 1.28 : 0.8,
                }}
                transition={centralSpringToken}
              />

              <motion.span
                className={`relative flex h-6 w-6 items-center justify-center rounded-full border text-xs leading-none font-semibold transition-colors duration-300 ${
                  isActive
                    ? "border-app-brand bg-app-brand text-white"
                    : "border-app-border bg-app-surface text-app-text-muted"
                }`}
                initial={false}
                animate={{ scale: isCurrent && !prefersReducedMotion ? 1.08 : 1 }}
                transition={centralSpringToken}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      initial={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.4, rotate: -35 }
                      }
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                      className="flex items-center justify-center"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
            </span>

            <span
              className={`text-sm whitespace-nowrap transition-colors duration-300 ${
                isCurrent
                  ? "font-medium text-app-text"
                  : isCompleted
                    ? "text-app-text"
                    : "text-app-text-muted"
              }`}
            >
              {label}
            </span>
          </>
        );

        return (
          // The connector track lives inside the <li> (not as a sibling of it),
          // so the <ol> only ever has <li> children — the sole valid child of a
          // list, which screen readers rely on to count list items.
          <li
            key={label}
            className="flex items-center"
            aria-current={isCurrent ? "step" : undefined}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mx-2 h-0.5 w-6 overflow-hidden rounded-full bg-app-border"
              >
                <motion.span
                  className="block h-full w-full origin-left rounded-full bg-app-brand"
                  initial={false}
                  animate={{ scaleX: isReached ? 1 : 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : FILL_TRANSITION}
                />
              </span>
            )}

            {isNavigable ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(index)}
                aria-label={`Go to ${label}`}
                className="-mx-1 flex items-center gap-1.5 rounded-full px-1 py-0.5 transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:outline-none"
              >
                {stepBody}
              </button>
            ) : (
              <span className="flex items-center gap-1.5">{stepBody}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
