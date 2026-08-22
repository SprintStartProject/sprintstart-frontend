import { useId, useState } from "react";
import { Check, Flag } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { useProjectContext } from "../../projects/useProjectContext";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";

type FlagToPmButtonProps = {
  /** Pre-fills the form with the hire's last question, so flagging is one edit, not a re-type. */
  defaultQuestion?: string;
};

/**
 * The hire's escalation affordance on the buddy home. When the buddy can't help, the hire *chooses*
 * to send the question to their PM — the answer comes back as durable buddy knowledge, so the next
 * person never hits the same wall. Hidden when the hire is on no project (there is no PM to route to).
 */
export function FlagToPmButton({ defaultQuestion = "" }: FlagToPmButtonProps) {
  const { selectedProjectId } = useProjectContext();
  const fieldId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState(defaultQuestion);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!selectedProjectId) return null;

  if (status === "sent") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-app-text-muted">
        <Check className="h-4 w-4 text-app-brand-text" aria-hidden="true" />
        Flagged to your PM — the answer will show up here once they reply.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setQuestion(defaultQuestion);
          setIsOpen(true);
        }}
        className="flex items-center gap-1.5 text-sm text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        Buddy can&apos;t help? Flag it to your PM
      </button>
    );
  }

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

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-3">
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-app-text-muted">
        Send this question to your PM
      </label>
      <AutoResizeTextarea
        id={fieldId}
        value={question}
        onChange={setQuestion}
        placeholder="What do you need answered?"
        minRows={2}
        maxRows={6}
      />
      {status === "error" && (
        <p className="mt-1 text-xs text-app-danger-text">Couldn&apos;t send that — try again.</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!question.trim() || status === "sending"}
          className="rounded-lg bg-app-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send to PM"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg px-3 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
