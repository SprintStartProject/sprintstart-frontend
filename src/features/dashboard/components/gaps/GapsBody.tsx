import { FolderOpen, ShieldCheck } from "lucide-react";
import type { DashboardWidgetSize } from "../../layout/types";
import { SeveritySummaryBar } from "./gapsKit";
import type { KnowledgeGap } from "./gapsKit";
import { documentsMissing, planWideGrid, VISIBLE_COUNT } from "./gapRules";
import { HiddenCount } from "./gapParts";
import { GapCard, GapRow, GapSpotlight, MoreTile } from "./GapLists";
import { GapFeature } from "./GapFeature";

type GapsBodyProps = {
  hasSelectedProject: boolean;
  gaps: KnowledgeGap[];
  size: DashboardWidgetSize;
  currentUserId: string | null;
};

/**
 * What the card shows for its size and gap count.
 *
 * `small` names the worst gap and what it needs. `medium` turns that into the list, because
 * "which of my three components" is the question a second gap creates. `wide` puts the spread
 * beside the list: at that width the severity mix is worth showing, and it is what separates
 * one urgent gap from four minor ones. A lone gap fills the card on its own rather than
 * sitting in it as a single row.
 */
export function GapsBody({ hasSelectedProject, gaps, size, currentUserId }: GapsBodyProps) {
  if (!hasSelectedProject) return <NoProject />;
  if (gaps.length === 0) return <NothingAssigned />;
  if (size === "small") return <SmallLayout gaps={gaps} />;
  if (gaps.length === 1) {
    return <GapFeature gap={gaps[0]} split={size === "wide"} currentUserId={currentUserId} />;
  }

  return size === "medium" ? <MediumLayout gaps={gaps} /> : <WideLayout gaps={gaps} />;
}

function NoProject() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <FolderOpen aria-hidden="true" className="h-5 w-5 text-app-text-muted" />
      <p className="text-sm font-medium text-app-text">No project selected.</p>
      <p className="text-xs text-app-text-muted">Pick a project to see what is assigned to you.</p>
    </div>
  );
}

function NothingAssigned() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <ShieldCheck aria-hidden="true" className="h-5 w-5 text-app-success-solid" />
      <p className="text-sm font-medium text-app-text">Nothing assigned to you.</p>
      <p className="text-xs text-app-text-muted">No component you own is missing documentation.</p>
    </div>
  );
}

function SmallLayout({ gaps }: { gaps: KnowledgeGap[] }) {
  const visible = gaps.slice(0, VISIBLE_COUNT.small);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <GapSpotlight gap={visible[0]} />
      <HiddenCount hidden={gaps.length - visible.length} />
    </div>
  );
}

function MediumLayout({ gaps }: { gaps: KnowledgeGap[] }) {
  const visible = gaps.slice(0, VISIBLE_COUNT.medium);

  /*
    Two gaps get boxes that share the height between them; three go back to rows, which is the
    point where a list is genuinely a list and boxes would be cramped.
  */
  if (gaps.length === 2) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <ul className="grid flex-1 grid-rows-2 gap-3">
          {visible.map((gap) => (
            <GapCard key={gap.id} gap={gap} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center">
      <ul className="space-y-2.5">
        {visible.map((gap) => (
          <GapRow key={gap.id} gap={gap} />
        ))}
      </ul>

      <HiddenCount hidden={gaps.length - visible.length} />
    </div>
  );
}

function WideLayout({ gaps }: { gaps: KnowledgeGap[] }) {
  const plan = planWideGrid(gaps);

  return (
    <div className="flex flex-1 flex-col gap-4 @min-[28rem]:flex-row @min-[28rem]:gap-6 @3xl:gap-8">
      <WideSummary gaps={gaps} />

      {/*
        Boxes in a two-column grid rather than stacked rows: the full-width card gives this
        column more than half the widget, and rows left the right of it blank. Two gaps sit
        side by side and fill it; four make a 2x2 that fills it the same way.

        No heading over it and no count under it. Both were costing height the two rows
        needed — that is what cut the bottom row off at three gaps and hid it entirely at
        five. The widget's own title already says what this is, and anything past the four
        cells is reported by the last cell rather than below the grid.
      */}
      <div className="flex min-w-0 flex-1 flex-col border-t border-app-border-muted pt-4 @min-[28rem]:border-t-0 @min-[28rem]:border-l @min-[28rem]:pt-0 @min-[28rem]:pl-6 @3xl:pl-8">
        <ul className={`grid min-h-0 flex-1 gap-3 ${plan.gridClass}`}>
          {plan.celled.map((gap) => (
            <GapCard key={gap.id} gap={gap} rich={plan.rich} />
          ))}

          {plan.remaining > 0 && <MoreTile remaining={plan.remaining} />}
        </ul>
      </div>
    </div>
  );
}

/**
 * The spread first, because at full width it is the thing the list cannot say: four
 * low-severity gaps and one high one are the same number of rows and completely different
 * afternoons.
 */
function WideSummary({ gaps }: { gaps: KnowledgeGap[] }) {
  const missing = documentsMissing(gaps);

  return (
    <div className="flex shrink-0 flex-col justify-center @min-[28rem]:w-40 @3xl:w-52">
      <p className="text-4xl leading-none font-bold text-app-text tabular-nums">{gaps.length}</p>
      <p className="mt-1 text-xs text-app-text-muted">
        {gaps.length === 1 ? "component assigned to you" : "components assigned to you"}
      </p>
      <p className="text-xs text-app-text-muted">
        {missing === 1 ? "1 document missing in total" : `${missing} documents missing in total`}
      </p>

      <SeveritySummaryBar gaps={gaps} className="mt-4" />
    </div>
  );
}
