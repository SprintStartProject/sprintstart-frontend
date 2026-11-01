/**
 * How long the board ignores further reordering after a move.
 *
 * A drag reports on every frame, but the re-flow it triggers takes a moment to land — and measuring
 * the new positions before they exist makes the next frame move again. Roughly the length of the
 * layout animation, so the next decision is made against where things actually are. Taken from the
 * dashboard, which learned it the same way.
 */
export const MOVE_COOLDOWN_MS = 160;

/**
 * How long a dragged card has to rest over the middle of another before letting go piles it there.
 *
 * Long enough that passing over a card on the way somewhere else never does it, short enough that
 * somebody who means it does not feel the board hesitating. The edge of a card still moves cards
 * aside the way it always did — after {@link REORDER_DWELL_MS}, so the middle is reachable at all.
 */
export const PILE_DWELL_MS = 350;

/**
 * How long a dragged card rests over the edge of another before the two trade places.
 *
 * An instant swap would make the middle of a card unreachable: the card would move aside the moment
 * its edge was touched. A beat is enough to tell "passing through" from "this is the
 * place" — as long as the beat only counts while the pointer is still (see {@link STILL_PX}).
 */
export const REORDER_DWELL_MS = 150;

/**
 * How far the pointer may drift over a card's edge and still count as resting.
 *
 * Reordering waits for the pointer to *stop*, not merely to stay over the edge. Timing the zone
 * alone meant the edge band — which every drag towards a card's middle crosses first — moved the
 * card aside on the way in whenever the crossing took longer than a beat, and the pile it was
 * headed for slid out from under it. A hand held still jitters a few pixels; anything more is the
 * hire still on their way.
 */
export const STILL_PX = 8;

/** Whether a point is in the middle of an element — the half of it, either way, around its centre. */
export function inMiddle(element: HTMLElement, x: number, y: number, reach = 1 / 4): boolean {
  const rect = element.getBoundingClientRect();
  const dx = Math.abs(x - (rect.left + rect.width / 2));
  const dy = Math.abs(y - (rect.top + rect.height / 2));

  return dx <= rect.width * reach && dy <= rect.height * reach;
}

/**
 * How far the middle reaches once the pointer is in it — further than the way in.
 *
 * Without the extra room a hand resting near the middle's border flickered between middle and edge,
 * and every flicker started the wait over, so the pile never lit.
 */
export const MIDDLE_HOLD_REACH = 0.4;

/** Where a dragged card counts as being: its own middle, which is what the eye is following. */
export function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * A drag's release point in the same space as `getBoundingClientRect`.
 *
 * Framer reports where a pointer was let go in page coordinates, which only agree with an
 * element's box while the page is scrolled to the top — so on a board scrolled down far enough
 * to see the areas, hit-testing without this would always miss.
 */
export function toViewport(point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x - window.scrollX, y: point.y - window.scrollY };
}

/** Which part of another card a dragged one is resting on. */
export type RestZone = "middle" | "edge";

/** The card and the part of it the dragged card is resting on, and where the rest began. */
export type Resting = { id: string; zone: RestZone; x: number; y: number };

/** Whether the pointer is still where it last rested in the middle of this very card. */
export function isHolding(resting: Resting | null, candidateId: string): boolean {
  return resting?.id === candidateId && resting.zone === "middle";
}

/** The middle of a card, or its edge — and the middle only when there is somewhere to pile. */
export function restZone(
  element: HTMLElement,
  point: { x: number; y: number },
  holding: boolean,
  canPile: boolean,
): RestZone {
  return canPile && inMiddle(element, point.x, point.y, holding ? MIDDLE_HOLD_REACH : undefined)
    ? "middle"
    : "edge";
}

/**
 * Whether the pointer is still resting where it was.
 *
 * The middle only has to be *stayed in*: it is small and deliberate, and asking a hand to hold
 * still inside it as well made piling feel broken. The edge has to be rested on, or every drag
 * towards a middle would shuffle the cards on its way in.
 */
export function isStillResting(
  resting: Resting | null,
  candidateId: string,
  zone: RestZone,
  point: { x: number; y: number },
): boolean {
  if (resting?.id !== candidateId || resting.zone !== zone) return false;

  return zone === "middle" || Math.hypot(point.x - resting.x, point.y - resting.y) <= STILL_PX;
}
