// ============================================================
// FaqDetailPage.tsx
// Route: /insights/faq/:groupId
// Zeigt alle Infos zu einer FAQ-Gruppe inkl. PM-Detail
// ============================================================

import { useParams, useNavigate } from "react-router-dom";
import type {
  FAQQuestion,
  FAQDocument,
} from "../../../features/faq/types";
import { insightsService } from "../../../services/faqService";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useFetch } from "../../../hooks/useFetch";

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
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const {
    data: detail,
    loading,
    error,
  } = useFetch(
    () => insightsService.fetchFAQGroup(groupId ?? ""),
    [groupId],
  );

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading group details...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-app-danger-solid mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-app-text mb-2">
            Could not load group
          </h2>
          <p className="text-sm text-app-text-muted mb-6">
            This FAQ group may no longer exist.
          </p>
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
            <h1 className="text-xl sm:text-2xl font-semibold text-app-text leading-snug">
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
      <main className="app-page-content py-8 pb-24 space-y-6">

        {/* PM detail section */}
        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-app-brand uppercase tracking-widest mb-4">
            <ShieldAlert className="w-3.5 h-3.5" />
            PM detail
          </div>

          {/* Individual questions */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted mb-3">
            <MessageSquareMore className="w-3.5 h-3.5" />
            Individual questions ({detail.questions.length})
          </div>
          <div className="space-y-2 mb-6">
            {detail.questions.map((q: FAQQuestion) => (
              <div
                key={q.id}
                className="bg-app-surface-muted rounded-xl p-4"
              >
                <p className="text-sm text-app-text leading-snug mb-3">
                  {q.text}
                </p>

                <div className="flex items-center justify-between text-xs text-app-text-muted">
                  <span>Question ID: {q.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Answering documents */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            Answering documents
          </div>
          <div className="divide-y divide-app-border">
            {detail.answeringDocuments.map((doc: FAQDocument) => (
              <div key={doc.id} className="flex items-center gap-3 py-3">
                <FileText className="w-4 h-4 text-app-text-disabled shrink-0" />
                <span className="text-sm text-app-text flex-1 min-w-0 truncate">
                  {doc.title}
                </span>
                {doc.source && (
                  <span className="text-xs text-app-text-muted bg-app-surface-muted px-2 py-0.5 rounded shrink-0">
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
