import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Sparkles, Target, X } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../context/useAuth";
import { PermissionGroup } from "../services/types";
import { StarterWorkTaskCard } from "../features/starter-work/components/StarterWorkTaskCard";
import { NewStarterTaskModal } from "../features/starter-work/components/NewStarterTaskModal";
import { CorpusIssueBrowser } from "../features/starter-work/components/CorpusIssueBrowser";
import { useProjectContext } from "../features/projects/useProjectContext";
import { TaskOrientationManager } from "../features/orientation/components/TaskOrientationManager";
import { useStarterWorkReview } from "../features/starter-work/hooks/useStarterWorkReview";
import type { CreateStarterWorkTaskInput } from "../features/starter-work/types";

/**
 * Where a PM looks over the starter tasks the corpus produced.
 *
 * A mined task is live and claimable the moment it lands; this lists the ones nobody has vouched
 * for yet. Vouching lifts the demotion fit-ranking applies — it does not admit anything, and
 * nothing here holds a task back from a hire.
 *
 * Removal is the one irreversible action, and it is sticky: mining never brings back a task
 * somebody took out, or they would take it out again after every crawl.
 *
 * HR reads, `ADMIN`/`PM` act, matching the backend's role split.
 */
export function StarterWorkPage() {
  const { profile } = useAuth();
  const canAct = profile?.permissionGroup !== PermissionGroup.HR;
  // Loaded here rather than inside the modal so opening the form never waits on a fetch. An
  // empty list degrades to "Any role" only, which is a usable form rather than a broken one.
  const { selectedProjectId } = useProjectContext();
  const {
    tasks,
    isLoading,
    isGenerating,
    error,
    generateResult,
    createdTask,
    createdVia,
    generate,
    create,
    notePromoted,
    dismissCreated,
    approve,
    reject,
  } = useStarterWorkReview();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (input: CreateStarterWorkTaskInput): Promise<boolean> => {
    setIsCreating(true);
    const ok = await create(input);
    setIsCreating(false);
    return ok;
  };

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Target}
            title="Starter Work"
            subtitle="Well-scoped first tasks mined from the ingested corpus. Approving one turns it into a goal a hire can work toward — their path becomes the route to shipping it."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canAct && (
                  <button
                    type="button"
                    data-testid="add-starter-task"
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover"
                  >
                    <Plus className="h-4 w-4" />
                    Add a task
                  </button>
                )}
                <button
                  type="button"
                  data-testid="generate-starter-work"
                  onClick={() => void generate()}
                  disabled={isGenerating}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating ? "Mining..." : "Find starter tasks"}
                </button>
              </div>
            }
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        {createdTask && (
          <div
            data-testid="created-task-confirmation"
            className="flex items-start gap-3 rounded-2xl border border-app-success-border bg-app-success-bg p-4 text-sm text-app-success-text"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">
              <strong>“{createdTask.title}”</strong> is in the pool —{" "}
              {createdVia === "picked" ? "you picked it" : "you wrote it"}, so it counts as reviewed
              and won&apos;t appear below. Hires can aim at it straight away.
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissCreated}
              className="rounded-lg p-1 text-app-success-text transition-colors hover:bg-app-surface-hover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {generateResult && (
          <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft p-4 text-sm text-app-brand-text">
            Added {generateResult.tasksProposed} task
            {generateResult.tasksProposed === 1 ? "" : "s"} to the pool. Hires can claim them now;
            they rank below tasks somebody has looked at.
            {generateResult.notes.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1">
                {generateResult.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-4 text-sm text-app-danger-text">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-3xl border border-app-border bg-app-bg p-10 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-app-text-disabled" />
            <p className="text-sm text-app-text-muted">
              Nothing here needs a look. Tasks are mined from the corpus whenever a crawl finishes —
              this is where the ones nobody has vouched for yet show up, not a queue blocking
              anybody.
            </p>
          </div>
        ) : (
          <section className="space-y-3" data-testid="starter-work-unreviewed">
            {tasks.map((task) => (
              <StarterWorkTaskCard
                key={task.id}
                task={task}
                canAct={canAct}
                onApprove={approve}
                onReject={reject}
              />
            ))}
          </section>
        )}

        {/* The picker beside the blank form: the same action with a better input than an
                    empty box. HR reads it, matching the rest of the page. It is a second way to
                    add work, never a filter in front of mining — the pool above stays live. */}
        <CorpusIssueBrowser
          projectId={selectedProjectId}
          canAct={canAct}
          onPromoted={notePromoted}
        />

        {/* Authoring a task's orientation is PM/ADMIN only, matching the backend role split —
                    HR looks over the pool but does not write hire-facing content. */}
        {canAct && <TaskOrientationManager />}
      </main>

      {isCreateOpen && (
        <NewStarterTaskModal
          isSaving={isCreating}
          error={error}
          onCreate={handleCreate}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
}
