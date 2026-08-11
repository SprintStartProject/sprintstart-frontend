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
import { useFetch } from "../../../hooks/useFetch";
import { useProjectContext } from "../../projects/useProjectContext";

import {
  ArrowLeft,
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
  } = useFetch(() => insightsService.fetchFAQGroup(selectedProjectId, groupId ?? ""), [groupId]);

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading group details...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  if (error || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-solid" />
          <h2 className="mb-2 text-lg font-semibold text-app-text">Could not load group</h2>
          <p className="mb-6 text-sm text-app-text-muted">This FAQ group may no longer exist.</p>
          <Button variant="primary" onClick={() => void navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ── HEADER ────────────────────────────────────────── */}
      <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-content py-4">
          <Button
            variant="ghost"
            onClick={() => void navigate(-1)}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back
          </Button>

          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl leading-snug font-semibold text-app-text sm:text-2xl">
              {detail.questions[0].text}
            </h1>
            <Badge variant="success" className="shrink-0 gap-1.5">
              <ArrowUp className="h-3 w-3" />
              {detail.count} times asked
            </Badge>
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────── */}
      <main className="app-page-content space-y-6 py-8 pb-24">
        {/* PM detail section */}
        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-app-brand uppercase">
            <ShieldAlert className="h-3.5 w-3.5" />
            PM detail
          </div>

          {/* Individual questions */}
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-app-text-muted">
            <MessageSquareMore className="h-3.5 w-3.5" />
            Individual questions ({detail.questions.length})
          </div>
          <div className="mb-6 space-y-2">
            {detail.questions.map((q: FAQQuestion) => (
              <div key={q.id} className="rounded-xl bg-app-surface-muted p-4">
                <p className="mb-3 text-sm leading-snug text-app-text">{q.text}</p>

                <div className="flex items-center justify-between text-xs text-app-text-muted">
                  <span>Question ID: {q.id}</span>
                </div>
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
      </main>
    </div>
  );
}
