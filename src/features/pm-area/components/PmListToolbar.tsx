import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { Input } from "../../../components/ui/Input";

/**
 * One filter in a PM list's toolbar: a pill with its label and how many items it holds.
 *
 * The Team, Questions and Knowledge gaps lists each grew their own — solid brand chips on one,
 * severity-coloured chips on the next, a toggle button on the third — so the same kind of
 * control looked different on every tab. This is the one shape: brand fill when on, a coloured
 * dot for what the filter stands for, and the count in a small badge that turns amber when the
 * filter holds something that wants attention.
 */
export function PmFilterChip({
  active,
  onClick,
  label,
  count,
  dotClassName,
  flagged = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  /** Background class of the leading dot, e.g. a severity's colour. */
  dotClassName?: string;
  /** Count wants attention (amber) while the chip is off. */
  flagged?: boolean;
}) {
  const empty = count === 0;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-app-brand bg-app-brand text-white"
          : "border-app-border bg-app-surface text-app-text-muted hover:border-app-brand-border-strong hover:text-app-text"
      } ${!active && empty ? "opacity-60" : ""}`}
    >
      {dotClassName && (
        <span
          aria-hidden="true"
          // Keeps its colour when on, ringed so it reads on the brand fill: on the severity
          // chips the colour is the point.
          className={`h-1.5 w-1.5 rounded-full ${dotClassName} ${active ? "ring-2 ring-white/80" : ""}`}
        />
      )}
      {label}
      {typeof count === "number" && (
        <span
          className={`rounded-full px-1.5 text-2xs font-semibold tabular-nums ${
            active
              ? "bg-white/20 text-white"
              : flagged && !empty
                ? "bg-app-warning-bg text-app-warning-text"
                : "bg-app-surface-muted text-app-text-subtle"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type SortControl<TSort extends string> = {
  label: string;
  value: TSort;
  options: FilterSelectOption<TSort>[];
  onChange: (value: TSort) => void;
  /** Extra classes, e.g. to hide it where column headers sort instead. */
  className?: string;
};

/**
 * The row above every PM list — Team, Questions, Knowledge gaps — in one order: search, filter
 * chips, then on the right how many are shown, a reset once anything is narrowed, any further
 * select, and the sort. The same place for the same control on every tab.
 */
export function PmListToolbar<TSort extends string>({
  search,
  filters,
  filtersLabel,
  shown,
  total,
  onReset,
  extra,
  sort,
}: {
  search?: { label: string; placeholder: string; value: string; onChange: (value: string) => void };
  /** The filter chips — {@link PmFilterChip}s. */
  filters?: ReactNode;
  /** Accessible name of the chips' group, e.g. "Filter gaps by severity". */
  filtersLabel?: string;
  shown?: number;
  total?: number;
  /** Shown only when given — pass it while the list is narrowed or re-sorted. */
  onReset?: () => void;
  /** Further selects, between the reset and the sort (a role filter, say). */
  extra?: ReactNode;
  sort?: SortControl<TSort>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        // Sized on a wrapper: with an icon, `Input` puts its `className` on the <input> inside
        // its own full-width box, so flex sizing given to it never reached the box in this row.
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Input
            size="sm"
            icon={<Search className="h-4 w-4" />}
            aria-label={search.label}
            placeholder={search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            className="rounded-xl! border-app-border/70! bg-app-surface/70! backdrop-blur-md hover:border-app-brand-border-strong! focus:border-app-brand-border-strong!"
          />
        </div>
      )}

      {filters && (
        <div role="group" aria-label={filtersLabel} className="flex flex-wrap items-center gap-2">
          {filters}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {typeof shown === "number" && typeof total === "number" && (
          <span className="text-xs text-app-text-muted tabular-nums">
            {shown} of {total}
          </span>
        )}
        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={<X className="h-3.5 w-3.5" />}
            className="text-app-brand-text"
          >
            Reset
          </Button>
        )}
        {extra}
        {sort && (
          <FilterSelect
            label={sort.label}
            value={sort.value}
            options={sort.options}
            onChange={sort.onChange}
            className={`w-48 ${sort.className ?? ""}`}
          />
        )}
      </div>
    </div>
  );
}
