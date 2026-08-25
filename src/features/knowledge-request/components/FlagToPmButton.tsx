import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Flag } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { Button } from "../../../components/ui/Button";
import { useProjectContext } from "../../projects/useProjectContext";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";

type FlagToPmButtonProps = {
  /** Pre-fills the form with the question being flagged, so flagging is one edit, not a re-type. */
  defaultQuestion?: string;
  /**
   * What the closed trigger says.
   *
   * The default reads as a reaction to an answer that did not land. Under the hire's own
   * question — where the control now lives, because the thing being flagged is the question —
   * that phrasing is about the wrong half of the exchange.
   */
  triggerLabel?: string;
};

/** The form's states swap in place; the shared motion keeps the change continuous. */
type FormState = "idle" | "sending" | "sent" | "error";

/**
 * The hire's escalation affordance on the buddy home. When the buddy can't help, the hire *chooses*
 * to send the question to their PM — the answer comes back as durable buddy knowledge, so the next
 * person never hits the same wall. Hidden when the hire is on no project (there is no PM to route to).
 */
export function FlagToPmButton({
  defaultQuestion = "",
  triggerLabel = "Buddy can't help? Flag it to your PM",
}: FlagToPmButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const { selectedProjectId } = useProjectContext();
  const fieldId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState(defaultQuestion);
  const [status, setStatus] = useState<FormState>("idle");

  if (!selectedProjectId) return null;

  const submit = async () => {
    if (!question.trim()) return;
    setStatus("sending");
    try {
      await knowledgeRequestService.escalate(selectedProjectId, question.trim());
      setStatus("sent");
      setIsOpen(false);
    } catch {
      setStatus("error");
    }
  };

  // The trigger stays deliberately quiet — escalation is the last resort, so it must not
  // compete with the composer for attention. Only what it opens wears the new look.
  if (!isOpen && status !== "sent") {
    return (
      <button
        type="button"
        onClick={() => {
          setQuestion(defaultQuestion);
          setIsOpen(true);
          setStatus("idle");
        }}
        className="flex items-center gap-1.5 rounded text-xs text-app-text-disabled transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {triggerLabel}
      </button>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {status === "sent" ? (
        <motion.div
          key="sent"
          {...(prefersReducedMotion
            ? {}
            : {
                initial: { opacity: 0, scale: 0.97 },
                animate: { opacity: 1, scale: 1 },
                exit: { opacity: 0 },
                transition: { duration: 0.2, ease: "easeOut" as const },
              })}
          className="flex items-center gap-2 self-start rounded-xl bg-app-success-bg px-3 py-2"
        >
          <Check className="h-4 w-4 shrink-0 text-app-success-text" aria-hidden="true" />
          <p className="text-sm text-app-success-text">
            Flagged to your PM — the answer will show up here once they reply.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          {...(prefersReducedMotion
            ? {}
            : {
                initial: { opacity: 0, y: 8, scale: 0.99 },
                animate: { opacity: 1, y: 0, scale: 1 },
                exit: { opacity: 0, y: -6, scale: 0.99 },
                transition: { duration: 0.2, ease: "easeOut" as const },
              })}
          className="shadow-card w-full rounded-2xl border border-app-border bg-app-surface p-4"
        >
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand">
              <Flag className="h-4 w-4" aria-hidden="true" />
            </span>
            <label
              htmlFor={fieldId}
              className="text-xs font-semibold tracking-wide text-app-text-muted uppercase"
            >
              Send this question to your PM
            </label>
          </div>
          <AutoResizeTextarea
            id={fieldId}
            value={question}
            onChange={setQuestion}
            placeholder="What do you need answered?"
            minRows={2}
            maxRows={6}
          />
          <AnimatePresence>
            {status === "error" && (
              <motion.p
                {...(prefersReducedMotion
                  ? {}
                  : {
                      initial: { opacity: 0, height: 0 },
                      animate: { opacity: 1, height: "auto" },
                      exit: { opacity: 0, height: 0 },
                      transition: { duration: 0.18, ease: "easeOut" as const },
                    })}
                className="mt-2 flex items-center gap-1.5 overflow-hidden text-xs text-app-danger-text"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Couldn&apos;t send that — try again.
              </motion.p>
            )}
          </AnimatePresence>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Flag className="h-3.5 w-3.5" />}
              loading={status === "sending"}
              disabled={!question.trim()}
              onClick={() => void submit()}
            >
              Send to PM
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
