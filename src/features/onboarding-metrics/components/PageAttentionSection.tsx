import { AlertCircle, Check, HeartHandshake, Loader2, UserRound } from "lucide-react";
import { useAttention } from "../hooks/useAttention";
import { formatDaysAgo } from "../format";
import type { AttentionItem } from "../types";

type PageAttentionSectionProps = {
  /** The selected project, or empty string when none is chosen. */
  projectId: string;
};

/**
 * The severity chip states whose problem it is: a hire kept `BLOCKED` on somebody
 * else's review is waiting (warning), a hire `DRIFTING` on their own is the more
 * pointed danger. Colour follows meaning, never the other way round.
 */
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
 * The page's leading call to action: who on the selected project needs a human
 * today — contributions waiting on a response and stalls, worst first, each
 * item's reason stating whose move it is.
 *
 * It reads richer data than the raw metrics payload (severity, a plain-words
 * reason, days-waiting) from `GET /metrics/projects/{id}/attention` via
 * `useAttention`. Read-only on purpose: acting on an item means talking to the
 * person, not clicking something here. Where the wait is on a review, the fix is
 * a conversation with the reviewer, not a nudge to the hire.
 */
export function PageAttentionSection({ projectId }: PageAttentionSectionProps) {
  const { attention, isLoading, error } = useAttention(projectId);

  return (
    <section className="rounded-3xl border border-app-border bg-app-bg p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 text-app-brand" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-app-text">Who needs a human</h2>
      </div>
      <p className="mb-4 text-sm text-app-text-muted">
        The thing to act on today. Where the wait is on a review, the fix is a conversation with
        the reviewer — not a nudge to the hire.
      </p>

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
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-app-success-solid" aria-hidden="true" />
          <p className="text-sm text-app-text">Nobody needs a human right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attention.items.map((item) => (
            <li
              key={item.hireId}
              className="flex items-start justify-between gap-3 rounded-xl border border-app-border bg-app-surface p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserRound
                    className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-app-text">{item.hireName}</span>
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
    </section>
  );
}
