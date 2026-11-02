import type { ReactNode } from "react";
import {
  Check,
  FolderPlus,
  LayoutList,
  ListTree,
  Maximize2,
  Milestone,
  Minimize2,
  X,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { BoardFilter } from "../layout/boardFilters";
import type { SectionSummary } from "../layout/boardSections";
import type { AuthoredCardKind } from "../types";
import { AddCardTriggers } from "./AddCardForm";
import { BoardFilterTriggers } from "./BoardFilterTriggers";
import { MarkFilterRail } from "./MarkFilterRail";

/**
 * The rule between groups on the tool rail: a short horizontal line while the rail stands up the
 * margin from `lg` up, a short vertical one while it lies across the page above the cards.
 */
const RAIL_SEPARATOR_CLASS = "mx-0.5 h-6 w-px bg-app-border lg:mx-0 lg:my-0.5 lg:h-px lg:w-6";

function Separator() {
  return <span className={RAIL_SEPARATOR_CLASS} aria-hidden="true" />;
}

type SwitchProps = {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** What the tooltip says when it is not the label. */
  title?: string;
  children: ReactNode;
};

/** One glyph on the rail, named by its label. */
function RailSwitch({ label, onClick, pressed, disabled, title, children }: SwitchProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

type FocusProps = { isFocused: boolean; onToggle: () => void };

/**
 * Widest change first: expanding takes the app's own navigation and this page's header off the
 * screen, so it is the one switch that has to be found before any of the others are worth reaching
 * for -- and the one that has to stay put afterwards, because it is the way back.
 */
function FocusSwitch({ isFocused, onToggle }: FocusProps) {
  const label = isFocused ? "Back to the app" : "Expand the board";
  return (
    <RailSwitch
      label={label}
      title={isFocused ? "Back to the app (Esc)" : label}
      onClick={onToggle}
      pressed={isFocused}
    >
      {isFocused ? (
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      )}
    </RailSwitch>
  );
}

type PlanningProps = {
  hasBoard: boolean;
  isArranging: boolean;
  planChanges: number;
  namingArea: boolean;
  onTogglePlanning: () => void;
  onCancelPlanning: () => void;
  onNameArea: () => void;
};

function cancelTitle(planChanges: number): string {
  if (planChanges === 0) return "Cancel planning";
  return `Cancel planning and undo ${planChanges} ${planChanges === 1 ? "change" : "changes"}`;
}

/**
 * Planning and making an area are the two ways of changing the board's *shape*, which is why they
 * sit together and away from the three that add something to it. Planning is a toggle rather than a
 * door: the way out has to be where the way in was, especially with the header's "Done" gone in
 * focus mode.
 */
function ShapeSwitches(props: PlanningProps) {
  const { hasBoard, isArranging } = props;
  const planLabel = isArranging ? "Done planning" : "Plan the board";
  return (
    <>
      <RailSwitch
        label={planLabel}
        onClick={props.onTogglePlanning}
        disabled={!hasBoard}
        pressed={isArranging}
      >
        {isArranging ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ListTree className="h-4 w-4" aria-hidden="true" />
        )}
      </RailSwitch>

      {/* The header's Cancel, for focus mode where the header is gone. */}
      {isArranging && (
        <RailSwitch
          label="Cancel planning"
          title={cancelTitle(props.planChanges)}
          onClick={props.onCancelPlanning}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </RailSwitch>
      )}

      <RailSwitch
        label="New area"
        onClick={props.onNameArea}
        disabled={!hasBoard}
        pressed={props.namingArea}
      >
        <FolderPlus className="h-4 w-4" aria-hidden="true" />
      </RailSwitch>
    </>
  );
}

type ShownProps = {
  hasBoard: boolean;
  isPathShown: boolean;
  onShowPath: (shown: boolean) => void;
  hasTaskPool: boolean;
  isTaskPoolShown: boolean;
  onShowTaskPool: (shown: boolean) => void;
};

/**
 * The strip saying where the hire stands, and the task pool, each on or off. The switches live here
 * rather than on the things they switch, because a control that takes its own surface away leaves
 * nothing to press to get it back.
 */
function ShownSwitches(props: ShownProps) {
  const { isPathShown, isTaskPoolShown } = props;
  return (
    <>
      <RailSwitch
        label={isPathShown ? "Hide where you are in your path" : "Show where you are"}
        onClick={() => props.onShowPath(!isPathShown)}
        disabled={!props.hasBoard}
        pressed={isPathShown}
      >
        <Milestone className="h-4 w-4" aria-hidden="true" />
      </RailSwitch>

      {props.hasTaskPool && (
        <RailSwitch
          label={isTaskPoolShown ? "Hide the task pool" : "Show the task pool"}
          onClick={() => props.onShowTaskPool(!isTaskPoolShown)}
          pressed={isTaskPoolShown}
        >
          <LayoutList className="h-4 w-4" aria-hidden="true" />
        </RailSwitch>
      )}
    </>
  );
}

type FilterProps = {
  /** Whether there are enough cards for a filter to mean anything. */
  offerFilters: boolean;
  filter: BoardFilter;
  onFilter: (filter: BoardFilter) => void;
  markSections: SectionSummary[];
  shownSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  vertical: boolean;
};

/**
 * Which cards, by where they came from, and then by what the hire marked on them. They sit below the
 * switches that change the board's shape because they change neither the board nor its shape -- they
 * only narrow what is drawn, and are undone by pressing a different button in the same group rather
 * than the same one again.
 */
function FilterSwitches(props: FilterProps) {
  return (
    <>
      {props.offerFilters && (
        <>
          <Separator />
          <BoardFilterTriggers
            value={props.filter}
            onChange={props.onFilter}
            vertical={props.vertical}
          />
        </>
      )}
      <MarkFilterRail
        sections={props.markSections}
        selectedId={props.shownSectionId}
        onSelect={props.onSelectSection}
        vertical={props.vertical}
      />
    </>
  );
}

export type BoardToolRailProps = FocusProps &
  PlanningProps &
  ShownProps &
  FilterProps & {
    addingKind: AuthoredCardKind | null;
    onPickKind: (kind: AuthoredCardKind) => void;
  };

/**
 * The board's tools, in the page's margin from `lg` up -- dead space on every board, and the natural
 * home for something always available and rarely urgent -- and across the page above the cards
 * below that. A group, not a toolbar: `toolbar` promises one tab stop with arrow keys between the
 * buttons, and every button here is its own tab stop.
 *
 * It stays up while the board is being arranged: arranging is one of the switches on it, and a switch
 * that takes its own rail off the screen leaves nothing to switch back with.
 */
export function BoardToolRail(props: BoardToolRailProps) {
  const { isFocused, isArranging } = props;
  return (
    <div
      className={
        // Centred on the viewport once the page is the whole screen. With the header gone there is
        // nothing at the top for it to hang under, and a rail pinned to a corner of a screen this
        // wide is a long way from wherever the pointer is.
        isFocused
          ? "z-20 lg:fixed lg:top-1/2 lg:right-3 lg:-translate-y-1/2"
          : "z-20 lg:absolute lg:top-8 lg:right-3"
      }
    >
      <div
        role="group"
        aria-label="Board tools"
        className={[
          "flex w-fit max-w-full flex-row flex-wrap items-center gap-1 rounded-2xl border border-app-border bg-app-surface/90 p-1 shadow-sm backdrop-blur lg:flex-col lg:flex-nowrap",
          // Fixed to the viewport it can no longer grow past the fold, so it scrolls in itself on a
          // short screen rather than losing its last buttons off the bottom.
          isFocused ? "lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" : "lg:sticky lg:top-6",
        ].join(" ")}
      >
        <FocusSwitch isFocused={isFocused} onToggle={props.onToggle} />
        <Separator />
        <ShapeSwitches {...props} />
        <ShownSwitches {...props} />
        <FilterSwitches {...props} />
        {/* Nothing is added to a board somebody is rearranging: the three forms open over the cards,
            which is exactly where the arranging is happening. */}
        {!isArranging && (
          <>
            <Separator />
            <AddCardTriggers
              onPick={props.onPickKind}
              active={props.addingKind}
              vertical={props.vertical}
            />
          </>
        )}
      </div>
    </div>
  );
}
