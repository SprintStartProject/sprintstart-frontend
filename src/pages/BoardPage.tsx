import { useEffect } from "react";
import { MainContent } from "../components/layout/MainContent";
import { useFocusMode } from "../context/useFocusMode";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { BoardHeader } from "../features/board/components/BoardHeader";
import { BoardSurface, type BoardModel } from "../features/board/components/BoardSurface";
import { BoardToolRail } from "../features/board/components/BoardToolRail";
import { toolRailProps } from "../features/board/components/boardRailProps";
import { BoardPathContext } from "../features/board/hooks/boardPath";
import { useBoardLook } from "../features/board/hooks/useBoardLook";
import { useBoardMemory } from "../features/board/hooks/useBoardMemory";
import { useBoardProcess } from "../features/board/hooks/useBoardProcess";
import { useBoardStore } from "../features/board/hooks/useBoardStore";
import { useProjectContext } from "../features/projects/useProjectContext";

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
  const { isFocused, setFocused } = useFocusMode();

  /**
   * Focus mode is this page's posture, not the app's, so it is given up on the way out -- a hire who
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

  const store = useBoardStore(selectedProjectId);
  const memory = useBoardMemory(store);
  const process = useBoardProcess(store, memory);
  const look = useBoardLook(store, memory, process);
  const model: BoardModel = { store, memory, process, look };
  const swipeRef = useSwipeableTabs<string, HTMLElement>(look.swipe);

  // The rail's own groups lay themselves out by a prop, not by CSS, so the rail has to know which
  // way it is standing: up the margin from `lg`, across the page below it.
  const isRailVertical = useMediaQuery("(min-width: 1024px)");

  /**
   * The gutters the page draws in.
   *
   * Outside focus mode it is the page gutter, widened on the right from `lg` up to clear the tool
   * rail parked there (`app-page-frame--rail`): the gutter is fluid now, and at 1024px it is only
   * 2rem. Focus mode trades the page gutter for a margin wide enough to keep the tool rail off the
   * cards and no wider -- the whole reason somebody expands the board is that the gutters were space
   * they were not using, and giving them back at the same width would be the button doing nothing.
   */
  const frameClass = isFocused
    ? "px-4 sm:px-6 lg:pr-20 lg:pl-6"
    : "app-page-frame app-page-frame--rail";

  return (
    // The path, for the notes that link into it with `[[…]]` -- see `hooks/boardPath.ts`.
    <BoardPathContext.Provider value={process.boardPath}>
      <div className="min-h-screen">
        {!isFocused && (
          <BoardHeader
            frameClass={frameClass}
            isArranging={memory.isArranging}
            planChanges={memory.planChanges}
            onCancelPlanning={memory.cancelArranging}
            onFinishPlanning={memory.finishArranging}
            onRefresh={store.refresh}
            canRefresh={!!selectedProjectId}
            loading={store.loading}
          />
        )}

        <MainContent ref={swipeRef} className={`${frameClass} relative space-y-5 py-6 lg:py-8`}>
          {selectedProjectId && (
            <BoardToolRail {...toolRailProps(model, { isFocused, setFocused }, isRailVertical)} />
          )}
          <BoardSurface model={model} projectsLoading={projectsLoading} />
        </MainContent>
      </div>
    </BoardPathContext.Provider>
  );
}
