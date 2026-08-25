import type { BoardCard } from "../types";

/**
 * Roughly how tall a card will be, in units of about 40px.
 *
 * Estimated from the content rather than measured, on purpose. Measuring means rendering, reading
 * heights back, and re-packing — a loop that reflows the board on every load and fights every
 * resize. An estimate is stable, runs before the first paint, and is only ever used to decide which
 * column a card starts in; being a little wrong costs a slightly uneven column, not a broken one.
 */
export function cardWeight(card: BoardCard, collapsed: boolean): number {
  // A folded card is its header, whatever it holds.
  if (collapsed) return 1.6;

  const content = card.content;
  switch (content.kind) {
    case "ARRIVAL_STEPS":
      return 4 + content.steps.length * 1.6;
    case "OPEN_PULL_REQUESTS":
      return 3 + content.pullRequests.length * 1.4;
    case "SUGGESTED_TASKS":
      return 2.5 + content.tasks.length * 2.4;
    case "COMPETENCY_PROGRESS":
      return 3 + (content.held.length + content.inProgress.length) * 0.7;
    case "CHECKLIST":
      return 3 + content.items.length;
    case "NOTE":
      return 2 + content.text.split("\n").length * 0.6;
    case "CURRENT_TASK":
      return 4;
    case "MEMORY_RECAP":
      return 5;
    case "PATH_TO_FIRST_CONTRIBUTION":
      return 4;
    case "LINK":
      return 2.5;
    case "DIAGRAM":
      return 10;
    default:
      return 3;
  }
}

/**
 * Cards a column is too narrow for: the picture needs the width more than the packing does.
 *
 * A full-width card takes a row of its own, which is also what keeps the packing honest — it is a
 * break in the flow at exactly the point the card sits in the board's order, so lifting it to full
 * width never moves it.
 */
export function spansFullWidth(card: BoardCard): boolean {
  return card.content.kind === "DIAGRAM";
}

/**
 * Deals cards into columns, shortest column first, keeping the board's order within each.
 *
 * The greedy pass is what closes the gaps a row grid leaves: a one-line note does not have to wait
 * for the tall card beside it to finish. Reading runs down a column and then over to the next, the
 * way a newspaper does — and on a phone there is one column, so the order is exactly the hire's.
 */
export function packIntoColumns(
  cards: BoardCard[],
  columns: number,
  weightOf: (card: BoardCard) => number,
): BoardCard[][] {
  const packed: BoardCard[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);

  for (const card of cards) {
    let shortest = 0;
    for (let index = 1; index < columns; index += 1) {
      if (heights[index] < heights[shortest]) shortest = index;
    }
    packed[shortest].push(card);
    heights[shortest] += weightOf(card);
  }

  return packed;
}
