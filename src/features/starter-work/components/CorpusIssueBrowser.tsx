import { ExternalLink, Inbox, Loader2, Plus, Search, UserCheck } from "lucide-react";
import { useCorpusIssueBrowser } from "../hooks/useCorpusIssueBrowser";
import type { StarterWorkCandidate, StarterWorkTask } from "../types";

type CorpusIssueBrowserProps = {
  /** The project whose corpus to browse. Empty when nothing is selected yet. */
  projectId: string;
  /** HR reads the browser; only PM/ADMIN put work in the pool. */
  canAct: boolean;
  onPromoted: (task: StarterWorkTask) => void;
};

/**
 * Browse the open issues a project has already ingested and put one in the pool by hand.
 *
 * This is a second way to add work, not a filter in front of mining. Mining keeps landing
 * tasks live and a hire can claim them without anybody looking, so nothing here may read as
 * "choose the tasks hires are allowed to have" — that is the gate S3b deleted. What it adds is the
 * picker hand-authoring never had: the blank form beside it is untouched and equally reachable.
 *
 * Nothing is ranked and no issue carries a score. The judgement is the reader's, and a number would
 * be the mining filter wearing a different hat.
 */
export function CorpusIssueBrowser({ projectId, canAct, onPromoted }: CorpusIssueBrowserProps) {
  const {
    candidates,
    totalCount,
    assignedCount,
    isLoading,
    error,
    query,
    setQuery,
    showAssigned,
    setShowAssigned,
    promotingSourceId,
    promote,
  } = useCorpusIssueBrowser(projectId, onPromoted);

  return (
    <section data-testid="corpus-issue-browser" className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Inbox className="h-4 w-4 text-app-text-muted" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-app-text">Issues in this project</h2>
      </div>
      <p className="mb-4 text-xs text-app-text-muted">
        Every open issue the project has ingested. Adding one puts it in the pool straight away —
        the same as writing a task by hand, because you looked at it. Mining keeps filling the pool
        on its own; this is a second way in, not a gate in front of it.
      </p>

      {!projectId ? (
        <p className="py-6 text-center text-xs text-app-text-muted">
          Issues come from one project&apos;s corpus, so pick a project first.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search issues</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-app-text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                data-testid="corpus-issue-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, label or issue id"
                className="h-11 w-full rounded-xl border border-app-border bg-app-surface pr-3 pl-9 text-sm text-app-text placeholder:text-app-text-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              />
            </label>
            {/* Off by default, and it hides only the issues somebody is definitely on.
                            The count is the point: an exclusion nobody can see is an absence, and a
                            PM who cannot find an issue they know exists has no way to tell "filtered"
                            from "not ingested". */}
            <label className="flex shrink-0 items-center gap-2 text-xs text-app-text-muted">
              <input
                type="checkbox"
                data-testid="show-assigned-issues"
                checked={showAssigned}
                onChange={(event) => setShowAssigned(event.target.checked)}
                className="h-4 w-4 rounded border-app-border"
              />
              Also show issues someone is already on
              {assignedCount > 0 && ` (${assignedCount})`}
            </label>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-app-danger-bg p-2.5 text-xs font-medium text-app-danger-text">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8 text-app-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          ) : candidates.length === 0 ? (
            <p
              data-testid="corpus-issue-empty"
              className="rounded-2xl border border-dashed border-app-border p-6 text-center text-sm text-app-text-muted"
            >
              {/* Three different silences, and they mean different things. "No good
                                first work here" is the one thing none of them means. */}
              {totalCount === 0
                ? "No open issues have been ingested for this project yet. Connect a repository or tracker and crawl it, and they will show up here."
                : query.trim().length > 0
                  ? `Nothing matches “${query.trim()}”.`
                  : "Every open issue here is one somebody is already on. Tick the box above to see them."}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="corpus-issue-list">
              {candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.sourceId}
                  candidate={candidate}
                  canAct={canAct}
                  isPromoting={promotingSourceId === candidate.sourceId}
                  isBusy={promotingSourceId !== null}
                  onPromote={promote}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

type CandidateRowProps = {
  candidate: StarterWorkCandidate;
  canAct: boolean;
  isPromoting: boolean;
  isBusy: boolean;
  onPromote: (sourceId: string) => Promise<boolean>;
};

/**
 * One browsable issue.
 *
 * An issue already in the pool, or one somebody removed from it, is shown marked and without a
 * button rather than left out — the marking is what tells a reader why it is not on offer.
 * Removal is sticky, so "removed" really does mean it cannot go back.
 */
function CandidateRow({ candidate, canAct, isPromoting, isBusy, onPromote }: CandidateRowProps) {
  const isPooled = candidate.poolState !== "AVAILABLE";

  return (
    <li
      data-testid={`corpus-issue-${candidate.sourceId}`}
      className="rounded-2xl border border-app-border bg-app-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-app-text">{candidate.title}</h3>
          <p className="mt-0.5 text-xs text-app-text-subtle">
            {candidate.tracker} · {candidate.sourceId}
          </p>
        </div>
        {candidate.sourceUrl && (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-app-brand-text hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open issue
          </a>
        )}
      </div>

      {candidate.excerpt && (
        <p className="mt-2 text-xs text-app-text-muted">
          {candidate.excerpt}
          {/* Said next to the thing it limits: a partial body read as the whole story is
                        how somebody judges an issue on half of it. */}
          {candidate.excerptTruncated && (
            <span className="text-app-text-subtle"> … (shortened)</span>
          )}
        </p>
      )}

      {candidate.labels.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {candidate.labels.map((label) => (
            <li
              key={label}
              className="rounded-md bg-app-surface-muted px-2 py-0.5 text-xs text-app-text-muted"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Only a definite `true` is marked. Null means SprintStart does not know — it
                    does not ingest GitHub assignees — and a badge on every GitHub issue saying so
                    would be noise on the whole list. */}
        {candidate.hasAssignee === true && (
          <span className="inline-flex items-center gap-1 rounded-md bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
            <UserCheck className="h-3 w-3" aria-hidden="true" />
            Someone is on this
          </span>
        )}
        {candidate.poolState === "IN_POOL" && (
          <span className="rounded-md bg-app-success-bg px-2 py-0.5 text-xs font-medium text-app-success-text">
            Already in the pool
          </span>
        )}
        {candidate.poolState === "REMOVED" && (
          <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-text-muted">
            Taken out of the pool — it cannot go back
          </span>
        )}
        {canAct && !isPooled && (
          <button
            type="button"
            data-testid={`promote-issue-${candidate.sourceId}`}
            disabled={isBusy}
            onClick={() => void onPromote(candidate.sourceId)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPromoting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Add to the pool
          </button>
        )}
      </div>
    </li>
  );
}
