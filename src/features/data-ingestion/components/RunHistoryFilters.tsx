import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import {
  buttonHoverMotion,
  buttonHoverMotionDisabled,
} from "../../../styles/tokens.ts";
import {
  FilterSelect,
  type FilterSelectOption,
} from "../../../components/ui/FilterSelect.tsx";
import type { IngestionRunStatus } from "../types.ts";

/** `"ALL"` means "no status filter", i.e. the query param is omitted. */
export type RunStatusFilter = IngestionRunStatus | "ALL";

/**
 * One selectable source in the run filter. `value` is a GitHub repository id or
 * a Jira instance URL; the parent decides which query param it maps to.
 */
export type RunSourceOption = {
  value: string;
  label: string;
};

type RunHistoryFiltersProps = {
  status: RunStatusFilter;
  /** A source `value`, or `"ALL"` for every source in the project. */
  sourceValue: string;
  sources: RunSourceOption[];
  onStatusChange: (status: RunStatusFilter) => void;
  onSourceChange: (value: string) => void;
  onReset: () => void;
  disabled?: boolean;
};

/**
 * `CONNECTED` is deliberately omitted: it is a transient hand-off state that the
 * UI already labels "Running", and offering both would give two identical-looking
 * options for a filter the backend matches on a single exact value.
 */
const STATUS_OPTIONS: FilterSelectOption<RunStatusFilter>[] = [
  { value: "ALL", label: "All statuses" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Success" },
  { value: "PARTIAL", label: "Partial" },
  { value: "FAILED", label: "Failed" },
];

/**
 * Filter toolbar for the run history. The selections are applied server-side by
 * the paginated runs endpoint, so filtering searches the whole history rather
 * than just the rows already loaded.
 */
export function RunHistoryFilters({
  status,
  sourceValue,
  sources,
  onStatusChange,
  onSourceChange,
  onReset,
  disabled = false,
}: RunHistoryFiltersProps) {
  const hasActiveFilter = status !== "ALL" || sourceValue !== "ALL";

  const sourceOptions: FilterSelectOption<string>[] = [
    { value: "ALL", label: "All sources" },
    ...sources.map((source) => ({
      value: source.value,
      label: source.label,
    })),
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter runs"
    >
      <FilterSelect
        label="Filter runs by status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatusChange}
        disabled={disabled}
        className="w-40"
      />

      {sources.length > 1 && (
        <FilterSelect
          label="Filter runs by source"
          value={sourceValue}
          options={sourceOptions}
          onChange={onSourceChange}
          disabled={disabled}
          className="w-52"
        />
      )}

      {hasActiveFilter && (
        <motion.button
          type="button"
          onClick={onReset}
          disabled={disabled}
          {...(disabled ? buttonHoverMotionDisabled : buttonHoverMotion)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-transparent px-2.5 text-sm font-medium text-app-brand-text transition-colors hover:border-app-brand-border hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </motion.button>
      )}
    </div>
  );
}
