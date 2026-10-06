import { motion, useReducedMotion } from "framer-motion";
import { centralSpringToken, hoverSpringToken } from "../../../styles/tokens";

interface TaskCheckItemProps {
  index: number;
  title: string;
  description?: string | null;
  isDone: boolean;
  onToggle: () => void;
}

/**
 * One task inside an onboarding step.
 *
 * The tick is drawn rather than swapped: a `CheckCircle2` replacing a `Circle`
 * changes state without ever showing the *act* of completing, which is the part
 * that feels good. Here the ring fills, the check strokes itself on, and a
 * short pulse rings out — roughly 400ms of feedback for a click that used to
 * produce none.
 *
 * The strikethrough is deliberately kept: crossing something out is the oldest
 * "done" signal there is, and it survives being the only cue for anyone who
 * cannot separate the green from the grey.
 *
 * Only the tick is a button. The whole row used to be one, and text inside a
 * button cannot be selected -- so a task could not be marked to hand to the
 * buddy (the app-wide selection toolbar's "Ask the buddy") or copied at all.
 * The tick and the rest of the row still tick it; the text itself does not, since a
 * click there is how selecting starts -- a double-click on a word is a single click
 * first, and would tick the task on the way to selecting the word.
 */
export function TaskCheckItem({ index, title, description, isDone, onToggle }: TaskCheckItemProps) {
  const reduceMotion = useReducedMotion();

  return (
    // The row's click is a larger target for the mouse; the tick is the control, for the keyboard
    // and for assistive technology, so the row itself needs no role or key handling.
    <motion.div
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button, [data-task-text]")) {
          return;
        }
        // Dragging from the row onto the text to select it ends in a click; that is not a tick.
        if (window.getSelection()?.isCollapsed === false) return;
        onToggle();
      }}
      className={`flex w-full cursor-pointer items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
        isDone
          ? "border-app-success-border bg-app-success-bg"
          : "border-app-border hover:border-app-brand-border-strong"
      }`}
      whileHover={reduceMotion ? undefined : { x: 3 }}
      transition={hoverSpringToken}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        aria-pressed={isDone}
        aria-label={`${index + 1}. ${title}`}
        className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        whileTap={reduceMotion ? undefined : { scale: 0.9 }}
      >
        {/* Pulse that rings out of the tick on completion. Keyed on the
                    done state so it replays on every re-check, not just once. */}
        {isDone && !reduceMotion && (
          <motion.span
            key="pulse"
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-app-success-solid"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}

        <motion.span
          aria-hidden="true"
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            isDone ? "border-app-success-solid bg-app-success-solid" : "border-app-border-strong"
          }`}
          animate={reduceMotion || !isDone ? { scale: 1 } : { scale: [1, 0.82, 1.12, 1] }}
          transition={reduceMotion ? { duration: 0 } : centralSpringToken}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Opacity is animated alongside the draw, not for the
                            fade: a round stroke cap at `pathLength: 0` still
                            paints its cap, which shows up as a stray dot inside
                            an unchecked circle. Snapping opacity to 0 removes it
                            without giving up the rounded ends on the drawn check. */}
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={false}
              animate={{
                pathLength: isDone ? 1 : 0,
                opacity: isDone ? 1 : 0,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      pathLength: {
                        duration: 0.28,
                        delay: isDone ? 0.06 : 0,
                        ease: "easeOut",
                      },
                      opacity: { duration: 0 },
                    }
              }
            />
          </svg>
        </motion.span>
      </motion.button>

      <span data-task-text className="min-w-0 cursor-text select-text">
        <span
          className={`relative inline text-sm font-medium ${
            isDone ? "text-app-text-subtle" : "text-app-text"
          }`}
        >
          {index + 1}. {title}
          {/* Rule drawn across the label rather than `line-through`, so
                        it can sweep in with the tick instead of appearing whole. */}
          <motion.span
            aria-hidden="true"
            className="absolute top-1/2 left-0 h-px w-full origin-left bg-app-text-subtle"
            initial={false}
            animate={{ scaleX: isDone ? 1 : 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.3, delay: isDone ? 0.1 : 0, ease: "easeOut" }
            }
          />
        </span>

        {description && <p className="mt-0.5 text-xs text-app-text-muted">{description}</p>}
      </span>
    </motion.div>
  );
}
