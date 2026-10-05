import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  FolderPlus,
  LayoutDashboard,
  LayoutList,
  ListTree,
  Maximize2,
  Milestone,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { Spinner } from "../components/ui/Spinner";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { useBoard } from "../features/board/hooks/useBoard";
import { useBoardStructure } from "../features/board/hooks/useBoardStructure";
import { useOnboardingPath } from "../features/board/hooks/useOnboardingPath";
import { BoardPathContext } from "../features/board/hooks/boardPath";
import { isCardAt, pathPhases, pathStages } from "../features/board/layout/pathStages";
import { AddCardForm, AddCardTriggers } from "../features/board/components/AddCardForm";
import type { AuthoredCardKind } from "../features/board/types";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathWindow } from "../features/board/components/BoardPathWindow";
import { BoardSectionTabs } from "../features/board/components/BoardSectionNav";
import { BoardFilterTriggers } from "../features/board/components/BoardFilterTriggers";
import { NewAreaForm } from "../features/board/components/NewAreaForm";
import { BoardViewStatus } from "../features/board/components/BoardViewStatus";
import { MarkFilterRail } from "../features/board/components/MarkFilterRail";
import { BoardPhaseCheck } from "../features/board/components/BoardPhaseCheck";
import { BoardPhaseRecap } from "../features/board/components/BoardPhaseRecap";
import { BoardLocalOnlyNotice } from "../features/board/components/BoardLocalOnlyNotice";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useToast } from "../context/useToast";
import { useFocusMode } from "../context/useFocusMode";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { readCollapsedCards, writeCollapsedCards } from "../features/board/layout/collapsedCards";
import {
  hasNewlyBehind,
  readBehindSeen,
  writeBehindSeen,
} from "../features/board/layout/behindSeen";
import { readPathWindowShown, writePathWindowShown } from "../features/board/layout/pathWindowFold";
import { readTaskPoolShown, writeTaskPoolShown } from "../features/board/layout/taskPoolShown";
import { readPinnedCards, writePinnedCards } from "../features/board/layout/pinnedCards";
import {
  ALL_SECTIONS,
  cardsInSection,
  sectionTabOrder,
  summariseSections,
} from "../features/board/layout/boardSections";
import {
  BOARD_STAGES,
  currentStage,
  type BoardStage,
} from "../features/board/layout/boardStructure";
import {
  filterLabel,
  matchesFilter,
  type BoardFilter,
} from "../features/board/layout/boardFilters";
import type { AreaAccent } from "../features/board/layout/areaAccents";
import {
  isDefault,
  readCardSizes,
  writeCardSizes,
  type CardSize,
  type CardSizes,
} from "../features/board/layout/cardSizes";
import { readCardOrigins, type CardOrigins } from "../features/board/layout/cardOrigins";
import { subscribeToBoardStorageReplaced } from "../features/board/layout/boardStorage";
import { forgetCard } from "../features/board/layout/forgetCard";
import { useBoardStructureSync } from "../features/board/sync/useBoardStructureSync";
import { useCardMarks, useMarkableBoard } from "../features/board/marks/useCardMarks";
import { buildStacks, collapseStacks } from "../features/board/layout/cardStacks";
import {
  assignToGroup,
  dissolveGroup,
  groupOf,
  newBoardGroup,
  readBoardGroups,
  writeBoardGroups,
  type BoardGroup,
} from "../features/board/layout/boardGroups";

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
 * **Not the onboarding.** That is the path on the Onboarding page, which a PM's blueprint prescribes
 * and the buddy tutors along. The board used to carry a second one -- a rail from joining to a first
 * accepted contribution, and a button that copied the path's steps into checklists -- and two plans
 * that drift apart are worse than one.
 *
 * The shell is the app's page shell — banner header over `app-page-frame`, `PageHeader` for the
 * title block, shared primitives for the actions and for every empty, loading and error state — so
 * the board sits at the same gutter and reads with the same weight as Starter Work beside it.
 *
 * **The board is now a process, not a pile.** Three things carry that, and none of them changes the
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
 * How long a removed card can be brought back, in milliseconds.
 *
 * The window exists because dismissal is sticky by design — the board never re-adds a card the
 * hire said no to, and there is no undo behind it. So the undo has to happen *before* the write:
 * the card leaves the screen at once and the server hears about it only when the window closes.
 */
const UNDO_WINDOW_MS = 7000;

/**
 * The board size at which the stage bands arrive folded.
 *
 * Below it, everything open *is* the right view: a hire with six cards can read all six, and
 * folding four of them under three headings would be ceremony rather than help. Above it the cost
 * flips, and it flips quickly — the complaint the bands answer is not "this is slightly long", it
 * is "forty cards appeared and I do not know where to start".
 */
const FOLD_THRESHOLD = 8;

/**
 * The rule between groups on the tool rail: a short horizontal line while the rail stands up the
 * margin from `lg` up, a short vertical one while it lies across the page above the cards.
 */
const RAIL_SEPARATOR_CLASS = "mx-0.5 h-6 w-px bg-app-border lg:mx-0 lg:my-0.5 lg:h-px lg:w-6";

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

  const [isArranging, setIsArranging] = useState(false);
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

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [readFor, setReadFor] = useState<string | null>(null);

  // Derived during render rather than in an effect, the way `SlidingTabPanel` derives its
  // direction: the fold state has to be right on the render that first shows the board, and
  // reading a key back out of storage is an idempotent read with nothing to synchronise.
  if (storedFor !== readFor) {
    setReadFor(storedFor);
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

  const [isPathShown, setIsPathShown] = useState(true);
  const [pathReadFor, setPathReadFor] = useState<string | null>(null);

  if (storedFor !== pathReadFor) {
    setPathReadFor(storedFor);
    setIsPathShown(readPathWindowShown(boardId));
  }

  const showPathWindow = useCallback(
    (shown: boolean) => {
      setIsPathShown(shown);
      writePathWindowShown(boardId, shown);
    },
    [boardId],
  );

  /**
   * Takes the path strip off the board, with the same undo the board gives a dismissed card.
   *
   * No server call behind it and nothing to wait for, so the undo is the toast alone rather than a
   * held-back write — and the switch in the rail is the way back afterwards, which is why this is
   * allowed to be a one-press removal at all.
   */
  const removePathWindow = useCallback(() => {
    showPathWindow(false);
    toast.info("Taken off your board", {
      description: "You can put it back from the switches on the right.",
      action: { label: "Undo", onClick: () => showPathWindow(true) },
    });
  }, [showPathWindow, toast]);

  // The task pool card, on or off — a switch like the path strip rather than a dismissal. See
  // `layout/taskPoolShown.ts` for why this one card does not get the sticky server-side removal.
  const [isTaskPoolShown, setIsTaskPoolShown] = useState(true);
  const [taskPoolReadFor, setTaskPoolReadFor] = useState<string | null>(null);

  if (storedFor !== taskPoolReadFor) {
    setTaskPoolReadFor(storedFor);
    setIsTaskPoolShown(readTaskPoolShown(boardId));
  }

  const showTaskPool = useCallback(
    (shown: boolean) => {
      setIsTaskPoolShown(shown);
      writeTaskPoolShown(boardId, shown);
    },
    [boardId],
  );

  const removeTaskPool = useCallback(() => {
    showTaskPool(false);
    toast.info("Task pool hidden", {
      description: "You can put it back from the switches on the right.",
      action: { label: "Undo", onClick: () => showTaskPool(true) },
    });
  }, [showTaskPool, toast]);

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinsReadFor, setPinsReadFor] = useState<string | null>(null);

  if (storedFor !== pinsReadFor) {
    setPinsReadFor(storedFor);
    setPinnedIds(readPinnedCards(boardId));
  }

  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [groupsReadFor, setGroupsReadFor] = useState<string | null>(null);

  if (storedFor !== groupsReadFor) {
    setGroupsReadFor(storedFor);
    setGroups(readBoardGroups(boardId));
  }

  /** Whether the "name your area" form is open over the board. */
  const [namingArea, setNamingArea] = useState(false);

  function saveGroups(next: BoardGroup[]) {
    setGroups(next);
    writeBoardGroups(boardId, next);
  }

  /**
   * Puts a card in an area, or takes it out of one.
   *
   * One caller now: letting a card go while arranging. The picker that used to sit in every card's
   * header is gone — an area is made from the tool rail and filled by dropping cards into it, and
   * a select repeating that on forty cards was forty copies of a decision that is better made by
   * putting the card where it goes.
   */
  function handleAssignGroup(cardId: string, groupId: string | null) {
    saveGroups(assignToGroup(groups, cardId, groupId));
  }

  function handleRenameGroup(groupId: string, name: string) {
    saveGroups(groups.map((group) => (group.id === groupId ? { ...group, name } : group)));
  }

  /**
   * Makes an empty area under the name it was given, and opens it.
   *
   * Empty is the point: an area made from the tool rail is a box somebody wants *before* they have
   * decided what goes in it — "Paperwork", "Week two" — and making them find a card to hang it off
   * first is the reason areas were only ever made by accident.
   *
   * Named in the same breath, in a form over the board, the way a note or a link is written. The
   * alternative was making it first and renaming it in place, which needs a name that can be
   * edited where the area is drawn — and an empty area is drawn nowhere except in a tab, which is
   * not a place to type.
   */
  function handleNewArea(name: string) {
    const created = { ...newBoardGroup(groups), name };
    saveGroups([...groups, created]);
    setNamingArea(false);
    setSectionId(created.id);
  }

  /** Takes the area away and leaves its cards exactly where they are on the board. */
  function handleDissolveGroup(groupId: string) {
    saveGroups(dissolveGroup(groups, groupId));
    // A rail pointed at an area that no longer exists would show an empty pane, so the view falls
    // back to the whole board rather than to nothing.
    if (sectionId === groupId) setSectionId(null);
  }

  /** Paints an area. A colour the hire chose, on a group the hire named — see `areaAccents.ts`. */
  function handleRecolourGroup(groupId: string, accent: AreaAccent) {
    saveGroups(groups.map((group) => (group.id === groupId ? { ...group, accent } : group)));
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
    if (board?.cards.find((card) => card.id === cardId)?.content.kind === "TASK_POOL") {
      removeTaskPool();
      return;
    }

    setPendingRemovals((current) => new Set(current).add(cardId));

    const timer = window.setTimeout(() => {
      removalTimers.current.delete(cardId);
      void dismiss(cardId).then(() => forgetCard(boardId, selectedProjectId, cardId));
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

  /**
   * Where each card was found — see `cardOrigins.ts`.
   *
   * Read once when the board arrives and never written here: the origin is recorded by whoever
   * made the card, which is always somewhere else in the app. The board only reads the trail.
   *
   * Keyed by project rather than by board, because the surfaces that write one — the selection
   * toolbar, a chat, the buddy dock — know the project and not the board.
   *
   * Read under `selectedProjectId`, which is the id those surfaces write under, and *not* under the
   * board's own `projectId`. The two are normally the same and the one time they are not — a board
   * fetched for one project while the app has moved to another — reading the board's id would look
   * up trails nobody stored there and show none of them.
   */
  const [cardOrigins, setCardOrigins] = useState<CardOrigins>({});
  const [originsReadFor, setOriginsReadFor] = useState<string | null>(null);

  // Keyed by project *and* revision: the origins follow the hire across a project, and a card
  // saved from the buddy dock while this page is open writes them without leaving it.
  const originsStoredFor = `${selectedProjectId}:${storageRevision}`;

  if (originsStoredFor !== originsReadFor) {
    setOriginsReadFor(originsStoredFor);
    setCardOrigins(readCardOrigins(selectedProjectId));
  }

  /**
   * Now and Behind you, read off the onboarding path — see `pathStages.ts`. Nothing on this page sets a
   * stage any more: the path is the one plan, and the board files its cards against it.
   */
  const { path, settled: pathSettled } = useOnboardingPath();
  const phases = useMemo(() => (path ? pathPhases(path) : null), [path]);
  const stageOf = useMemo(() => pathStages(phases, cardOrigins), [phases, cardOrigins]);
  const boardPath = useMemo(
    () => ({ path, phases, settled: pathSettled }),
    [path, phases, pathSettled],
  );

  /**
   * The phase the board was opened for: `/board?phase=<id>`.
   *
   * What "N cards on your board from this phase" in the path card links to. In the address rather
   * than in router state so it survives a reload and can be opened in a second tab, and so the
   * browser's Back goes from the narrowed board to where it came from.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const pathPlace = searchParams.get("phase");

  /** What the phase is called, for the line saying the board is narrowed to it. */
  const pathPlaceTitle = useMemo(
    () =>
      pathPlace ? (path?.phases.find((phase) => phase.id === pathPlace)?.title ?? null) : null,
    [path, pathPlace],
  );

  const { states, stackOnto } = useBoardStructure(boardId, allCards, stageOf);

  /**
   * The piles on this board, and which of them are spread out.
   *
   * A pile is cards the hire put one under another with the "Pile" control (see `restack`). It is
   * drawn as its top card with the others fanned beneath, and opens on a click. A pile only forms
   * inside one area, so piling a card under one in another area takes it into that area too — see
   * {@link handleStackOnto}.
   *
   * Which piles are open is kept for the visit rather than stored: opening one is looking into it,
   * not rearranging the board.
   */
  const stacks = useMemo(
    () => buildStacks(allCards, states, (cardId) => groupOf(groups, cardId)?.id ?? null),
    [allCards, groups, states],
  );
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(new Set());

  /** Every pile spread out while the board is being arranged, so each card can be moved. */
  const openStackIds = useMemo(
    () => (isArranging ? allRootIds(stacks) : expandedStackIds),
    [expandedStackIds, isArranging, stacks],
  );

  function toggleStack(rootId: string) {
    setExpandedStackIds((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);

      return next;
    });
  }

  /**
   * Piles a card under another one, and into that card's area so the two can lie together.
   *
   * `carry` is a whole closed pile being moved — every card of it goes along, area included.
   */
  function handleStackOnto(cardId: string, targetId: string | null, carry?: readonly string[]) {
    stackOnto(cardId, targetId, carry);
    if (!targetId) return;

    const area = groupOf(groups, targetId)?.id ?? null;
    let next = groups;
    for (const id of carry ?? [cardId]) {
      if ((groupOf(next, id)?.id ?? null) !== area) next = assignToGroup(next, id, area);
    }
    if (next !== groups) saveGroups(next);
  }

  // Lends these cards to the app shell, so the selection toolbar mounted above the router can offer
  // the marker pen on text that turns out to be on one of them. Taken back when this page leaves.
  useMarkableBoard({
    cards: allCards,
    onEditCard: (cardId, request) => void editCard(cardId, request),
  });

  // The highlights, for the section bar's colour cuts. Read from the same provider the cards
  // themselves draw from, so a row's count and the cards behind it cannot disagree.
  const { marks: cardMarks, labels: markLabels } = useCardMarks();

  const sections = useMemo(
    () =>
      summariseSections(allCards, groups, states, {
        // The focus tab is for a board somebody can get lost on. Below the fold threshold every
        // card is already in front of them, and a tab offering a subset of six is a choice made
        // for its own sake.
        focus: allCards.length > FOLD_THRESHOLD,
        pinnedIds,
        marks: cardMarks,
        markLabels,
      }),
    [allCards, groups, pinnedIds, states, cardMarks, markLabels],
  );

  /**
   * The sections, split by what kind of thing they are.
   *
   * A colour is not a part of the board the way an area is — it is something the hire drew on a
   * card while reading it — so it does not belong in the bar that says which part of the board is
   * open. The colours are switches, and they live in the rail with the other switches; the bar
   * keeps the areas, the stages and the rest, which are all places a card *is*.
   */
  const markSections = useMemo(() => sections.filter((section) => section.mark), [sections]);
  const tabSections = useMemo(() => sections.filter((section) => !section.mark), [sections]);

  /**
   * Whether the board has been divided into anything worth navigating.
   *
   * One section called "Everything" is a table of contents for a book with one chapter, so an
   * undivided board gets no bar at all, rather than a bar with a single tab in it.
   */
  const hasSectionTabs = tabSections.length > 1;

  /**
   * The section actually being shown, which is not always the one that was chosen.
   *
   * A colour row exists only while something is marked in that colour, so rubbing out the last
   * green highlight takes the green dot off the rail — and the board would go on filtering by a
   * colour with no control left to switch it off, no tab lit, and nothing on the status line
   * naming the cut, because the cut it names no longer exists to be looked up. An area behaves the
   * same way when it is dissolved from somewhere other than this page.
   *
   * A section id that no longer names a section means everything, which is what the board would be
   * showing anyway if it agreed with itself.
   */
  const shownSectionId = useMemo(
    () =>
      sectionId !== null && !sections.some((section) => section.id === sectionId)
        ? null
        : sectionId,
    [sectionId, sections],
  );

  /**
   * The sections as the tab machinery sees them: a fixed left-to-right order, and a string for the
   * current one.
   *
   * Built from the same array the bar renders, so a swipe and a tap walk the same list — a second
   * order defined anywhere else would drift the first time a card changed area.
   */
  const sectionOrder = useMemo(() => sectionTabOrder(tabSections), [tabSections]);
  const sectionValue = shownSectionId ?? ALL_SECTIONS;
  const sectionIndex = Math.max(sectionOrder.indexOf(sectionValue), 0);

  /**
   * Two-finger swipe between the sections, the same gesture every other tabbed page in the app
   * answers to. Off on an undivided board, where there is nothing to swipe between.
   *
   * Off as well while a colour is being shown. The colours are not in this order — they are
   * switches in the rail, not tabs — so a swipe from one would be asked to step from an index this
   * list does not contain, and would land on whichever tab happens to be first rather than on the
   * next one. Pressing the colour again is the way back, which is where a swipe would have to
   * start anyway.
   */
  const swipeRef = useSwipeableTabs<string, HTMLElement>({
    order: sectionOrder,
    value: sectionValue,
    onChange: (value) => setSectionId(value === ALL_SECTIONS ? null : value),
    enabled: hasSectionTabs && sectionOrder.includes(sectionValue),
  });

  /**
   * Which stage bands are open.
   *
   * This is what used to be the focus view, turned from a mode into a fold. Focus took the cards
   * that were not due *off the board* and left a count behind; a hire looking at six of thirty-four
   * had to take the other twenty-eight on trust. The bands put all of it on the page — named,
   * counted, and one click from being read — which is the same reduction in what you have to look
   * at without the part that made the board feel unreliable.
   *
   * Decided once per board rather than remembered, for the reason focus was: which shape is right
   * is a question about how big *this* board is, and a hire who opened everything on a six-card
   * board last month should not meet a forty-card one wide open. A small board arrives with every
   * band open, because folding four cards into three headings is ceremony, not help.
   */
  const [openStages, setOpenStages] = useState<Set<BoardStage>>(new Set(BOARD_STAGES));
  const [bandsDecidedFor, setBandsDecidedFor] = useState<string | null>(null);

  if (board && boardId !== bandsDecidedFor) {
    setBandsDecidedFor(boardId);
    // "Behind you" never arrives open, at any size: it holds what is finished, and it fills in only
    // once the path has been read, after this is decided.
    setOpenStages(
      allCards.length > FOLD_THRESHOLD
        ? new Set([currentStage(states)])
        : new Set(BOARD_STAGES.filter((stage) => stage !== "BEHIND")),
    );
  }

  /**
   * "Behind you" opens when cards have moved into it since the hire last looked.
   *
   * It arrives folded, but cards move there without the hire touching the board: a phase finished
   * in the dock or on the Onboarding page, a note kept from a step of a finished phase. A band that
   * silently swallows them reads as the cards being gone. So what was behind last time is
   * remembered (`behindSeen.ts`) — across visits, and while the board stays open — and any card
   * that is new there unfolds the band once. Folding it again is the hire's call and sticks.
   */
  const behindIds = useMemo(
    () =>
      pathSettled
        ? allCards
            .filter((card) => states.get(card.id)?.stage === "BEHIND")
            .map((card) => card.id)
            .sort()
        : null,
    [allCards, pathSettled, states],
  );
  const behindKey = behindIds?.join("|") ?? null;
  const [knownBehind, setKnownBehind] = useState<{ boardId: string; key: string } | null>(null);

  if (
    board &&
    behindIds !== null &&
    behindKey !== null &&
    (knownBehind?.boardId !== boardId || knownBehind.key !== behindKey)
  ) {
    const before =
      knownBehind?.boardId === boardId
        ? new Set(knownBehind.key.split("|").filter(Boolean))
        : readBehindSeen(boardId);
    setKnownBehind({ boardId, key: behindKey });
    if (hasNewlyBehind(before, behindIds)) {
      setOpenStages((current) => new Set([...current, "BEHIND"]));
    }
  }

  useEffect(() => {
    if (board && behindIds !== null) writeBehindSeen(boardId, behindIds);
  }, [board, boardId, behindIds]);

  function toggleStage(stage: BoardStage) {
    setOpenStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);

      return next;
    });
  }

  /** The kind of card being written, or null when nothing is being added. */
  const [addingKind, setAddingKind] = useState<AuthoredCardKind | null>(null);

  /** The sizes the hire pulled their cards to — see `cardSizes.ts`. */
  const [cardSizes, setCardSizes] = useState<CardSizes>({});
  const [sizesReadFor, setSizesReadFor] = useState<string | null>(null);

  if (storedFor !== sizesReadFor) {
    setSizesReadFor(storedFor);
    setCardSizes(readCardSizes(boardId));
  }

  /**
   * Sets one card's size, and forgets the entry entirely when it is pulled back to the default.
   *
   * Storage should hold the decisions somebody made. A row per card saying "unchanged" is not a
   * decision, and it is what would slowly turn a preference into a copy of the board.
   */
  function resizeCard(cardId: string, size: CardSize) {
    setCardSizes((current) => {
      const next = { ...current };
      if (isDefault(size)) delete next[cardId];
      else next[cardId] = size;

      writeCardSizes(boardId, next);

      return next;
    });
  }

  /**
   * Undoes every cut at once: the step it was opened for, the filter, the section and the focus view.
   *
   * One function because the line that offers it counts *all* the cards the board is holding back,
   * and an offer that cleared some of them would be a button that does not do what the sentence
   * above it says.
   */
  function showEverything() {
    setOpenStages(new Set(BOARD_STAGES));
    setSectionId(null);
    setFilter("all");
    setExpandedStackIds(allRootIds(stacks));
    if (pathPlace) setSearchParams({}, { replace: true });
  }

  /**
   * The cards on screen: the phase the board was opened for, then the owner filter, then the
   * section, then the focus view.
   *
   * Pinned last and stably, so pinning one card lifts that card and disturbs nothing else. A
   * display sort, not a write: what gets sent on a reorder is what is on screen, so pinning and
   * dragging cannot disagree about where a card is.
   *
   * The focus view keeps pinned cards whatever their stage. A pin is the hire saying *this one
   * matters to me now*, and a mode that overrode it would be the board arguing with them.
   */
  const shownCards = useMemo(() => {
    // The phase the board was opened for, first: it is the narrowest question anybody asks
    // of this page, and the other cuts still apply within it.
    // Piles fold first, so every later cut sees one card where there is one pile.
    const folded = collapseStacks(allCards, stacks, openStackIds);
    const atPlace = pathPlace
      ? folded.filter((card) => isCardAt(card, pathPlace, phases, cardOrigins))
      : folded;
    const bySource = atPlace.filter((card) => matchesFilter(card, filter));
    const visible = cardsInSection(
      bySource,
      groups,
      shownSectionId,
      { states, pinnedIds },
      cardMarks,
    );

    return [...visible].sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)));
  }, [
    allCards,
    cardMarks,
    cardOrigins,
    filter,
    groups,
    openStackIds,
    pathPlace,
    phases,
    pinnedIds,
    shownSectionId,
    stacks,
    states,
  ]);

  const griddedBoard = board ? { ...board, cards: shownCards } : null;
  const hiddenCount = allCards.length - shownCards.length;

  /**
   * Every cut currently taking cards off the screen, named the way its own control names it.
   *
   * In the order they are applied, so the line reads as the pipeline it describes. A cut that is
   * set but removing nothing — a filter matching every card, a section holding all of them — is
   * left out: the line exists to explain cards that are missing, and naming a control that took
   * nothing away would send the hire to reset something that was never the problem.
   */
  const activeCuts = useMemo(() => {
    const cuts: string[] = [];

    const piled = allCards.length - collapseStacks(allCards, stacks, openStackIds).length;
    if (piled > 0) cuts.push(`${piled} under other cards in piles`);

    if (pathPlace) {
      cuts.push(pathPlaceTitle ? `From “${pathPlaceTitle}”` : "From one phase");
    }

    const cut = filterLabel(filter);
    if (cut) cuts.push(cut);

    if (shownSectionId !== null) {
      const section = sections.find((candidate) => candidate.id === shownSectionId);
      if (section) cuts.push(section.name);
    }

    // Folded bands are deliberately not listed. They are the one cut that says so where it happens
    // — a heading on the board reading "Later · 8 to do" — and repeating it up here would be the
    // page explaining something that is not hidden.
    return cuts;
  }, [allCards, filter, openStackIds, pathPlace, pathPlaceTitle, shownSectionId, sections, stacks]);

  const handleReorder = (cardIds: string[]) => void reorder(cardIds);

  /**
   * Opens the planning mode, with nothing folded away.
   *
   * **It no longer clears the filter and the section.** It used to have to: a reorder replaces the
   * board's order outright, and the grid built that order from what was on screen, so a drag on a
   * narrowed board told the server about a fraction of it. The narrowing was never the problem —
   * computing a *position* from a narrowed list was. The grid is now given the whole order and
   * every move names the card it is going next to, so a hire can plan one area without the board
   * jumping to everything first.
   *
   * What is still opened is what is *folded*: planning is about what comes after what, and a
   * dependency you cannot see is one you cannot set.
   */
  function startArranging() {
    setOpenStages(new Set(BOARD_STAGES));
    setIsArranging(true);
  }

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

        <main ref={swipeRef} className={`${frameClass} relative space-y-5 py-6 lg:py-8`}>
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
            <div
              className={
                // Centred on the viewport once the page is the whole screen. With the header gone
                // there is nothing at the top for it to hang under, and a rail pinned to a corner of
                // a screen this wide is a long way from wherever the pointer is.
                //
                // Below `lg` there is no margin to park it in, so it is the same rail lying flat in
                // the page above the cards -- not a second, smaller set of controls.
                isFocused
                  ? "z-20 lg:fixed lg:top-1/2 lg:right-3 lg:-translate-y-1/2"
                  : "z-20 lg:absolute lg:top-8 lg:right-3"
              }
            >
              <div
                // A group, not a toolbar: `toolbar` promises one tab stop with arrow keys between the
                // buttons, and every button here is its own tab stop.
                role="group"
                aria-label="Board tools"
                className={[
                  "flex w-fit max-w-full flex-row flex-wrap items-center gap-1 rounded-2xl border border-app-border bg-app-surface/90 p-1 shadow-sm backdrop-blur lg:flex-col lg:flex-nowrap",
                  // Fixed to the viewport it can no longer grow past the fold, so it scrolls in
                  // itself on a short screen rather than losing its last buttons off the bottom.
                  isFocused
                    ? "lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
                    : "lg:sticky lg:top-6",
                ].join(" ")}
              >
                {/* Widest change first: expanding takes the app's own navigation and this page's
                  header off the screen, so it is the one switch that has to be found before any of
                  the others are worth reaching for — and the one that has to stay put afterwards,
                  because it is the way back. */}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => setFocused(!isFocused)}
                  aria-pressed={isFocused}
                  title={isFocused ? "Back to the app (Esc)" : "Expand the board"}
                  aria-label={isFocused ? "Back to the app" : "Expand the board"}
                >
                  {isFocused ? (
                    <Minimize2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>

                <span className={RAIL_SEPARATOR_CLASS} aria-hidden="true" />

                {/* Planning and making an area are the two ways of changing the board's *shape*,
                  which is why they sit together and away from the three that add something to it.
                  It is a toggle rather than a door: the way out has to be where the way in was,
                  especially with the header's "Done" gone in focus mode. */}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => (isArranging ? setIsArranging(false) : startArranging())}
                  disabled={!board}
                  aria-pressed={isArranging}
                  title={isArranging ? "Done planning" : "Plan the board"}
                  aria-label={isArranging ? "Done planning" : "Plan the board"}
                >
                  {isArranging ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ListTree className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => setNamingArea(true)}
                  disabled={!board}
                  aria-pressed={namingArea}
                  title="New area"
                  aria-label="New area"
                >
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                </Button>

                {/* The strip saying where the hire stands, on or off this board. The switch lives
                  here rather than on the strip, because the strip is the thing being switched: a
                  control that takes its own surface away leaves nothing to press to get it back. */}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => showPathWindow(!isPathShown)}
                  disabled={!board}
                  aria-pressed={isPathShown}
                  title={isPathShown ? "Hide where you are in your path" : "Show where you are"}
                  aria-label={
                    isPathShown ? "Hide where you are in your path" : "Show where you are"
                  }
                >
                  <Milestone className="h-4 w-4" aria-hidden="true" />
                </Button>

                {/* The task pool, on or off — the same kind of switch as the path strip above, and
                  for the same reason: the card's own X only hides it, so the way back has to live
                  somewhere the card is not. */}
                {hasTaskPool && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => showTaskPool(!isTaskPoolShown)}
                    aria-pressed={isTaskPoolShown}
                    title={isTaskPoolShown ? "Hide the task pool" : "Show the task pool"}
                    aria-label={isTaskPoolShown ? "Hide the task pool" : "Show the task pool"}
                  >
                    <LayoutList className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}

                {/* Which cards, by where they came from. It sits below the switches that change the
                  board's shape because it changes neither the board nor its shape — it only
                  narrows what is drawn, and it is the one control here that is undone by pressing
                  a different button in the same group rather than the same one again. */}
                {allCards.length > 2 && (
                  <>
                    <span className={RAIL_SEPARATOR_CLASS} aria-hidden="true" />
                    <BoardFilterTriggers
                      value={filter}
                      onChange={setFilter}
                      vertical={isRailVertical}
                    />
                  </>
                )}

                {/* Directly under it, because it is the same kind of thing: it narrows what is drawn
                  and nothing else. Where they came from, then what you marked on them. */}
                <MarkFilterRail
                  sections={markSections}
                  selectedId={shownSectionId}
                  onSelect={setSectionId}
                  vertical={isRailVertical}
                />

                {/* Nothing is added to a board somebody is rearranging: the three forms open over the
                  cards, which is exactly where the arranging is happening. */}
                {!isArranging && (
                  <>
                    <span className={RAIL_SEPARATOR_CLASS} aria-hidden="true" />
                    <AddCardTriggers
                      onPick={setAddingKind}
                      active={addingKind}
                      vertical={isRailVertical}
                    />
                  </>
                )}
              </div>
            </div>
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
                      // A colour is not one of the tabs, but it is still what is being shown, so its
                      // line of counts is handed over rather than the bar falling back to
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
                        className="font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
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
                          className="font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
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
                    expandedStackIds={openStackIds}
                    onToggleStack={toggleStack}
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
        </main>
      </div>
    </BoardPathContext.Provider>
  );
}

/** Every pile's root id — what "open all of them" means. */
function allRootIds(stacks: Map<string, { rootId: string }>): Set<string> {
  return new Set([...stacks.values()].map((stack) => stack.rootId));
}
