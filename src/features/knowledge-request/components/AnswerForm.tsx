import { useId, useState } from "react";
import { BookCheck } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { Button } from "../../../components/ui/Button";

type AnswerFormProps = {
  /** The hire's original wording — pre-fills the (optional) generalised question. */
  originalQuestion: string;
  /** Mints the durable answer; the parent handles the request lifecycle and refresh. */
  onSubmit: (answer: string, question: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * The PM's compose surface for answering an escalated question. The answer text is required; the
 * question is pre-filled with the hire's original wording but editable, so a PM can generalise it
 * ("how do I run the tests?" instead of "why does npm test hang for me?") and the durable answer
 * then matches more than the one phrasing that triggered it.
 */
export function AnswerForm({ originalQuestion, onSubmit, onCancel }: AnswerFormProps) {
  const questionId = useId();
  const answerId = useId();
  const [question, setQuestion] = useState(originalQuestion);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const submit = async () => {
    if (!answer.trim()) return;
    setStatus("saving");
    try {
      await onSubmit(answer.trim(), question.trim());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-app-border bg-app-bg p-3">
      <div>
        <label htmlFor={questionId} className="mb-1 block text-xs font-medium text-app-text-muted">
          Question the buddy will match (edit to generalise)
        </label>
        <AutoResizeTextarea
          id={questionId}
          value={question}
          onChange={setQuestion}
          placeholder="What is the buddy being asked?"
          minRows={1}
          maxRows={4}
        />
      </div>
      <div>
        <label htmlFor={answerId} className="mb-1 block text-xs font-medium text-app-text-muted">
          Your answer — the buddy will serve this next time
        </label>
        <AutoResizeTextarea
          id={answerId}
          value={answer}
          onChange={setAnswer}
          placeholder="Answer it once, for everyone after."
          minRows={3}
          maxRows={12}
        />
      </div>
      {status === "error" && (
        <p className="text-xs text-app-danger-text">Couldn&apos;t save that — try again.</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          icon={<BookCheck className="h-3.5 w-3.5" />}
          loading={status === "saving"}
          disabled={!answer.trim()}
          onClick={() => void submit()}
        >
          Answer &amp; publish
        </Button>
        <Button variant="secondary" size="sm" disabled={status === "saving"} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
