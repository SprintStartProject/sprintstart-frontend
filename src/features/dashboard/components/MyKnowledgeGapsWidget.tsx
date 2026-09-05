import { Clock, FileWarning, FolderOpen, ShieldCheck } from "lucide-react";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { useMyKnowledgeGaps } from "../../knowledge-gaps/useMyKnowledgeGaps";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../../knowledge-gaps/severity";
import {
  SeverityBar,
  SeveritySummaryBar,
} from "../../knowledge-gaps/components/SeverityIndicators";
import type { KnowledgeGap } from "../../knowledge-gaps/types";
import { useProjectContext } from "../../projects/useProjectContext";
import type { DashboardWidgetSize } from "../layout/types";
import { WidgetShell } from "./WidgetShell";

/**
 * Gaps listed per size, chosen against the cell's fixed height rather than the data.
 *
 * The usual case is one — a user owns a component, that component is missing a runbook — so
 * these are the ceiling for the unusual case, not the target. Anything past them is counted
 * in a footer line instead, which is the only honest way to end a list that cannot grow.
 */
const VISIBLE_COUNT: Record<DashboardWidgetSize, number> = {
  small: 1,
  medium: 3,
  wide: 4,
};

/** Missing types spelled out before the rest collapse into a `+n` chip. */
const VISIBLE_TYPE_COUNT: Record<DashboardWidgetSize, number> = {
  small: 2,
  medium: 3,
  wide: 4,
};

/** How many "already documented" types the feature layout lists before collapsing them. */
const PRESENT_TYPE_COUNT = 4;

/** Worst first, then by component name — the order the knowledge-gaps pages use. */
function worstFirst(gaps: readonly KnowledgeGap[]): KnowledgeGap[] {
  return [...gaps].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.component.localeCompare(b.component),
  );
}

function documentsMissing(gaps: readonly KnowledgeGap[]): number {
  return gaps.reduce((total, gap) => total + gap.missingTypes.length, 0);
}

/**
 * What the component is missing, as chips.
 *
 * The document types are the actionable half of a gap — "runbook" says what to write, where
 * "high severity" only says how much it matters — so they survive at every size, and it is
 * how many of them are shown that gives way instead.
 */
function MissingTypes({
  types,
  limit,
  tone = "missing",
}: {
  types: readonly string[];
  limit: number;
  /** `present` is the green counterpart used for what the component already has. */
  tone?: "missing" | "present";
}) {
  const visible = types.slice(0, limit);
  const hidden = types.length - visible.length;

  const chip =
    tone === "present"
      ? "rounded border border-app-success-border bg-app-success-bg px-1.5 py-0.5 text-[10px] text-app-success-text"
      : "rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[10px] text-app-text-muted";

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((type) => (
        <span key={type} className={chip}>
          {type}
        </span>
      ))}

      {hidden > 0 && <span className={chip}>+{hidden}</span>}
    </div>
  );
}

/** Small uppercase caption over a chip group. */
function ChipLabel({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
      {children}
    </p>
  );
}

/**
 * A single gap given the whole card.
 *
 * Owning exactly one component is the common case, and the compact row built for a list of
 * four left most of a half- or full-width card empty. So one gap stops being a list of one
 * and becomes the subject: the name set large, every missing type spelled out rather than
 * capped at three, what the component *does* already have, and when it was last ingested.
 *
 * The extra content is real, not padding — `presentTypes` and the ingest date were already on
 * the response and were simply not being shown.
 *
 * Two columns from `sm` up, at both sizes. The rows are a hard 8.5rem, which leaves 196px of
 * body — and stacked, this content measures about that much before a chip row wraps, so it
 * would start clipping on the first component with three long document types. Side by side it
 * needs the height of its taller half and nothing more, and it spends the width the half- and
 * full-width cards actually have. It only stacks on a phone, where there is no width to split.
 *
 * `split` is then just the typography: the full-width card can carry a bigger name.
 */
function GapFeature({
  gap,
  split,
  currentUserId,
}: {
  gap: KnowledgeGap;
  split: boolean;
  currentUserId: string | null;
}) {
  const present = gap.presentTypes ?? [];
  const { longLabel } = SEVERITY_STYLES[gap.severity];

  // Everyone else on the hook for this component. The caller is in `owners` by definition —
  // that is why the gap is on their dashboard — so they are never their own "shared with".
  const coOwners = gap.owners.filter((owner) => owner.id !== currentUserId);

  return (
    <div className="flex flex-1 flex-col justify-center gap-3 sm:flex-row sm:items-center sm:gap-8">
      <div className="min-w-0 sm:flex-1">
        <SeverityPill gap={gap} />

        <p
          className={`mt-2 truncate leading-tight font-semibold text-app-text ${
            split ? "text-2xl" : "text-xl"
          }`}
        >
          {gap.component}
        </p>

        <p className="mt-1 text-xs text-app-text-muted">
          {gap.missingTypes.length === 1
            ? "1 document missing"
            : `${gap.missingTypes.length} documents missing`}
        </p>

        <p className="mt-1 text-xs text-app-text-muted">{longLabel}</p>

        {/* At full width this moves into the third column, where it has company. */}
        {!split && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-app-text-muted">
            <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Last ingested {formatRelativeDate(gap.lastIngested)}
          </p>
        )}
      </div>

      <div className="min-w-0 sm:flex-1 sm:border-l sm:border-app-border-muted sm:pl-8">
        <ChipLabel>Missing</ChipLabel>
        <MissingTypes types={gap.missingTypes} limit={gap.missingTypes.length} />

        {present.length > 0 && (
          <div className="mt-3">
            <ChipLabel>Already documented</ChipLabel>
            <MissingTypes types={present} limit={PRESENT_TYPE_COUNT} tone="present" />
          </div>
        )}
      </div>

      {/*
        A third column, only at full width and only for a lone gap — that is the one case with
        more space than content, and every line here was already on the response and simply
        never shown. Without it the right half of the widget sat empty.
      */}
      {split && (
        <div className="min-w-0 sm:flex-1 sm:border-l sm:border-app-border-muted sm:pl-8">
          <ChipLabel>Source</ChipLabel>

          <dl className="space-y-1">
            <MetaRow label="First ingested" value={formatRelativeDate(firstIngestedOf(gap))} />
            <MetaRow label="Last ingested" value={formatRelativeDate(gap.lastIngested)} />
            <MetaRow label="Last analyzed" value={formatRelativeDate(gap.refreshedAt)} />
          </dl>

          {coOwners.length > 0 && (
            <div className="mt-3">
              <ChipLabel>Shared with</ChipLabel>
              <p className="truncate text-xs text-app-text">
                {coOwners.map((owner) => `${owner.firstname} ${owner.lastname}`).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One `label — value` line of the source column. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-xs text-app-text-muted">{label}</dt>
      <dd className="truncate text-xs font-medium text-app-text">{value}</dd>
    </div>
  );
}

/** `firstIngested` is optional and absent when a component has no ingested artifact yet. */
function firstIngestedOf(gap: KnowledgeGap): string {
  return gap.firstIngested ?? gap.lastIngested;
}

/**
 * One gap as a filled box rather than a line.
 *
 * What two or three gaps get: a row is the right shape for a list of four, but two of them
 * floating in a half-row card is the same empty-space problem one row had. A box that
 * stretches to its share of the grid keeps the card looking deliberate at any count.
 */
function GapCard({ gap, rich = false }: { gap: KnowledgeGap; rich?: boolean }) {
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
        <p className="mt-2 flex items-center gap-1 text-[10px] text-app-text-muted">
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
function MoreTile({ remaining }: { remaining: number }) {
  return (
    <li className="flex min-w-0 items-center justify-center rounded-xl border border-dashed border-app-border-muted p-3">
      <p className="text-xs font-medium text-app-text-muted">
        and {remaining} more assigned to you
      </p>
    </li>
  );
}

/*
  The feature's own pill rather than `ui/Badge`: severity is a four-step ramp on its own
  scale, not a point on the app's status ladder, so no Badge variant carries the right
  colour. Mapping the steps onto the nearest status roles would have put this pill and the
  `SeverityBar` beside it in two different reds for the same gap. Same markup as the pills
  on the knowledge-gaps pages.
*/
function SeverityPill({ gap }: { gap: KnowledgeGap }) {
  const { badge, label } = SEVERITY_STYLES[gap.severity];

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
      {label}
    </span>
  );
}

/**
 * The single gap the `small` card is built around.
 *
 * A quarter of a row cannot hold a list, and a count on its own ("1 gap") is a number the
 * reader then has to go and look up. Naming the component instead makes the smallest card
 * the one that still says something actionable, and the rest become a footer line.
 */
function GapSpotlight({ gap }: { gap: KnowledgeGap }) {
  return (
    <div className="min-w-0">
      <SeverityPill gap={gap} />

      <p className="mt-2 truncate text-lg leading-tight font-semibold text-app-text">
        {gap.component}
      </p>

      <p className="mt-0.5 text-xs text-app-text-muted">
        {gap.missingTypes.length === 1
          ? "1 document missing"
          : `${gap.missingTypes.length} documents missing`}
      </p>

      <div className="mt-2.5">
        <MissingTypes types={gap.missingTypes} limit={VISIBLE_TYPE_COUNT.small} />
      </div>
    </div>
  );
}

/**
 * One gap as a row: the severity as a bar down the left, the component and what it lacks.
 *
 * The most compact form, and now only used where there are enough gaps for the card to read
 * as a list — three on the half-width card. One or two get {@link GapFeature} / {@link GapCard}
 * instead, which is what stopped a nearly empty card from looking like a mistake.
 */
function GapRow({ gap }: { gap: KnowledgeGap }) {
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

/**
 * The "there is something new here" marker, and the only thing that clears it.
 *
 * Not a button: the whole card is the control (see `WidgetShell`), so pressing anywhere on it
 * is what acknowledges the marker. That is also why the card is made pressable for a user who
 * has nowhere to go from here -- clearing the marker is a worthwhile outcome on its own, and
 * it is the one the sidebar flag is waiting for.
 */
function NewOwnershipPill({ count }: { count: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-app-warning-border bg-app-warning-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-app-warning-text uppercase">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-app-warning-solid" />
      New
      <span className="sr-only">
        {count === 1
          ? ": 1 component was assigned to you. Open this card to mark it as read."
          : `: ${count} components were assigned to you. Open this card to mark them as read.`}
      </span>
    </span>
  );
}

/** Trailing line for whatever did not fit, so the list never just stops. */
function HiddenCount({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null;

  return <p className="mt-2 text-xs text-app-text-muted">and {hidden} more assigned to you</p>;
}

/**
 * The components you own that are missing documentation.
 *
 * The counterpart to the manager's `team-insights` card: same analysis, filtered to the
 * caller. Where a PM needs to see which parts of the project are undocumented, a member only
 * needs to know which of them is theirs to write — so this reads `/knowledge-gaps/mine`,
 * which is scoped by component ownership rather than by role and is therefore open to
 * everyone in the project. Available to every user for that reason, and offered in the
 * picker rather than placed by default: most people own nothing and would get an empty card
 * they never asked for.
 *
 * Built for more than one gap throughout even though one is the normal case — ownership is a
 * list on the backend, and a card that only worked for a single row would break the first
 * time somebody took on a second component.
 *
 * `small` names the worst one and what it needs. `medium` turns that into the list, because
 * "which of my three components" is the question a second gap creates. `wide` puts the
 * spread beside the list: at that width the severity mix is worth showing, and it is what
 * separates one urgent gap from four minor ones.
 *
 * Clicking through is offered only to a user who may actually reach the knowledge-gaps page.
 * For everyone else the card is plain content — a member cannot open the detail view (the
 * backend guards it with PM/Admin), and a click that lands on a redirect is worse than no
 * click at all.
 */
export function MyKnowledgeGapsWidget({ size }: { size: DashboardWidgetSize }) {
  const { profile } = useAuth();
  const { selectedProjectId, canManageSelected } = useProjectContext();
  // Only the unread flag comes from the shared provider; the figures below stay this widget's
  // own request, so the card still works wherever it is rendered.
  const { unseenComponents, markAllSeen } = useMyKnowledgeGaps();

  /*
    The project context starts empty and only fills in once the project list has loaded — and
    it stays empty for a user who belongs to no project at all. Asking for `?projectId=` is a
    400 the moment it leaves the browser, so the request is not made until there is something
    to ask about. Skipping it also keeps that case out of the error state, which is not what
    "the request failed" should mean.
  */
  const hasProject = selectedProjectId !== "";

  const { data, loading, error } = useFetch(
    () =>
      hasProject
        ? knowledgeGapService.fetchMyKnowledgeGaps(selectedProjectId)
        : Promise.resolve({ gaps: [] }),
    [selectedProjectId],
  );

  const canOpenPage = canAccessRoute(profile, "/insights/knowledge-gaps", canManageSelected);

  /*
    Something has been assigned that the user has not acknowledged. The card then always
    accepts a press, even for a member who cannot open the knowledge-gaps page: the press is
    what puts the flag down, here and in the sidebar.
  */
  const hasUnseen = unseenComponents.length > 0;

  /*
    The overview is the project's full component roster now, the covered ones included. This
    card is a to-do list — its title, its counts and every chip on it say "missing" — so a
    component with nothing missing is not a smaller item on it, it is not an item at all.

    Filtering here is also what keeps the empty state reachable: left in, a member whose
    components are all documented would get cards reading "0 documents missing" instead of
    "Nothing assigned to you", and the summary bar would count them as work.
  */
  const gaps = worstFirst((data?.gaps ?? []).filter((gap) => gap.severity !== "covered"));
  const visible = gaps.slice(0, VISIBLE_COUNT[size]);
  const hidden = gaps.length - visible.length;

  /*
    The full-width list is a fixed grid of at most four cells. When there are more gaps than
    cells the last one becomes a counter instead of a card, so the overflow is reported inside
    the grid rather than on a line beneath it — a line there had to come out of the rows'
    height, which is what clipped the bottom row.

    The row count follows the cell count: two cells are one row of two at full height, and
    three or four are a 2x2. Fixing it at two rows would have stranded a pair in the top half.
  */
  const cellLimit = VISIBLE_COUNT.wide;
  const celledGaps =
    gaps.length > cellLimit ? gaps.slice(0, cellLimit - 1) : gaps.slice(0, cellLimit);
  const remaining = gaps.length - celledGaps.length;
  const wideCells = celledGaps.length + (remaining > 0 ? 1 : 0);

  /*
    The grid takes the shape that fills the row: two or three cells get a single row of two or
    three columns, four get a 2x2. A fixed 2x2 would have stranded a pair in the top half, and
    three cells in a 2x2 leaves a hole in the bottom right.

    Cells that own a whole row have height to spare, so those cards get their fuller form back
    — without it the emptiness just moved from the card into the box.
  */
  const wideGridClass =
    wideCells <= 2
      ? "grid-cols-2 grid-rows-1"
      : wideCells === 3
        ? "grid-cols-3 grid-rows-1"
        : "grid-cols-2 grid-rows-2";
  const wideRichCards = wideCells <= 3;

  return (
    <WidgetShell
      icon={FileWarning}
      title="Your knowledge gaps"
      actionLabel={
        canOpenPage
          ? "Open knowledge gaps"
          : hasUnseen
            ? "Mark the components assigned to you as read"
            : undefined
      }
      to={canOpenPage ? "/insights/knowledge-gaps" : undefined}
      onActivate={hasUnseen ? markAllSeen : undefined}
      notice={hasUnseen ? <NewOwnershipPill count={unseenComponents.length} /> : undefined}
      isLoading={loading}
      // Only a failed request may say this. Owning nothing is a normal, successful answer and
      // gets the empty state below — the two must never be told apart by guesswork.
      errorMessage={error ? "Could not load your knowledge gaps." : null}
    >
      {!hasProject ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <FolderOpen aria-hidden="true" className="h-5 w-5 text-app-text-muted" />
          <p className="text-sm font-medium text-app-text">No project selected.</p>
          <p className="text-xs text-app-text-muted">
            Pick a project to see what is assigned to you.
          </p>
        </div>
      ) : gaps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-app-success-solid" />
          <p className="text-sm font-medium text-app-text">Nothing assigned to you.</p>
          <p className="text-xs text-app-text-muted">
            No component you own is missing documentation.
          </p>
        </div>
      ) : size === "small" ? (
        <div className="flex flex-1 flex-col justify-center">
          <GapSpotlight gap={visible[0]} />
          <HiddenCount hidden={hidden} />
        </div>
      ) : gaps.length === 1 ? (
        // One gap fills the card on its own rather than sitting in it as a lone row.
        <GapFeature gap={gaps[0]} split={size === "wide"} currentUserId={profile?.id ?? null} />
      ) : size === "medium" ? (
        <div className="flex flex-1 flex-col justify-center">
          {/*
            Two gaps get boxes that share the height between them; three go back to rows,
            which is the point where a list is genuinely a list and boxes would be cramped.
          */}
          {gaps.length === 2 ? (
            <ul className="grid flex-1 grid-rows-2 gap-3">
              {visible.map((gap) => (
                <GapCard key={gap.id} gap={gap} />
              ))}
            </ul>
          ) : (
            <>
              <ul className="space-y-2.5">
                {visible.map((gap) => (
                  <GapRow key={gap.id} gap={gap} />
                ))}
              </ul>

              <HiddenCount hidden={hidden} />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-8">
          {/*
            The spread first, because at full width it is the thing the list cannot say: four
            low-severity gaps and one high one are the same number of rows and completely
            different afternoons.
          */}
          <div className="flex shrink-0 flex-col justify-center sm:w-52">
            <p className="text-4xl leading-none font-bold text-app-text tabular-nums">
              {gaps.length}
            </p>
            <p className="mt-1 text-xs text-app-text-muted">
              {gaps.length === 1 ? "component assigned to you" : "components assigned to you"}
            </p>
            <p className="text-xs text-app-text-muted">
              {documentsMissing(gaps) === 1
                ? "1 document missing in total"
                : `${documentsMissing(gaps)} documents missing in total`}
            </p>

            <SeveritySummaryBar gaps={gaps} className="mt-4" />
          </div>

          {/*
            Boxes in a two-column grid rather than stacked rows: the full-width card gives this
            column more than half the widget, and rows left the right of it blank. Two gaps sit
            side by side and fill it; four make a 2x2 that fills it the same way.

            No heading over it and no count under it. Both were costing height the two rows
            needed — that is what cut the bottom row off at three gaps and hid it entirely at
            five. The widget's own title already says what this is, and anything past the four
            cells is reported by the last cell rather than below the grid.
          */}
          <div className="flex min-w-0 flex-1 flex-col border-t border-app-border-muted pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
            <ul className={`grid min-h-0 flex-1 gap-3 ${wideGridClass}`}>
              {celledGaps.map((gap) => (
                <GapCard key={gap.id} gap={gap} rich={wideRichCards} />
              ))}

              {remaining > 0 && <MoreTile remaining={remaining} />}
            </ul>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
