import { Clock } from "lucide-react";
import { formatRelativeDate, SeverityBar } from "./gapsKit";
import type { KnowledgeGap } from "./gapsKit";
import { missingLabel, VISIBLE_TYPE_COUNT } from "./gapRules";
import { MissingTypes, SeverityPill } from "./gapParts";

/**
 * One gap as a filled box rather than a line.
 *
 * What two or three gaps get: a row is the right shape for a list of four, but two of them
 * floating in a half-row card is the same empty-space problem one row had. A box that
 * stretches to its share of the grid keeps the card looking deliberate at any count.
 */
export function GapCard({ gap, rich = false }: { gap: KnowledgeGap; rich?: boolean }) {
  const present = gap.presentTypes ?? [];

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-app-border-muted bg-app-surface-muted/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-app-text">{gap.component}</p>
        <SeverityPill gap={gap} />
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <MissingTypes types={gap.missingTypes} limit={VISIBLE_TYPE_COUNT.wide} />

        {rich && present.length > 0 && (
          <div className="mt-2">
            <MissingTypes types={present} limit={3} tone="present" />
          </div>
        )}
      </div>

      {/*
        The date is `rich` only. Two rows of cards have to fit 196px of body, and this is the
        line that pushed a card past its share and clipped the bottom row. It comes back when
        the cards get a whole row to themselves and have the height to spare.
      */}
      {rich && (
        <p className="mt-2 flex items-center gap-1 text-xs text-app-text-muted">
          <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
          {formatRelativeDate(gap.lastIngested)}
        </p>
      )}
    </li>
  );
}

/**
 * The last cell of a full grid when there are more gaps than cells.
 *
 * A tile rather than a line under the grid: the row height is fixed and already spoken for,
 * so a footer had to come out of the cards' share — which is what cut the bottom row off. This
 * costs nothing, because it takes the place of a card instead of sitting below them.
 */
export function MoreTile({ remaining }: { remaining: number }) {
  return (
    <li className="flex min-w-0 items-center justify-center rounded-xl border border-dashed border-app-border-muted p-3">
      <p className="text-xs font-medium text-app-text-muted">
        and {remaining} more assigned to you
      </p>
    </li>
  );
}

/**
 * The single gap the `small` card is built around.
 *
 * A quarter of a row cannot hold a list, and a count on its own ("1 gap") is a number the
 * reader then has to go and look up. Naming the component instead makes the smallest card
 * the one that still says something actionable, and the rest become a footer line.
 */
export function GapSpotlight({ gap }: { gap: KnowledgeGap }) {
  return (
    <div className="min-w-0">
      <SeverityPill gap={gap} />

      <p className="mt-2 truncate text-lg leading-tight font-semibold text-app-text">
        {gap.component}
      </p>

      <p className="mt-0.5 text-xs text-app-text-muted">{missingLabel(gap.missingTypes.length)}</p>

      <div className="mt-2.5">
        <MissingTypes types={gap.missingTypes} limit={VISIBLE_TYPE_COUNT.small} />
      </div>
    </div>
  );
}

/**
 * One gap as a row: the severity as a bar down the left, the component and what it lacks.
 *
 * The most compact form, used where there are enough gaps for the card to read as a list —
 * three on the half-width card. One or two get the feature layout or {@link GapCard}
 * instead, which is what stopped a nearly empty card from looking like a mistake.
 */
export function GapRow({ gap }: { gap: KnowledgeGap }) {
  return (
    <li className="flex items-stretch gap-2.5">
      <SeverityBar severity={gap.severity} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-app-text">{gap.component}</p>
          <SeverityPill gap={gap} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <MissingTypes types={gap.missingTypes} limit={VISIBLE_TYPE_COUNT.medium} />
        </div>
      </div>
    </li>
  );
}
