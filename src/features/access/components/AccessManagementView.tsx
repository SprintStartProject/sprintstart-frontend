import { useCallback, useMemo, useState } from "react";
import { Plug } from "lucide-react";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { Spinner } from "../../../components/ui/Spinner";
import { ACCESS_CONNECTORS } from "../registry";
import { AccessAddMenu } from "./AccessAddMenu";
import { AccessConnectorGroup } from "./AccessConnectorGroup";

/** Filter value showing only sources that actually have credentials stored. */
const IN_USE = "in-use";
/** Filter value keeping every known source visible, used or not. */
const ALL_SOURCES = "all";

/** What a host should start {@link AccessManagementView}'s filter at. */
export const DEFAULT_ACCESS_SOURCE_FILTER = IN_USE;

type ConnectorState = { loaded: boolean; count: number };

type AccessManagementViewProps = {
  /**
   * The filter belongs to the host, not to this component: the admin page
   * unmounts the whole section when you switch tabs, so a filter kept here
   * would silently snap back to the default on return — which is not what the
   * neighbouring user and project filters do, because those live on the page.
   */
  sourceFilter: string;
  onSourceFilterChange: (sourceFilter: string) => void;
};

/**
 * Access management for every connected source in one list.
 *
 * Replaces the previous tab-per-source layout, which put a second segmented
 * control under the page's own and would have overflowed as connectors were
 * added. Sources are stacked instead and narrowed through a dropdown — a
 * dropdown rather than a chip row precisely because a row of source buttons is
 * the same overflow problem in a different shape.
 *
 * The default filter is "in use": with many connectors registered, most of them
 * are things this installation does not use, and scrolling past a wall of empty
 * sources to reach the two that matter is the problem the unified view was
 * supposed to solve. Unused sources stay one dropdown entry away, and the add
 * menu reaches them regardless of the filter.
 *
 * Everything shown here comes from `ACCESS_CONNECTORS`, so a new connector is a
 * registry entry and nothing else. Used by both the admin Access Management
 * page and the user settings page.
 */
export function AccessManagementView({
  sourceFilter,
  onSourceFilterChange,
}: AccessManagementViewProps) {
  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [connectorStates, setConnectorStates] = useState<Record<string, ConnectorState>>({});

  const handleConnectorState = useCallback((connectorId: string, state: ConnectorState) => {
    setConnectorStates((current) => {
      const previous = current[connectorId];
      if (previous?.loaded === state.loaded && previous.count === state.count) {
        return current;
      }
      return { ...current, [connectorId]: state };
    });
  }, []);

  const filterOptions = useMemo<FilterSelectOption<string>[]>(
    () => [
      { value: IN_USE, label: "In use" },
      { value: ALL_SOURCES, label: "All sources" },
      ...ACCESS_CONNECTORS.map((connector) => ({
        value: connector.id,
        label: connector.label,
      })),
    ],
    [],
  );

  const isVisible = (connectorId: string) => {
    // A source being set up right now stays visible whatever the filter says,
    // so the open form cannot vanish under the user.
    if (openAddFor === connectorId) return true;
    if (sourceFilter === ALL_SOURCES) return true;
    if (sourceFilter !== IN_USE) return sourceFilter === connectorId;

    const state = connectorStates[connectorId];
    return Boolean(state?.loaded) && state.count > 0;
  };

  const isSettling = ACCESS_CONNECTORS.some((connector) => !connectorStates[connector.id]?.loaded);
  const hasVisibleConnector = ACCESS_CONNECTORS.some((connector) => isVisible(connector.id));

  /**
   * Opening a form is enough to reveal its source — `isVisible` treats that as
   * an override — so the filter is deliberately left alone. Narrowing it to the
   * chosen source instead would outlive the form: cancelling out of "add Jira"
   * used to leave the view stuck on Jira rather than back on what the user had
   * picked. The form focuses its first field on mount, which brings it into
   * view without moving anything else.
   */
  const handleAddRequest = (connectorId: string) => {
    setOpenAddFor(connectorId);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-app-text-muted">
          Credentials are stored per source and used for ingestion.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterSelect
            label="Filter access by source"
            value={sourceFilter}
            options={filterOptions}
            onChange={onSourceFilterChange}
            className="w-full sm:w-48"
          />

          <AccessAddMenu connectors={ACCESS_CONNECTORS} onSelect={handleAddRequest} />
        </div>
      </div>

      <div className="space-y-8">
        {ACCESS_CONNECTORS.map((connector) => (
          <AccessConnectorGroup
            key={connector.id}
            connector={connector}
            isHidden={!isVisible(connector.id)}
            isAddOpen={openAddFor === connector.id}
            onAddClose={() => setOpenAddFor(null)}
            onStateChange={handleConnectorState}
          />
        ))}
      </div>

      {/* Under "in use" nothing is visible until the sources report back, and
          each group's own spinner is hidden with it — without this the view
          would sit blank for the length of the slowest request. */}
      {!hasVisibleConnector && isSettling && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" label="Loading access sources" />
        </div>
      )}

      {!hasVisibleConnector && !isSettling && (
        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Plug className="h-8 w-8 text-app-text-disabled" aria-hidden />
            <div>
              <p className="text-base font-medium text-app-text">No source is set up yet</p>
              <p className="mt-1 text-sm text-app-text-muted">
                Add a credential to connect a source, or switch the filter to All sources to see
                everything that can be connected.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
