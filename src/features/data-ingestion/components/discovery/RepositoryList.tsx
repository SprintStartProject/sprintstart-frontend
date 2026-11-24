import { Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "../../../../components/ui/Input";
import { isSelectableState } from "./discoveryRules";
import type { DiscoveredRepositoryItem, RepositoryLinkState } from "./discoveryTypes";
import { RepositoryRow } from "./RepositoryRow";

type RepositoryListProps = {
  repositories: DiscoveredRepositoryItem[];
  linkStates: Map<string, RepositoryLinkState>;
  selected: ReadonlySet<string>;
  selectedCount: number;
  providerName: string;
  filter: string;
  onFilterChange: (filter: string) => void;
  onToggle: (name: string) => void;
  onToggleAll: (names: string[], allSelected: boolean) => void;
  hasMore: boolean;
  loadingMore: boolean;
  /** Locks "Load more" while anything runs. */
  busy: boolean;
  onLoadMore: () => void;
};

function LoadMore({
  loading,
  busy,
  onClick,
}: {
  loading: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Load more
      </button>
    </div>
  );
}

/** The filter box, the select-all control, the rows and the pager. */
export function RepositoryList(props: RepositoryListProps) {
  const { repositories, linkStates, selected } = props;
  const stateOf = (name: string) => linkStates.get(name) ?? "new";
  const selectableVisible = repositories.filter((repository) =>
    isSelectableState(stateOf(repository.name)),
  );
  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((repository) => selected.has(repository.name));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-xs sm:flex-1">
          <Input
            size="sm"
            value={props.filter}
            onChange={(event) => props.onFilterChange(event.target.value)}
            placeholder="Filter repositories"
            aria-label="Filter repositories"
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-app-text-muted">{props.selectedCount} selected</span>
          <button
            type="button"
            onClick={() =>
              props.onToggleAll(
                selectableVisible.map((repository) => repository.name),
                allVisibleSelected,
              )
            }
            disabled={selectableVisible.length === 0}
            className="rounded-lg px-2 py-1 font-semibold text-app-brand-text transition hover:bg-app-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {allVisibleSelected ? "Clear all" : "Select all"}
          </button>
        </div>
      </div>

      <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
        {repositories.map((repository) => (
          <RepositoryRow
            key={repository.name}
            repository={repository}
            linkState={stateOf(repository.name)}
            selected={selected.has(repository.name)}
            disabled={!isSelectableState(stateOf(repository.name))}
            providerName={props.providerName}
            onToggle={() => props.onToggle(repository.name)}
          />
        ))}
      </ul>

      {props.hasMore && (
        <LoadMore loading={props.loadingMore} busy={props.busy} onClick={props.onLoadMore} />
      )}
    </div>
  );
}
