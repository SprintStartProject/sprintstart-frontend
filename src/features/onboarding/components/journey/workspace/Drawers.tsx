import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Textarea } from "../../../../../components/ui/Textarea";

type DrawerActionsProps = {
  submitLabel: string;
  loading: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

function DrawerActions({ submitLabel, loading, disabled, onCancel, onSubmit }: DrawerActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" variant="primary" loading={loading} disabled={disabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}

/** The reason box for a skip request. */
export function SkipDrawer({
  reason,
  busy,
  onReasonChange,
  onCancel,
  onSubmit,
}: {
  reason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-app-warning-border bg-app-warning-bg/50 p-3">
      <p className="text-xs text-app-text-muted">
        Already know this, or it doesn’t apply to you? Your project manager decides.
      </p>
      <Textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder="Why skip it?"
        aria-label="Reason for skipping"
        minRows={2}
        maxRows={6}
      />
      <DrawerActions
        submitLabel="Request skip"
        loading={busy}
        disabled={!reason.trim()}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/** The helpful / not helpful choice and the comment for step feedback. */
export function FeedbackDrawer({
  helpful,
  comment,
  busy,
  onHelpfulChange,
  onCommentChange,
  onCancel,
  onSubmit,
}: {
  helpful: boolean | null;
  comment: string;
  busy: boolean;
  onHelpfulChange: (value: boolean) => void;
  onCommentChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-app-brand-border bg-app-brand-soft/40 p-3">
      <div className="flex gap-2">
        {[true, false].map((value) => (
          <HelpfulChoice
            key={String(value)}
            value={value}
            selected={helpful === value}
            onSelect={() => onHelpfulChange(value)}
          />
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="What worked, or what was missing?"
        aria-label="Feedback comment"
        minRows={2}
        maxRows={6}
      />
      <DrawerActions
        submitLabel="Send feedback"
        loading={busy}
        disabled={helpful === null || !comment.trim()}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function choiceTone(value: boolean, selected: boolean): string {
  if (!selected) return "border-app-border text-app-text-muted hover:border-app-brand-border";

  return value
    ? "border-app-success-border bg-app-success-bg text-app-success-text"
    : "border-app-danger-border bg-app-danger-bg text-app-danger-text";
}

function HelpfulChoice({
  value,
  selected,
  onSelect,
}: {
  value: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = value ? ThumbsUp : ThumbsDown;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${choiceTone(value, selected)}`}
    >
      <Icon className={`h-3.5 w-3.5 ${selected ? "fill-current" : ""}`} />
      {value ? "Helpful" : "Not helpful"}
      {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
    </button>
  );
}
