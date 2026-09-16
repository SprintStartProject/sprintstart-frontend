import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ChevronRight,
  FileText,
  Filter,
  MessageSquareMore,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import type { FAQGroup, FAQRebuildScope } from "../types";
import { insightsService } from "../../../services/faqService";
import { useToast } from "../../../context/useToast";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { Spinner } from "../../../components/ui/Spinner";
import { queryKeys } from "../../../services/queryKeys";
import { PmSectionHeader, PmStat } from "../../pm-area/components/PmCard";
import { useProjectContext } from "../../projects/useProjectContext";
import { formatAskedAt } from "../format";
import { FaqGroupPanel } from "./FaqGroupPanel";
import { RebuildFaqDialog } from "./RebuildFaqDialog";
import { TrendBadge } from "./TrendBadge";

const PAGE_TITLE = "Recurring Questions";
const PAGE_SUBTITLE = "What people keep asking the chat, ranked by frequency and kept up to date.";

type FaqSortOption = "count" | "recent" | "trend" | "title";

const SORT_OPTIONS: FilterSelectOption<FaqSortOption>[] = [
  { value: "count", label: "Most asked" },
  { value: "recent", label: "Recently asked" },
  { value: "trend", label: "Picking up first" },
  { value: "title", label: "Title" },
];

const TREND_ORDER: Record<NonNullable<FAQGroup["trend"]>, number> = {
  RISING: 0,
  STEADY: 1,
  FADING: 2,
};

/**
 * Every sort falls back to the times-asked order, so entries that tie on the
 * chosen key still come out in a stable and meaningful sequence rather than
 * whatever the backend happened to return.
 */
const SORTERS: Record<FaqSortOption, (a: FAQGroup, b: FAQGroup) => number> = {
  count: (a, b) => b.count - a.count,
  recent: (a, b) => (b.lastAskedAt ?? "").localeCompare(a.lastAskedAt ?? "") || b.count - a.count,
  trend: (a, b) =>
    TREND_ORDER[a.trend ?? "STEADY"] - TREND_ORDER[b.trend ?? "STEADY"] ||
    (b.recentCount ?? 0) - (a.recentCount ?? 0) ||
    b.count - a.count,
  title: (a, b) => a.title.localeCompare(b.title),
};

function FaqListSkeleton() {
  return (
    <SkeletonGroup label="Loading recurring questions" className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-2 py-3">
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-1/3" />
          </div>
          <SkeletonLine className="h-6 w-10" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * The recurring questions, as one ranked list with the detail in a side panel.
 *
 * `/insights/faq/:groupId` renders this same page with that group's panel open, so a link to a
 * single question still works — it just no longer costs the reader the list.
 */
export function FaqPage({ groupId }: { groupId?: string }) {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState<FaqSortOption>("count");
  const [hideOneOffs, setHideOneOffs] = useState(false);

  const [isRebuildDialogOpen, setRebuildDialogOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const toast = useToast();

  const {
    data: overview,
    loading,
    revalidating,
    error,
    refresh,
  } = useLiveFetch(queryKeys.faq.groups(selectedProjectId), () =>
    insightsService.fetchFAQGroups(selectedProjectId),
  );

  const showLoadingSkeleton = useDelayedFlag(loading);

  // Closes first, then works. A rebuild takes as long as an AI call and there is
  // nothing to watch — holding the dialog open would pin the PM to a spinner for
  // no information, so the button carries the progress and the page stays usable.
  // Which is also why the outcome is reported as a toast.
  const handleRebuild = (scope: FAQRebuildScope) => {
    setRebuildDialogOpen(false);
    setRebuilding(true);

    void insightsService
      .refreshFAQGroups(selectedProjectId, scope)
      .then((result) => {
        refresh();
        // Taken from the rebuild's own result rather than from the reloaded
        // list: useLiveFetch keeps the previous entries on screen while it
        // revalidates, so no render marks the moment the new result arrived.
        if (result.groupCount === 0) {
          toast.info("Nothing to group yet", {
            description: "No recurring questions were found for this project.",
          });
        }
      })
      .catch((err: unknown) => {
        console.error("FAQ rebuild failed", err);
        toast.error("Rebuild failed. Is the AI service running and are there questions to group?");
      })
      .finally(() => setRebuilding(false));
  };

  const allGroups = overview?.groups ?? [];
  const totalGroups = allGroups.length;
  const totalQuestions = allGroups.reduce((sum, group) => sum + group.count, 0);
  const risingCount = allGroups.filter((group) => group.trend === "RISING").length;
  const totalDocuments = new Set(
    allGroups.flatMap((group) => group.topDocuments.map((doc) => doc.id)),
  ).size;
  const oneOffCount = allGroups.filter((group) => group.count <= 1).length;

  // A question asked once is not yet a recurring question — it is noise in a
  // list whose whole subject is repetition.
  const visible = hideOneOffs ? allGroups.filter((group) => group.count > 1) : allGroups;
  const sorted = [...visible].sort(SORTERS[sortBy]);
  const selectedGroup = allGroups.find((group) => group.groupId === groupId) ?? null;

  const openGroup = (group: FAQGroup) => void navigate(`/insights/faq/${group.groupId}`);
  const closeGroup = () => void navigate("/insights/faq");

  // Destructive, so it asks first — the FAQ updates itself as questions are asked,
  // this regroups everything from scratch.
  const headerActions = (
    <>
      {/* How current the list is, in the only terms that mean anything here: the FAQ
          follows the chat, so its freshness *is* the last question someone asked. */}
      {overview?.lastAskedAt && (
        <span className="text-xs text-app-text-muted">
          Last question {formatAskedAt(overview.lastAskedAt)}
        </span>
      )}
      {revalidating && <Spinner size="sm" label="Updating" />}
      <Button
        variant="secondary"
        onClick={() => setRebuildDialogOpen(true)}
        loading={rebuilding}
        disabled={loading || error}
        icon={<RefreshCw className="h-4 w-4" />}
        className="shrink-0"
        title="Regroup every question from scratch"
      >
        {rebuilding ? "Rebuilding…" : "Rebuild grouping"}
      </Button>
    </>
  );

  const hasData = !loading && !error && overview !== null;

  return (
    <div>
      <PmSectionHeader title={PAGE_TITLE} description={PAGE_SUBTITLE} actions={headerActions} />
      <div className="space-y-5">
        <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PmStat
            icon={MessageSquareMore}
            label="Questions tracked"
            value={hasData ? totalGroups : "—"}
            hint={hasData ? `${oneOffCount} asked only once` : "Loading"}
          />
          <PmStat
            icon={MessageSquareMore}
            label="Times asked"
            value={hasData ? totalQuestions : "—"}
            hint="Across every wording"
          />
          <PmStat
            icon={TrendingUp}
            label="Picking up"
            value={hasData ? risingCount : "—"}
            hint={risingCount > 0 ? "Asked more often lately" : "Nothing on the rise"}
            attention={risingCount > 0}
          />
          <PmStat
            icon={FileText}
            label="Linked documents"
            value={hasData ? totalDocuments : "—"}
            hint="That answer these questions"
          />
        </section>

        {hasData && totalGroups > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              variant={hideOneOffs ? "primary" : "secondary"}
              size="sm"
              onClick={() => setHideOneOffs((hidden) => !hidden)}
              icon={<Filter className="h-3.5 w-3.5" />}
              aria-pressed={hideOneOffs}
            >
              Asked more than once
            </Button>
            <span className="text-xs text-app-text-muted">
              {hideOneOffs
                ? `${oneOffCount} one-off ${oneOffCount === 1 ? "question" : "questions"} hidden`
                : `${sorted.length} of ${totalGroups} shown`}
            </span>

            <FilterSelect
              label="Sort recurring questions"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={setSortBy}
              className="ml-auto w-48"
            />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
          {showLoadingSkeleton ? (
            <FaqListSkeleton />
          ) : loading ? null : error || !overview ? (
            // Separate from the empty list below: a FAQ nobody has filled yet and a FAQ
            // that could not be loaded look alike but mean opposite things.
            <div className="p-6">
              <EmptyState
                icon={<AlertCircle className="h-8 w-8" />}
                title="Not available right now"
              >
                The recurring questions couldn&apos;t be loaded. Try again in a moment.
              </EmptyState>
            </div>
          ) : totalGroups === 0 ? (
            <div className="p-6">
              <EmptyState icon={<MessageSquareMore className="h-8 w-8" />} title="No questions yet">
                They appear here as soon as someone asks a question in the chat.
              </EmptyState>
            </div>
          ) : sorted.length === 0 ? (
            <p className="p-8 text-center text-sm text-app-text-muted">
              Every question here has only been asked once so far.
            </p>
          ) : (
            <ul className="divide-y divide-app-border-muted px-3 py-1.5">
              {sorted.map((group) => {
                const selected = group.groupId === groupId;

                return (
                  <li key={group.groupId} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => openGroup(group)}
                      aria-current={selected ? "true" : undefined}
                      className={`group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                        selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug font-semibold text-app-text">
                          {group.title}
                        </span>
                        {/* The wording users actually use, under the summary. */}
                        <span className="mt-0.5 block truncate text-sm text-app-text-muted">
                          {group.question}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          {group.trend && (
                            <TrendBadge trend={group.trend} recentCount={group.recentCount} />
                          )}
                          {group.topDocuments.slice(0, 2).map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex max-w-56 items-center gap-1 rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-text-muted"
                            >
                              <FileText aria-hidden="true" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{doc.title}</span>
                            </span>
                          ))}
                          {group.lastAskedAt && (
                            <span className="text-[11px] text-app-text-subtle">
                              Last asked {formatAskedAt(group.lastAskedAt)}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-2xl leading-none font-bold text-app-text tabular-nums">
                          {group.count}
                        </span>
                        <span className="mt-1 text-[11px] text-app-text-subtle">asked</span>
                      </span>

                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-app-text"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <RebuildFaqDialog
        isOpen={isRebuildDialogOpen}
        projectId={selectedProjectId}
        onClose={() => setRebuildDialogOpen(false)}
        onConfirm={handleRebuild}
      />

      <FaqGroupPanel groupId={groupId ?? null} group={selectedGroup} onClose={closeGroup} />
    </div>
  );
}
