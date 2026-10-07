import { Button } from "../../../components/ui/Button";
import { FILTER_OPTIONS, type BoardFilter } from "../layout/boardFilters";

type BoardFilterTriggersProps = {
  value: BoardFilter;
  onChange: (filter: BoardFilter) => void;
  /** Stacks them, for the rail standing up the margin from `lg`; side by side below that. */
  vertical?: boolean;
  className?: string;
};

/**
 * Which cards to show, as two switches rather than a dropdown.
 *
 * Lives in the board's tool rail beside the other switches — up the right margin from `lg`, across
 * the top of the page below it. Glyphs only, named by their `aria-label` and tooltip: the rail is
 * the only place this renders, and the worded form it used to have for a row above the board went
 * with that row.
 *
 * Toggle buttons with `aria-pressed` rather than a radio group, which is what `SegmentedTabs` does
 * a few lines away and for the same reason: a real radio group promises arrow-key navigation, and
 * announcing one without implementing it sets an expectation the control then fails.
 *
 * Toggles in the full sense: the lit one turns itself off. There is no "all cards" button to press
 * afterwards, because a board with neither of these on is already showing every card — see
 * {@link FILTER_OPTIONS}.
 *
 * Without words, which a cut like "Yours" cannot carry on a glyph alone. It does
 * not have to: `BoardViewStatus` names the cut in words directly above the board whenever one is
 * on, so what the pressed button did is written out where the result of it is.
 */
export function BoardFilterTriggers({
  value,
  onChange,
  vertical,
  className = "",
}: BoardFilterTriggersProps) {
  return (
    <div
      role="group"
      aria-label="Which cards to show"
      className={`flex items-center gap-1 ${vertical ? "flex-col" : "flex-wrap"} ${className}`}
    >
      {FILTER_OPTIONS.map(({ value: option, label, icon: Icon }) => (
        <Button
          key={option}
          variant={value === option ? "secondary" : "ghost"}
          size="sm"
          iconOnly
          onClick={() => onChange(value === option ? "all" : option)}
          aria-pressed={value === option}
          aria-label={label}
          title={label}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
