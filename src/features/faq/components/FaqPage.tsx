import { useMemo, useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";

import type { FAQGroup } from "../types";
import { insightsService } from "../../../services/faqService";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TrendBadge } from "./TrendBadge";
import { toCategorySections } from "../grouping";

import {
  TrendingUp,
  FileText,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Layers,
  MessageSquareMore,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { useProjectContext } from "../../projects/useProjectContext";

export function FaqPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const {
    data: overview,
    loading,
    revalidating,
    error,
    refresh,
  } = useLiveFetch(() => insightsService.fetchFAQGroups(selectedProjectId), [selectedProjectId]);

  const sections = useMemo(() => (overview ? toCategorySections(overview) : []), [overview]);

  const handleRebuild = async () => {
    setRebuilding(true);
    setRebuildError(null);
    try {
      await insightsService.refreshFAQGroups(selectedProjectId);
      refresh();
    } catch (err) {
      console.error("FAQ rebuild failed", err);
      setRebuildError(
        "Rebuild failed. Is the AI service running and are there questions to group?",
      );
    } finally {
      setRebuilding(false);
    }
  };

  const toggleSection = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // The FAQ now updates itself as questions are asked, so this is a rebuild of
  // the whole grouping rather than the only way to see new questions.
  const rebuildButton = (
    <Button
      variant="secondary"
      onClick={() => void handleRebuild()}
      loading={rebuilding}
      icon={<RefreshCw className="h-4 w-4" />}
      className="shrink-0"
      title="Regroup every question from scratch"
    >
      {rebuilding ? "Rebuilding…" : "Rebuild grouping"}
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
        <p className="max-w-md text-center text-app-text-muted">
          No recurring questions yet. They appear here as soon as someone asks the AI Buddy
          something.
        </p>
        {rebuildButton}
        {rebuildError && (
          <p className="max-w-md text-center text-sm text-app-danger-text">{rebuildError}</p>
        )}
      </div>
    );
  }

  const totalGroups = overview.groups.length;
  const totalQuestions = overview.groups.reduce((sum, group) => sum + group.count, 0);
  const totalCategories = sections.filter((section) => section.category).length;
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
              subtitle="Grouped by topic and updated as questions are asked."
            />
            <div className="flex shrink-0 items-center gap-3">
              {revalidating && <Spinner size="sm" label="Updating" />}
              {rebuildButton}
            </div>
          </div>
          {rebuildError && <p className="mb-4 text-sm text-app-danger-text">{rebuildError}</p>}

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-app-brand" />
                <div>
                  <div className="text-2xl font-semibold text-app-brand">{totalCategories}</div>
                  <div className="text-xs text-app-text-muted">Topics</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <MessageSquareMore className="h-5 w-5 text-app-success-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-success-solid">{totalGroups}</div>
                  <div className="text-xs text-app-text-muted">Question groups</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-app-danger-solid" />
                <div>
                  <div className="text-2xl font-semibold text-app-danger-solid">
                    {totalQuestions}
                  </div>
                  <div className="text-xs text-app-text-muted">Total questions</div>
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
        {/* Topic sections. No "most asked" hero here: every question already
            appears under its topic, and a hero would show the top one twice. */}
        <div className="space-y-4">
          {sections.map((section) => {
            const isCollapsed = collapsed.has(section.key);
            const sectionQuestions =
              section.category?.questionCount ??
              section.groups.reduce((sum, group) => sum + group.count, 0);

            return (
              <section key={section.key} className="rounded-2xl border border-app-border">
                <button
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-app-surface-hover"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                    <h2 className="truncate font-semibold text-app-text">{section.name}</h2>
                    {section.category && (
                      <TrendBadge
                        trend={section.category.trend}
                        recentCount={section.category.recentQuestionCount}
                      />
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-app-text-muted">
                    {section.groups.length} {section.groups.length === 1 ? "group" : "groups"} ·{" "}
                    {sectionQuestions} asked
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2 px-3 pb-3">
                    {section.groups.map((group) => (
                      <button
                        key={group.groupId}
                        onClick={() => goToDetail(group)}
                        className="w-full rounded-xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
                      >
                        <div className="mb-2 flex items-start justify-between gap-4">
                          <p className="text-sm font-medium text-app-text">{group.question}</p>
                          <span className="shrink-0 text-lg font-semibold text-app-brand">
                            {group.count}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {group.trend && (
                            <TrendBadge trend={group.trend} recentCount={group.recentCount} />
                          )}
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
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
