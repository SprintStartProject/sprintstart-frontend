import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bot,
  Check,
  FolderPlus,
  LayoutDashboard,
  ListTree,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { Spinner } from "../components/ui/Spinner";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { useBoard } from "../features/board/hooks/useBoard";
import { useBoardStructure } from "../features/board/hooks/useBoardStructure";
import { useGeneratedPathCards } from "../features/board/hooks/useGeneratedPathCards";
import { AddCardForm, AddCardTriggers } from "../features/board/components/AddCardForm";
import type { AuthoredCardKind } from "../features/board/types";
import { BoardGrid } from "../features/board/components/BoardGrid";
import { BoardPathRail } from "../features/board/components/BoardPathRail";
import { BoardSectionTabs } from "../features/board/components/BoardSectionNav";
import { BoardFilterTriggers } from "../features/board/components/BoardFilterTriggers";
import { NewAreaForm } from "../features/board/components/NewAreaForm";
import { BoardViewStatus } from "../features/board/components/BoardViewStatus";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { useFocusMode } from "../context/useFocusMode";
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
import { useBoardStructureSync } from "../features/board/sync/useBoardStructureSync";
import { useMarkableBoard } from "../features/board/marks/useCardMarks";
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
export function BoardPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const { profile } = useAuth();
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
  useBoardStructureSync(boardId, selectedProjectId);

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

  // Lends these cards to the app shell, so the selection toolbar mounted above the router can offer
  // the marker pen on text that turns out to be on one of them. Taken back when this page leaves.
  useMarkableBoard({
    cards: allCards,
    onEditCard: (cardId, request) => void editCard(cardId, request),
  });

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

    const cut = filterLabel(filter);
    if (cut) cuts.push(cut);

    if (sectionId !== null) {
      const section = sections.find((candidate) => candidate.id === sectionId);
      if (section) cuts.push(section.name);
    }

    // Folded bands are deliberately not listed. They are the one cut that says so where it happens
    // — a heading on the board reading "Later · 8 to do" — and repeating it up here would be the
    // page explaining something that is not hidden.
    return cuts;
  }, [allCards, filter, openStackIds, sectionId, sections, stacks]);

  const handleReorder = (cardIds: string[]) => {
    if (!pathCard || pathIndex === -1) return void reorder(cardIds);
    const next = [...cardIds];
    next.splice(Math.min(pathIndex, next.length), 0, pathCard.id);
    return void reorder(next);
  };

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
   * dependency you cannot see is one you cannot set. Stacks spread out too, for as long as the
   * mode lasts — see `openStackIds`, which derives that rather than snapshotting it.
   */
  function startArranging() {
    setOpenStages(new Set(BOARD_STAGES));
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

  /**
   * The gutters the page draws in.
   *
   * Focus mode trades the 10rem page gutter for a margin wide enough to keep the tool rail off the
   * cards and no wider — the whole reason somebody expands the board is that the gutters were space
   * they were not using, and giving them back at the same width would be the button doing nothing.
   */
  const frameClass = isFocused ? "px-4 sm:px-6 lg:pr-20 lg:pl-6" : "app-page-frame";

  return (
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
                  ? "Say when each card is due and what it waits on."
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
                    {/* The one switch from the rail worth a copy here, for the widths where
                        there is no margin to put a rail in. `lg:hidden` rather than a second
                        implementation: one state, two places it can be reached from. */}
                    <Button
                      variant="secondary"
                      iconOnly
                      className="lg:hidden"
                      onClick={startArranging}
                      disabled={!board}
                      title="Plan the board"
                      aria-label="Plan the board"
                    >
                      <ListTree className="h-4 w-4" aria-hidden="true" />
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
      )}

      <main ref={swipeRef} className={`${frameClass} relative space-y-5 py-6 lg:py-8`}>
        {/* The page keeps a 10rem margin either side from `lg` up, and on this page it is dead
            space: the board is a column of cards and the margin is where a hand rests. So the
            offers live there — always in reach, never in the way, and out of the row above the
            board where they were competing with the controls that decide what is *shown*.
            Absolute rather than a column of its own, so nothing about the board's own width or its
            two-column packing changes; hidden below `lg`, where there is no margin to sit in.

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
              isFocused
                ? "fixed top-1/2 right-3 z-20 hidden -translate-y-1/2 lg:block"
                : "absolute top-6 right-3 z-20 hidden lg:top-8 lg:block"
            }
          >
            <div
              className={[
                "flex flex-col items-center gap-1 rounded-2xl border border-app-border bg-app-surface/90 p-1 shadow-sm backdrop-blur",
                // Fixed to the viewport it can no longer grow past the fold, so it scrolls in
                // itself on a short screen rather than losing its last buttons off the bottom.
                isFocused ? "max-h-[calc(100vh-2rem)] overflow-y-auto" : "sticky top-6",
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

              <span className="my-0.5 h-px w-6 bg-app-border" aria-hidden="true" />

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

              {/* Which cards, by where they came from. It sits below the switches that change the
                  board's shape because it changes neither the board nor its shape — it only
                  narrows what is drawn, and it is the one control here that is undone by pressing
                  a different button in the same group rather than the same one again. */}
              {allCards.length > 2 && (
                <>
                  <span className="my-0.5 h-px w-6 bg-app-border" aria-hidden="true" />
                  <BoardFilterTriggers value={filter} onChange={setFilter} compact vertical />
                </>
              )}

              {/* Nothing is added to a board somebody is rearranging: the three forms open over the
                  cards, which is exactly where the arranging is happening. */}
              {!isArranging && (
                <>
                  <span className="my-0.5 h-px w-6 bg-app-border" aria-hidden="true" />
                  <AddCardTriggers onPick={setAddingKind} active={addingKind} compact vertical />
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
            You&apos;re not on a project yet, so there&apos;s nothing to put on a board. Whoever set
            up your account can add you to one.
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
                    sections={sections}
                    selectedId={sectionId}
                    onSelect={setSectionId}
                  />
                </div>
              ) : (
                <span />
              )}

              <div className="flex flex-wrap items-center gap-2">
                {/* The rail in the margin takes over from `lg` up, where there is a margin to
                      put it in. Below that these are the only offers on the page — and there is
                      room for the words, which the rail's glyphs do without. */}
                {allCards.length > 2 && (
                  <BoardFilterTriggers value={filter} onChange={setFilter} className="lg:hidden" />
                )}

                <AddCardTriggers onPick={setAddingKind} active={addingKind} className="lg:hidden" />
              </div>
            </div>

            {/* Over the board rather than in the rail: the rail is 10rem of page margin, which is
                room for a few glyphs and not for a form. */}
            {addingKind && (
              <AddCardForm kind={addingKind} onAdd={addCard} onClose={() => setAddingKind(null)} />
            )}

            {namingArea && (
              <NewAreaForm onCreate={handleNewArea} onClose={() => setNamingArea(false)} />
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
                  onAssignStage={assignStage}
                  onAssignGroupStage={assignGroupStage}
                  onToggleDone={toggleDone}
                  onSetPredecessor={setPredecessor}
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
