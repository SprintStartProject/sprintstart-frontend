import { Link } from "react-router-dom";
import { AlertCircle, Bot, LayoutDashboard, Loader2, RefreshCw } from "lucide-react";
import { useBoard } from "../features/board/hooks/useBoard";
import { AddCardForm } from "../features/board/components/AddCardForm";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { useProjectContext } from "../features/projects/useProjectContext";

/**
 * The board: the hire's persistent working surface.
 *
 * The buddy conversation opens fresh every visit — the previous window is folded into the mentor's
 * memory and never replayed — so anything durable it showed you was gone by the next visit. This is
 * where those things live instead. Chat is the conversation; this is the whiteboard beside it.
 *
 * Per project, because what belongs on it is: the path, the open work, later the current task. The
 * project switcher is the same one the rest of the app uses, so the choice is remembered across
 * pages rather than being a setting of this one.
 */
export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();

  const {
    board,
    loading,
    error,
    refresh,
    dismiss,
    dismissingId,
    dismissError,
    addCard,
    editCard,
    reorder,
    writeError,
  } = useBoard(selectedProjectId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-brand/10">
            <LayoutDashboard className="h-5 w-5 text-app-brand-text" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg leading-tight font-bold text-app-text">Board</h1>
            <p className="text-sm text-app-text-muted">
              Where your onboarding stays put between conversations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={!selectedProjectId || loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-app-border px-3 text-sm font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {!selectedProjectId && !projectsLoading ? (
        <p className="rounded-2xl border border-app-border bg-app-surface p-6 text-sm text-app-text-muted">
          You&apos;re not on a project yet, so there&apos;s nothing to put on a board. Whoever set
          up your account can add you to one.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-app-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your board…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg/30 p-4 text-sm text-app-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Your board couldn&apos;t be loaded.{" "}
            <button type="button" onClick={refresh} className="underline">
              Try again
            </button>
            .
          </span>
        </div>
      ) : board ? (
        <>
          {/* A card that looks gone but is not is worse than one that visibly refused. */}
          {(dismissError || writeError) && (
            <p className="mb-4 rounded-xl border border-app-danger-border bg-app-danger-bg/30 p-3 text-sm text-app-danger-text">
              {dismissError
                ? "That card couldn't be removed. It's still here — try again."
                : "That change didn't save. Your board is as it was — try again."}
            </p>
          )}
          <AddCardForm onAdd={addCard} />
          <BoardGrid
            board={board}
            onDismiss={(cardId) => void dismiss(cardId)}
            dismissingId={dismissingId}
            onEdit={(cardId, request) => void editCard(cardId, request)}
            onReorder={(cardIds) => void reorder(cardIds)}
          />
        </>
      ) : null}

      {/* The board is curated by the mentor, so it should always be one click from them. */}
      <p className="mt-6 text-sm text-app-text-muted">
        <Link
          to="/buddy"
          className="inline-flex items-center gap-1.5 font-medium text-app-brand-text hover:underline"
        >
          <Bot className="h-4 w-4" aria-hidden="true" />
          Ask your buddy about any of this
        </Link>
      </p>
    </div>
  );
}
