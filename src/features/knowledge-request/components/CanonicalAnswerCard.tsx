import { useId, useState } from "react";
import { BookCheck, Pencil } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { Button } from "../../../components/ui/Button";
import type { CanonicalAnswer } from "../types";
import { formatDateTime } from "../format";

type CanonicalAnswerCardProps = {
  answer: CanonicalAnswer;
  onSave: (answerId: string, question: string, answer: string) => Promise<void>;
  /** HR can read durable answers but not edit them; hide the affordance rather than reject on save. */
  readOnly?: boolean;
};

/**
 * One durable answer the buddy now serves. Editable inline: when reality changes a PM keeps it
 * current here, and the buddy serves the new text — no re-escalation needed. This view is what
 * makes the growth loop visible: escalated questions become knowledge that lives on.
 */
export function CanonicalAnswerCard({
  answer,
  onSave,
  readOnly = false,
}: CanonicalAnswerCardProps) {
  const questionId = useId();
  const answerId = useId();
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(answer.question);
  const [body, setBody] = useState(answer.answer);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const save = async () => {
    if (!question.trim() || !body.trim()) return;
    setStatus("saving");
    try {
      await onSave(answer.id, question.trim(), body.trim());
      setEditing(false);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const cancel = () => {
    setQuestion(answer.question);
    setBody(answer.answer);
    setStatus("idle");
    setEditing(false);
  };

  return (
    <li className="rounded-xl border border-app-border bg-app-surface p-4">
      {editing ? (
        <div className="space-y-3">
          <div>
            <label
              htmlFor={questionId}
              className="mb-1 block text-xs font-medium text-app-text-muted"
            >
              Question
            </label>
            <AutoResizeTextarea
              id={questionId}
              value={question}
              onChange={setQuestion}
              minRows={1}
              maxRows={4}
            />
          </div>
          <div>
            <label
              htmlFor={answerId}
              className="mb-1 block text-xs font-medium text-app-text-muted"
            >
              Answer
            </label>
            <AutoResizeTextarea
              id={answerId}
              value={body}
              onChange={setBody}
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
              loading={status === "saving"}
              disabled={!question.trim() || !body.trim()}
              onClick={() => void save()}
            >
              Save
            </Button>
            <Button variant="secondary" size="sm" disabled={status === "saving"} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <BookCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-app-text">{answer.question}</p>
            </div>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
          <p className="mt-2 pl-6 text-sm whitespace-pre-wrap text-app-text-muted">
            {answer.answer}
          </p>
          <p className="mt-2 pl-6 text-xs text-app-text-disabled">
            Updated {formatDateTime(answer.updatedAt)}
          </p>
        </>
      )}
    </li>
  );
}
