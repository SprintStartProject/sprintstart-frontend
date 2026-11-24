import type { DashboardWidgetSize } from "../../layout/types";
import { SEVERITY_ORDER } from "./gapsKit";
import type { KnowledgeGap } from "./gapsKit";

/**
 * Gaps listed per size, chosen against the cell's fixed height rather than the data.
 *
 * The usual case is one — a user owns a component, that component is missing a runbook — so
 * these are the ceiling for the unusual case, not the target. Anything past them is counted
 * in a footer line instead, which is the only honest way to end a list that cannot grow.
 */
export const VISIBLE_COUNT: Record<DashboardWidgetSize, number> = {
  small: 1,
  medium: 3,
  wide: 4,
};

/** Missing types spelled out before the rest collapse into a `+n` chip. */
export const VISIBLE_TYPE_COUNT: Record<DashboardWidgetSize, number> = {
  small: 2,
  medium: 3,
  wide: 4,
};

/** How many "already documented" types the feature layout lists before collapsing them. */
export const PRESENT_TYPE_COUNT = 4;

/** Worst first, then by component name — the order the knowledge-gaps pages use. */
export function worstFirst(gaps: readonly KnowledgeGap[]): KnowledgeGap[] {
  return [...gaps].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.component.localeCompare(b.component),
  );
}

/**
 * The gaps this card is a to-do list of.
 *
 * The overview is the project's full component roster, the covered ones included. This card's
 * title, counts and chips all say "missing", so a component with nothing missing is not a
 * smaller item on it, it is not an item at all. Filtering also keeps the empty state reachable:
 * left in, a member whose components are all documented would get cards reading "0 documents
 * missing" instead of "Nothing assigned to you".
 */
export function openGaps(gaps: readonly KnowledgeGap[]): KnowledgeGap[] {
  return worstFirst(gaps.filter((gap) => gap.severity !== "covered"));
}

export function documentsMissing(gaps: readonly KnowledgeGap[]): number {
  return gaps.reduce((total, gap) => total + gap.missingTypes.length, 0);
}

export function missingLabel(count: number): string {
  return count === 1 ? "1 document missing" : `${count} documents missing`;
}

/** `firstIngested` is optional and absent when a component has no ingested artifact yet. */
export function firstIngestedOf(gap: KnowledgeGap): string {
  return gap.firstIngested ?? gap.lastIngested;
}

/**
 * Everyone else on the hook for this component. The caller is in `owners` by definition — that
 * is why the gap is on their dashboard — so they are never their own "shared with".
 */
export function coOwnerNames(gap: KnowledgeGap, currentUserId: string | null): string {
  return gap.owners
    .filter((owner) => owner.id !== currentUserId)
    .map((owner) => `${owner.firstname} ${owner.lastname}`)
    .join(", ");
}

type WidePlan = {
  /** The gaps that get a card of their own. */
  celled: KnowledgeGap[];
  /** How many gaps the last cell reports instead of showing. */
  remaining: number;
  gridClass: string;
  /** Cells that own a whole row have height to spare, so their cards get the fuller form. */
  rich: boolean;
};

/**
 * The full-width list is a fixed grid of at most four cells. When there are more gaps than cells
 * the last one becomes a counter instead of a card, so the overflow is reported inside the grid
 * rather than on a line beneath it — a line there had to come out of the rows' height, which is
 * what clipped the bottom row.
 *
 * The grid takes the shape that fills the row: two or three cells get a single row of two or
 * three columns, four get a 2x2. A fixed 2x2 would have stranded a pair in the top half, and
 * three cells in a 2x2 leaves a hole in the bottom right.
 */
export function planWideGrid(gaps: readonly KnowledgeGap[]): WidePlan {
  const limit = VISIBLE_COUNT.wide;
  const celled = gaps.length > limit ? gaps.slice(0, limit - 1) : gaps.slice(0, limit);
  const remaining = gaps.length - celled.length;
  const cells = celled.length + (remaining > 0 ? 1 : 0);

  const gridClass =
    cells <= 2
      ? "grid-cols-2 grid-rows-1"
      : cells === 3
        ? "grid-cols-3 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return { celled, remaining, gridClass, rich: cells <= 3 };
}

type PressInput = {
  isPressable: boolean;
  canOpenDrawer: boolean;
  unseenCount: number;
};

/**
 * What the card says about being pressed. The card is `role="button"`, so the label is all a
 * screen reader gets of it: everything the "New" marker means has to be said here.
 */
export function pressLabels(input: PressInput): { actionLabel?: string; actionText: string } {
  const actionText = input.canOpenDrawer ? "Open your knowledge gaps" : "Mark as read";
  if (!input.isPressable) return { actionText };

  if (!input.canOpenDrawer) {
    return {
      actionLabel: `Mark ${input.unseenCount} newly assigned components as read`,
      actionText,
    };
  }

  return {
    actionLabel:
      input.unseenCount > 0
        ? `Open your knowledge gaps, ${input.unseenCount} newly assigned`
        : "Open your knowledge gaps",
    actionText,
  };
}
