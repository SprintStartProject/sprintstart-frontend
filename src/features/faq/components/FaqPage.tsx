import { useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";

import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useFetch } from "../../../hooks/useFetch";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

import {
  TrendingUp,
  FileText,
  AlertCircle,
  ArrowLeft,
  Users,
  MessageSquareMore,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { useProjectContext } from "../../projects/useProjectContext";

export function FaqPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const {
    data: overview,
    loading,
    error,
  } = useFetch(
    () => insightsService.fetchFAQGroups(selectedProjectId),
    [refreshKey, selectedProjectId],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await insightsService.refreshFAQGroups(selectedProjectId);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("FAQ refresh failed", err);
      setRefreshError(
        "Refresh failed. Is the AI service running and are there questions to group?",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const refreshButton = (
    <Button
      variant="primary"
      onClick={() => void handleRefresh()}
      loading={refreshing}
      icon={<RefreshCw className="h-4 w-4" />}
      className="shrink-0"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </Button>
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
        <p className="text-app-text-muted">
          No FAQ groups yet. Trigger a refresh to generate them.
        </p>
        {refreshButton}
        {refreshError && (
          <p className="max-w-md text-center text-sm text-app-danger-text">{refreshError}</p>
        )}
      </div>
    );
  }

  const sorted = [...overview.groups].sort((a, b) => b.count - a.count);

  const [hero, ...rest] = sorted;

  const totalGroups = overview.groups.length;

  const totalQuestions = overview.groups.reduce((sum, group) => sum + group.count, 0);

  const mostAskedCount = hero?.count ?? 0;

  const totalDocuments = new Set(
    overview.groups.flatMap((group) => group.topDocuments.map((doc) => doc.id)),
  ).size;

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
              subtitle="Frequently asked questions grouped by topic and ranked by frequency."
            />
            {refreshButton}
          </div>
          {refreshError && <p className="mb-4 text-sm text-app-danger-text">{refreshError}</p>}

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-app-brand" />
                <div>
                  <div className="text-2xl font-semibold text-app-brand">{totalGroups}</div>
                  <div className="text-xs text-app-text-muted">Question groups</div>
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
                  <div className="text-xs text-app-text-muted">Total questions</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-app-danger-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-danger-solid">
                    {mostAskedCount}
                  </div>
                  <div className="text-xs text-app-text-muted">Top frequency</div>
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
        {/* Hero Card */}
        <div className="mb-4">
          <button
            onClick={() => goToDetail(hero)}
            // The hero had no hover state at all despite being clickable.
            // 1.01 rather than the 1.02 used on grid cards: these rows span the
            // full content column, so the same percentage travels much further.
            className="relative mb-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5 text-left transition-all duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 text-app-text-muted">
              <TrendingUp className="h-5 w-5 text-app-brand" />
              <span className="text-2xl font-semibold text-app-brand">{hero.count}</span>
            </div>

            <p className="mb-4 pr-16 text-lg leading-snug font-semibold text-app-text">
              {hero.question}
            </p>

            <div className="flex flex-wrap gap-2">
              {hero.topDocuments.map((doc) => (
                <Badge key={doc.id} variant="neutral" size="sm" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {doc.title}
                </Badge>
              ))}
            </div>
          </button>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {rest.map((group) => (
            <button
              key={group.groupId}
              onClick={() => goToDetail(group)}
              className="w-full rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-app-text">{group.question}</p>

                <span className="shrink-0 text-lg font-semibold text-app-brand">{group.count}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {group.topDocuments.map((doc) => (
                  <Badge key={doc.id} variant="neutral" size="sm" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {doc.title}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
