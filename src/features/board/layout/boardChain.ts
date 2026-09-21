import { chainFor, type GraphRuleNode } from "../../graph-diagram/graphLayout.ts";
import { cardName } from "./cardNames.ts";
import type { BoardCardKind } from "../types.ts";
import type {
  BoardCardStatus,
  BoardStructure,
  CardState,
  DependencySource,
} from "./boardStructure.ts";
import type { BoardCard } from "../types.ts";

/**
 * The board's "comes after" relation as a graph, so it can be drawn instead of listed.
 *
 * The board answers *that* a card is blocked, in one line naming what it waits on. It has never
 * been able to answer the question underneath — how far back the chain goes, and whether the thing
 * at the far end is something the hire can do anything about. Two cards deep, the line "first
 * finish Read the runbook" is true and useless: the runbook is itself waiting on something.
 *
 * The shape here is the one every graph in this app is drawn from, plus the one fact a board has
 * that a Blueprint does not: who put each arrow there.
 */
export type BoardChainNode = GraphRuleNode & {
  /** What the card is called, resolved once here rather than by whatever draws it. */
  title: string;
  /** Its kind, so the picture can wear the same glyph the card itself does on the board. */
  kind: BoardCardKind;
  status: BoardCardStatus;
  /** Who set each incoming arrow, by the id of the card it comes from. */
  sourceByBlockerId: Record<string, DependencySource>;
};

/**
 * Every card on the board as a graph node, carrying who set each of its arrows.
 *
 * Positions are deliberately absent. A board card has no place on a canvas and never will — it is
 * arranged as a grid, not as a diagram — so the drawing lays the chain out by prerequisite every
 * time it is opened. That is the case the layout is best at and the only honest one: there is no
 * arrangement of these to preserve.
 *
 * Arrows to cards that have left the board are dropped, for the same reason `deriveCardStates`
 * drops them: a hire who dismissed the runbook card is not thereby waiting on a card nobody can
 * see, and drawing an arrow into nothing would say otherwise.
 */
export function boardChainNodes(
  cards: readonly BoardCard[],
  structure: BoardStructure,
  states: Map<string, CardState>,
): BoardChainNode[] {
  const present = new Set(cards.map((card) => card.id));

  return cards.map((card) => {
    const dependencies = (structure.cards[card.id]?.dependsOn ?? []).filter((dependency) =>
      present.has(dependency.id),
    );

    return {
      id: card.id,
      title: cardName(card),
      kind: card.content.kind,
      status: states.get(card.id)?.status ?? "OPEN",
      graphX: null,
      graphY: null,
      blockerIds: dependencies.map((dependency) => dependency.id),
      sourceByBlockerId: Object.fromEntries(
        dependencies.map((dependency) => [dependency.id, dependency.source]),
      ),
    };
  });
}

/**
 * Just the run one card belongs to: everything it waits on, everything waiting on it, and itself.
 *
 * The whole board as a picture would be the grid again with arrows over it — forty cards, most of
 * them unrelated to the one somebody clicked. The question being asked is about *this* card, so
 * what is drawn is its chain and nothing else.
 */
export function chainAround(nodes: readonly BoardChainNode[], cardId: string): BoardChainNode[] {
  const chain = chainFor(nodes, cardId);
  return nodes.filter((node) => chain.has(node.id));
}
