// ============================================================
// PhaseCheckAdminModal.tsx
// ============================================================
// PM/HR/Admin view of one phase's knowledge check, with two
// tabs: the member's submitted attempts, and an editor for the
// questions themselves. Onboarding paths are per-user, so
// editing here only affects this member's check.
// ============================================================

import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/Modal";
import { onboardingService } from "../../../../services/onboardingService";
import type {
  AdminPhaseCheckQuestionEndpoint,
  PhaseCheckAttemptsReviewEndpoint,
  UpsertPhaseCheckQuestion,
  CheckQuestionType,
} from "../../../onboarding/types";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ClipboardCheck,
} from "lucide-react";

export type PhaseCheckAdminTab = "results" | "questions";

type PhaseCheckAdminModalProps = {
  userId: string;
  phaseId: string;
  phaseTitle: string;
  memberName: string;
  initialTab: PhaseCheckAdminTab;
  /** Called after questions were saved, so the parent can refetch the path summary. */
  onSaved: () => void;
  onClose: () => void;
};

/**
 * Editor state for one question; mirrors UpsertPhaseCheckQuestion plus a local key.
 *
 * `id` is the server's ID, kept so the save can tell the backend which questions already
 * exist — without it every save recreates the whole check, which orphans the members'
 * review pool entries and their attempt history. Null means "new question".
 */
type QuestionDraft = {
  key: string;
  id: string | null;
  type: CheckQuestionType;
  question: string;
  explanation: string;
  correctAnswer: string;
  options: { key: string; id: string | null; label: string; correct: boolean }[];
};

let draftKeySeed = 0;
const nextKey = () => `draft-${draftKeySeed++}`;

function toDraft(question: AdminPhaseCheckQuestionEndpoint): QuestionDraft {
  return {
    key: nextKey(),
    id: question.id,
    type: question.type,
    question: question.question,
    explanation: question.explanation ?? "",
    correctAnswer: question.correctAnswer ?? "",
    options: (question.options ?? []).map((option) => ({
      key: nextKey(),
      id: option.id,
      label: option.label,
      correct: option.correct,
    })),
  };
}

function emptyDraft(type: CheckQuestionType): QuestionDraft {
  return {
    key: nextKey(),
    id: null,
    type,
    question: "",
    explanation: "",
    correctAnswer: "",
    options:
      type === "MULTIPLE_CHOICE"
        ? [
            { key: nextKey(), id: null, label: "", correct: true },
            { key: nextKey(), id: null, label: "", correct: false },
          ]
        : [],
  };
}

/**
 * Mirrors the backend's validation so the user gets told what is wrong before a save
 * round-trip: multiple choice needs two options and a correct one, short text a sample
 * answer, and every question needs text.
 */
function validate(drafts: QuestionDraft[]): string | null {
  if (drafts.length === 0) return null;
  for (const [index, draft] of drafts.entries()) {
    const label = `Question ${index + 1}`;
    if (!draft.question.trim()) return `${label} needs a question text.`;
    if (draft.type === "MULTIPLE_CHOICE") {
      const filled = draft.options.filter((option) => option.label.trim());
      if (filled.length < 2) return `${label} needs at least 2 options.`;
      if (!filled.some((option) => option.correct)) {
        return `${label} needs at least 1 correct option.`;
      }
    } else if (!draft.correctAnswer.trim()) {
      return `${label} needs a sample answer.`;
    }
  }
  return null;
}

/**
 * Turns the editor state into the save payload.
 *
 * IDs of existing questions and options are passed through so the backend updates them in
 * place instead of recreating the check. Questions the user removed are simply absent, which
 * is how the backend learns to delete exactly those.
 */
function toPayload(drafts: QuestionDraft[]): UpsertPhaseCheckQuestion[] {
  return drafts.map((draft, index) => ({
    id: draft.id ?? undefined,
    position: index,
    type: draft.type,
    question: draft.question.trim(),
    explanation: draft.explanation.trim() || undefined,
    correctAnswer: draft.type === "SHORT_TEXT" ? draft.correctAnswer.trim() : undefined,
    options:
      draft.type === "MULTIPLE_CHOICE"
        ? draft.options
            .filter((option) => option.label.trim())
            .map((option, optionIndex) => ({
              id: option.id ?? undefined,
              position: optionIndex,
              label: option.label.trim(),
              correct: option.correct,
            }))
        : undefined,
  }));
}

export function PhaseCheckAdminModal({
  userId,
  phaseId,
  phaseTitle,
  memberName,
  initialTab,
  onSaved,
  onClose,
}: PhaseCheckAdminModalProps) {
  const [tab, setTab] = useState<PhaseCheckAdminTab>(initialTab);
  const [questions, setQuestions] = useState<AdminPhaseCheckQuestionEndpoint[] | null>(null);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [attempts, setAttempts] = useState<PhaseCheckAttemptsReviewEndpoint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Both tabs need the questions: the editor edits them, the results tab joins them
  // onto the attempts, which only carry question ids.
  useEffect(() => {
    const load = async () => {
      try {
        const [check, review] = await Promise.all([
          onboardingService.fetchPhaseCheckForEditing(phaseId),
          onboardingService.fetchPhaseCheckAttempts(userId, phaseId),
        ]);
        setQuestions(check.questions);
        setDrafts(check.questions.map(toDraft));
        setAttempts(review);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void load();
  }, [phaseId, userId]);

  const updateDraft = (key: string, patch: Partial<QuestionDraft>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );

  const save = async () => {
    const problem = validate(drafts);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await onboardingService.savePhaseCheck(phaseId, toPayload(drafts));
      setQuestions(saved.questions);
      setDrafts(saved.questions.map(toDraft));
      setSavedAt(Date.now());
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const footer =
    tab === "questions" ? (
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || questions === null}
        className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save questions
      </button>
    ) : undefined;

  return (
    <Modal
      isOpen
      title="Knowledge check"
      description={`${phaseTitle} · ${memberName}`}
      size="xl"
      bodyClassName="max-h-[60vh] overflow-y-auto px-7 py-6"
      onClose={onClose}
      footer={footer}
    >
      <div role="tablist" aria-label="Knowledge check sections" className="mb-5 flex gap-2">
        <TabButton active={tab === "results"} onClick={() => setTab("results")} label="Results" />
        <TabButton
          active={tab === "questions"}
          onClick={() => setTab("questions")}
          label="Questions"
        />
      </div>

      {!questions && !loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-app-text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-app-brand" />
          <p className="text-sm">Loading knowledge check...</p>
        </div>
      )}
      {loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-app-danger-solid" />
          <p className="text-sm text-app-text-muted">{loadError}</p>
        </div>
      )}

      {questions && tab === "results" && <ResultsTab attempts={attempts} questions={questions} />}

      {questions && tab === "questions" && (
        <QuestionsEditor
          drafts={drafts}
          savedAt={savedAt}
          saveError={saveError}
          onUpdate={updateDraft}
          onRemove={(key) => setDrafts((current) => current.filter((draft) => draft.key !== key))}
          onAdd={(type) => setDrafts((current) => [...current, emptyDraft(type)])}
        />
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-app-brand bg-app-brand-soft text-app-brand"
          : "border-app-border text-app-text-muted hover:border-app-border-strong hover:text-app-text"
      }`}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Results tab
// ─────────────────────────────────────────────────────────────

function ResultsTab({
  attempts,
  questions,
}: {
  attempts: PhaseCheckAttemptsReviewEndpoint | null;
  questions: AdminPhaseCheckQuestionEndpoint[];
}) {
  const questionText = new Map(questions.map((question) => [question.id, question.question]));

  if (!attempts || attempts.attempts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <ClipboardCheck className="h-8 w-8 text-app-text-muted" />
        <p className="text-sm font-semibold text-app-text">No attempts yet</p>
        <p className="text-sm text-app-text-muted">
          This member has not submitted the knowledge check of this phase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attempts.attempts.map((attempt, index) => (
        <div
          key={attempt.id}
          className={`rounded-2xl border p-4 ${
            attempt.passed ? "border-app-success-solid/40" : "border-app-danger-solid/40"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {attempt.passed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-app-success-solid" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-app-danger-solid" />
              )}
              <span className="text-sm font-semibold text-app-text">
                {attempt.passed ? "Passed" : "Not passed"}
              </span>
              <span className="text-xs text-app-text-muted">
                {attempt.correctAnswerCount}/{attempt.questionCount} correct
              </span>
            </div>
            <span className="text-xs text-app-text-muted">
              {/* Newest first, so the first entry is the most recent attempt. */}
              {index === 0 ? "Latest · " : ""}
              {new Date(attempt.createdAt).toLocaleString()}
            </span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {attempt.answers.map((answer) => (
              <li
                key={answer.questionId}
                className="flex items-start gap-2 text-xs text-app-text-muted"
              >
                {answer.correct ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-success-solid" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-danger-solid" />
                )}
                <span className="min-w-0">
                  {/* Questions replaced since this attempt are no longer resolvable. */}
                  {questionText.get(answer.questionId) ?? "Question was replaced"}
                  {answer.textAnswer && (
                    <span className="text-app-text"> — “{answer.textAnswer}”</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Questions editor
// ─────────────────────────────────────────────────────────────

function QuestionsEditor({
  drafts,
  savedAt,
  saveError,
  onUpdate,
  onRemove,
  onAdd,
}: {
  drafts: QuestionDraft[];
  savedAt: number | null;
  saveError: string | null;
  onUpdate: (key: string, patch: Partial<QuestionDraft>) => void;
  onRemove: (key: string) => void;
  onAdd: (type: CheckQuestionType) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-app-surface-muted px-3 py-2 text-xs text-app-text-muted">
        Saving replaces this member&apos;s check for the phase. Earlier attempts stay as history,
        and questions they already cleared are not asked again.
      </p>

      {drafts.map((draft, index) => (
        <div key={draft.key} className="rounded-2xl border border-app-border p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold text-app-text-muted">
              Question {index + 1} ·{" "}
              {draft.type === "MULTIPLE_CHOICE" ? "Multiple choice" : "Short text"}
            </span>
            <button
              type="button"
              onClick={() => onRemove(draft.key)}
              aria-label={`Remove question ${index + 1}`}
              className="rounded-lg border border-app-border p-1.5 text-app-text-muted transition-colors hover:border-app-danger-solid hover:text-app-danger-solid"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={draft.question}
            onChange={(event) => onUpdate(draft.key, { question: event.target.value })}
            placeholder="Question"
            aria-label={`Question ${index + 1} text`}
            className="mt-3 w-full rounded-xl border border-app-border bg-app-bg px-4 py-2.5 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-brand focus:outline-none"
          />

          {draft.type === "MULTIPLE_CHOICE" ? (
            <div className="mt-3 space-y-2">
              {draft.options.map((option, optionIndex) => (
                <div key={option.key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={option.correct}
                    aria-label={`Option ${optionIndex + 1} is correct`}
                    onChange={() =>
                      onUpdate(draft.key, {
                        options: draft.options.map((entry) =>
                          entry.key === option.key ? { ...entry, correct: !entry.correct } : entry,
                        ),
                      })
                    }
                    className="h-4 w-4 shrink-0"
                  />
                  <input
                    type="text"
                    value={option.label}
                    placeholder={`Option ${optionIndex + 1}`}
                    aria-label={`Option ${optionIndex + 1} label`}
                    onChange={(event) =>
                      onUpdate(draft.key, {
                        options: draft.options.map((entry) =>
                          entry.key === option.key
                            ? { ...entry, label: event.target.value }
                            : entry,
                        ),
                      })
                    }
                    className="w-full rounded-xl border border-app-border bg-app-bg px-4 py-2 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(draft.key, {
                        options: draft.options.filter((entry) => entry.key !== option.key),
                      })
                    }
                    aria-label={`Remove option ${optionIndex + 1}`}
                    className="rounded-lg border border-app-border p-1.5 text-app-text-muted transition-colors hover:border-app-danger-solid hover:text-app-danger-solid"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onUpdate(draft.key, {
                    options: [
                      ...draft.options,
                      { key: nextKey(), id: null, label: "", correct: false },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-app-brand hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={draft.correctAnswer}
              onChange={(event) => onUpdate(draft.key, { correctAnswer: event.target.value })}
              placeholder="Sample answer (graded semantically by the AI)"
              aria-label={`Question ${index + 1} sample answer`}
              className="mt-3 w-full rounded-xl border border-app-border bg-app-bg px-4 py-2.5 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-brand focus:outline-none"
            />
          )}

          <input
            type="text"
            value={draft.explanation}
            onChange={(event) => onUpdate(draft.key, { explanation: event.target.value })}
            placeholder="Explanation shown after answering (optional)"
            aria-label={`Question ${index + 1} explanation`}
            className="mt-2 w-full rounded-xl border border-app-border bg-app-bg px-4 py-2 text-xs text-app-text placeholder:text-app-text-subtle focus:border-app-brand focus:outline-none"
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAdd("MULTIPLE_CHOICE")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-xs font-medium text-app-text-muted transition-all hover:border-app-border-strong hover:text-app-text"
        >
          <Plus className="h-3.5 w-3.5" />
          Multiple choice
        </button>
        <button
          type="button"
          onClick={() => onAdd("SHORT_TEXT")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-xs font-medium text-app-text-muted transition-all hover:border-app-border-strong hover:text-app-text"
        >
          <Plus className="h-3.5 w-3.5" />
          Short text
        </button>
      </div>

      {saveError && (
        <p className="flex items-center gap-2 text-sm text-app-danger-solid">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </p>
      )}
      {savedAt !== null && !saveError && (
        <p className="flex items-center gap-2 text-sm text-app-success-text">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Questions saved.
        </p>
      )}
    </div>
  );
}
