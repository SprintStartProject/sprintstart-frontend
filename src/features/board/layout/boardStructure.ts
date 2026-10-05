import { notifyBoardStorageWritten } from "./boardStorage";
import type { BoardCard } from "../types";

/**
 * The order a board's cards are meant to be worked in, and what has to happen first.
 *
 * The board answers *what is on my plate*; it did not answer *what do I do first*. On a board of a
 * dozen cards that gap is survivable — the hire reads all of them. On a board of forty it is the
 * whole problem: every card is equally loud, so none of them is a next step, and the surface that
 * was supposed to make onboarding legible becomes the thing to get through.
 *
 * So a card carries two more facts here: which **stage** of the ramp it belongs to, and which cards
 * have to be finished before it is worth opening. Both are the hire's or their PM's to set, and
 * both are *display* facts — like folding, pinning and areas, they never touch the board's own
 * order, so turning the structure off puts every card back exactly where it was.
 *
 * Local storage, and no longer only local storage: `sync/useBoardStructureSync.ts` sends this layer
 * and the other five up to `PUT /me/board/structure` after every change and reads them back on
 * arrival, so a hire who opens their board on a second machine does not find their process
 * flattened. This is still where the client writes first and reads from — the sync is a copy that
 * follows the hire, not a round trip in the way of a fold — which is what keeps every gesture on
 * this page instant and keeps a failed request from costing anybody anything.
 *
 * That the local shape and the wire shape are two different things is deliberate: `sync/` owns the
 * translation, so nothing here has to know a wire format and the readers below stay defensive about
 * a document written by an older version of the app.
 */
const STORAGE_VERSION = 1;

/**
 * How far into the ramp a card belongs.
 *
 * Named after when rather than after a week number: a hire who starts on a Wednesday, or who spends
 * four days waiting for a laptop, still knows what "now" means, where "week 2" is already a lie by
 * the time they read it.
 *
 * **Two, not three.** There used to be a `NEXT` between these, and nobody could defend the line: a
 * PM writing a blueprint and a hire filing a card both had to decide whether something was "next"
 * or "later", and both were guessing at a distinction that meant the same thing — not now. Two
 * buckets carry the whole point of the ramp with half the vocabulary, and what order things come in
 * *within* a bucket is what the dependencies and the stacks are for. That is the division of labour
 * here: the stage is the board's coarse answer for the cards nobody has sequenced, and a chain is a
 * hard claim about the few that somebody has.
 *
 * **Read off the path, no longer set by hand.** Since the onboarding path became the one plan, a
 * card's stage is where it sits on that path — see `pathStages.ts`. A stage stored by an older
 * version is still read and still synced, so nothing about a board is lost, but the board does not
 * draw from it any more.
 */
export type StoredStage = "NOW" | "LATER";

/**
 * A stage as the board draws it: **Now**, and **Behind you**.
 *
 * Later is gone from the drawing: the path is the one plan, and a phase not reached yet is the
 * path's to show, not the board's (#311). A stored `LATER` is still read and synced — it just no
 * longer decides anything. Behind you only exists because the path decides now: cards from a phase
 * the hire has finished.
 * Left in Now they kept the current phase's band full of things already dealt with; hidden, they
 * would be gone exactly when somebody wants to look something up. So they get a band of their own
 * that arrives folded. Never stored and never sent — it is a fact about the path, not about the
 * board — which is why it sits outside {@link StoredStage}.
 */
export type BoardStage = "NOW" | "BEHIND";

/** The stages that may be read back from storage or from the server. */
const STORED_STAGES: readonly StoredStage[] = ["NOW", "LATER"];

/**
 * Every stage, in the order the board draws them. The one place that order is written down.
 *
 * Behind comes last although it is earliest in time: the board is read top down, and the top is for
 * what to do now. It is also what every "earliest first" question here wants — the stage still to
 * work through, and the card to start with, are never the finished ones.
 */
export const BOARD_STAGES: readonly BoardStage[] = ["NOW", "BEHIND"];

/** What each stage is called on screen, and the sentence under it. */
export const STAGE_LABELS: Record<BoardStage, { title: string; hint: string }> = {
  NOW: { title: "Now", hint: "Your current phase, and anything not tied to one ahead." },
  BEHIND: {
    title: "Behind you",
    hint: "From phases you've finished — kept for when you want to look something up.",
  },
};

/**
 * A stored stage, including one written before there were two of them.
 *
 * A board sequenced under the old three reads back with `NEXT` in it, and dropping the value would
 * fall back to the default — `NOW` — which is the worst of the three answers: every card somebody
 * deliberately deferred would arrive on top of the pile. `NEXT` meant "not now", and so does
 * `LATER`.
 */
function toStage(value: unknown): StoredStage | null {
  if (value === "NEXT") return "LATER";

  return isStage(value) ? value : null;
}

/** Where a stage sits in the ramp; higher means further out. */
export function stageOrder(stage: BoardStage): number {
  return BOARD_STAGES.indexOf(stage);
}

/**
 * Who put a card behind another one.
 *
 * Two different claims used to be written into the same list. "The team says you cannot touch
 * deploys before you have read the runbook" is a rule about the work; "I want to do these three in
 * this order" is one person's plan for their afternoon. Stored as bare ids they were
 * indistinguishable, so the hire's picker could quietly clear a rule the PM had written into a
 * blueprint, and nobody — not the PM, not the buddy — would ever know it had gone.
 *
 * - `TEAM` — from a card blueprint. The PM's, and the hire may not take it off.
 * - `BUDDY` — from a generated path. Named on the card so it does not look like the hire's own
 *   doing, but still theirs to clear: the buddy is an assistant, not an authority.
 * - `HIRE` — theirs, and the only kind their own controls write.
 *
 * Nothing writes `TEAM` or `BUDDY` any more: card blueprints and the generator that copied the path
 * onto the board were retired when the onboarding path became the one plan (#311). Boards arranged
 * before then still hold such edges, and they keep their meaning.
 */
export type DependencySource = "TEAM" | "BUDDY" | "HIRE";

/** One "comes after", and who said so. */
export type CardDependency = { id: string; source: DependencySource };

/** Whether the hire's own controls may take this dependency off again. */
export function isRemovableByHire(dependency: CardDependency): boolean {
  return dependency.source !== "TEAM";
}

/**
 * One card's place in the process: its stage, what it waits on, and whether it was ticked off.
 *
 * Everything is optional because a board with no structure at all is the honest starting state —
 * an entry only exists once somebody has said something about that card.
 */
export type CardStructure = {
  stage?: StoredStage;
  /**
   * Cards that have to be done before this one is worth opening.
   *
   * Ids rather than kinds, because "read the deployment runbook before you deploy" is a statement
   * about two particular cards and not about two categories. A dependency on a card that has since
   * been dismissed is dropped on read rather than blocking forever.
   */
  dependsOn?: CardDependency[];
  /**
   * Ticked off by hand, for the kinds whose completion nothing can observe.
   *
   * A note or a link is finished when the hire says it is and never before — there is no server
   * fact to consult. Kept separate from the derived completion below so a card that *is* observable
   * can never be marked done while it plainly is not.
   */
  markedDone?: boolean;
};

export type BoardStructure = {
  /** Per card id. Cards absent from here have no structure, which is a state and not a default. */
  cards: Record<string, CardStructure>;
  /** The stage a whole area sits in, so a PM can sequence twelve cards in one gesture. */
  groupStages: Record<string, StoredStage>;
};

export const EMPTY_STRUCTURE: BoardStructure = { cards: {}, groupStages: {} };

function storageKey(boardId: string): string {
  return `sprintstart:board-structure:${boardId}`;
}

type StoredStructure = {
  version: number;
  structure: unknown;
};

function isStage(value: unknown): value is StoredStage {
  return typeof value === "string" && (STORED_STAGES as readonly string[]).includes(value);
}

/**
 * One stored dependency, in either shape it has been written in.
 *
 * A bare string is what every board written before dependencies had a source holds. It reads as the
 * hire's own — never as the team's. Guessing the other way would retroactively lock every sequence
 * a hire ever dragged together, on boards where nobody can say where those sequences came from, and
 * leave them with no way out.
 *
 * A read rather than a version bump, for the reason the storage's own note gives: bumping discards
 * everything the old version wrote, which here is every stage and every hand-set tick as well.
 */
function toDependency(value: unknown): CardDependency | null {
  if (typeof value === "string") return { id: value, source: "HIRE" };
  if (typeof value !== "object" || value === null) return null;

  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  const source =
    raw.source === "TEAM" || raw.source === "BUDDY" || raw.source === "HIRE" ? raw.source : "HIRE";

  return { id: raw.id, source };
}

/** One stored card entry, with anything unrecognised dropped rather than trusted. */
function toCardStructure(value: unknown): CardStructure | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const entry: CardStructure = {};
  const stage = toStage(raw.stage);
  if (stage) entry.stage = stage;
  if (Array.isArray(raw.dependsOn)) {
    entry.dependsOn = raw.dependsOn
      .map(toDependency)
      .filter((dependency): dependency is CardDependency => dependency !== null);
  }
  if (raw.markedDone === true) entry.markedDone = true;

  return entry;
}

/**
 * The structure stored for this board, or none.
 *
 * Every entry is checked rather than trusted: this is user-writable storage, and a hand-edited or
 * half-written entry must not be able to take the board down. Storage itself can throw — a private
 * window, or a browser set to block site data — and a board that renders unsequenced is a fine
 * answer to that, so nothing here is allowed to escape.
 */
export function readBoardStructure(boardId: string): BoardStructure {
  if (!boardId) return EMPTY_STRUCTURE;

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return EMPTY_STRUCTURE;

    const parsed = JSON.parse(raw) as StoredStructure;
    if (parsed?.version !== STORAGE_VERSION) return EMPTY_STRUCTURE;

    const stored = parsed.structure as Record<string, unknown> | null;
    if (typeof stored !== "object" || stored === null) return EMPTY_STRUCTURE;

    const cards: Record<string, CardStructure> = {};
    for (const [cardId, value] of Object.entries((stored.cards as object) ?? {})) {
      const entry = toCardStructure(value);
      if (entry) cards[cardId] = entry;
    }

    const groupStages: Record<string, StoredStage> = {};
    for (const [groupId, value] of Object.entries((stored.groupStages as object) ?? {})) {
      const groupStage = toStage(value);
      if (groupStage) groupStages[groupId] = groupStage;
    }

    return { cards, groupStages };
  } catch {
    return EMPTY_STRUCTURE;
  }
}

/** Stores the structure. A storage that refuses is not a reason to lose it on screen. */
export function writeBoardStructure(boardId: string, structure: BoardStructure): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, structure } satisfies StoredStructure),
    );
  } catch {
    // Nothing to do and nothing to say: the structure still holds for this visit.
  }

  notifyBoardStorageWritten();
}

/**
 * Whether this kind of card can say for itself that it is finished.
 *
 * The distinction matters more than it looks. A checklist knows; a link never will. Marking a
 * checklist done by hand would let a hire tick off work they have not done and then be told by the
 * board that they have — so the observable kinds are observed, and only the rest are ticked.
 */
export function isSelfReporting(card: BoardCard): boolean {
  switch (card.content.kind) {
    case "CHECKLIST":
    case "ARRIVAL_STEPS":
      return true;
    case "PATH_STEP":
      // A degraded card (`reason` set) or a live step that simply has no tasks would otherwise be
      // permanently `OPEN` — zero of zero never reaches `total > 0` in `isCardDone` — which blocks
      // whatever the hire put behind it with no control anywhere to override it. Unlike `CHECKLIST`,
      // the hire cannot add items to fix that themselves: the tasks belong to the path. So a card
      // with nothing to report falls back to the hand-set tick instead of staying stuck.
      return card.content.tasks.length > 0;
    default:
      return false;
  }
}

/**
 * How much of a card is done, when the card can say — otherwise null.
 *
 * Returned as a pair rather than a percentage: "3 of 8" is a fact the hire can check against the
 * card, and a bar at 37% is not.
 */
export function cardProgress(card: BoardCard): { done: number; total: number } | null {
  const content = card.content;
  switch (content.kind) {
    case "CHECKLIST":
      return {
        done: content.items.filter((item) => item.done).length,
        total: content.items.length,
      };
    case "ARRIVAL_STEPS": {
      const total = content.steps.length;
      return { done: total - content.outstandingCount, total };
    }
    case "PATH_STEP": {
      const total = content.tasks.length;
      return { done: content.tasks.filter((task) => task.finished).length, total };
    }
    default:
      return null;
  }
}

/**
 * Whether a card counts as finished.
 *
 * Observed where it can be observed, ticked where it cannot. An empty checklist is deliberately
 * *not* done: zero of zero is a list nobody has written yet, and calling it finished would let a
 * blank card unblock everything behind it.
 */
export function isCardDone(card: BoardCard, _structure?: BoardStructure): boolean {
  // A note or a link is never "done": ticking one off by hand was only ever there to release the
  // cards waiting on it, and since piles replaced waiting nothing does. A stored tick is ignored
  // rather than honoured, so a note somebody once ticked does not stay greyed with no way back.
  if (!isSelfReporting(card)) return false;

  const progress = cardProgress(card);

  return progress !== null && progress.total > 0 && progress.done === progress.total;
}

/**
 * What the board says about one card right now.
 *
 * `BLOCKED` is the one that earns its keep: it is the difference between forty things to do and
 * six, and it is derived rather than set, so it cannot go stale against the cards it depends on.
 */
export type BoardCardStatus = "DONE" | "BLOCKED" | "OPEN";

export type CardState = {
  status: BoardCardStatus;
  stage: BoardStage;
  /** The cards this one is still waiting on, in board order. Empty unless `status` is BLOCKED. */
  blockedBy: BoardCard[];
  /**
   * The card put in front of this one, done or not.
   *
   * Distinct from `blockedBy`, which drops predecessors that are finished — right for the badge,
   * wrong for the control: a hire who finished the predecessor should still see the sequence they
   * arranged rather than watch the picker forget it.
   */
  predecessorId: string | null;
  /** Who put that card in front of this one, or null when nothing is. */
  predecessorSource: DependencySource | null;
  progress: { done: number; total: number } | null;
};

/**
 * The state of every card on the board, keyed by id.
 *
 * Computed in one pass over the whole board rather than per card, because "blocked" is a question
 * about *other* cards and a per-card hook would re-derive the same map once per card. Dependencies
 * on cards that are no longer on the board are ignored: a hire who dismissed the runbook card is
 * not thereby blocked forever on a card nobody can see.
 *
 * The default stage is `NOW`. A board with no structure at all should read as an ordinary board and
 * not as one where everything has been deferred.
 *
 * `stageOf` decides the stage when given — the board passes the path's answer (`pathStages.ts`).
 * Without it everything is Now: a stored stage is kept for sync but no longer drawn.
 */
export function deriveCardStates(
  cards: BoardCard[],
  structure: BoardStructure,
  stageOf?: (card: BoardCard) => BoardStage,
): Map<string, CardState> {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const done = new Map(cards.map((card) => [card.id, isCardDone(card, structure)]));

  const states = new Map<string, CardState>();
  for (const card of cards) {
    const entry = structure.cards[card.id];
    const stage = stageOf ? stageOf(card) : "NOW";
    const progress = cardProgress(card);
    // Dependencies on cards that have left the board are dropped: a hire who dismissed the runbook
    // card is not thereby blocked forever on a card nobody can see.
    const predecessor = (entry?.dependsOn ?? []).find((dependency) => byId.has(dependency.id));
    const predecessorId = predecessor?.id ?? null;
    // Carried out with the id so the control can ask "may I offer to change this" without going
    // back to the structure — the same reason every other question about a card is answered here.
    const predecessorSource = predecessor?.source ?? null;

    if (done.get(card.id)) {
      states.set(card.id, {
        status: "DONE",
        stage,
        blockedBy: [],
        predecessorId,
        predecessorSource,
        progress,
      });
      continue;
    }

    // Nothing blocks any more: a stored "comes after" is a card's place in a pile, not a lock on it.
    // See `restack`. `BLOCKED` stays in the type only for boards drawn from older data in tests.
    states.set(card.id, {
      status: "OPEN",
      stage,
      blockedBy: [],
      predecessorId,
      predecessorSource,
      progress,
    });
  }

  return states;
}

/**
 * The stage the hire is actually on: the earliest one that still has something to do.
 *
 * Not "the earliest stage that exists" — a board whose `NOW` cards are all finished should move the
 * hire on rather than showing them a wall of ticks. Blocked cards count as work: they are in this
 * stage and they are not done, so the stage is not finished either.
 *
 * Falls back to the last stage when everything is done, so the focus view has something to show
 * rather than collapsing to nothing at the moment of finishing.
 */
export function currentStage(states: Map<string, CardState>): BoardStage {
  for (const stage of BOARD_STAGES) {
    for (const state of states.values()) {
      if (state.stage === stage && state.status !== "DONE") return stage;
    }
  }

  return BOARD_STAGES[BOARD_STAGES.length - 1];
}

/**
 * Makes `cardId` wait on `blockerId`, or stops it waiting.
 *
 * Cycles are refused rather than stored: two cards that block each other block forever, and the
 * hire has no way to see why. The check walks the existing edges from the proposed blocker — if it
 * can already reach the card being blocked, adding this edge would close a loop.
 *
 * `source` says who is claiming it, and only matters on the way out: a `TEAM` edge is not removed
 * by asking. See {@link DependencySource}.
 */
export function setDependency(
  structure: BoardStructure,
  cardId: string,
  blockerId: string,
  depends: boolean,
  source: DependencySource = "HIRE",
): BoardStructure {
  const existing = structure.cards[cardId]?.dependsOn ?? [];

  if (!depends) {
    return {
      ...structure,
      cards: {
        ...structure.cards,
        [cardId]: {
          ...structure.cards[cardId],
          // A rule the team wrote survives being asked to go. The hire's controls never ask —
          // they offer no way to — but the generator re-running is another matter, and a rule
          // that could be cleared by anything that happened to call this would not be one.
          dependsOn: existing.filter(
            (dependency) => dependency.id !== blockerId || !isRemovableByHire(dependency),
          ),
        },
      },
    };
  }

  if (cardId === blockerId || existing.some((dependency) => dependency.id === blockerId)) {
    return structure;
  }
  if (reaches(structure, blockerId, cardId)) return structure;

  return {
    ...structure,
    cards: {
      ...structure.cards,
      [cardId]: {
        ...structure.cards[cardId],
        dependsOn: [...existing, { id: blockerId, source }],
      },
    },
  };
}

/**
 * Puts a card on a pile, or takes it off one — what the board's "Pile" control does.
 *
 * A pile is stored the way a sequence used to be: each card after the first names the one before
 * it (`dependsOn`), and `cardStacks.ts` folds such a run into one pile. Storing it that way keeps it
 * in the arrangement that already syncs, with no new field on the wire. What it no longer means is
 * "wait for": a card in a pile is just a card lying under another one.
 *
 * - **Off its pile:** whatever lay after it now lies after whatever was before it, so taking out the
 *   middle card closes the gap instead of splitting the pile in two.
 * - **Under a card:** it goes directly under the target, and whatever lay under the target now lies
 *   under it. The pile's top card stays on top, and "under X" means exactly that.
 *
 * Every "comes after" on the card is replaced, including one a team blueprint once wrote: it used
 * to be a rule, and nothing enforces it any more.
 */
export function restack(
  structure: BoardStructure,
  cardIds: readonly string[],
  cardId: string,
  targetId: string | null,
  /**
   * A whole run to move instead of the one card, in pile order, `cardId` first — what dragging a
   * closed pile does. The run keeps its own order; only its ends are re-linked.
   */
  carry: readonly string[] = [cardId],
): BoardStructure {
  const known = new Set(cardIds);
  const block = new Set(carry);
  if (targetId && block.has(targetId)) return structure;

  const first = carry[0] ?? cardId;
  const last = carry[carry.length - 1] ?? cardId;
  const edge = (from: BoardStructure, id: string) =>
    (from.cards[id]?.dependsOn ?? []).find((dependency) => known.has(dependency.id));
  const before = (from: BoardStructure, id: string) => edge(from, id)?.id ?? null;
  // The moved card's edge is the hire's doing; a neighbour that only closes the gap keeps whoever
  // put it there — a PM's or the buddy's pile does not turn into the hire's because a card left it.
  const placeAfter = (
    from: BoardStructure,
    id: string,
    after: string | null,
    source = edge(from, id)?.source ?? "HIRE",
  ): BoardStructure => ({
    ...from,
    cards: {
      ...from.cards,
      [id]: { ...from.cards[id], dependsOn: after ? [{ id: after, source }] : [] },
    },
  });

  let next = structure;
  const previous = before(next, first);
  for (const other of cardIds) {
    if (!block.has(other) && before(next, other) === last) next = placeAfter(next, other, previous);
  }
  next = placeAfter(next, first, null);

  if (!targetId || !known.has(targetId)) return next;

  // Whatever lay directly under the target now lies under what goes in between.
  for (const other of cardIds) {
    if (!block.has(other) && before(next, other) === targetId) next = placeAfter(next, other, last);
  }

  return placeAfter(next, first, targetId, "HIRE");
}

/** Whether `from` already waits on `target`, directly or through other cards. */
function reaches(structure: BoardStructure, from: string, target: string): boolean {
  const seen = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(structure.cards[current]?.dependsOn ?? []).map((dependency) => dependency.id));
  }

  return false;
}

/** Forgets everything said about cards that are no longer on the board. */
export function pruneStructure(structure: BoardStructure, cardIds: Set<string>): BoardStructure {
  const cards: Record<string, CardStructure> = {};
  for (const [cardId, entry] of Object.entries(structure.cards)) {
    if (!cardIds.has(cardId)) continue;
    cards[cardId] = {
      ...entry,
      dependsOn: entry.dependsOn?.filter((dependency) => cardIds.has(dependency.id)),
    };
  }

  return { ...structure, cards };
}
