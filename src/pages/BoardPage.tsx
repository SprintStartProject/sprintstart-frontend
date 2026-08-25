import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Bot, Check, LayoutDashboard, Move, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { useBoard } from "../features/board/hooks/useBoard";
import { AddCardForm } from "../features/board/components/AddCardForm";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathRail } from "../features/board/components/BoardPathRail";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useToast } from "../context/useToast";
import { readCollapsedCards, writeCollapsedCards } from "../features/board/layout/collapsedCards";

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
 *
 * The shell is the app's page shell — banner header over `app-page-frame`, `PageHeader` for the
 * title block, shared primitives for the actions and for every empty, loading and error state — so
 * the board sits at the same gutter and reads with the same weight as Starter Work beside it.
 *
 * **The path is lifted out of the grid into the header.** It is the one card that says where the
 * hire stands overall; every other card is a detail of some part of it, so it belongs above them
 * rather than competing with a checklist for a slot. It keeps its place in the board's order — the
 * grid renders the rest, and a reorder puts the path back at the index it came from, so lifting it
 * for display never quietly rewrites what the hire arranged.
 */
export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const toast = useToast();
  const [isArranging, setIsArranging] = useState(false);

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

  // A failed write is reported the way every other failed write in the app is: as a toast,
  // rather than as a paragraph this page invented for itself. The card or list it failed on is
  // still on screen and unchanged, so the message is about the attempt, not about the surface.
  const showErrorToast = toast.error;

  useEffect(() => {
    if (!dismissError) return;
    showErrorToast("That card couldn't be removed", {
      description: "It's still here — try again.",
    });
  }, [dismissError, showErrorToast]);

  useEffect(() => {
    if (!writeError) return;
    showErrorToast("That change didn't save", {
      description: "Your board is as it was — try again.",
    });
  }, [writeError, showErrorToast]);

  // Folded cards are a preference, not board state: kept per board in local storage, read once the
  // board arrives and written on every fold. A board that will not load has nothing to fold.
  const boardId = board?.boardId ?? "";
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [readFor, setReadFor] = useState<string | null>(null);

  // Derived during render rather than in an effect, the way `SlidingTabPanel` derives its
  // direction: the fold state has to be right on the render that first shows the board, and
  // reading a key back out of storage is an idempotent read with nothing to synchronise.
  if (boardId !== readFor) {
    setReadFor(boardId);
    setCollapsedIds(readCollapsedCards(boardId));
  }

  const toggleCollapsed = useCallback(
    (cardId: string) => {
      setCollapsedIds((current) => {
        const next = new Set(current);
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        writeCollapsedCards(boardId, next);
        return next;
      });
    },
    [boardId],
  );

  // The path is drawn in the header; the grid gets everything else. Its index is kept so a reorder
  // of the visible cards can put it back where it was — the board's order is the hire's, and this
  // is a display decision, not an edit to it.
  const pathIndex =
    board?.cards.findIndex((card) => card.content.kind === "PATH_TO_FIRST_CONTRIBUTION") ?? -1;
  const pathCard = pathIndex === -1 ? null : (board?.cards[pathIndex] ?? null);

  const griddedBoard = useMemo(
    () =>
      board && pathCard ? { ...board, cards: board.cards.filter((c) => c !== pathCard) } : board,
    [board, pathCard],
  );

  const handleReorder = (cardIds: string[]) => {
    if (!pathCard || pathIndex === -1) return void reorder(cardIds);
    const next = [...cardIds];
    next.splice(Math.min(pathIndex, next.length), 0, pathCard.id);
    return void reorder(next);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={LayoutDashboard}
            title="Board"
            subtitle={
              isArranging
                ? "Drag a card to move it, or fold one shut to get it out of the way."
                : "Where your onboarding stays put between conversations."
            }
            actions={
              isArranging ? (
                <Button
                  variant="primary"
                  onClick={() => setIsArranging(false)}
                  icon={<Check className="h-4 w-4" aria-hidden="true" />}
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    iconOnly
                    onClick={() => setIsArranging(true)}
                    disabled={!board}
                    title="Arrange the board"
                    aria-label="Arrange the board"
                  >
                    <Move className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={refresh}
                    disabled={!selectedProjectId}
                    loading={loading}
                    icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  >
                    Refresh
                  </Button>
                </>
              )
            }
          />

          {pathCard && pathCard.content.kind === "PATH_TO_FIRST_CONTRIBUTION" && (
            <BoardPathRail content={pathCard.content} />
          )}
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        {!selectedProjectId && !projectsLoading ? (
          <EmptyState
            icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
            title="No project yet"
          >
            You&apos;re not on a project yet, so there&apos;s nothing to put on a board. Whoever set
            up your account can add you to one.
          </EmptyState>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" label="Loading your board" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p>Your board couldn&apos;t be loaded.</p>
              <Button variant="secondary" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          </div>
        ) : griddedBoard ? (
          <>
            <AddCardForm onAdd={addCard} />
            <BoardGrid
              board={griddedBoard}
              onDismiss={(cardId) => void dismiss(cardId)}
              dismissingId={dismissingId}
              onEdit={(cardId, request) => void editCard(cardId, request)}
              onReorder={handleReorder}
              isArranging={isArranging}
              collapsedIds={collapsedIds}
              onToggleCollapsed={toggleCollapsed}
            />
          </>
        ) : null}

        {/* The board is curated by the mentor, so it should always be one click from them. */}
        <p className="text-sm text-app-text-muted">
          <Link
            to="/buddy"
            className="inline-flex items-center gap-1.5 font-medium text-app-brand-text hover:underline"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Ask your buddy about any of this
          </Link>
        </p>
      </main>
    </div>
  );
}
