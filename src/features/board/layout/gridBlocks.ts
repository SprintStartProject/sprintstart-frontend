import type { BoardCard } from "../types";
import { groupOf, type BoardGroup } from "./boardGroups";
import { BOARD_STAGES, type BoardStage, type CardState } from "./boardStructure";
import { spansFullWidth } from "./cardWidths";
import { GRID_COLUMNS, sizeOf, WIDTH_SPAN, type CardSizes } from "./cardSizes";
import type { CardStack } from "./cardStacks";

/**
 * One thing that sits in a column or inside an area: a card, or a sequence spread out.
 *
 * A spread-out stack stays one item rather than becoming its members. Letting the members loose
 * into the packing would deal them into different columns and interleave them with whatever else
 * was around — which is the opposite of what opening a pile is for. You open it to see the run, so
 * the run has to still look like a run.
 */
export type Item =
  | { kind: "card"; key: string; card: BoardCard; cards: BoardCard[] }
  | { kind: "stack"; key: string; stack: CardStack; cards: BoardCard[] };

/** One thing the board lays out: an item, or a named area holding items. */
export type Block =
  Item | { kind: "group"; key: string; group: BoardGroup; cards: BoardCard[]; items: Item[] };

/** One stage of the board, with everything filed under it. */
export type Band = { stage: BoardStage; blocks: Block[]; total: number; remaining: number };

/** A list of cards as items, with the members of any open stack folded back into one. */
function toItems(
  cards: BoardCard[],
  stacks: Map<string, CardStack> | undefined,
  expandedStackIds: ReadonlySet<string> | undefined,
): Item[] {
  const items: Item[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    if (seen.has(card.id)) continue;

    const stack = stacks?.get(card.id);
    if (stack && expandedStackIds?.has(stack.rootId)) {
      const members = cards.filter((member) => stack.memberIds.includes(member.id));
      members.forEach((member) => seen.add(member.id));
      items.push({ kind: "stack", key: `stack-${stack.rootId}`, stack, cards: members });
      continue;
    }

    items.push({ kind: "card", key: `card-${card.id}`, card, cards: [card] });
  }

  return items;
}

/**
 * The board as blocks, in board order: one card, or one named area with its cards inside it.
 *
 * An area takes the place of its first member, so grouping cards moves them together to where the
 * earliest of them already sat rather than to the end. Everything is built from `board.cards` in
 * order, which is what keeps the grouping a *display* decision — the order underneath is
 * untouched, and ungrouping puts every card back exactly where it was.
 */
export function buildBlocks(
  cards: BoardCard[],
  groups: BoardGroup[],
  stacks: Map<string, CardStack> | undefined,
  expandedStackIds: ReadonlySet<string> | undefined,
): Block[] {
  const built: Block[] = [];
  const placed = new Set<string>();

  for (const card of cards) {
    if (placed.has(card.id)) continue;

    const group = groupOf(groups, card.id);
    if (group) {
      // Members in the board's own order, whatever order they were added to the area in.
      const members = cards.filter((member) => group.cardIds.includes(member.id));
      members.forEach((member) => placed.add(member.id));
      built.push({
        kind: "group",
        key: `group-${group.id}`,
        group,
        cards: members,
        items: toItems(members, stacks, expandedStackIds),
      });
      continue;
    }

    const stack = stacks?.get(card.id);
    if (stack && expandedStackIds?.has(stack.rootId)) {
      const members = cards.filter((member) => stack.memberIds.includes(member.id));
      members.forEach((member) => placed.add(member.id));
      built.push({ kind: "stack", key: `stack-${stack.rootId}`, stack, cards: members });
      continue;
    }

    built.push({ kind: "card", key: `card-${card.id}`, card, cards: [card] });
  }

  return built;
}

/**
 * How wide a block is, in columns of the board's grid.
 *
 * The card's own size, clamped to what the grid it sits in actually has: a card pulled wide
 * inside an area two columns across is two columns across, not four sticking out of its own
 * container. A diagram is wide whatever anybody chose, because half of a half-width picture is
 * not a picture.
 *
 * An area is as wide as the widest thing in it, and never narrower than two — an area of one
 * narrow note would otherwise be a tinted box the size of a stamp with a name in it.
 */
export function spanOf(block: Block, columns: number, cardSizes: CardSizes | undefined): number {
  const widest = block.cards.reduce(
    (span, card) =>
      Math.max(
        span,
        spansFullWidth(card) ? GRID_COLUMNS : WIDTH_SPAN[sizeOf(cardSizes, card.id).width],
      ),
    1,
  );
  const wanted = block.kind === "group" ? Math.max(widest, 2) : widest;

  return Math.min(wanted, columns);
}

/** Which stages a set of cards covers, earliest first. */
export function stagesOf(
  cards: BoardCard[],
  states: Map<string, CardState> | undefined,
): BoardStage[] {
  return BOARD_STAGES.filter((stage) =>
    cards.some((card) => (states?.get(card.id)?.stage ?? "NOW") === stage),
  );
}

/**
 * The areas with nothing drawn in them.
 *
 * They have no box in the grid, which is built by walking the cards, so while the board is being
 * arranged they are given a box of their own to be dropped into: the only way a first card gets
 * into an empty area.
 */
export function emptyGroups(cards: BoardCard[], groups: BoardGroup[]): BoardGroup[] {
  return groups.filter((group) => !cards.some((card) => group.cardIds.includes(card.id)));
}

/**
 * The areas that carry stages of their own: a named set of cards that is not all due at once.
 *
 * These are not filed into a band, they are banded *inside*. A team's blueprints are the case
 * this exists for — one set somebody wrote in one sitting, deliberately spread across the stages.
 * Filing it under "Now" because its earliest card is due now would put a heading saying "Now"
 * around cards already behind the hire, and splitting it across the bands would take a thing with
 * a name and scatter it. So it keeps its name, keeps its cards, and folds by stage within itself
 * — the same fold, one level in.
 *
 * They lead, above the bands. An area is a decision somebody made about what belongs together,
 * and the bands are the board's own answer to when; the named thing goes first.
 */
export function spanningGroups(
  blocks: Block[],
  states: Map<string, CardState> | undefined,
): Block[] {
  return blocks.filter(
    (block) => block.kind === "group" && stagesOf(block.cards, states).length > 1,
  );
}

/**
 * The board's blocks filed under their stage, in stage order.
 *
 * **An area goes in the band of its earliest card**, whole, rather than being split across three.
 * Two grouping axes have to agree about which one owns a block, and an area is a thing somebody
 * named and expects to find in one piece — the same rule the section bar already uses for an
 * area's stage, so the two never disagree.
 *
 * Empty bands are not drawn. A board where nothing is due later should not carry a heading saying
 * so; the fold exists to hold cards, and a band with none holds a sentence nobody needs.
 */
export function buildBands(
  blocks: Block[],
  spanning: Block[],
  states: Map<string, CardState>,
): Band[] {
  const stageOf = (block: Block): BoardStage => stagesOf(block.cards, states)[0] ?? "NOW";
  const rest = blocks.filter((block) => !spanning.includes(block));

  const filled = BOARD_STAGES.map((stage) => {
    const own = rest.filter((block) => stageOf(block) === stage);
    const cards = own.flatMap((block) => block.cards);

    return {
      stage,
      blocks: own,
      total: cards.length,
      remaining: cards.filter((card) => states.get(card.id)?.status !== "DONE").length,
    };
  }).filter((band) => band.total > 0);

  // One band is not a band, it is a heading over the whole board saying what everything on it
  // already says. A board where nothing has been sequenced yet is exactly that board, and it
  // should look the way it did before there were bands at all.
  //
  // Except "Behind you": when a filter, a section or a finished path leaves only finished cards
  // on screen, dropping the heading drew them as if they were current, and the band looked gone.
  return filled.length > 1 || filled.some((band) => band.stage === "BEHIND") ? filled : [];
}

/**
 * Moves a whole block — a named area, or the diagram that owns its row — past its neighbour.
 *
 * An area has no position of its own: it sits where its earliest member sits. So moving one is
 * moving all of its cards at once, which is what this does — put a block where another block is
 * and send the order that falls out. Nothing about the grouping changes, only where its cards are
 * in the board.
 */
export function orderAfterBlockMove(
  blocks: Block[],
  ids: string[],
  from: number,
  to: number,
): string[] | null {
  if (from === to || to < 0 || to >= blocks.length) return null;

  // Expressed over the *whole* order, the way `moveTo` is, and never over the blocks on screen.
  // Rebuilding the order from the blocks was right only while arranging began by clearing every
  // cut — narrowed, it dropped every card the view was hiding, which is the one thing a reorder
  // must never do.
  //
  // A block is a set of cards that need not be contiguous in the board's own order: an area
  // gathers its members from wherever they sit. So the move is "take these out, and put them
  // back beside the block they were aimed at" rather than a splice of one element.
  const moved = blocks[from].cards.map((card) => card.id);
  if (moved.length === 0) return null;

  const movedIds = new Set(moved);
  const rest = ids.filter((id) => !movedIds.has(id));

  // Past the target's far edge going down, in front of its near edge going up — which is what
  // stepping a block past its neighbour has always meant.
  const targetAt = blocks[to].cards
    .map((card) => rest.indexOf(card.id))
    .filter((index) => index !== -1);
  if (targetAt.length === 0) return null;

  const at = from < to ? Math.max(...targetAt) + 1 : Math.min(...targetAt);

  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

/**
 * The board's grid, in pixels.
 *
 * `ROW_UNIT` is deliberately tiny: a card is given as many of these rows as it measures, so the
 * unit is the resolution of the layout rather than a row height anybody sees. Small enough that a
 * card is never rounded up by more than a few pixels, large enough that the browser is not laying
 * out a thousand tracks.
 */
export const ROW_UNIT = 8;

/** The gap between cards. In JS because the row maths has to use the same number. */
export const GRID_GAP = 16;
