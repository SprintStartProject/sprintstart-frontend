import { useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { StarterWorkTask } from "../types";

type StarterWorkTaskCardProps = {
  task: StarterWorkTask;
  /** HR can read the queue but not decide on it. */
  canAct: boolean;
  /** Whether this task's detail drawer is the one currently open. */
  isOpen: boolean;
  /** Toggle this task's detail drawer (open it, or close it if it is already the open one). */
  onSelect: (task: StarterWorkTask) => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
};

/** The action cluster slides its buttons in with a short stagger; reduced motion just fades them. */
const CLUSTER_VARIANTS: Variants = {
  rest: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
};

const BUTTON_SPRING = { type: "spring", stiffness: 520, damping: 30, mass: 0.6 } as const;

/**
 * One mined starter task in the review list, kept compact.
 *
 * The whole row toggles the detail drawer, where the AI's scope-safety rationale lives. The two
 * quick decisions sit here too, sliding in while the pointer is over this row or focus is within it,
 * so a PM can clear an obvious one without opening it. On touch, where there is no hover, they stay
 * out of the way and the drawer is the way in. The outcome of a decision is surfaced by a toast.
 */
export function StarterWorkTaskCard({
  task,
  canAct,
  isOpen,
  onSelect,
  onApprove,
  onReject,
}: StarterWorkTaskCardProps) {
  const [isDeciding, setIsDeciding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const showActions = canAct && (isHovered || isFocusWithin);

  const buttonVariants: Variants = prefersReducedMotion
    ? { rest: { opacity: 0 }, show: { opacity: 1 } }
    : {
        rest: { opacity: 0, x: 14, scale: 0.85 },
        show: { opacity: 1, x: 0, scale: 1, transition: BUTTON_SPRING },
      };

  const decide = async (action: () => Promise<void>) => {
    setIsDeciding(true);
    try {
      await action();
      // On success the task leaves the queue and this card unmounts, so there is
      // nothing to reset; the toast owns the feedback.
    } catch {
      // The page's handler already raised a toast for the failure — just let the
      // row settle back so it can be tried again.
      setIsDeciding(false);
    }
  };

  return (
    <div
      data-task-card
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={() => setIsFocusWithin(false)}
      className="relative rounded-2xl border border-app-border bg-app-bg transition-colors hover:border-app-border-strong"
    >
      {/* A stretched button rather than an interactive wrapper: it sits behind
          the content as a sibling of the quick actions, so nothing interactive
          is nested inside anything interactive. Everything on top is
          pointer-transparent except the actions, so a click anywhere else
          falls through to this and toggles the drawer. */}
      <button
        type="button"
        onClick={(event) => {
          onSelect(task);
          // A mouse open leaves this trigger focused, and the drawer returns focus
          // here on close — showing a focus ring the pointer user never asked for.
          // Blur so focus falls back to the body. Keyboard activation (detail 0)
          // keeps the ring, which is where it belongs.
          if (event.detail !== 0) {
            event.currentTarget.blur();
          }
        }}
        aria-label={isOpen ? `Close details for ${task.title}` : `Open details for ${task.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      />

      <div className="pointer-events-none relative z-10 flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-app-text">{task.title}</h3>
          {task.summary && (
            <p className="mt-0.5 line-clamp-1 text-sm text-app-text-muted">{task.summary}</p>
          )}
          {task.competencyKeys.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {task.competencyKeys.map((key) => (
                <li key={key}>
                  <Badge variant="purple" size="md">
                    {key}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canAct && (
          <motion.div
            initial={false}
            animate={showActions ? "show" : "rest"}
            variants={CLUSTER_VARIANTS}
            className="pointer-events-auto flex shrink-0 items-center gap-2 self-center"
          >
            <motion.button
              type="button"
              variants={buttonVariants}
              whileHover={
                prefersReducedMotion ? undefined : { scale: 1.06, transition: BUTTON_SPRING }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              data-testid={`approve-task-${task.id}`}
              disabled={isDeciding}
              onClick={() => void decide(() => onApprove(task.id))}
              aria-label="Looks good"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-app-success-border bg-app-success-bg px-4 py-5 text-xs font-semibold whitespace-nowrap text-app-success-text transition-colors hover:border-app-success-solid hover:bg-app-success-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeciding ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Looks good
            </motion.button>
            <motion.button
              type="button"
              variants={buttonVariants}
              whileHover={
                prefersReducedMotion ? undefined : { scale: 1.06, transition: BUTTON_SPRING }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              data-testid={`reject-task-${task.id}`}
              disabled={isDeciding}
              onClick={() => void decide(() => onReject(task.id))}
              aria-label="Take it out of the pool"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-5 text-xs font-semibold whitespace-nowrap text-app-danger-text transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Take it out
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
