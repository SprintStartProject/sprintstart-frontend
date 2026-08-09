// ============================================================
// FaqWidget.tsx
// Dashboard widget — zeigt Top-5 FAQ-Gruppen, klick navigiert
// zur Detailpage /insights/faq/:groupId
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useFetch } from "../../../hooks/useFetch";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { useProjectContext } from "../../projects/useProjectContext";

import {
  TrendingUp,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// COMPONENT: FaqWidget
// ─────────────────────────────────────────────────────────────

export function FaqWidget() {
    const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const {
    data: overview,
    loading,
    error,
  } = useFetch(() => insightsService.fetchFAQGroups(selectedProjectId), [refreshKey]);

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

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex items-center justify-center min-h-48">
        <Loader2 className="w-5 h-5 animate-spin text-app-brand" />
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  if (error || !overview || overview.groups.length === 0) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex flex-col items-center justify-center gap-3 min-h-48 text-center">
        <AlertCircle className="w-5 h-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No FAQ groups yet. Trigger a refresh to generate them.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-brand hover:bg-app-brand-hover text-white text-xs font-medium transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => void navigate("/insights/faq")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-app-border text-xs text-app-text-muted hover:text-app-text transition-colors"
          >
            Open FAQ page
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {refreshError && (
          <p className="text-xs text-app-danger-text max-w-xs">{refreshError}</p>
        )}
      </div>
    );
  }

  // Sort by count descending, take top 5
  const sorted = [...overview.groups]
    .sort((a, b) => b.count - a.count);

  const sliced = sorted.slice(0,5);


  const [hero, ...rest] = sliced;

  const goToDetail = (group: FAQGroup) =>
    void navigate(`/insights/faq/${group.groupId}`);

  // ── RENDER ───────────────────────────────────────────────

  return (
    <ClickableCard
      onClick={() => void navigate("/insights/faq")}
      interactive={false}
      className="rounded-2xl border border-app-border bg-app-surface p-5 cursor-pointer transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* <Messages className="w-4 h-4 text-app-brand" /> */}
          <span className="text-sm font-semibold text-app-text">
            Recurring questions
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleRefresh();
            }}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center text-app-text-muted hover:text-app-text transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void navigate("/insights/faq");
            }}
            className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
          >
            See all ({sorted.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hero card — most asked */}
      <button
        onClick={(event) => {
          event.stopPropagation();
          goToDetail(hero);
        }}
        className="w-full text-left rounded-2xl border border-app-border bg-app-surface hover:border-app-border-strong transition-colors p-4 mb-3 relative overflow-hidden"
      >
        {/* Big count in the corner */}
        <span className="absolute top-4 right-4 text-3xl font-semibold text-app-brand">
          {hero.count}
        </span>

        <div className="inline-flex items-center gap-1.5 bg-app-success-bg text-app-success-text text-xs font-medium px-2.5 py-1 rounded-full mb-3">
          <TrendingUp className="w-3 h-3" />
          Most asked
        </div>

        <p className="text-sm font-semibold text-app-text leading-snug mb-3 pr-12">
          {hero.question}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {hero.topDocuments.map((doc) => (
            <span
              key={doc.id}
              className="flex items-center gap-1 text-xs text-app-text-muted bg-app-surface-muted border border-app-border rounded-full px-2 py-0.5"
            >
              <FileText className="w-3 h-3" />
              {doc.title}
            </span>
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
            className="text-left rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong transition-colors p-3"
          >
            <div className="text-xl font-semibold text-app-brand mb-1">
              {group.count}
            </div>
            <p className="text-xs text-app-text leading-snug line-clamp-2 mb-2">
              {group.question}
            </p>
            {group.topDocuments[0] && (
              <div className="flex items-center gap-1 text-xs text-app-text-muted overflow-hidden">
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{group.topDocuments[0].title}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </ClickableCard>
  );
}