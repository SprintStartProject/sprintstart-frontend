import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Textarea } from "../../../../components/ui/Textarea";

export type SkipReviewAction = "accept" | "deny";

/**
 * Answering a member's request to skip a step, where the step is being looked at.
 *
 * The comment is optional but goes back to the member either way -- a "no" with a reason reads very
 * differently from a bare one, which is why the field sits right above the buttons.
 */
export function SkipReview({
  reason,
  onReview,
}: {
  reason: string;
  onReview: (action: SkipReviewAction, comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<SkipReviewAction | null>(null);

  const review = async (action: SkipReviewAction) => {
    setBusy(action);
    try {
      await onReview(action, comment.trim());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-app-warning-border bg-app-warning-bg p-3">
      <div>
        <p className="text-xs font-semibold text-app-warning-text">Skip requested</p>
        <p className="mt-1 text-sm text-app-text">“{reason}”</p>
      </div>
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="A word for them (optional)"
        aria-label="Comment for the member"
        minRows={1}
        maxRows={4}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<X className="h-3.5 w-3.5" />}
          loading={busy === "deny"}
          disabled={busy !== null}
          onClick={() => void review("deny")}
        >
          Decline
        </Button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void review("accept")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-app-success-solid px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-app-success-solid/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {busy === "accept" ? "Approving…" : "Approve skip"}
        </button>
      </div>
    </div>
  );
}
