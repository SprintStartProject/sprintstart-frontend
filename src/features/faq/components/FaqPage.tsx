import { useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";

import type { FAQGroup, FAQRebuildScope } from "../types";
import { insightsService } from "../../../services/faqService";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { TrendBadge } from "./TrendBadge";
import { RebuildFaqDialog } from "./RebuildFaqDialog";
import { formatAskedAt } from "../format";

import {
  TrendingUp,
  FileText,
  AlertCircle,
  ArrowLeft,
  Filter,
  MessageSquareMore,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { useProjectContext } from "../../projects/useProjectContext";

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

export function FaqPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState<FaqSortOption>("count");
  const [hideOneOffs, setHideOneOffs] = useState(false);

  const [isRebuildDialogOpen, setRebuildDialogOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | undefined>(undefined);

  const {
    data: overview,
    loading,
    revalidating,
    error,
    refresh,
  } = useLiveFetch(() => insightsService.fetchFAQGroups(selectedProjectId), [selectedProjectId]);

  // Closes first, then works. A rebuild takes as long as an AI call and there is
  // nothing to watch — holding the dialog open would pin the PM to a spinner for
  // no information, so the button carries the progress and the page stays usable.
  const handleRebuild = (scope: FAQRebuildScope) => {
    setRebuildDialogOpen(false);
    setRebuilding(true);
    setRebuildError(undefined);

    void insightsService
      .refreshFAQGroups(selectedProjectId, scope)
      .then(() => refresh())
      .catch((err: unknown) => {
        console.error("FAQ rebuild failed", err);
        setRebuildError(
          "Rebuild failed. Is the AI service running and are there questions to group?",
        );
      })
      .finally(() => setRebuilding(false));
  };

  const openRebuildDialog = () => {
    setRebuildError(undefined);
    setRebuildDialogOpen(true);
  };

  // The FAQ now updates itself as questions are asked, so this is a rebuild of
  // the whole grouping rather than the only way to see new questions — and it
  // is destructive, so it asks first.
  const rebuildButton = (
    <Button
      variant="secondary"
      onClick={openRebuildDialog}
      loading={rebuilding}
      icon={<RefreshCw className="h-4 w-4" />}
      className="shrink-0"
      title="Regroup every question from scratch"
    >
      {rebuilding ? "Rebuilding…" : "Rebuild grouping"}
    </Button>
  );

  const rebuildDialog = (
    <RebuildFaqDialog
      isOpen={isRebuildDialogOpen}
      projectId={selectedProjectId}
      onClose={() => setRebuildDialogOpen(false)}
      onConfirm={handleRebuild}
    />
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  if (error || !overview || overview.groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="max-w-md text-center text-app-text-muted">
          No recurring questions yet. They appear here as soon as someone asks the AI Buddy
          something.
        </p>
        {rebuildButton}
        {rebuildError && (
          <p className="max-w-md text-center text-sm text-app-danger-text">{rebuildError}</p>
        )}
        {rebuildDialog}
      </div>
    );
  }

  const allGroups = overview.groups;
  const totalGroups = allGroups.length;
  const totalQuestions = allGroups.reduce((sum, group) => sum + group.count, 0);
  const risingCount = allGroups.filter((group) => group.trend === "RISING").length;
  const totalDocuments = new Set(
    allGroups.flatMap((group) => group.topDocuments.map((doc) => doc.id)),
  ).size;
  const oneOffCount = allGroups.filter((group) => group.count <= 1).length;

  // A question asked once is not yet a recurring question — it is noise in a
  // panel whose whole subject is repetition, and at the entry ceiling it is
  // most of what fills the list.
  const visible = hideOneOffs ? allGroups.filter((group) => group.count > 1) : allGroups;
  const sorted = [...visible].sort(SORTERS[sortBy]);

  const goToDetail = (group: FAQGroup) => void navigate(`/insights/faq/${group.groupId}`);

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header */}
      <section aria-label="Page header" className="border-b border-app-border bg-app-bg/90">
        <div className="app-page-content py-8">
          <Button
            variant="ghost"
            onClick={() => void navigate("/pm-dashboard")}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back to PM-Dashboard
          </Button>

          <div className="mb-6 flex items-start justify-between gap-4">
            <PageHeader
              icon={MessageSquareMore}
              title="Recurring Questions"
              subtitle="Ranked by frequency and updated as questions are asked."
            />
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <div className="flex items-center gap-3">
                {revalidating && <Spinner size="sm" label="Updating" />}
                {rebuildButton}
              </div>
              {/* How current the panel is, in the only terms that mean anything
                  here: the FAQ follows the Buddy, so its freshness *is* the
                  last question someone asked. */}
              {overview.lastAskedAt && (
                <span className="text-xs text-app-text-muted">
                  Last question {formatAskedAt(overview.lastAskedAt)}
                </span>
              )}
            </div>
          </div>
          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <MessageSquareMore className="h-5 w-5 text-app-brand" />
                <div>
                  <div className="text-2xl font-semibold text-app-brand">{totalGroups}</div>
                  <div className="text-xs text-app-text-muted">Questions tracked</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <MessageSquareMore className="h-5 w-5 text-app-success-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-success-solid">
                    {totalQuestions}
                  </div>
                  <div className="text-xs text-app-text-muted">Times asked</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-app-danger-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-danger-solid">{risingCount}</div>
                  <div className="text-xs text-app-text-muted">Picking up</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-app-warning-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-warning-solid">
                    {totalDocuments}
                  </div>
                  <div className="text-xs text-app-text-muted">Linked documents</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="app-page-content py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
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
            className="ml-auto"
          />
        </div>

        {sorted.length === 0 && (
          <p className="py-12 text-center text-sm text-app-text-muted">
            Every question here has only been asked once so far.
          </p>
        )}

        <div className="space-y-3">
          {sorted.map((group) => (
            <button
              key={group.groupId}
              onClick={() => goToDetail(group)}
              // 1.01 rather than the 1.02 used on grid cards: these rows span
              // the full content column, so the same percentage travels much
              // further.
              className="w-full rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base leading-snug font-semibold text-app-text">
                    {group.title}
                  </p>
                  {/* The wording users actually use, under the summary. */}
                  <p className="mt-0.5 truncate text-sm text-app-text-muted">{group.question}</p>
                </div>
                <span className="shrink-0 text-2xl leading-none font-semibold text-app-brand">
                  {group.count}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {group.trend && <TrendBadge trend={group.trend} recentCount={group.recentCount} />}
                {group.topDocuments.map((doc) => (
                  <Badge key={doc.id} variant="neutral" size="sm" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {doc.title}
                  </Badge>
                ))}
                {group.lastAskedAt && (
                  <span className="ml-auto text-xs text-app-text-muted">
                    Last asked {formatAskedAt(group.lastAskedAt)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>

      {rebuildDialog}
    </div>
  );
}
