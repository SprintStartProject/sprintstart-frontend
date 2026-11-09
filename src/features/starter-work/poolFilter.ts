import type { FilterSelectOption } from "../../components/ui/FilterSelect";
import type { CandidatePoolState } from "../../services/starterWorkTypes";

/** The pool-state filter beside the search box. */
export type PoolFilter = "all" | "available" | "in-pool" | "removed";

export const POOL_FILTER_OPTIONS: FilterSelectOption<PoolFilter>[] = [
  { value: "all", label: "All issues" },
  { value: "available", label: "New" },
  { value: "in-pool", label: "In the pool" },
  { value: "removed", label: "Taken out" },
];

export const POOL_FILTER_STATE: Record<Exclude<PoolFilter, "all">, CandidatePoolState> = {
  available: "AVAILABLE",
  "in-pool": "IN_POOL",
  removed: "REMOVED",
};
