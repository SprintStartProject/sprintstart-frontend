// ============================================================
// FaqWidget.tsx
// Dashboard widget — the most asked questions by title; click
// navigates to /insights/faq/:groupId
// ============================================================

import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TrendBadge } from "./TrendBadge";
import { useProjectContext } from "../../projects/useProjectContext";

import { TrendingUp, FileText, ArrowRight, AlertCircle } from "lucide-react";

/** Entries shown before the widget stops being a glance and starts being a list. */
const MAX_ENTRIES = 5;

// ─────────────────────────────────────────────────────────────
// COMPONENT: FaqWidget
// ─────────────────────────────────────────────────────────────

export function FaqWidget() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const {
    data: overview,
    loading,
    revalidating,
    error,
  } = useLiveFetch(() => insightsService.fetchFAQGroups(selectedProjectId), [selectedProjectId]);

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Spinner size="lg" label="Loading recurring questions" />
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  // Kept apart from the empty state: on a dashboard the two are one glance
  // apart, and "nobody has asked anything yet" is a very different thing to
  // report than "this panel could not be loaded".
  if (error || !overview) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-danger-text" />
        <p className="text-sm text-app-text-muted">
          Could not load the recurring questions. Is the backend reachable?
        </p>
      </div>
    );
  }

  // ── EMPTY ────────────────────────────────────────────────

  if (overview.groups.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No recurring questions yet. They appear here as soon as someone asks a question in the
          chat.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void navigate("/insights/faq")}
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          Open FAQ page
        </Button>
      </div>
    );
  }

  const sorted = [...overview.groups].sort((a, b) => b.count - a.count);
  const [hero, ...rest] = sorted.slice(0, MAX_ENTRIES);

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
          <span className="text-sm font-semibold text-app-text">Recurring questions</span>
          {/* No refresh button any more: the panel follows the chat on its own. */}
          {revalidating && <Spinner size="sm" label="Updating recurring questions" />}
        </div>
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

        <p className="mb-1 pr-12 text-sm leading-snug font-semibold text-app-text">{hero.title}</p>
        <p className="mb-3 truncate pr-12 text-xs text-app-text-muted">{hero.question}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          {hero.trend && <TrendBadge trend={hero.trend} recentCount={hero.recentCount} />}
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
            <p className="mb-2 line-clamp-2 text-xs leading-snug font-medium text-app-text">
              {group.title}
            </p>
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
