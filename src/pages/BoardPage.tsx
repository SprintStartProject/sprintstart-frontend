import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Bot, Check, LayoutDashboard, Move, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { Spinner } from "../components/ui/Spinner";
import { useBoard } from "../features/board/hooks/useBoard";
import { AddCardForm } from "../features/board/components/AddCardForm";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathRail } from "../features/board/components/BoardPathRail";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useToast } from "../context/useToast";
import { readCollapsedCards, writeCollapsedCards } from "../features/board/layout/collapsedCards";
import { readPinnedCards, writePinnedCards } from "../features/board/layout/pinnedCards";
import {
  assignToGroup,
  readBoardGroups,
  writeBoardGroups,
  type BoardGroup,
} from "../features/board/layout/boardGroups";
import { NEW_GROUP } from "../features/board/components/BoardGrid";

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
/**
 * How long a removed card can be brought back, in milliseconds.
 *
 * The window exists because dismissal is sticky by design — the board never re-adds a card the
 * hire said no to, and there is no undo behind it. So the undo has to happen *before* the write:
 * the card leaves the screen at once and the server hears about it only when the window closes.
 */
const UNDO_WINDOW_MS = 7000;

/**
 * Which cards the board is showing.
 *
 * Not a search and not a sort — the board is small enough that the only cut worth making is *who
 * put this here*, which is the one thing a card's content never says on its own. `mine` is the
 * hire's own notes, links and checklists; `buddy` is everything read for them.
 */
type BoardFilter = "all" | "buddy" | "mine";

const FILTER_OPTIONS: FilterSelectOption<BoardFilter>[] = [
  { value: "all", label: "All cards" },
  { value: "buddy", label: "From your buddy" },
  { value: "mine", label: "Yours" },
];

export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const toast = useToast();
  const [isArranging, setIsArranging] = useState(false);
  const [filter, setFilter] = useState<BoardFilter>("all");

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

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinsReadFor, setPinsReadFor] = useState<string | null>(null);

  if (boardId !== pinsReadFor) {
    setPinsReadFor(boardId);
    setPinnedIds(readPinnedCards(boardId));
  }

  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [groupsReadFor, setGroupsReadFor] = useState<string | null>(null);

  if (boardId !== groupsReadFor) {
    setGroupsReadFor(boardId);
    setGroups(readBoardGroups(boardId));
  }

  function saveGroups(next: BoardGroup[]) {
    setGroups(next);
    writeBoardGroups(boardId, next);
  }

  /**
   * Puts a card in an area, or takes it out of one.
   *
   * The picker's "New area…" is handled here rather than in the grid: creating the area and
   * putting the first card in it are one action, so a card is never dropped into a box that does
   * not exist yet, and an area never exists with nothing in it.
   */
  function handleAssignGroup(cardId: string, groupId: string | null) {
    if (groupId === NEW_GROUP) {
      const created: BoardGroup = {
        id: `group-${Date.now()}`,
        name: `Area ${groups.length + 1}`,
        cardIds: [],
        collapsed: false,
      };
      saveGroups(assignToGroup([...groups, created], cardId, created.id));

      return;
    }

    saveGroups(assignToGroup(groups, cardId, groupId));
  }

  function handleRenameGroup(groupId: string, name: string) {
    saveGroups(groups.map((group) => (group.id === groupId ? { ...group, name } : group)));
  }

  /** Takes the area away and leaves its cards exactly where they are on the board. */
  function handleDissolveGroup(groupId: string) {
    saveGroups(groups.filter((group) => group.id !== groupId));
  }

  function handleToggleGroup(groupId: string) {
    saveGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group,
      ),
    );
  }

  const togglePinned = useCallback(
    (cardId: string) => {
      setPinnedIds((current) => {
        const next = new Set(current);
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        writePinnedCards(boardId, next);
        return next;
      });
    },
    [boardId],
  );

  // Cards on their way out: gone from the board on screen, not yet gone from the server. Held here
  // rather than in `useBoard` because it is a property of this page's undo affordance, not of the
  // board itself — the hook still knows only about writes that actually happened.
  //
  // Plain functions rather than `useCallback`: this project compiles with the React Compiler, which
  // memoizes them itself and rejects hand-written dependency lists it cannot verify.
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const removalTimers = useRef(new Map<string, number>());

  // A page left while a removal is still pending drops the timer with it: the card stays on the
  // board rather than disappearing from under somebody who navigated away mid-undo.
  useEffect(() => {
    const timers = removalTimers.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function keepCard(cardId: string) {
    setPendingRemovals((current) => {
      const next = new Set(current);
      next.delete(cardId);

      return next;
    });
  }

  function handleDismiss(cardId: string) {
    setPendingRemovals((current) => new Set(current).add(cardId));

    const timer = window.setTimeout(() => {
      removalTimers.current.delete(cardId);
      void dismiss(cardId);
      keepCard(cardId);
    }, UNDO_WINDOW_MS);
    removalTimers.current.set(cardId, timer);

    toast.info("Removed from your board", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(timer);
          removalTimers.current.delete(cardId);
          keepCard(cardId);
        },
      },
    });
  }

  // The path is drawn in the header; the grid gets everything else. Its index is kept so a reorder
  // of the visible cards can put it back where it was — the board's order is the hire's, and this
  // is a display decision, not an edit to it.
  const pathIndex =
    board?.cards.findIndex((card) => card.content.kind === "PATH_TO_FIRST_CONTRIBUTION") ?? -1;
  const pathCard = pathIndex === -1 ? null : (board?.cards[pathIndex] ?? null);

  // Pinned first, and the board's own order inside each half — `sort` is stable, so pinning one
  // card lifts that card and disturbs nothing else. A display sort, not a write: what gets sent on
  // a reorder is what is on screen, so pinning and dragging cannot disagree about where a card is.
  const griddedBoard = useMemo(() => {
    if (!board) return board;
    const rest = board.cards
      .filter((c) => c !== pathCard && !pendingRemovals.has(c.id))
      .filter((c) =>
        filter === "all" ? true : filter === "buddy" ? c.owner === "AI" : c.owner === "HIRE",
      );
    const cards = [...rest].sort(
      (a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)),
    );

    return { ...board, cards };
  }, [board, filter, pathCard, pendingRemovals, pinnedIds]);

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Only offered once there is something to cut: a filter over three cards is a
                  control that costs more attention than it saves. */}
              {griddedBoard.cards.length + (filter === "all" ? 0 : 1) > 2 ? (
                <FilterSelect
                  label="Which cards to show"
                  value={filter}
                  options={FILTER_OPTIONS}
                  onChange={setFilter}
                />
              ) : (
                <span />
              )}

              <AddCardForm onAdd={addCard} />
            </div>

            <div className="space-y-4">
              {/* A board with nothing on it is the first thing a new hire sees, and an empty page
                cannot say what the board is *for*. Named after what it will hold rather than after
                its own emptiness — and it points at the two things that fill it, the buddy and the
                row of buttons directly above. */}
              {griddedBoard.cards.length === 0 && (
                <EmptyState
                  icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
                  title="Nothing on your board yet"
                >
                  This is where things stay put between conversations — the task you are on, work
                  worth picking up, what your buddy remembers. It fills itself in as you go, and you
                  can put a note, a link or a checklist of your own here at any time.
                </EmptyState>
              )}

              <BoardGrid
                board={griddedBoard}
                onDismiss={handleDismiss}
                dismissingId={dismissingId}
                onEdit={(cardId, request) => void editCard(cardId, request)}
                onReorder={handleReorder}
                isArranging={isArranging}
                collapsedIds={collapsedIds}
                onToggleCollapsed={toggleCollapsed}
                pinnedIds={pinnedIds}
                onTogglePinned={togglePinned}
                groups={groups}
                onAssignGroup={handleAssignGroup}
                onRenameGroup={handleRenameGroup}
                onToggleGroup={handleToggleGroup}
                onDissolveGroup={handleDissolveGroup}
              />
            </div>
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
