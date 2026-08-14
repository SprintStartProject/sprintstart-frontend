// ============================================================
// FaqWidget.tsx
// Dashboard widget — most asked question plus the topics it sits
// among; click navigates to /insights/faq
// ============================================================

import { useMemo } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TrendBadge } from "./TrendBadge";
import { toCategorySections } from "../grouping";
import { useProjectContext } from "../../projects/useProjectContext";

import { TrendingUp, FileText, ArrowRight, AlertCircle } from "lucide-react";

/** Topics shown before the widget stops being a glance and starts being a list. */
const MAX_CATEGORIES = 4;

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

  const sections = useMemo(() => (overview ? toCategorySections(overview) : []), [overview]);

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Spinner size="lg" label="Loading recurring questions" />
      </div>
    );
  }

  // ── EMPTY ────────────────────────────────────────────────

  if (error || !overview || overview.groups.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No recurring questions yet. They appear here as soon as someone asks the AI Buddy
          something.
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
  const hero = sorted[0];
  const topCategories = sections.filter((section) => section.category).slice(0, MAX_CATEGORIES);

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
          {/* No refresh button any more: the panel follows the Buddy on its own. */}
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

        <p className="mb-3 pr-12 text-sm leading-snug font-semibold text-app-text">
          {hero.question}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {hero.category && (
            <Badge variant="brand" size="sm">
              {hero.category}
            </Badge>
          )}
          {hero.topDocuments.map((doc) => (
            <Badge key={doc.id} variant="neutral" size="sm" className="gap-1">
              <FileText className="h-3 w-3" />
              {doc.title}
            </Badge>
          ))}
        </div>
      </button>

      {/* Topics — the level a PM scans by once the question set grows */}
      {topCategories.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {topCategories.map((section) => (
            <div
              key={section.key}
              className="rounded-xl border border-app-border bg-app-surface p-3"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium text-app-text">{section.name}</p>
                <span className="shrink-0 text-lg leading-none font-semibold text-app-brand">
                  {section.category?.questionCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-app-text-muted">
                  {section.groups.length} {section.groups.length === 1 ? "group" : "groups"}
                </span>
                {section.category && <TrendBadge trend={section.category.trend} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </ClickableCard>
  );
}
