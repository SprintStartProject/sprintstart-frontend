// ============================================================
// FaqWidget.tsx
// Dashboard widget — zeigt Top-5 FAQ-Gruppen, klick navigiert
// zur Detailpage /insights/faq/:groupId
// ============================================================

import { useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useFetch } from "../../../hooks/useFetch";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

import { TrendingUp, FileText, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// COMPONENT: FaqWidget
// ─────────────────────────────────────────────────────────────

export function FaqWidget() {
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const {
    data: overview,
    loading,
    error,
  } = useFetch(() => insightsService.fetchFAQGroups(), [refreshKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await insightsService.refreshFAQGroups();
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

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  if (error || !overview || overview.groups.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No FAQ groups yet. Trigger a refresh to generate them.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleRefresh()}
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigate("/insights/faq")}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Open FAQ page
          </Button>
        </div>
        {refreshError && <p className="max-w-xs text-xs text-app-danger-text">{refreshError}</p>}
      </div>
    );
  }

  // Sort by count descending, take top 5
  const sorted = [...overview.groups].sort((a, b) => b.count - a.count);

  const sliced = sorted.slice(0, 5);

  const [hero, ...rest] = sliced;

  const goToDetail = (group: FAQGroup) => void navigate(`/insights/faq/${group.groupId}`);

  // ── RENDER ───────────────────────────────────────────────

  return (
    <ClickableCard
      onClick={() => void navigate("/insights/faq")}
      interactive={false}
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* <Messages className="w-4 h-4 text-app-brand" /> */}
          <span className="text-sm font-semibold text-app-text">Recurring questions</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={(event) => {
              event.stopPropagation();
              void handleRefresh();
            }}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void navigate("/insights/faq");
            }}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            See all ({sorted.length})
          </Button>
        </div>
      </div>

      {/* Hero card — most asked */}
      <button
        onClick={(event) => {
          event.stopPropagation();
          goToDetail(hero);
        }}
        className="relative mb-3 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
      >
        {/* Big count in the corner */}
        <span className="absolute top-4 right-4 text-3xl font-semibold text-app-brand">
          {hero.count}
        </span>

        <Badge variant="success" className="mb-3 gap-1.5">
          <TrendingUp className="h-3 w-3" />
          Most asked
        </Badge>

        <p className="mb-3 pr-12 text-sm leading-snug font-semibold text-app-text">
          {hero.question}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {hero.topDocuments.map((doc) => (
            <Badge key={doc.id} variant="neutral" size="sm" className="gap-1">
              <FileText className="h-3 w-3" />
              {doc.title}
            </Badge>
          ))}
        </div>
      </button>

      {/* 2x2 grid for the next four */}
      <div className="grid grid-cols-2 gap-2">
        {rest.map((group) => (
          <button
            key={group.groupId}
            onClick={(event) => {
              event.stopPropagation();
              goToDetail(group);
            }}
            className="rounded-xl border border-app-border bg-app-surface p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
          >
            <div className="mb-1 text-xl font-semibold text-app-brand">{group.count}</div>
            <p className="mb-2 line-clamp-2 text-xs leading-snug text-app-text">{group.question}</p>
            {group.topDocuments[0] && (
              <div className="flex items-center gap-1 overflow-hidden text-xs text-app-text-muted">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{group.topDocuments[0].title}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </ClickableCard>
  );
}
