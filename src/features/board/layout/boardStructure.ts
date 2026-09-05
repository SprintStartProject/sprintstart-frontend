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
 * Local storage, the same bargain the folded, pinned and grouped cards make: there is no endpoint
 * for it yet, and a structure that follows the machine is closer to right than one that does not
 * exist.
 *
 * TODO(backend): stage, dependencies and the done-marks belong on the board row once
 * `POST /me/board/structure` exists — a hire who opens their board on a second machine should not
 * find their process flattened. Moving it means replacing {@link readBoardStructure} and
 * {@link writeBoardStructure} and nothing else; every consumer reads the derived
 * {@link BoardCardStatus}, never the storage.
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
 */
export type BoardStage = "NOW" | "LATER";

/** Every stage, earliest first. The one place the order of the ramp is written down. */
export const BOARD_STAGES: readonly BoardStage[] = ["NOW", "LATER"];

/** What each stage is called on screen, and the sentence under it. */
export const STAGE_LABELS: Record<BoardStage, { title: string; hint: string }> = {
  NOW: { title: "Now", hint: "What to work through today." },
  LATER: { title: "Later", hint: "Not yet — it will be here when it is." },
};

/**
 * A stored stage, including one written before there were two of them.
 *
 * A board sequenced under the old three reads back with `NEXT` in it, and dropping the value would
 * fall back to the default — `NOW` — which is the worst of the three answers: every card somebody
 * deliberately deferred would arrive on top of the pile. `NEXT` meant "not now", and so does
 * `LATER`.
 */
function toStage(value: unknown): BoardStage | null {
  if (value === "NEXT") return "LATER";

  return isStage(value) ? value : null;
}

/** Where a stage sits in the ramp; higher means further out. */
export function stageOrder(stage: BoardStage): number {
  return BOARD_STAGES.indexOf(stage);
}

/**
 * One card's place in the process: its stage, what it waits on, and whether it was ticked off.
 *
 * Everything is optional because a board with no structure at all is the honest starting state —
 * an entry only exists once somebody has said something about that card.
 */
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
 */
export type DependencySource = "TEAM" | "BUDDY" | "HIRE";

/** One "comes after", and who said so. */
export type CardDependency = { id: string; source: DependencySource };

/** Whether the hire's own controls may take this dependency off again. */
export function isRemovableByHire(dependency: CardDependency): boolean {
  return dependency.source !== "TEAM";
}

export type CardStructure = {
  stage?: BoardStage;
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
  groupStages: Record<string, BoardStage>;
};

export const EMPTY_STRUCTURE: BoardStructure = { cards: {}, groupStages: {} };

function storageKey(boardId: string): string {
  return `sprintstart:board-structure:${boardId}`;
}

type StoredStructure = {
  version: number;
  structure: unknown;
};

function isStage(value: unknown): value is BoardStage {
  return typeof value === "string" && (BOARD_STAGES as readonly string[]).includes(value);
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

    const groupStages: Record<string, BoardStage> = {};
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
    case "PATH_TO_FIRST_CONTRIBUTION":
      return true;
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
    case "PATH_TO_FIRST_CONTRIBUTION": {
      const total = content.moments.length;
      return { done: content.moments.filter((moment) => moment.reachedAt !== null).length, total };
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
export function isCardDone(card: BoardCard, structure: BoardStructure): boolean {
  if (!isSelfReporting(card)) return structure.cards[card.id]?.markedDone === true;

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
 */
export function deriveCardStates(
  cards: BoardCard[],
  structure: BoardStructure,
): Map<string, CardState> {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const done = new Map(cards.map((card) => [card.id, isCardDone(card, structure)]));

  const states = new Map<string, CardState>();
  for (const card of cards) {
    const entry = structure.cards[card.id];
    const stage = entry?.stage ?? "NOW";
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

    const blockedBy = (entry?.dependsOn ?? [])
      .map((dependency) => byId.get(dependency.id))
      .filter((blocker): blocker is BoardCard => blocker !== undefined && !done.get(blocker.id));

    states.set(card.id, {
      status: blockedBy.length > 0 ? "BLOCKED" : "OPEN",
      stage,
      blockedBy,
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

/** Sets one card's stage, or clears it back to the default. */
export function setCardStage(
  structure: BoardStructure,
  cardId: string,
  stage: BoardStage,
): BoardStructure {
  return {
    ...structure,
    cards: { ...structure.cards, [cardId]: { ...structure.cards[cardId], stage } },
  };
}

/** Puts every card of an area in one stage — the gesture that makes sequencing forty cards bearable. */
export function setGroupStage(
  structure: BoardStructure,
  groupId: string,
  cardIds: string[],
  stage: BoardStage,
): BoardStructure {
  const cards = { ...structure.cards };
  for (const cardId of cardIds) cards[cardId] = { ...cards[cardId], stage };

  return { cards, groupStages: { ...structure.groupStages, [groupId]: stage } };
}

/** Marks a card done, or un-marks it. Ignored for kinds that report their own completion. */
export function setMarkedDone(
  structure: BoardStructure,
  cardId: string,
  markedDone: boolean,
): BoardStructure {
  return {
    ...structure,
    cards: { ...structure.cards, [cardId]: { ...structure.cards[cardId], markedDone } },
  };
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
 * Takes off every dependency the hire's own controls are allowed to take off.
 *
 * The picker offers one predecessor at a time, so choosing a new one means dropping the last — and
 * "the last" has to mean the last *they* set. A rule the team wrote into a blueprint is not that
 * control's to drop, and one card can carry both.
 *
 * Here rather than in the hook that calls it because it is the same rule {@link setDependency}
 * applies on removal, and a rule about who may unsay what belongs with the thing being said.
 */
export function clearHireDependencies(structure: BoardStructure, cardId: string): BoardStructure {
  const kept = (structure.cards[cardId]?.dependsOn ?? []).filter(
    (dependency) => !isRemovableByHire(dependency),
  );

  return {
    ...structure,
    cards: { ...structure.cards, [cardId]: { ...structure.cards[cardId], dependsOn: kept } },
  };
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
