import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Check, ChevronRight, Inbox, Loader2, Search, UserCheck } from "lucide-react";
import { SelectionCheckbox } from "../../admin/components/SelectionCheckbox";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { Input } from "../../../components/ui/Input";
import { Pagination } from "../../../components/ui/Pagination";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { CorpusIssueDetails } from "./CorpusIssueDetails";
import { useCorpusIssueBrowser } from "../hooks/useCorpusIssueBrowser";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { CandidatePoolState, StarterWorkCandidate, StarterWorkTask } from "../types";

type CorpusIssueBrowserProps = {
  /** The project whose corpus to browse. Empty when nothing is selected yet. */
  projectId: string;
  /** HR reads the browser; only PM/ADMIN put work in the pool. */
  canAct: boolean;
  onPromoted: (task: StarterWorkTask) => void;
};

/** How many issue rows sit on one page before the list paginates. */
const PAGE_SIZE = 8;
/** Labels shown inline on a row before the rest collapse into a "+N" badge. */
const ROW_LABEL_CAP = 3;

/** The pool-state filter beside the search box. */
type PoolFilter = "all" | "available" | "in-pool" | "removed";

const POOL_FILTER_OPTIONS: FilterSelectOption<PoolFilter>[] = [
  { value: "all", label: "All issues" },
  { value: "available", label: "New" },
  { value: "in-pool", label: "In the pool" },
  { value: "removed", label: "Taken out" },
];

const POOL_FILTER_STATE: Record<Exclude<PoolFilter, "all">, CandidatePoolState> = {
  available: "AVAILABLE",
  "in-pool": "IN_POOL",
  removed: "REMOVED",
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
 *
 * Each row is compact — a name and a number — and opens a drawer with the whole issue body and the
 * add action, so the list scans quickly and the reading happens where there is room for it.
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

  const [page, setPage] = useState(1);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);

  // The pool-state filter sits on top of the hook's own search/assigned filtering.
  const shown = useMemo(
    () =>
      poolFilter === "all"
        ? candidates
        : candidates.filter((candidate) => candidate.poolState === POOL_FILTER_STATE[poolFilter]),
    [candidates, poolFilter],
  );

  // A new search, a flipped filter or a changed project makes the old page number meaningless, so
  // the list snaps back to the first page rather than stranding the reader on a page that no longer
  // exists. Adjusted during render (the supported pattern) rather than in an effect, so no extra
  // paint is committed before the reset takes.
  const listSignature = `${projectId} ${query} ${showAssigned} ${poolFilter}`;
  const [prevSignature, setPrevSignature] = useState(listSignature);
  if (listSignature !== prevSignature) {
    setPrevSignature(listSignature);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [shown, safePage],
  );

  // The open issue, resolved from the live list so its pool state stays current after an add. It
  // drops to null (and the drawer closes) if a filter hides it while it is open.
  const openCandidate = useMemo(
    () => candidates.find((candidate) => candidate.sourceId === openSourceId) ?? null,
    [candidates, openSourceId],
  );

  return (
    <section data-testid="corpus-issue-browser" className="p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand-text">
          <Inbox className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-app-text">Issues in this project</h2>
            {projectId && totalCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-app-surface-muted px-1.5 py-0.5 text-[11px] font-bold text-app-text-subtle tabular-nums">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-app-text-muted">
            Every open issue the project has ingested. Adding one puts it in the pool straight away
            — the same as writing a task by hand, because you looked at it. Mining keeps filling the
            pool on its own; this is a second way in, not a gate in front of it.
          </p>
        </div>
      </div>

      {!projectId ? (
        <div data-testid="corpus-issue-empty">
          <EmptyState icon={<Inbox className="h-8 w-8" aria-hidden="true" />}>
            Issues come from one project&apos;s corpus, so pick a project first.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Input
                type="search"
                data-testid="corpus-issue-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, label or issue id"
                aria-label="Search issues"
                icon={<Search className="h-4 w-4" aria-hidden="true" />}
              />
            </div>
            {/* Off by default, and it hides only the issues somebody is definitely on. The count is
                the point: an exclusion nobody can see is an absence, and a PM who cannot find an
                issue they know exists has no way to tell "filtered" from "not ingested". */}
            <div className="flex shrink-0 items-center gap-2.5">
              <SelectionCheckbox
                checked={showAssigned}
                onChange={() => setShowAssigned(!showAssigned)}
                ariaLabel="Also show issues someone is already on"
                testId="show-assigned-issues"
              />
              <span className="text-xs text-app-text-muted">
                Also show issues someone is already on
                {assignedCount > 0 && ` (${assignedCount})`}
              </span>
            </div>
            <FilterSelect
              label="Filter issues by pool state"
              value={poolFilter}
              options={POOL_FILTER_OPTIONS}
              onChange={setPoolFilter}
              className="shrink-0 lg:w-44"
            />
          </div>

          {error && (
            <p className="mb-3 rounded-xl border border-app-danger-border bg-app-danger-bg p-3 text-xs font-medium text-app-danger-text">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-app-text-muted">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </div>
          ) : candidates.length === 0 ? (
            <div data-testid="corpus-issue-empty">
              {/* Three different silences, and they mean different things. "No good first work
                  here" is the one thing none of them means. */}
              <EmptyState icon={<Inbox className="h-8 w-8" aria-hidden="true" />}>
                {totalCount === 0
                  ? "No open issues have been ingested for this project yet. Connect a repository or tracker and crawl it, and they will show up here."
                  : query.trim().length > 0
                    ? `Nothing matches “${query.trim()}”.`
                    : "Every open issue here is one somebody is already on. Tick the box above to see them."}
              </EmptyState>
            </div>
          ) : shown.length === 0 ? (
            <div data-testid="corpus-issue-empty">
              <EmptyState icon={<Inbox className="h-8 w-8" aria-hidden="true" />}>
                No issues match this filter. Switch it back to “All issues” to see the rest.
              </EmptyState>
            </div>
          ) : (
            <>
              <ul className="space-y-2.5" data-testid="corpus-issue-list">
                {pageItems.map((candidate) => (
                  <CandidateRow
                    key={candidate.sourceId}
                    candidate={candidate}
                    onOpen={setOpenSourceId}
                  />
                ))}
              </ul>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                className="mt-5"
              />
            </>
          )}
        </>
      )}

      {createPortal(
        <PanelPresence value={openCandidate}>
          {(candidate) => (
            <CorpusIssueDetails
              candidate={candidate}
              canAct={canAct}
              isPromoting={promotingSourceId === candidate.sourceId}
              error={error}
              onPromote={promote}
              onClose={() => setOpenSourceId(null)}
            />
          )}
        </PanelPresence>,
        document.body,
      )}
    </section>
  );
}

type CandidateRowProps = {
  candidate: StarterWorkCandidate;
  onOpen: (sourceId: string) => void;
};

/**
 * The pool state of an issue, as a badge that reads apart from its labels.
 *
 * Labels all share the one neutral colour (the tracker never tells us their real colours), so pool
 * state has to earn its own place: it sits up in the title row, carries an icon, and is coloured —
 * "in the pool" in success green, "taken out" muted with a struck-through mark, so a terminal state
 * never reads like just another tag.
 */
function poolStateBadge(poolState: CandidatePoolState) {
  if (poolState === "IN_POOL") {
    return (
      <Badge variant="success" size="md">
        <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        In the pool
      </Badge>
    );
  }
  if (poolState === "REMOVED") {
    return (
      <Badge variant="neutral" size="md">
        <Ban className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Taken out
      </Badge>
    );
  }
  return null;
}

/**
 * One browsable issue, kept to a name and a number.
 *
 * The whole row opens the detail drawer, where the body and the add action live. A pooled or
 * removed issue is still shown and still opens — the marking is what tells a reader why it is not on
 * offer, and leaving it out would send them hunting for an issue they know exists.
 */
function CandidateRow({ candidate, onOpen }: CandidateRowProps) {
  const parsed = parseCandidateSource(candidate.sourceId);
  const tracker = trackerLabel(candidate.tracker);
  const shownLabels = candidate.labels.slice(0, ROW_LABEL_CAP);
  const extraLabels = candidate.labels.length - shownLabels.length;
  const isRemoved = candidate.poolState === "REMOVED";
  const status = poolStateBadge(candidate.poolState);

  return (
    <li data-testid={`corpus-issue-${candidate.sourceId}`} data-corpus-row>
      <button
        type="button"
        onClick={() => onOpen(candidate.sourceId)}
        aria-label={`Open ${candidate.title}`}
        className={`flex w-full items-start gap-3 rounded-2xl border border-app-border bg-app-bg p-4 text-left transition-colors hover:border-app-border-strong focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
          isRemoved ? "opacity-70" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          {/* Title row carries the one thing that is a state, not a tag: the pool badge. */}
          <div className="flex items-start gap-2">
            <h3
              className={`min-w-0 flex-1 truncate text-sm font-semibold text-app-text ${
                isRemoved ? "line-through decoration-app-text-disabled" : ""
              }`}
            >
              {candidate.title}
            </h3>
            {(status || candidate.hasAssignee === true) && (
              <div className="flex shrink-0 items-center gap-1.5">
                {candidate.hasAssignee === true && (
                  <Badge variant="warning" size="md">
                    <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Someone is on this
                  </Badge>
                )}
                {status}
              </div>
            )}
            <ChevronRight
              className="mt-1.5 h-4 w-4 shrink-0 text-app-text-disabled"
              aria-hidden="true"
            />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="brand" size="md">
              {tracker}
            </Badge>
            {parsed.numberLabel && (
              <Badge variant="neutral" size="md">
                {parsed.numberLabel}
              </Badge>
            )}
            {parsed.repoLabel && (
              <span className="truncate text-xs text-app-text-subtle">{parsed.repoLabel}</span>
            )}
          </div>

          {shownLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {shownLabels.map((label) => (
                <Badge key={label} variant="neutral" size="md">
                  {label}
                </Badge>
              ))}
              {extraLabels > 0 && (
                <span className="text-xs text-app-text-subtle">+{extraLabels}</span>
              )}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}
