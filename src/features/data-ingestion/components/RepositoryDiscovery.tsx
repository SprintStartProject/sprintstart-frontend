import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DiscoveringSpinner, DiscoveryAlert, NoRepositories } from "./discovery/DiscoveryNotices";
import { DiscoveryForm } from "./discovery/DiscoveryForm";
import { filterRepositories, linkStatesFor, selectionFrom } from "./discovery/discoveryRules";
import type { DiscoverySelection, RepositoryDiscoveryAdapter } from "./discovery/discoveryTypes";
import { RepositoryList } from "./discovery/RepositoryList";
import { useConnectedRepositories } from "./discovery/useConnectedRepositories";
import { useDiscoveryRun } from "./discovery/useDiscoveryRun";
import { useRepositoryPicker } from "./discovery/useRepositoryPicker";

export type {
  DiscoveredRepositoryItem,
  DiscoverySelection,
  RepositoryDiscoveryAdapter,
} from "./discovery/discoveryTypes";

type RepositoryDiscoveryProps = {
  adapter: RepositoryDiscoveryAdapter;
  /** Whether the user has any stored credential; disables the form without one. */
  hasCredentials: boolean;
  /** Selected credential (the parent needs it at connect time). */
  credentialName: string;
  /**
   * Renders the credential picker (a GitHub token or an Atlassian credential
   * dropdown, with its label). `disabled` is true while discovery or the
   * parent's connect batch runs, or without any stored credential.
   */
  renderCredentialPicker: (state: { disabled: boolean }) => ReactNode;
  /**
   * Project the repositories would be connected to, or `null` when there is no
   * project yet (e.g. the create-project wizard stages the selection first). With
   * no project the "already in this project" classification is skipped, but the
   * global "ingested elsewhere" check still runs.
   */
  projectId: string | null;
  /** Reports the resolved selection whenever it changes. Must be stable. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
  /** True while the parent runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
  /** Connect error from the parent, shown below any discovery error. */
  connectError?: string | null;
  /**
   * Hides the built-in "no stored credential" banner. Set when the parent shows
   * its own hint (e.g. the wizard's compact notice next to its inline "Add"
   * button) so the message is not duplicated.
   */
  suppressMissingCredentialNotice?: boolean;
};

/**
 * Provider-neutral repository discovery: searchable, paginated, multi-select,
 * with an "already ingested elsewhere → link instead of re-ingest" classification.
 *
 * Owns discovery and the selection set; the resolved selection is reported up via
 * {@link RepositoryDiscoveryProps.onSelectionChange} so the parent keeps its own
 * connect button and decides what connecting means (immediate connect on the Data
 * Ingestion page, staged connect in the create-project wizard). The provider
 * differences come in through a {@link RepositoryDiscoveryAdapter}.
 */
export function RepositoryDiscovery({
  adapter,
  hasCredentials,
  credentialName,
  renderCredentialPicker,
  projectId,
  onSelectionChange,
  isConnecting = false,
  connectError,
  suppressMissingCredentialNotice = false,
}: RepositoryDiscoveryProps) {
  const [ownerInput, setOwnerInput] = useState("");
  const picker = useRepositoryPicker();
  const connected = useConnectedRepositories(adapter.sourceSystem, projectId);
  const discovery = useDiscoveryRun({
    adapter,
    ownerInput,
    credentialName,
    onFreshResults: (filter) => {
      picker.clearSelection();
      picker.setFilter(filter);
    },
    loadConnected: connected.load,
    onReset: () => {
      picker.clearSelection();
      picker.setFilter("");
    },
  });
  const { repositories, resolvedOwner } = discovery;
  const isDiscovering = discovery.state === "loading" || discovery.state === "loadingMore";
  const isBusy = isDiscovering || isConnecting;

  const linkStates = useMemo(
    () => linkStatesFor(repositories, resolvedOwner, connected),
    [repositories, resolvedOwner, connected],
  );
  const selection = useMemo<DiscoverySelection[]>(
    () =>
      selectionFrom({
        repositories,
        selected: picker.selected,
        owner: resolvedOwner,
        linkStates,
        idsByFullName: connected.idsByFullName,
      }),
    [repositories, picker.selected, resolvedOwner, linkStates, connected.idsByFullName],
  );

  // Report the resolved selection up. `onSelectionChange` must be stable (a
  // useState setter or a memoised callback) so this only fires when the
  // selection actually changes.
  useEffect(() => {
    onSelectionChange(selection);
  }, [onSelectionChange, selection]);

  return (
    <div className="space-y-5">
      {!hasCredentials && !suppressMissingCredentialNotice && (
        <DiscoveryAlert tone="warning">{adapter.missingCredentialNotice}</DiscoveryAlert>
      )}

      <DiscoveryForm
        ownerLabel={adapter.ownerLabel}
        ownerPlaceholder={adapter.ownerPlaceholder}
        ownerInput={ownerInput}
        onOwnerInputChange={setOwnerInput}
        disabled={isBusy || !hasCredentials}
        loading={discovery.state === "loading"}
        credentialPicker={renderCredentialPicker({ disabled: isBusy || !hasCredentials })}
        onSubmit={() => void discovery.run(0)}
      />

      {discovery.error && <DiscoveryAlert tone="warning">{discovery.error}</DiscoveryAlert>}
      {connectError && <DiscoveryAlert tone="danger">{connectError}</DiscoveryAlert>}
      {discovery.state === "loading" && <DiscoveringSpinner />}
      {discovery.state === "loaded" && repositories.length === 0 && (
        <NoRepositories hint={adapter.emptyResultHint} />
      )}

      {repositories.length > 0 && (
        <RepositoryList
          repositories={filterRepositories(repositories, picker.filter)}
          linkStates={linkStates}
          selected={picker.selected}
          selectedCount={selection.length}
          providerName={adapter.providerName}
          filter={picker.filter}
          onFilterChange={picker.setFilter}
          onToggle={picker.toggle}
          onToggleAll={picker.toggleAll}
          hasMore={discovery.hasMore}
          loadingMore={discovery.state === "loadingMore"}
          busy={isBusy}
          onLoadMore={() => void discovery.run(discovery.page + 1)}
        />
      )}
    </div>
  );
}
