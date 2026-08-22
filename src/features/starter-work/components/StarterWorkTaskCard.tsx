import { useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import type { StarterWorkTask } from "../types";

type StarterWorkTaskCardProps = {
  task: StarterWorkTask;
  /** HR can read the queue but not decide on it. */
  canAct: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
};

/**
 * One mined starter task awaiting a PM's decision.
 *
 * Shows the AI's scope-safety rationale next to the task itself, because that judgement is the
 * whole reason a PM is being asked rather than told: "this issue is small and self-contained" is
 * a claim they are checking, not a fact.
 */
export function StarterWorkTaskCard({
  task,
  canAct,
  onApprove,
  onReject,
}: StarterWorkTaskCardProps) {
  const [isDeciding, setIsDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (action: () => Promise<void>) => {
    setIsDeciding(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that decision.");
      setIsDeciding(false);
    }
  };

  return (
    <article className="rounded-2xl border border-app-border bg-app-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-app-text">{task.title}</h3>
          {task.summary && <p className="mt-1 text-sm text-app-text-muted">{task.summary}</p>}
        </div>
        {task.sourceUrl && (
          <a
            href={task.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-app-brand-text hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Source issue
          </a>
        )}
      </div>

      {task.rationale && (
        <p className="mt-3 rounded-lg bg-app-surface-muted p-2.5 text-xs text-app-text-muted">
          <span className="font-medium text-app-text">Why this is a safe first task: </span>
          {task.rationale}
        </p>
      )}

      {task.competencyKeys.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-app-text-subtle">
            Skills it exercises — each becomes a prerequisite
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {task.competencyKeys.map((key) => (
              <li
                key={key}
                className="rounded-md bg-app-surface-muted px-2 py-0.5 text-xs text-app-text-muted"
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-app-danger-bg p-2.5 text-xs font-medium text-app-danger-text">
          {error}
        </p>
      )}

      {canAct && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid={`approve-task-${task.id}`}
            disabled={isDeciding}
            onClick={() => void decide(() => onApprove(task.id))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeciding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Looks good
          </button>
          <button
            type="button"
            data-testid={`reject-task-${task.id}`}
            disabled={isDeciding}
            onClick={() => void decide(() => onReject(task.id))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-4 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Take it out of the pool
          </button>
          {/* Review is not admission any more, so the copy must not imply a hire is
                        waiting on it. What it changes is rank, and what removal changes is
                        permanent -- both are worth saying plainly. */}
          <p className="w-full text-xs text-app-text-subtle">
            Hires can already claim this. Vouching for it moves it up their suggestions; taking it
            out is permanent, and mining will not bring it back.
          </p>
        </div>
      )}
    </article>
  );
}
