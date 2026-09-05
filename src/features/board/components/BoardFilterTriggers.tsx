import { Button } from "../../../components/ui/Button";
import { FILTER_OPTIONS, type BoardFilter } from "../layout/boardFilters";

type BoardFilterTriggersProps = {
  value: BoardFilter;
  onChange: (filter: BoardFilter) => void;
  /** Drops the words and keeps the glyphs, for the narrow rail in the page's own margin. */
  compact?: boolean;
  /** Stacks them, for the rail: three glyphs down the margin rather than across it. */
  vertical?: boolean;
  className?: string;
};

/**
 * Which cards to show, as three switches rather than a dropdown.
 *
 * Split out the way {@link AddCardTriggers} was, and for the same reason: from `lg` up it lives in
 * the page's right margin beside the other switches, and below that width there is no margin, so it
 * stays in the row above the board where the filter has always been. One state, two places it can
 * be reached from — never two implementations.
 *
 * Toggle buttons with `aria-pressed` rather than a radio group, which is what `SegmentedTabs` does
 * a few lines away and for the same reason: a real radio group promises arrow-key navigation, and
 * announcing one without implementing it sets an expectation the control then fails.
 *
 * In the rail the words are gone, which a cut like "Yours" cannot carry on a glyph alone. It does
 * not have to: `BoardViewStatus` names the cut in words directly above the board whenever one is
 * on, so what the pressed button did is written out where the result of it is.
 */
export function BoardFilterTriggers({
  value,
  onChange,
  compact,
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
          iconOnly={compact}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={compact ? label : undefined}
          title={label}
        >
          {compact ? <Icon className="h-4 w-4" aria-hidden="true" /> : label}
        </Button>
      ))}
    </div>
  );
}
