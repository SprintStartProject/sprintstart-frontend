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

export type RunRepositoryOption = {
  repositoryId: string;
  label: string;
};

type RunHistoryFiltersProps = {
  status: RunStatusFilter;
  /** A repository id, or `"ALL"` for every repository in the project. */
  repositoryId: string;
  repositories: RunRepositoryOption[];
  onStatusChange: (status: RunStatusFilter) => void;
  onRepositoryChange: (repositoryId: string) => void;
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
  repositoryId,
  repositories,
  onStatusChange,
  onRepositoryChange,
  onReset,
  disabled = false,
}: RunHistoryFiltersProps) {
  const hasActiveFilter = status !== "ALL" || repositoryId !== "ALL";

  const repositoryOptions: FilterSelectOption<string>[] = [
    { value: "ALL", label: "All repositories" },
    ...repositories.map((repository) => ({
      value: repository.repositoryId,
      label: repository.label,
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

      {repositories.length > 1 && (
        <FilterSelect
          label="Filter runs by repository"
          value={repositoryId}
          options={repositoryOptions}
          onChange={onRepositoryChange}
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
