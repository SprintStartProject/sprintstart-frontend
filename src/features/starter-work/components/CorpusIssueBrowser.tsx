import { useMemo, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Ban, Check, ChevronRight, Inbox, Loader2, Plus, Search, UserCheck } from "lucide-react";
import { SelectionCheckbox } from "../../admin/components/SelectionCheckbox";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Input } from "../../../components/ui/Input";
import { Pagination } from "../../../components/ui/Pagination";
import { useToast } from "../../../context/useToast";
import { useIsSmUp } from "../../../hooks/useIsSmUp";
import { getQuickActionRevealVariants, quickActionSpringToken } from "../../../styles/tokens";
import { BuddyMarkdown } from "../../buddy/components/BuddyMarkdown";
import { useCorpusIssueBrowser } from "../hooks/useCorpusIssueBrowser";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { CandidatePoolState, StarterWorkCandidate, StarterWorkTask } from "../types";
import { capturePoolFlightRect, type PoolFlightRect } from "./poolFlight";

type CorpusIssueBrowserProps = {
  /** The project whose corpus to browse. Empty when nothing is selected yet. */
  projectId: string;
  /** HR reads the browser; only PM/ADMIN put work in the pool. */
  canAct: boolean;
  onPromoted: (task: StarterWorkTask, origin?: PoolFlightRect) => Promise<void> | void;
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
 * Each row is compact — a name and a number — and expands in place to show the whole issue body and
 * the add action, so the list scans quickly and reading happens without leaving it.
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
  const { error: showErrorToast } = useToast();

  useEffect(() => {
    if (!error) return;
    showErrorToast("Issue action failed", { description: error });
  }, [error, showErrorToast]);

  const [page, setPage] = useState(1);
  // Defaults to the new, not-yet-pooled issues — the ones a PM is here to act on. Pooled and
  // removed issues stay one filter step away rather than padding the default list.
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("available");
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // The pool-state filter sits on top of the hook's own search/assigned filtering. The row a PM
  // just expanded stays visible even if adding it just moved it out of the filter (the default
  // filter is "New", so promoting one is exactly this case) — otherwise the confirmation it is
  // reading would be yanked out from under it the instant the add lands.
  const shown = useMemo(() => {
    const filtered =
      poolFilter === "all"
        ? candidates
        : candidates.filter((candidate) => candidate.poolState === POOL_FILTER_STATE[poolFilter]);
    if (
      expandedSourceId &&
      !filtered.some((candidate) => candidate.sourceId === expandedSourceId)
    ) {
      const expanded = candidates.find((candidate) => candidate.sourceId === expandedSourceId);
      if (expanded) return [expanded, ...filtered];
    }
    return filtered;
  }, [candidates, poolFilter, expandedSourceId]);

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

  const toggleExpanded = (sourceId: string) =>
    setExpandedSourceId((current) => (current === sourceId ? null : sourceId));

  return (
    <section data-testid="corpus-issue-browser" aria-label="Issues in this project">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-app-text">
            Issues in this project
          </h2>
          {projectId && totalCount > 0 && (
            <Badge variant="neutral" size="sm" className="tabular-nums">
              {totalCount}
            </Badge>
          )}
          <InfoHint
            label="About issues in this project"
            text="Add any ingested issue straight to the pool, a second way in besides mining."
          />
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
                    canAct={canAct}
                    isExpanded={expandedSourceId === candidate.sourceId}
                    isPromoting={promotingSourceId === candidate.sourceId}
                    isBusy={promotingSourceId !== null}
                    onToggle={toggleExpanded}
                    onPromote={promote}
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
    </section>
  );
}

type CandidateRowProps = {
  candidate: StarterWorkCandidate;
  /** HR reads the list; only PM/ADMIN get the quick-add action. */
  canAct: boolean;
  /** Whether this row's body is expanded open. */
  isExpanded: boolean;
  /** This row's own add is in flight. */
  isPromoting: boolean;
  /** Any row's add is in flight, so every add is held until it settles. */
  isBusy: boolean;
  onToggle: (sourceId: string) => void;
  onPromote: (sourceId: string, origin?: PoolFlightRect) => Promise<boolean>;
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
 * One browsable issue, kept to a name and a number until opened.
 *
 * The title button expands the row in place to show the whole issue body (rendered as the Markdown
 * it is written in) and the add action, rather than opening a separate drawer — one less layer while
 * the list is already sitting inside its own sheet. On a pointer the quick "Add to the pool" sits
 * beside the title, revealed on hover (and on keyboard focus), so a PM can pool an obvious one
 * without expanding it; on touch, where there is no hover, it stays out of the way and expanding is
 * the way in. Only an available issue offers it: a pooled or removed one is shown marked instead.
 */
function CandidateRow({
  candidate,
  canAct,
  isExpanded,
  isPromoting,
  isBusy,
  onToggle,
  onPromote,
}: CandidateRowProps) {
  const parsed = parseCandidateSource(candidate.sourceId);
  const tracker = trackerLabel(candidate.tracker);
  const shownLabels = candidate.labels.slice(0, ROW_LABEL_CAP);
  const extraLabels = candidate.labels.length - shownLabels.length;
  const isRemoved = candidate.poolState === "REMOVED";
  const status = poolStateBadge(candidate.poolState);
  const canAdd = canAct && candidate.poolState === "AVAILABLE";

  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Revealed on hover or focus, matching the review card. Reduced motion just fades it in; otherwise
  // it slides and scales in on the same spring the review quick-actions use. On touch there is no
  // hover, so below `sm` it is shown from the start instead.
  const isSmUp = useIsSmUp();
  const showAdd = canAdd && (!isSmUp || isHovered || isFocusWithin);
  const addVariants = getQuickActionRevealVariants(Boolean(prefersReducedMotion));

  return (
    <li
      className="rounded-2xl border border-app-border bg-app-surface transition-colors hover:border-app-border-strong"
      data-testid={`corpus-issue-${candidate.sourceId}`}
      data-corpus-row
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={() => setIsFocusWithin(false)}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => onToggle(candidate.sourceId)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Close" : "Open"} ${candidate.title}`}
          className="min-w-0 flex-1 text-left focus-visible:outline-none"
        >
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
        </button>

        <div className="flex shrink-0 items-center gap-2 self-center">
          {canAdd && (
            <motion.button
              type="button"
              initial={false}
              animate={showAdd ? "show" : "rest"}
              variants={addVariants}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { scale: 1.06, transition: quickActionSpringToken }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              data-testid={`quick-promote-issue-${candidate.sourceId}`}
              disabled={isBusy}
              onClick={(event) => {
                const origin = capturePoolFlightRect(event.currentTarget);
                void onPromote(candidate.sourceId, origin);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-app-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-app-brand-lift transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed"
            >
              {isPromoting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Add to the pool
            </motion.button>
          )}
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-app-text-disabled transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-app-border px-4 pt-3 pb-4">
          {candidate.excerpt ? (
            <div className="text-sm leading-relaxed text-app-text-muted">
              <BuddyMarkdown content={candidate.excerpt} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-app-text-muted">
              This issue has no description in the corpus.
            </p>
          )}
          {candidate.excerptTruncated && (
            <p className="mt-2 text-xs text-app-text-subtle">
              This text is shortened. Open the issue to read all of it.
            </p>
          )}
          {candidate.hasAssignee === true && (
            <p className="mt-3 text-xs text-app-text-subtle">
              Someone is already on this issue. It is still yours to add — the pool is a suggestion,
              not a claim.
            </p>
          )}

          {candidate.poolState === "IN_POOL" && (
            <p className="mt-3 text-sm font-medium text-app-success-text">Already in the pool.</p>
          )}
          {candidate.poolState === "REMOVED" && (
            <p className="mt-3 text-sm text-app-text-muted">
              Taken out of the pool. Reopen the issue at the source and it can be added again.
            </p>
          )}
          {candidate.poolState === "AVAILABLE" &&
            (canAct ? (
              <button
                type="button"
                data-testid={`promote-issue-${candidate.sourceId}`}
                disabled={isPromoting}
                onClick={(event) => {
                  const origin = capturePoolFlightRect(event.currentTarget);
                  void onPromote(candidate.sourceId, origin);
                }}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-app-brand px-4 py-2.5 text-sm font-semibold text-white shadow-app-brand-lift transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPromoting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                Add to the pool
              </button>
            ) : (
              <p className="mt-3 text-sm text-app-text-muted">
                Only a project manager can add work to the pool.
              </p>
            ))}
        </div>
      )}
    </li>
  );
}
