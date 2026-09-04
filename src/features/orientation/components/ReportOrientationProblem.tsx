import { useState } from "react";
import { AlertCircle, Check, Flag, Loader2 } from "lucide-react";
import { onboardingFeedbackService } from "../../../services/onboardingFeedbackService";

type ReportOrientationProblemProps = {
  /** What the packet is about, so the report says which one without the hire having to. */
  taskTitle: string;
};

/**
 * "Something here is wrong" — the report that does not require knowing the fix.
 *
 * Sits beside "Fix this", not instead of it: correct the packet if you know what it should say,
 * report it if you only know it is wrong.
 *
 * It changes nothing anybody else sees. Reporting writes no packet and touches no cache, so
 * nothing about the panel changes afterwards except an acknowledgement.
 *
 * The app writes the "which packet" line, and the hire sees it before sending. A report
 * whose subject the reader must infer is one nobody acts on, and a hidden tag appended afterwards
 * would be the app putting words in somebody's mouth.
 */
export function ReportOrientationProblem({ taskTitle }: ReportOrientationProblemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subject = `About the orientation for "${taskTitle}"`;

  const submit = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await onboardingFeedbackService.reportProblem(`${subject}: ${message.trim()}`);
      setIsSent(true);
    } catch (e) {
      console.error(e);
      // Kept on screen rather than cleared: somebody who has just typed out what is wrong
      // should not have to type it again because the request failed.
      setError("That could not be sent. Try again in a moment.");
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <p
        data-testid="orientation-report-sent"
        className="mt-3 inline-flex items-start gap-1.5 text-xs text-app-success-text"
      >
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Thanks — your PM can see this. The guide above is unchanged; nothing you read has moved.
        </span>
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="report-orientation"
        onClick={() => setIsOpen(true)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Flag className="h-3 w-3" aria-hidden="true" />
        Something here is wrong
      </button>
    );
  }

  return (
    <div className="mt-3 min-w-0 rounded-lg border border-app-border bg-app-surface p-3">
      {/* The same sentence that will lead the message, shown before it is sent. */}
      <p className="mb-2 text-xs text-app-text-muted">
        {subject} — what looks wrong? Your PM reads this; the guide stays as it is.
      </p>
      <label htmlFor="orientation-report" className="sr-only">
        What looks wrong with this orientation
      </label>
      <textarea
        id="orientation-report"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={3}
        placeholder="The setup step mentions a script that isn't in the repo any more."
        className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text transition-colors focus:border-app-brand focus:ring-1 focus:ring-app-brand focus:outline-none"
      />
      {error && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-app-danger-text">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!message.trim() || isSending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-app-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Send
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs font-medium text-app-text-muted hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
