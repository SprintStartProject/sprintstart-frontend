import { useState } from "react";
import { Clock, MessageSquareText } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { KnowledgeRequest } from "../types";
import { formatWaiting, hasWaitedADay } from "../format";
import { AnswerForm } from "./AnswerForm";

type RequestCardProps = {
  request: KnowledgeRequest;
  onAnswer: (requestId: string, answer: string, question: string) => Promise<void>;
  onDismiss: (requestId: string) => Promise<void>;
};

/**
 * One open escalated question in the PM inbox. The wait time is the triage signal (the list is
 * longest-first), so it leads. Answering opens the compose form; dismissing closes a one-off or
 * duplicate without minting durable knowledge.
 */
export function RequestCard({ request, onAnswer, onDismiss }: RequestCardProps) {
  const [composing, setComposing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const waited = formatWaiting(request.createdAt);
  // A question sitting a day or more is the one a PM should feel; flag it warm.
  const isStale = hasWaitedADay(request.createdAt);

  return (
    <li className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <MessageSquareText
            className="mt-0.5 h-4 w-4 shrink-0 text-app-text-muted"
            aria-hidden="true"
          />
          <p className="text-sm text-app-text">{request.question}</p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 text-xs font-medium ${
            isStale ? "text-app-warning-text" : "text-app-text-muted"
          }`}
          title="How long this has waited on a person"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {waited}
        </span>
      </div>

      {composing ? (
        <AnswerForm
          originalQuestion={request.question}
          onSubmit={(answer, question) => onAnswer(request.id, answer, question)}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <div className="mt-3 flex items-center gap-2">
          {/* The shared Button brings the focus ring, press motion and disabled
              treatment these actions previously lacked. */}
          <Button variant="primary" size="sm" onClick={() => setComposing(true)}>
            Answer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={dismissing}
            onClick={() => {
              setDismissing(true);
              void onDismiss(request.id).catch(() => setDismissing(false));
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
    </li>
  );
}
