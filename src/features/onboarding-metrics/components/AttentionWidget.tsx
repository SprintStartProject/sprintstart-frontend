import { AlertCircle, Check, HeartHandshake, Loader2, UserRound } from "lucide-react";
import { useAttention } from "../hooks/useAttention";
import { formatDaysAgo } from "../format";
import type { AttentionItem } from "../types";

type AttentionWidgetProps = {
  projectId: string;
};

function severityChip(item: AttentionItem) {
  if (item.severity === "BLOCKED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
        Waiting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-app-danger-bg px-2 py-0.5 text-xs font-medium text-app-danger-text">
      Drifting
    </span>
  );
}

/**
 * PM/HR/ADMIN dashboard widget: who on a project needs a human today — pull
 * requests waiting on a response and stalls, worst first.
 *
 * Each item's reason states whose move it is: a hire waiting four days on a
 * review cannot fix that themselves, so it is never framed as the hire being
 * behind. Read-only on purpose — acting on an item means talking to the person,
 * not clicking something here.
 */
export function AttentionWidget({ projectId }: AttentionWidgetProps) {
  const { attention, isLoading, error } = useAttention(projectId);

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-app-brand" aria-hidden="true" />
        <span className="text-sm font-semibold text-app-text">Who needs a human</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-app-brand" aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-4 text-sm text-app-danger-text">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </div>
      ) : !attention || attention.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Check className="h-5 w-5 text-app-success-solid" aria-hidden="true" />
          <p className="text-sm text-app-text-muted">Nobody is waiting or drifting right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attention.items.map((item) => (
            <li
              key={item.hireId}
              className="flex items-start justify-between gap-3 rounded-xl border border-app-border bg-app-bg p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserRound
                    className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-app-text">
                    {item.hireName}
                  </span>
                  {severityChip(item)}
                </div>
                <p className="mt-1 text-xs text-app-text-muted">
                  {item.reason} · {formatDaysAgo(item.days)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
