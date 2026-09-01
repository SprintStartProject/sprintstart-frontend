import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MessageSquareText } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { EscalationHire, KnowledgeRequest } from "../types";
import { formatWaiting, hasWaitedADay } from "../format";
import { AnswerForm } from "./AnswerForm";

type RequestCardProps = {
  request: KnowledgeRequest;
  onAnswer: (requestId: string, answer: string, question: string) => Promise<void>;
  onDismiss: (requestId: string) => Promise<void>;
};

/**
 * One open escalated question in the PM inbox. The wait time is the triage signal (the list is
 * longest-first), so it keeps its place at the top right. Answering opens the compose form;
 * dismissing closes a one-off or duplicate without minting durable knowledge.
 *
 * The asker leads, because answering well depends on who is asking: the same question means
 * different things from somebody on their first morning and from somebody three weeks in. Before
 * this, a PM had a question and a wait time and had to go and find out the rest by hand.
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
        {/* Nothing at all when the asker could not be resolved, rather than a placeholder
            avatar: a generic face beside a real question invents a person. The question still
            belongs in the queue -- somebody is waiting on it either way. */}
        {request.hire ? <HireIdentity hire={request.hire} /> : <span />}

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

      <div className="mt-3 flex min-w-0 items-start gap-2">
        <MessageSquareText
          className="mt-0.5 h-4 w-4 shrink-0 text-app-text-muted"
          aria-hidden="true"
        />
        <p className="text-sm text-app-text">{request.question}</p>
      </div>

      {composing ? (
        <AnswerForm
          originalQuestion={request.question}
          onSubmit={(answer, question) => onAnswer(request.id, answer, question)}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="rounded-lg bg-app-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissing(true);
              void onDismiss(request.id).catch(() => setDismissing(false));
            }}
            disabled={dismissing}
            className="rounded-lg px-3 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
          >
            {dismissing ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The asker, and where they have got to.
 *
 * A real `Link` rather than a click handler: a PM reading a queue wants the member page in a second
 * tab beside the inbox, and a programmatic navigation takes the inbox away from them instead.
 */
function HireIdentity({ hire }: { hire: EscalationHire }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar
        size={32}
        profileIcon={hire.profileIcon}
        fallbackName={hire.displayName}
        seed={hire.userId}
      />

      <div className="min-w-0">
        <Link
          to={`/team/${hire.userId}`}
          className="truncate rounded text-sm font-semibold text-app-text transition-colors hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          {hire.displayName}
        </Link>

        <p className="truncate text-xs text-app-text-muted">{positionOf(hire)}</p>
      </div>
    </div>
  );
}

/**
 * Where somebody is, in one line.
 *
 * A missing `currentStep` means two opposite things, and saying the wrong one is worse than saying
 * nothing. The backend has no active step both for somebody who has not begun *and* for somebody
 * who has finished every step — so the progress figure, not the step, is what separates them.
 * Telling a PM that a hire three weeks in and fully ramped has "not started" would invert the very
 * signal this card exists to give.
 *
 * Said outright either way rather than left as an empty row: a blank line under a name reads as a
 * value that failed to load, and "we don't know" versus "there is nothing yet" is exactly the
 * distinction a PM is trying to draw.
 */
function positionOf(hire: EscalationHire): string {
  const progress = `${Math.round(hire.progressPercentage * 100)}% through`;

  if (!hire.currentStep) {
    if (hire.progressPercentage >= 1) return "Onboarding complete";
    // Nothing active and nothing finished is somebody who has not begun. In between is a state the
    // backend does not currently produce -- every step is waiting, running, finished or skipped, so
    // "none active" implies "all done" -- but reporting the number beats asserting either extreme
    // if that ever stops being true.
    return hire.progressPercentage > 0 ? `No active step — ${progress}` : "Onboarding not started";
  }

  const where = hire.currentPhase ? `${hire.currentStep} · ${hire.currentPhase}` : hire.currentStep;

  return `${where} — ${progress}`;
}
