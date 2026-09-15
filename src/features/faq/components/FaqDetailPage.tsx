// ============================================================
// FaqDetailPage.tsx
// Route: /insights/faq/:groupId
// Zeigt alle Infos zu einer FAQ-Gruppe inkl. PM-Detail
// ============================================================

import { useParams, useNavigate } from "react-router-dom";
import type { FAQQuestion, FAQDocument } from "../../../features/faq/types";
import { insightsService } from "../../../services/faqService";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageShell } from "../../../components/layout/PageShell";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { queryKeys } from "../../../services/queryKeys";
import { useProjectContext } from "../../projects/useProjectContext";
import { TrendBadge } from "./TrendBadge";
import { formatAskedAt } from "../format";

import {
  ShieldAlert,
  FileText,
  Loader2,
  AlertCircle,
  MessageSquareMore,
  BookOpen,
  ArrowUp,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// COMPONENT: FaqDetailPage
// ─────────────────────────────────────────────────────────────

export function FaqDetailPage() {
  const { selectedProjectId } = useProjectContext();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const {
    data: detail,
    loading,
    error,
  } = useQueryFetch(queryKeys.faq.detail(selectedProjectId, groupId ?? ""), () =>
    insightsService.fetchFAQGroup(selectedProjectId, groupId ?? ""),
  );

  // ── RENDER ───────────────────────────────────────────────
  // The title/subtitle are the fetched group's own text, so there is nothing
  // real to show for them until it loads — a generic placeholder stands in
  // rather than leaving the header without one, but the band itself (and the
  // back button) is present from the first frame regardless of loading state.

  return (
    <PageShell
      icon={MessageSquareMore}
      title={detail?.title ?? "Recurring question"}
      subtitle={detail?.question ?? ""}
      frame="content"
      back={{ label: "Back", onClick: () => void navigate(-1) }}
      actions={
        detail && (
          <Badge variant="success" className="shrink-0 gap-1.5">
            <ArrowUp className="h-3 w-3" />
            {detail.count} times asked
          </Badge>
        )
      }
      bandExtra={
        detail &&
        (detail.trend || detail.lastAskedAt) && (
          <div className="flex flex-wrap items-center gap-2">
            {detail.trend && <TrendBadge trend={detail.trend} recentCount={detail.recentCount} />}
            {detail.lastAskedAt && (
              <span className="text-xs text-app-text-muted">
                Last asked {formatAskedAt(detail.lastAskedAt)}
              </span>
            )}
          </div>
        )
      }
      mainClassName="space-y-6 py-8 pb-24"
    >
      {loading ? (
        <div className="flex min-h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-app-text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
            <p className="text-sm">Loading group details...</p>
          </div>
        </div>
      ) : error || !detail ? (
        <div className="flex min-h-96 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-solid" />
            <h2 className="mb-2 text-lg font-semibold text-app-text">Could not load group</h2>
            <p className="mb-6 text-sm text-app-text-muted">This FAQ group may no longer exist.</p>
            <Button variant="primary" onClick={() => void navigate(-1)}>
              Go back
            </Button>
          </div>
        </div>
      ) : (
        // PM detail section
        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-app-brand uppercase">
            <ShieldAlert className="h-3.5 w-3.5" />
            PM detail
          </div>

          {/* Distinct phrasings — newest first, capped and de-duplicated by the backend */}
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-app-text-muted">
            <MessageSquareMore className="h-3.5 w-3.5" />
            How it is being asked ({detail.questions.length}
            {detail.questions.length === 1 ? " wording" : " wordings"} of {detail.count} asks)
          </div>
          <div className="mb-6 space-y-2">
            {detail.questions.map((q: FAQQuestion) => (
              <div key={q.id} className="rounded-xl bg-app-surface-muted p-4">
                <p className="text-sm leading-snug text-app-text">
                  {q.text}
                  {/* Repeats collapse into a multiplier rather than repeating the
                      line: ten identical rows say nothing the count does not, and
                      they push the genuinely different wordings out of view. */}
                  {(q.occurrences ?? 1) > 1 && (
                    <span className="ml-1.5 text-xs font-medium text-app-text-muted">
                      ({q.occurrences}×)
                    </span>
                  )}
                </p>

                {q.askedAt && (
                  <p className="mt-2 text-xs text-app-text-muted">
                    {(q.occurrences ?? 1) > 1 ? "Last asked " : ""}
                    {formatAskedAt(q.askedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Answering documents */}
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-app-text-muted">
            <BookOpen className="h-3.5 w-3.5" />
            Answering documents
          </div>
          <div className="divide-y divide-app-border">
            {detail.answeringDocuments.map((doc: FAQDocument) => (
              <div key={doc.id} className="flex items-center gap-3 py-3">
                <FileText className="h-4 w-4 shrink-0 text-app-text-disabled" />
                <span className="min-w-0 flex-1 truncate text-sm text-app-text">{doc.title}</span>
                {doc.source && (
                  <span className="shrink-0 rounded bg-app-surface-muted px-2 py-0.5 text-xs text-app-text-muted">
                    {doc.source}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
