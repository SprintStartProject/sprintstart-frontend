import { Link } from "react-router-dom";
import { AlertCircle, LayoutDashboard } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SlidingTabPanel } from "../../../components/ui/SlidingTabPanel";
import { Spinner } from "../../../components/ui/Spinner";
import type { Board } from "../types";
import type { BoardLook } from "../hooks/useBoardLook";
import type { BoardMemory } from "../hooks/useBoardMemory";
import type { BoardProcess } from "../hooks/useBoardProcess";
import type { BoardStore } from "../hooks/useBoardStore";
import { AddCardForm } from "./AddCardForm";
import { BoardGrid } from "./BoardGrid";
import { BoardLocalOnlyNotice } from "./BoardLocalOnlyNotice";
import { BoardPathWindow } from "./BoardPathWindow";
import { BoardPhaseCheck } from "./BoardPhaseCheck";
import { BoardPhaseRecap } from "./BoardPhaseRecap";
import { BoardSectionTabs } from "./BoardSectionNav";
import { BoardViewStatus } from "./BoardViewStatus";
import { NewAreaForm } from "./NewAreaForm";

/** Everything the board page knows, in the four layers it is built in. */
export type BoardModel = {
  store: BoardStore;
  memory: BoardMemory;
  process: BoardProcess;
  look: BoardLook;
};

/** The model, and the board as it is on screen after every cut. */
type WithBoard = { model: BoardModel; board: Board };

function NoProject() {
  return (
    <EmptyState
      icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
      title="No project yet"
    >
      You&apos;re not on a project yet, so there&apos;s nothing to put on a board. Whoever set up
      your account can add you to one.
    </EmptyState>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-2">
        <p>Your board couldn&apos;t be loaded.</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * One row: which part of the board on the left, what to do with it on the right. The two are halves
 * of "what am I looking at", and they belong side by side. `items-start` so the tab bar's own status
 * line hangs under the tabs rather than dragging the controls down with it.
 */
function SectionRow({ memory, look }: Pick<BoardModel, "memory" | "look">) {
  const { sections, tabSections, shownSectionId } = look;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      {look.hasSectionTabs ? (
        <div className="min-w-0 flex-1">
          <BoardSectionTabs
            sections={tabSections}
            selectedId={shownSectionId}
            // A colour is not one of the tabs, but it is still what is being shown, so its line of
            // counts is handed over rather than the bar falling back to "Everything" and reporting
            // a number that belongs to a different view.
            selected={sections.find((section) => section.id === shownSectionId)}
            onSelect={memory.setSectionId}
          />
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}

/**
 * Over the board rather than in the rail: the rail is page margin, which is room for a few glyphs
 * and not for a form.
 */
function Forms({ store, memory }: Pick<BoardModel, "store" | "memory">) {
  return (
    <>
      {memory.addingKind && (
        <AddCardForm
          kind={memory.addingKind}
          onAdd={store.addCard}
          onClose={() => memory.setAddingKind(null)}
        />
      )}
      {memory.namingArea && (
        <NewAreaForm onCreate={memory.handleNewArea} onClose={() => memory.setNamingArea(false)} />
      )}
    </>
  );
}

/**
 * About the work rather than about one section of the board -- where the hire is in their path and
 * what is next, the phase just finished, and the check closing the one they are in. Kept together,
 * so "continue" and "the check" read as one place. The phase check rides inside the path card, so
 * "show where you are" on the rail shows and hides both.
 */
function PathStrip({ store, memory, process, look }: BoardModel) {
  return (
    <>
      {memory.isPathShown && (
        <BoardPathWindow path={process.path} onRemove={memory.removePathWindow}>
          <BoardPhaseCheck
            path={process.path}
            phases={process.phases}
            cards={memory.allCards}
            origins={process.cardOrigins}
            marks={look.cardMarks}
            embedded
          />
        </BoardPathWindow>
      )}
      <BoardPhaseRecap boardId={store.boardId} path={process.path} />
    </>
  );
}

/**
 * A board with nothing on it is the first thing a new hire sees, and an empty page cannot say what
 * the board is *for*. Named after what it will hold rather than after its own emptiness -- and it
 * says where the onboarding is, because it is not here.
 */
function NothingYet() {
  return (
    <EmptyState
      icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
      title="Nothing on your board yet"
    >
      This is where things stay put between conversations — the task you are on, work worth picking
      up, what your buddy remembers. Add a note, a link or a list of your own at any time. Your
      onboarding itself is on the{" "}
      <Link
        to="/onboarding"
        className="font-medium text-app-brand-text underline underline-offset-2"
      >
        Onboarding page
      </Link>
      .
    </EmptyState>
  );
}

/** The section is empty rather than the board: different states, and only one of them is fixed by generating anything. */
function NothingHere({ model }: { model: BoardModel }) {
  const { memory, look } = model;
  return (
    <EmptyState size="sm">
      Nothing here right now.{" "}
      {look.hiddenCount > 0 && (
        <button
          type="button"
          onClick={look.showEverything}
          className="font-medium text-app-brand-text hover:underline"
        >
          Show all {memory.allCards.length} cards
        </button>
      )}
    </EmptyState>
  );
}

/** The grid, with everything the board remembers about how its cards are laid out. */
function Grid({ model, board }: WithBoard) {
  const { store, memory, process, look } = model;
  return (
    <BoardGrid
      board={board}
      onDismiss={memory.handleDismiss}
      dismissingId={store.dismissingId}
      onEdit={(cardId, request) => void store.editCard(cardId, request)}
      onRestorePrevious={(cardId, replacedAt) => void store.restorePrevious(cardId, replacedAt)}
      restoringIds={store.restoringIds}
      savingIds={store.savingIds}
      undoNotices={store.undoNotices}
      // A checklist broken out of a task is a *new* card, which only a re-read can show. Without
      // this the write lands and the board keeps drawing what it read before the press.
      onCardAdded={store.refresh}
      onReorder={look.handleReorder}
      boardOrder={memory.allCards.map((card) => card.id)}
      isArranging={memory.isArranging}
      collapsedIds={memory.collapsedIds}
      onToggleCollapsed={memory.toggleCollapsed}
      pinnedIds={memory.pinnedIds}
      onTogglePinned={memory.togglePinned}
      groups={memory.groups}
      onAssignGroup={memory.handleAssignGroup}
      onRenameGroup={memory.handleRenameGroup}
      onToggleGroup={memory.handleToggleGroup}
      onDissolveGroup={memory.handleDissolveGroup}
      onRecolourGroup={memory.handleRecolourGroup}
      states={process.states}
      onStackOnto={look.handleStackOnto}
      stacks={look.stacks}
      expandedStackIds={look.visibleStackIds}
      onToggleStack={look.toggleVisibleStack}
      openStages={process.openStages}
      onToggleStage={process.toggleStage}
      cardSizes={memory.cardSizes}
      cardOrigins={process.cardOrigins}
      onResizeCard={memory.resizeCard}
    />
  );
}

/**
 * Only the cards travel. The controls above are the same controls whatever section is open, and
 * sliding them out and back would be the page redrawing its own furniture every time somebody moved
 * one tab across.
 */
function Cards({ model, board }: WithBoard) {
  const { memory, look, store } = model;
  const total = memory.allCards.length;
  return (
    <SlidingTabPanel activeKey={look.sectionValue} index={look.sectionIndex} className="space-y-4">
      {total === 0 && <NothingYet />}
      {total > 0 && look.shownCards.length === 0 && <NothingHere model={model} />}
      <BoardViewStatus
        shown={look.shownCards.length}
        total={total}
        cuts={look.activeCuts}
        onShowEverything={look.showEverything}
      />
      {/* Under the line about what is shown, because it is the same kind of fact about the board
          rather than about the work: that one says how much of it you are looking at, this one says
          where the arrangement is being kept. */}
      <BoardLocalOnlyNotice localOnly={store.localOnly} />
      <Grid model={model} board={board} />
    </SlidingTabPanel>
  );
}

/** The board itself: the section row, the forms, the path strip and the cards. */
function BoardView({ model, board }: WithBoard) {
  return (
    <div className="min-w-0 space-y-5">
      <SectionRow memory={model.memory} look={model.look} />
      <Forms store={model.store} memory={model.memory} />
      <div className="min-w-0 space-y-4">
        <PathStrip {...model} />
        <Cards model={model} board={board} />
      </div>
    </div>
  );
}

/**
 * Whatever the page is showing in its main column: that there is no project, that the board is on
 * its way, that it could not be loaded, or the board.
 */
export function BoardSurface({
  model,
  projectsLoading,
}: {
  model: BoardModel;
  projectsLoading: boolean;
}) {
  const { store, look } = model;
  if (!store.projectId && !projectsLoading) return <NoProject />;
  if (store.showLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" label="Loading your board" />
      </div>
    );
  }
  if (store.error) return <LoadError onRetry={store.refresh} />;
  const board = look.griddedBoard;
  return board ? <BoardView model={model} board={board} /> : null;
}
