import { MainContent } from "../components/layout/MainContent";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, LayoutDashboard, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { Spinner } from "../components/ui/Spinner";
import { useBoard } from "../features/board/hooks/useBoard";
import { useBoardPlanning } from "../features/board/hooks/useBoardPlanning";
import { useBoardPath } from "../features/board/hooks/useBoardPath";
import { useStageBands } from "../features/board/hooks/useStageBands";
import { useBoardPiles } from "../features/board/hooks/useBoardPiles";
import { useBoardSections } from "../features/board/hooks/useBoardSections";
import { useBoardAreas } from "../features/board/hooks/useBoardAreas";
import { useCardPreferences } from "../features/board/hooks/useCardPreferences";
import { usePanelSwitches } from "../features/board/hooks/usePanelSwitches";
import { useCardRemovals } from "../features/board/hooks/useCardRemovals";
import { useBoardStructure } from "../features/board/hooks/useBoardStructure";
import { BoardPathContext } from "../features/board/hooks/boardPath";
import { AddCardForm } from "../features/board/components/AddCardForm";
import type { AuthoredCardKind } from "../features/board/types";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathWindow } from "../features/board/components/BoardPathWindow";
import { BoardSectionTabs } from "../features/board/components/BoardSectionNav";
import { NewAreaForm } from "../features/board/components/NewAreaForm";
import { BoardViewStatus } from "../features/board/components/BoardViewStatus";
import { BoardToolRail } from "../features/board/components/BoardToolRail";
import { BoardPhaseCheck } from "../features/board/components/BoardPhaseCheck";
import { BoardPhaseRecap } from "../features/board/components/BoardPhaseRecap";
import { BoardLocalOnlyNotice } from "../features/board/components/BoardLocalOnlyNotice";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useToast } from "../context/useToast";
import { useFocusMode } from "../context/useFocusMode";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { BoardFilter } from "../features/board/layout/boardFilters";
import { subscribeToBoardStorageReplaced } from "../features/board/layout/boardStorage";
import { describeCuts, selectShownCards } from "../features/board/layout/boardCuts";
import { useBoardStructureSync } from "../features/board/sync/useBoardStructureSync";
import { useMarkableBoard } from "../features/board/marks/useCardMarks";

/**
 * The board: the hire's persistent working surface.
 *
 * The buddy conversation opens fresh every visit — the previous window is folded into the mentor's
 * memory and never replayed — so anything durable it showed you was gone by the next visit. This is
 * where those things live instead. Chat is the conversation; this is the whiteboard beside it.
 *
 * Per project, because what belongs on it is: the open work, the current task, what the buddy
 * remembers. The project switcher is the same one the rest of the app uses, so the choice is
 * remembered across pages rather than being a setting of this one.
 *
 * **Not the onboarding.** That is the path on the Onboarding page, which a PM's blueprint
 * prescribes and the buddy tutors along. The board does not carry a second plan: two plans that
 * drift apart are worse than one.
 *
 * The shell is the app's page shell — banner header over `app-page-frame`, `PageHeader` for the
 * title block, shared primitives for the actions and for every empty, loading and error state — so
 * the board sits at the same gutter and reads with the same weight as Starter Work beside it.
 *
 * **The board is a process, not a pile.** Three things carry that, and none of them changes the
 * board's own order:
 *
 * - a *stage* per card — now or behind you, read off the onboarding path (`pathStages.ts`) — so the
 *   board can say what is due rather than only what exists;
 * - a *predecessor* per card, so "read the runbook before you deploy" is a fact the board holds
 *   instead of one the hire has to remember;
 * - *sections* down the side, so a board of forty cards is read one part at a time.
 *
 * The reason for all three is the same. A board that shows everything at once is fine at eight
 * cards and unusable at forty. See `layout/boardStructure.ts` for the model.
 */

/**
 * The hire's board: their own cards and the buddy's, arranged in areas and stages and synced with
 * the server. The onboarding path itself lives on the Onboarding page; the board only shows the
 * current step of it, as a live `PATH_STEP` card. That card is `AI`-owned, so it counts as `buddy`.
 *
 * The filter rail cuts by *who put a card here*, the one thing a card's content never says on its
 * own (see `layout/boardFilters.ts`). Two sources, and they partition the board:
 *
 * - `buddy` — placed for the hire in conversation, contents read live.
 * - `mine` — everything they wrote themselves: their own notes, links and lists.
 *
 * Where a card sits in the process is a separate question, and the stages, the focus view and the
 * section tabs answer that one.
 *
 * Bound to `/board`, open to every permission group, not wrapped in `ManagerAreaGuard`.
 */
export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const toast = useToast();
  const { isFocused, setFocused } = useFocusMode();

  /**
   * Focus mode is this page's posture, not the app's, so it is given up on the way out — a hire who
   * clicks through to their buddy must not find the app's own navigation missing there.
   */
  useEffect(() => () => setFocused(false), [setFocused]);

  /** Escape is how every mode that took the furniture away gives it back, so it is how this does. */
  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, setFocused]);

  const [filter, setFilter] = useState<BoardFilter>("all");
  const [sectionId, setSectionId] = useState<string | null>(null);

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
    restorePrevious,
    restoringIds,
    savingIds,
    undoNotices,
    reorder,
    writeError,
  } = useBoard(selectedProjectId);

  /**
   * Whether to put a spinner where the board is.
   *
   * Only while there is no board *for this project* to show. A re-read of a board already on
   * screen keeps it there: swapping it for a spinner unmounts every card, and the hire comes back
   * to the top of a board they were working somewhere in the middle of. That is the difference
   * between "loading" and "reloading", and only the first one is worth hiding the page for.
   *
   * Compared against the selected project rather than against `board !== null`, so switching
   * projects still hides the old one — showing another project's cards under this project's name,
   * even for a moment, is worse than showing nothing.
   */
  const showLoading = loading && board?.projectId !== selectedProjectId;

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

  // Keeps this hire's arrangement on the server rather than only in this browser, and brings it
  // down on the first load of a visit. See `sync/useBoardStructureSync.ts`.
  const localOnly = useBoardStructureSync(boardId, selectedProjectId);

  const { isArranging, planChanges, startArranging, finishArranging, cancelArranging } =
    useBoardPlanning({ board, boardId, projectId: selectedProjectId, reorder });

  /**
   * Bumped whenever the stored arrangement is replaced under this page — by the sync above pulling
   * it down, or by a surface outside the board writing into it.
   *
   * Part of the key every local read below is guarded by, so one counter refreshes all of them.
   * Local storage is not reactive and these are read once into state; without this, an arrangement
   * that arrived from the server sat on disk until the next navigation.
   */
  const [storageRevision, setStorageRevision] = useState(0);

  useEffect(
    () => subscribeToBoardStorageReplaced(() => setStorageRevision((current) => current + 1)),
    [],
  );

  /** What the reads below compare against: this board, at this revision of what is stored for it. */
  const storedFor = `${boardId}:${storageRevision}`;

  const { collapsedIds, toggleCollapsed, pinnedIds, togglePinned, cardSizes, resizeCard } =
    useCardPreferences(boardId, storedFor);
  const {
    isPathShown,
    showPathWindow,
    removePathWindow,
    isTaskPoolShown,
    showTaskPool,
    removeTaskPool,
  } = usePanelSwitches(boardId, storedFor);

  const {
    groups,
    saveGroups,
    namingArea,
    setNamingArea,
    handleNewArea,
    handleDissolveGroup,
    handleAssignGroup,
    handleRenameGroup,
    handleRecolourGroup,
    handleToggleGroup,
  } = useBoardAreas({ boardId, storedFor, sectionId, setSectionId });

  const { pendingRemovals, handleDismiss } = useCardRemovals({
    board,
    boardId,
    projectId: selectedProjectId,
    dismiss,
    removeTaskPool,
  });

  /**
   * Every card the board is holding, whatever the current view.
   *
   * The process layer and the section counts are both computed from this rather than from what is
   * on screen. A rail that said "3 of 4 done" because the fourth card happened to be filtered out
   * would be worse than no rail at all — the counts are about the board, and the view is about the
   * hire's attention.
   */
  // Whether the backend put a pool card on this board at all. The rail switch only exists for a
  // board that has one: a switch that toggles nothing visible reads as broken.
  const hasTaskPool = board?.cards.some((card) => card.content.kind === "TASK_POOL") ?? false;

  const allCards = useMemo(
    () =>
      board?.cards.filter(
        (card) =>
          !pendingRemovals.has(card.id) && (isTaskPoolShown || card.content.kind !== "TASK_POOL"),
      ) ?? [],
    [board, pendingRemovals, isTaskPoolShown],
  );

  const {
    path,
    pathSettled,
    phases,
    stageOf,
    boardPath,
    cardOrigins,
    pathPlace,
    pathPlaceTitle,
    clearPathPlace,
  } = useBoardPath(selectedProjectId, storageRevision);

  const { states, stackOnto } = useBoardStructure(boardId, allCards, stageOf);

  // Lends these cards to the app shell, so the selection toolbar mounted above the router can offer
  // the marker pen on text that turns out to be on one of them. Taken back when this page leaves.
  useMarkableBoard({
    cards: allCards,
    onEditCard: (cardId, request) => void editCard(cardId, request),
  });

  const {
    sections,
    markSections,
    hasSectionTabs,
    tabSections,
    shownSectionId,
    sectionValue,
    sectionIndex,
    swipeRef,
    cardMarks,
  } = useBoardSections({ allCards, groups, states, pinnedIds, sectionId, setSectionId });

  const { stacks, visibleStackIds, toggleVisibleStack, handleStackOnto, openAllPiles } =
    useBoardPiles({
      allCards,
      groups,
      saveGroups,
      states,
      pinnedIds,
      isArranging,
      shownSectionId,
      cardMarks,
      stackOnto,
    });

  const { openStages, toggleStage, openAllStages } = useStageBands({
    board,
    boardId,
    allCards,
    states,
    pathSettled,
  });

  /** Planning opens every band: a dependency you cannot see is one you cannot set. */
  function beginPlanning() {
    openAllStages();
    startArranging();
  }

  /** The kind of card being written, or null when nothing is being added. */
  const [addingKind, setAddingKind] = useState<AuthoredCardKind | null>(null);

  /**
   * Undoes every cut at once: the step it was opened for, the filter, the section and the focus
   * view.
   *
   * One function because the line that offers it counts *all* the cards the board is holding back,
   * and an offer that cleared some of them would be a button that does not do what the sentence
   * above it says.
   */
  function showEverything() {
    openAllStages();
    setSectionId(null);
    setFilter("all");
    openAllPiles();
    if (pathPlace) clearPathPlace();
  }

  const cutBy = useMemo(
    () => ({
      allCards,
      stacks,
      visibleStackIds,
      pathPlace,
      phases,
      cardOrigins,
      filter,
      groups,
      shownSectionId,
      states,
      pinnedIds,
      cardMarks,
    }),
    [
      allCards,
      stacks,
      visibleStackIds,
      pathPlace,
      phases,
      cardOrigins,
      filter,
      groups,
      shownSectionId,
      states,
      pinnedIds,
      cardMarks,
    ],
  );
  const shownCards = useMemo(() => selectShownCards(cutBy), [cutBy]);

  const griddedBoard = board ? { ...board, cards: shownCards } : null;
  const hiddenCount = allCards.length - shownCards.length;

  const activeCuts = useMemo(
    () => describeCuts(cutBy, { pathPlaceTitle, shownSectionId, sections }),
    [cutBy, pathPlaceTitle, shownSectionId, sections],
  );

  const handleReorder = (cardIds: string[]) => void reorder(cardIds);

  /**
   * The gutters the page draws in.
   *
   * Outside focus mode it is the page gutter, widened on the right from `lg` up to clear the tool
   * rail parked there (`app-page-frame--rail`): the gutter is fluid now, and at 1024px it is only
   * 2rem. Focus mode trades the page gutter for a margin wide enough to keep the tool rail off the
   * cards and no wider — the whole reason somebody expands the board is that the gutters were space
   * they were not using, and giving them back at the same width would be the button doing nothing.
   */
  // The rail's own groups lay themselves out by a prop, not by CSS, so the rail has to know
  // which way it is standing: up the margin from `lg`, across the page below it.
  const isRailVertical = useMediaQuery("(min-width: 1024px)");

  const frameClass = isFocused
    ? "px-4 sm:px-6 lg:pr-20 lg:pl-6"
    : "app-page-frame app-page-frame--rail";

  return (
    // The path, for the notes that link into it with `[[…]]` — see `hooks/boardPath.ts`.
    <BoardPathContext.Provider value={boardPath}>
      <div className="min-h-screen">
        {/* Gone in focus mode, with everything on it either in the tool rail already or one Escape
          away. */}
        {!isFocused && (
          <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
            <div className={`${frameClass} py-6`}>
              <PageHeader
                icon={LayoutDashboard}
                title="Board"
                subtitle={
                  isArranging
                    ? "Put cards into piles and areas, and move them where they belong."
                    : "Where your work stays put between conversations."
                }
                actions={
                  isArranging ? (
                    <>
                      <span className="text-sm text-app-text-muted" role="status">
                        {planChanges === 0
                          ? "No changes yet"
                          : `${planChanges} ${planChanges === 1 ? "change" : "changes"}`}
                      </span>
                      <Button variant="secondary" onClick={cancelArranging}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={finishArranging}
                        icon={<Check className="h-4 w-4" aria-hidden="true" />}
                      >
                        Done
                      </Button>
                    </>
                  ) : (
                    <>
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
            </div>
          </header>
        )}

        <MainContent ref={swipeRef} className={`${frameClass} relative space-y-5 py-6 lg:py-8`}>
          {/* The page keeps a margin either side from `lg` up (at least 5rem on the right here, see
            `frameClass`), and on this page it is dead space: the board is a column of cards and
            the margin is where a hand rests. So the offers live there — always in reach, never in
            the way, and out of the row above the board where they were competing with the
            controls that decide what is *shown*.
            Absolute rather than a column of its own, so nothing about the board's own width or its
            two-column packing changes. Below `lg` there is no margin to sit in, and it lies across
            the page above the cards instead.

            It stays up while the board is being arranged, which it did not use to: arranging is now
            one of the switches on it, and a switch that takes its own rail off the screen leaves
            nothing to switch back with — in focus mode, where the header's "Done" is gone too,
            nothing at all. */}
          {selectedProjectId && (
            <BoardToolRail
              isFocused={isFocused}
              onToggle={() => setFocused(!isFocused)}
              hasBoard={!!board}
              isArranging={isArranging}
              planChanges={planChanges}
              namingArea={namingArea}
              onTogglePlanning={() => (isArranging ? finishArranging() : beginPlanning())}
              onCancelPlanning={cancelArranging}
              onNameArea={() => setNamingArea(true)}
              isPathShown={isPathShown}
              onShowPath={showPathWindow}
              hasTaskPool={hasTaskPool}
              isTaskPoolShown={isTaskPoolShown}
              onShowTaskPool={showTaskPool}
              offerFilters={allCards.length > 2}
              filter={filter}
              onFilter={setFilter}
              markSections={markSections}
              shownSectionId={shownSectionId}
              onSelectSection={setSectionId}
              vertical={isRailVertical}
              addingKind={addingKind}
              onPickKind={setAddingKind}
            />
          )}

          {!selectedProjectId && !projectsLoading ? (
            <EmptyState
              icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
              title="No project yet"
            >
              You&apos;re not on a project yet, so there&apos;s nothing to put on a board. Whoever
              set up your account can add you to one.
            </EmptyState>
          ) : showLoading ? (
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
            <div className="min-w-0 space-y-5">
              {/* One row: which part of the board on the left, what to do with it on the right. The
                filter used to sit on a line of its own under the tabs, which read as a second
                navigation for the same board — they are two halves of "what am I looking at", and
                they belong side by side. `items-start` so the tab bar's own status line hangs
                under the tabs rather than dragging the controls down with it. */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                {hasSectionTabs ? (
                  <div className="min-w-0 flex-1">
                    <BoardSectionTabs
                      sections={tabSections}
                      selectedId={shownSectionId}
                      // A colour is not one of the tabs, but it is still what is being shown, so
                      // its line of counts is handed over rather than the bar falling back to
                      // "Everything" and reporting a number that belongs to a different view.
                      selected={sections.find((section) => section.id === shownSectionId)}
                      onSelect={setSectionId}
                    />
                  </div>
                ) : (
                  <span />
                )}
              </div>

              {/* Over the board rather than in the rail: the rail is page margin, which is room for a
                few glyphs and not for a form. */}
              {addingKind && (
                <AddCardForm
                  kind={addingKind}
                  onAdd={addCard}
                  onClose={() => setAddingKind(null)}
                />
              )}

              {namingArea && (
                <NewAreaForm onCreate={handleNewArea} onClose={() => setNamingArea(false)} />
              )}

              <div className="min-w-0 space-y-4">
                {/* Under the section tabs, and outside the panel that slides between them: these are
                    about the work rather than about one section of the board — where the hire is in
                    their path and what is next, the phase just finished, and the check closing the
                    one they are in. Kept together, so "continue" and "the check" read as one place. */}
                {/* The phase check rides inside the path card, so "show where you are" on the rail
                    shows and hides both. */}
                {isPathShown && (
                  <BoardPathWindow path={path} onRemove={removePathWindow}>
                    <BoardPhaseCheck
                      path={path}
                      phases={phases}
                      cards={allCards}
                      origins={cardOrigins}
                      marks={cardMarks}
                      embedded
                    />
                  </BoardPathWindow>
                )}

                <BoardPhaseRecap boardId={boardId} path={path} />

                {/* Only the cards travel. The controls above are the same controls whatever section
                  is open, and sliding them out and back would be the page redrawing its own
                  furniture every time somebody moved one tab across. */}
                <SlidingTabPanel
                  activeKey={sectionValue}
                  index={sectionIndex}
                  className="space-y-4"
                >
                  {/* A board with nothing on it is the first thing a new hire sees, and an empty page
                cannot say what the board is *for*. Named after what it will hold rather than after
                its own emptiness — and it says where the onboarding is, because it is not here. */}
                  {allCards.length === 0 && (
                    <EmptyState
                      icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
                      title="Nothing on your board yet"
                    >
                      This is where things stay put between conversations — the task you are on,
                      work worth picking up, what your buddy remembers. Add a note, a link or a list
                      of your own at any time. Your onboarding itself is on the{" "}
                      <Link
                        to="/onboarding"
                        className="font-medium text-app-brand-text underline underline-offset-2"
                      >
                        Onboarding page
                      </Link>
                      .
                    </EmptyState>
                  )}

                  {/* The section is empty rather than the board: different states, and only one of them
                  is fixed by generating anything. */}
                  {allCards.length > 0 && shownCards.length === 0 && (
                    <EmptyState size="sm">
                      Nothing here right now.{" "}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={showEverything}
                          className="font-medium text-app-brand-text hover:underline"
                        >
                          Show all {allCards.length} cards
                        </button>
                      )}
                    </EmptyState>
                  )}

                  <BoardViewStatus
                    shown={shownCards.length}
                    total={allCards.length}
                    cuts={activeCuts}
                    onShowEverything={showEverything}
                  />

                  {/* Under the line about what is shown, because it is the same kind of fact about
                    the board rather than about the work: that one says how much of it you are
                    looking at, this one says where the arrangement is being kept. */}
                  <BoardLocalOnlyNotice localOnly={localOnly} />

                  <BoardGrid
                    board={griddedBoard}
                    onDismiss={handleDismiss}
                    dismissingId={dismissingId}
                    onEdit={(cardId, request) => void editCard(cardId, request)}
                    onRestorePrevious={(cardId, replacedAt) =>
                      void restorePrevious(cardId, replacedAt)
                    }
                    restoringIds={restoringIds}
                    savingIds={savingIds}
                    undoNotices={undoNotices}
                    // A checklist broken out of a task is a *new* card, which only a re-read can
                    // show. Without this the write lands and the board keeps drawing what it read
                    // before the press.
                    onCardAdded={refresh}
                    onReorder={handleReorder}
                    boardOrder={allCards.map((card) => card.id)}
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
                    onRecolourGroup={handleRecolourGroup}
                    states={states}
                    onStackOnto={handleStackOnto}
                    stacks={stacks}
                    expandedStackIds={visibleStackIds}
                    onToggleStack={toggleVisibleStack}
                    openStages={openStages}
                    onToggleStage={toggleStage}
                    cardSizes={cardSizes}
                    cardOrigins={cardOrigins}
                    onResizeCard={resizeCard}
                  />
                </SlidingTabPanel>
              </div>
            </div>
          ) : null}
        </MainContent>
      </div>
    </BoardPathContext.Provider>
  );
}
