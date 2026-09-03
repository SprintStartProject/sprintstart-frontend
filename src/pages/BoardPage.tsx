import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bot,
  Check,
  LayoutDashboard,
  Move,
  PanelTopClose,
  PanelTopOpen,
  RefreshCw,
  Rows2,
  Rows3,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { Spinner } from "../components/ui/Spinner";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { useBoard } from "../features/board/hooks/useBoard";
import { useBoardStructure } from "../features/board/hooks/useBoardStructure";
import { useGeneratedPathCards } from "../features/board/hooks/useGeneratedPathCards";
import { AddCardForm, AddCardTriggers } from "../features/board/components/AddCardForm";
import type { AuthoredCardKind, BoardCard } from "../features/board/types";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathRail } from "../features/board/components/BoardPathRail";
import { BoardSectionTabs } from "../features/board/components/BoardSectionNav";
import { BoardViewStatus } from "../features/board/components/BoardViewStatus";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { readCollapsedCards, writeCollapsedCards } from "../features/board/layout/collapsedCards";
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
import { buildStacks, collapseStacks } from "../features/board/layout/cardStacks";
import { sourceOfTitle } from "../features/board/generation/pathToCards";
import type { AreaAccent } from "../features/board/layout/areaAccents";
import {
  DEFAULT_PREFERENCES,
  readBoardPreferences,
  writeBoardPreferences,
  type BoardPreferences,
} from "../features/board/layout/boardPreferences";
import {
  isDefault,
  readCardSizes,
  writeCardSizes,
  type CardSize,
  type CardSizes,
} from "../features/board/layout/cardSizes";
import {
  assignToGroup,
  groupOf,
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
 *
 * **The board is now a process, not a pile.** Three things carry that, and none of them changes the
 * board's own order:
 *
 * - a *stage* per card — now, next, later — so the board can say what is due rather than only what
 *   exists;
 * - a *predecessor* per card, so "read the runbook before you deploy" is a fact the board holds
 *   instead of one the hire has to remember;
 * - *sections* down the side, so a board of forty cards is read one part at a time.
 *
 * The reason for all three is the same. A board that shows everything at once is fine at eight
 * cards and unusable at forty, and forty is what a generated onboarding path produces. See
 * `layout/boardStructure.ts` for the model and `generation/pathToCards.ts` for where the cards come
 * from.
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
 * Which cards the board is showing.
 *
 * Not a search and not a sort — the one cut worth making by hand is *who put this here*, which is
 * the one thing a card's content never says on its own. Three sources, and they partition the
 * board:
 *
 * - `buddy` — placed for the hire in conversation, contents read live.
 * - `team` — a card blueprint their PM wrote for everybody in this role.
 * - `mine` — everything else they own: their own notes and lists, and the steps of their own
 *   personalised path. The path counts as theirs because it *is*: it was drafted for them, they
 *   edit it, and nobody else on the project has the same one.
 *
 * Where a card sits in the process is a separate question, and the stages, the focus view and the
 * section tabs answer that one.
 */
type BoardFilter = "all" | "buddy" | "team" | "mine";

/**
 * Whether a card came from the project's blueprints rather than from the hire or their buddy.
 *
 * Read off the invisible marker its title carries — see `generation/pathToCards.ts`, which explains
 * why provenance is smuggled through a text field and what should replace it.
 */
function isFromTeam(card: BoardCard): boolean {
  return card.content.kind === "CHECKLIST" && sourceOfTitle(card.content.title) === "TEAM";
}

function matchesFilter(card: BoardCard, filter: BoardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "buddy") return card.owner === "AI";
  if (filter === "team") return isFromTeam(card);

  return card.owner === "HIRE" && !isFromTeam(card);
}

export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const { profile } = useAuth();
  const toast = useToast();

  /** The hire's roles on this project, which decide which of the team's blueprints reach them. */
  const roleIds = useMemo(() => (profile?.projectRoles ?? []).map((role) => role.id), [profile]);
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

  /** The area whose name is open for editing, because it was just created. */
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);

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
      // Naming it is the other half of creating it, so the name opens focused and selected rather
      // than leaving the hire with a box called "Area 3" and a rename control to go and find.
      setRenamingGroupId(created.id);

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

  /**
   * Every card the board is holding, whatever the current view.
   *
   * The process layer and the section counts are both computed from this rather than from what is
   * on screen. A rail that said "3 of 4 done" because the fourth card happened to be filtered out
   * would be worse than no rail at all — the counts are about the board, and the view is about the
   * hire's attention.
   */
  const allCards = useMemo(
    () => board?.cards.filter((card) => card !== pathCard && !pendingRemovals.has(card.id)) ?? [],
    [board, pathCard, pendingRemovals],
  );

  const { states, assignStage, assignGroupStage, toggleDone, setPredecessor, applyPlan } =
    useBoardStructure(boardId, allCards);

  const sections = useMemo(
    () =>
      summariseSections(allCards, groups, states, {
        // The focus tab is for a board somebody can get lost on. Below the fold threshold every
        // card is already in front of them, and a tab offering a subset of six is a choice made
        // for its own sake.
        focus: allCards.length > FOLD_THRESHOLD,
        pinnedIds,
      }),
    [allCards, groups, pinnedIds, states],
  );

  /**
   * The provenance cuts worth offering on *this* board.
   *
   * "From your team" only appears once the team has actually prescribed something. An option that
   * can only ever come back empty is a promise the board cannot keep, and on an installation where
   * nobody has written a blueprint that is every board.
   */
  const filterOptions = useMemo<FilterSelectOption<BoardFilter>[]>(() => {
    const options: FilterSelectOption<BoardFilter>[] = [
      { value: "all", label: "All cards" },
      { value: "buddy", label: "From your buddy" },
    ];
    if (allCards.some(isFromTeam)) options.push({ value: "team", label: "From your team" });
    options.push({ value: "mine", label: "Yours" });

    return options;
  }, [allCards]);

  /**
   * Whether the board has been divided into anything worth navigating.
   *
   * One section called "Everything" is a table of contents for a book with one chapter, so an
   * undivided board gets no bar at all, rather than a bar with a single tab in it.
   */
  const hasSectionTabs = sections.length > 1;

  /**
   * The sections as the tab machinery sees them: a fixed left-to-right order, and a string for the
   * current one.
   *
   * Built from the same array the bar renders, so a swipe and a tap walk the same list — a second
   * order defined anywhere else would drift the first time a card changed area.
   */
  const sectionOrder = useMemo(() => sectionTabOrder(sections), [sections]);
  const sectionValue = sectionId ?? ALL_SECTIONS;
  const sectionIndex = Math.max(sectionOrder.indexOf(sectionValue), 0);

  /**
   * Two-finger swipe between the sections, the same gesture every other tabbed page in the app
   * answers to. Off on an undivided board, where there is nothing to swipe between.
   */
  const swipeRef = useSwipeableTabs<string, HTMLElement>({
    order: sectionOrder,
    value: sectionValue,
    onChange: (value) => setSectionId(value === ALL_SECTIONS ? null : value),
    enabled: hasSectionTabs,
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
    setOpenStages(
      allCards.length > FOLD_THRESHOLD ? new Set([currentStage(states)]) : new Set(BOARD_STAGES),
    );
  }

  function toggleStage(stage: BoardStage) {
    setOpenStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);

      return next;
    });
  }

  /**
   * The chains on this board, and which of them the hire has opened.
   *
   * Kept for the visit rather than stored: opening a stack is looking into it, not rearranging the
   * board, and a pile that was still spread out a week later would have quietly become five cards
   * again. Keyed by root id, which does not move as cards are ticked off — see `cardStacks.ts`.
   */
  // Area-aware, because a pile is drawn in one place and a chain that ran out of one area into
  // another had two — see `cardStacks.ts`. Blueprints hit this routinely: a PM's "comes after"
  // points at whatever card it names, wherever that card ended up filed.
  const stacks = useMemo(
    () => buildStacks(allCards, states, (cardId) => groupOf(groups, cardId)?.id ?? null),
    [allCards, groups, states],
  );
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(new Set());

  /**
   * How this hire wants their board to look: how much room the cards get, and whether the tools
   * above them are on screen at all.
   *
   * Read once per board, the way the folds, the pins and the areas are — see `boardPreferences.ts`
   * for the storage bargain and for why this one wants a server more than the others do.
   */
  const [preferences, setPreferences] = useState<BoardPreferences>(DEFAULT_PREFERENCES);
  const [preferencesReadFor, setPreferencesReadFor] = useState<string | null>(null);

  if (boardId !== preferencesReadFor) {
    setPreferencesReadFor(boardId);
    setPreferences(readBoardPreferences(boardId));
  }

  function savePreferences(next: BoardPreferences) {
    setPreferences(next);
    writeBoardPreferences(boardId, next);
  }

  /** The kind of card being written, or null when nothing is being added. */
  const [addingKind, setAddingKind] = useState<AuthoredCardKind | null>(null);

  /** The sizes the hire pulled their cards to — see `cardSizes.ts`. */
  const [cardSizes, setCardSizes] = useState<CardSizes>({});
  const [sizesReadFor, setSizesReadFor] = useState<string | null>(null);

  if (boardId !== sizesReadFor) {
    setSizesReadFor(boardId);
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
   * The piles that are spread out — and while the board is being arranged, that is all of them.
   *
   * Derived rather than stored, because arranging is when chains get *made*. Saying "B comes after
   * A" turns those two into a pile the moment it is set; a snapshot taken when arrange mode opened
   * knows nothing about a pile that did not exist yet, so B folded away under A on the spot — out
   * of the board, and out of the "waits on…" list on every other card. Which meant a run could
   * never grow past two: the card you had just chained was gone before you could point the next one
   * at it. Nothing was wrong with the chain; it was the surface refusing to show its own middle.
   *
   * The hire's own open set is kept untouched underneath, so leaving arrange mode puts the piles
   * back exactly as they were before.
   */
  const openStackIds = useMemo(
    () => (isArranging ? allRootIds(stacks) : expandedStackIds),
    [expandedStackIds, isArranging, stacks],
  );

  /**
   * Undoes every cut at once: the filter, the section, the focus view and every folded stack.
   *
   * One function because the line that offers it counts *all* the cards the board is holding back,
   * and an offer that cleared the filters but left four cards folded inside a stack would be a
   * button that does not do what the sentence above it says.
   */
  function showEverything() {
    setOpenStages(new Set(BOARD_STAGES));
    setSectionId(null);
    setFilter("all");
    setExpandedStackIds(allRootIds(stacks));
  }

  function toggleStack(rootId: string) {
    setExpandedStackIds((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);

      return next;
    });
  }

  /**
   * The cards on screen: stacks folded to one card each, then the owner filter, then the section,
   * then the focus view.
   *
   * Pinned last and stably, so pinning one card lifts that card and disturbs nothing else. A
   * display sort, not a write: what gets sent on a reorder is what is on screen, so pinning and
   * dragging cannot disagree about where a card is.
   *
   * The focus view keeps pinned cards whatever their stage. A pin is the hire saying *this one
   * matters to me now*, and a mode that overrode it would be the board arguing with them.
   */
  const shownCards = useMemo(() => {
    // Stacks fold first, so every later cut sees one card where there is one card to work on. The
    // alternative — filtering the members and then folding — would let the focus view hide the card
    // a stack was about to stand on and leave the pile claiming a depth it no longer had.
    const folded = collapseStacks(allCards, stacks, openStackIds);

    const bySource = folded.filter((card) => matchesFilter(card, filter));
    const visible = cardsInSection(bySource, groups, sectionId, { states, pinnedIds });

    return [...visible].sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)));
  }, [allCards, filter, groups, openStackIds, pinnedIds, sectionId, stacks, states]);

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

    const foldedAway = allCards.length - collapseStacks(allCards, stacks, openStackIds).length;
    if (foldedAway > 0) cuts.push(`${foldedAway} folded into sequences`);

    if (filter !== "all") {
      const option = filterOptions.find((candidate) => candidate.value === filter);
      if (option) cuts.push(option.label);
    }

    if (sectionId !== null) {
      const section = sections.find((candidate) => candidate.id === sectionId);
      if (section) cuts.push(section.name);
    }

    // Folded bands are deliberately not listed. They are the one cut that says so where it happens
    // — a heading on the board reading "Later · 8 to do" — and repeating it up here would be the
    // page explaining something that is not hidden.
    return cuts;
  }, [allCards, filter, filterOptions, openStackIds, sectionId, sections, stacks]);

  const handleReorder = (cardIds: string[]) => {
    if (!pathCard || pathIndex === -1) return void reorder(cardIds);
    const next = [...cardIds];
    next.splice(Math.min(pathIndex, next.length), 0, pathCard.id);
    return void reorder(next);
  };

  /**
   * Enters arrange mode with every card on screen.
   *
   * A reorder sends the whole order of what is *shown*, so arranging a filtered board would tell
   * the server about a fraction of it and let the rest fall to the end. Rather than teaching the
   * reorder to reconstruct the hidden cards' positions — which is the kind of thing that works
   * until two of them are adjacent — arranging simply means looking at all of it.
   */
  function startArranging() {
    setFilter("all");
    setSectionId(null);
    // Every band opens with them: arranging is about the board's whole order, and a fold that hid
    // a third of it while somebody dragged a card through would be the surface arguing with the
    // gesture. The grid draws no bands at all while the board is being arranged.
    setOpenStages(new Set(BOARD_STAGES));
    // Stacks spread out too — see `openStackIds`, which does that for as long as the mode lasts
    // rather than once on the way in. A reorder sends the order of what is *shown*, so arranging a
    // board with four cards folded away would tell the server about a fraction of it.
    setIsArranging(true);
  }

  const { generate, generating } = useGeneratedPathCards();

  /**
   * Builds the hire's personalised onboarding path into cards, and files them.
   *
   * The cards are written server-side; the areas, stages and order between them are this client's
   * to keep, so both halves are applied here rather than left for the hire to arrange by hand. A
   * generated path that landed as forty loose cards would be the exact complaint this answers.
   */
  async function handleGenerate() {
    if (!selectedProjectId) return;

    const existingTitles = new Set(
      allCards.flatMap((card) =>
        card.content.kind === "CHECKLIST" && card.content.title ? [card.content.title] : [],
      ),
    );

    const result = await generate(selectedProjectId, roleIds, existingTitles);

    if (result === "NOTHING_TO_BUILD") {
      toast.info("Nothing to build from yet", {
        description:
          "Generate your onboarding path on the Onboarding page, or ask your PM to set up card blueprints.",
      });
      return;
    }
    if (result === "NOTHING_NEW") {
      toast.info("Your path is already on the board", {
        description: "Every step that isn't finished is already a card here.",
      });
      return;
    }
    if (result === "FAILED") {
      showErrorToast("Your path couldn't be built into cards", {
        description: "Nothing was changed — try again.",
      });
      return;
    }

    // One area per phase, named after it — and a second run adds to the area it made the first
    // time rather than making another one beside it. Without that, generating again after the PM
    // added a blueprint left two areas called "From your team", one holding the old cards and one
    // holding the new, which is the same card twice as far as anybody reading the board can tell.
    //
    // The index is in the id because a plan is applied inside a single millisecond and `Date.now()`
    // alone would mint the same id for every phase.
    const stamp = Date.now();
    const filed = [...groups];
    result.areas.forEach((area, index) => {
      const existing = filed.findIndex((group) => group.name === area.name);
      if (existing !== -1) {
        filed[existing] = {
          ...filed[existing],
          cardIds: [...filed[existing].cardIds, ...area.cardIds],
        };

        return;
      }

      filed.push({
        id: `group-path-${stamp}-${index}`,
        name: area.name,
        cardIds: area.cardIds,
        collapsed: false,
      });
    });
    saveGroups(filed);
    applyPlan(result.stages, result.chain);

    refresh();
    toast.success(`${result.cardCount} cards added from your path`, {
      description: "Grouped by phase, in the order the path puts them in.",
    });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={LayoutDashboard}
            title="Board"
            subtitle={
              isArranging
                ? "Drag a card to move it, set when it's due, or say what it waits on."
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
                    onClick={() => void handleGenerate()}
                    disabled={!selectedProjectId}
                    loading={generating}
                    icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                    title="Turn your personalised onboarding path into checklists here"
                  >
                    Build my path
                  </Button>
                  {/* The same two switches the rail carries, for the widths where there is no
                      margin to put a rail in. `lg:hidden` rather than a second implementation:
                      one state, two places it can be reached from. */}
                  <Button
                    variant="secondary"
                    iconOnly
                    className="lg:hidden"
                    onClick={() =>
                      savePreferences({
                        ...preferences,
                        density: preferences.density === "cozy" ? "compact" : "cozy",
                      })
                    }
                    disabled={!board}
                    aria-pressed={preferences.density === "compact"}
                    title={
                      preferences.density === "compact"
                        ? "Give the cards more room"
                        : "Fit more on screen"
                    }
                    aria-label={
                      preferences.density === "compact"
                        ? "Give the cards more room"
                        : "Fit more on screen"
                    }
                  >
                    {preferences.density === "compact" ? (
                      <Rows2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Rows3 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    iconOnly
                    className="lg:hidden"
                    onClick={() =>
                      savePreferences({ ...preferences, toolsHidden: !preferences.toolsHidden })
                    }
                    disabled={!board}
                    aria-pressed={preferences.toolsHidden}
                    title={preferences.toolsHidden ? "Show the board's tools" : "Hide the tools"}
                    aria-label={
                      preferences.toolsHidden ? "Show the board's tools" : "Hide the tools"
                    }
                  >
                    {preferences.toolsHidden ? (
                      <PanelTopOpen className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <PanelTopClose className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    iconOnly
                    onClick={startArranging}
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

      <main ref={swipeRef} className="app-page-frame relative space-y-5 py-6 lg:py-8">
        {/* The page keeps a 10rem margin either side from `lg` up, and on this page it is dead
            space: the board is a column of cards and the margin is where a hand rests. So the
            three offers live there — always in reach, never in the way, and out of the row above
            the board where they were competing with the controls that decide what is *shown*.
            Absolute rather than a column of its own, so nothing about the board's own width or its
            two-column packing changes; hidden below `lg`, where there is no margin to sit in. */}
        {selectedProjectId && !isArranging && (
          <div className="absolute top-6 right-3 z-20 hidden lg:top-8 lg:block">
            <div className="sticky top-6 flex flex-col items-center gap-1 rounded-2xl border border-app-border bg-app-surface/90 p-1 shadow-sm backdrop-blur">
              {/* The two view switches lead, because they are about the board as a whole and the
                  three below them are about adding one thing to it. Hiding the tools is the
                  topmost: it is the one control that has to stay reachable *after* it has taken
                  the others off the screen. */}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() =>
                  savePreferences({ ...preferences, toolsHidden: !preferences.toolsHidden })
                }
                disabled={!board}
                aria-pressed={preferences.toolsHidden}
                title={preferences.toolsHidden ? "Show the board's tools" : "Hide the tools"}
                aria-label={preferences.toolsHidden ? "Show the board's tools" : "Hide the tools"}
              >
                {preferences.toolsHidden ? (
                  <PanelTopOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelTopClose className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() =>
                  savePreferences({
                    ...preferences,
                    density: preferences.density === "cozy" ? "compact" : "cozy",
                  })
                }
                disabled={!board}
                aria-pressed={preferences.density === "compact"}
                title={
                  preferences.density === "compact"
                    ? "Give the cards more room"
                    : "Fit more on screen"
                }
                aria-label={
                  preferences.density === "compact"
                    ? "Give the cards more room"
                    : "Fit more on screen"
                }
              >
                {preferences.density === "compact" ? (
                  <Rows2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Rows3 className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>

              <span className="my-0.5 h-px w-6 bg-app-border" aria-hidden="true" />

              <AddCardTriggers onPick={setAddingKind} active={addingKind} compact vertical />
            </div>
          </div>
        )}

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
          <div className="min-w-0 space-y-5">
            {/* One row: which part of the board on the left, what to do with it on the right. The
                filter used to sit on a line of its own under the tabs, which read as a second
                navigation for the same board — they are two halves of "what am I looking at", and
                they belong side by side. `items-start` so the tab bar's own status line hangs
                under the tabs rather than dragging the controls down with it. */}
            {!preferences.toolsHidden && (
              <div className="flex flex-wrap items-start justify-between gap-3">
                {hasSectionTabs ? (
                  <div className="min-w-0 flex-1">
                    <BoardSectionTabs
                      sections={sections}
                      selectedId={sectionId}
                      onSelect={setSectionId}
                    />
                  </div>
                ) : (
                  <span />
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {/* Only offered once there is something to cut: a filter over three cards is a
                      control that costs more attention than it saves. */}
                  {allCards.length > 2 && (
                    <FilterSelect
                      label="Which cards to show"
                      value={filter}
                      options={filterOptions}
                      onChange={setFilter}
                    />
                  )}

                  {/* The rail in the margin takes over from `lg` up, where there is a margin to
                      put it in. Below that these are the only three offers on the page. */}
                  <AddCardTriggers
                    onPick={setAddingKind}
                    active={addingKind}
                    className="lg:hidden"
                  />
                </div>
              </div>
            )}

            {/* Over the board rather than in the rail: the rail is 10rem of page margin, which is
                room for three glyphs and not for a form. */}
            {addingKind && (
              <AddCardForm kind={addingKind} onAdd={addCard} onClose={() => setAddingKind(null)} />
            )}

            <div className="min-w-0 space-y-4">
              {/* Only the cards travel. The controls above are the same controls whatever section
                  is open, and sliding them out and back would be the page redrawing its own
                  furniture every time somebody moved one tab across. */}
              <SlidingTabPanel activeKey={sectionValue} index={sectionIndex} className="space-y-4">
                {/* A board with nothing on it is the first thing a new hire sees, and an empty page
                cannot say what the board is *for*. Named after what it will hold rather than after
                its own emptiness — and it points at the two things that fill it: the path, and the
                row of buttons directly above. */}
                {allCards.length === 0 && (
                  <EmptyState
                    icon={<LayoutDashboard className="h-8 w-8" aria-hidden="true" />}
                    title="Nothing on your board yet"
                    action={
                      <Button
                        variant="primary"
                        onClick={() => void handleGenerate()}
                        loading={generating}
                        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                      >
                        Build my path
                      </Button>
                    }
                  >
                    This is where things stay put between conversations — the task you are on, work
                    worth picking up, what your buddy remembers. Build your onboarding path into
                    checklists here, and add a note, a link or a list of your own at any time.
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
                  renamingGroupId={renamingGroupId}
                  onRenameGroupDone={() => setRenamingGroupId(null)}
                  onToggleGroup={handleToggleGroup}
                  onDissolveGroup={handleDissolveGroup}
                  onRecolourGroup={handleRecolourGroup}
                  states={states}
                  onAssignStage={assignStage}
                  onAssignGroupStage={assignGroupStage}
                  onToggleDone={toggleDone}
                  onSetPredecessor={setPredecessor}
                  stacks={stacks}
                  expandedStackIds={openStackIds}
                  onToggleStack={toggleStack}
                  openStages={openStages}
                  onToggleStage={toggleStage}
                  density={preferences.density}
                  cardSizes={cardSizes}
                  onResizeCard={resizeCard}
                />
              </SlidingTabPanel>
            </div>
          </div>
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

/** Every stack's root id — what "open all of them" means. */
function allRootIds(stacks: Map<string, { rootId: string }>): Set<string> {
  return new Set([...stacks.values()].map((stack) => stack.rootId));
}
