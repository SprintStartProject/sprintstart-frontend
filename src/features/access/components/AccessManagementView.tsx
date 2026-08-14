import { useMemo, useState } from "react";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { ACCESS_CONNECTORS } from "../registry";
import { AccessConnectorGroup } from "./AccessConnectorGroup";

/** Filter value that keeps every source visible. */
const ALL_SOURCES = "all";

/**
 * Access management for every connected source in one list.
 *
 * Replaces the previous tab-per-source layout, which put a second segmented
 * control under the page's own and would have overflowed as connectors were
 * added. Sources are stacked instead and narrowed through a dropdown — a
 * dropdown rather than a chip row precisely because a row of source buttons is
 * the same overflow problem in a different shape.
 *
 * Everything shown here comes from `ACCESS_CONNECTORS`, so a new connector is a
 * registry entry and nothing else. Used by both the admin Access Management
 * page and the user settings page.
 */
export function AccessManagementView() {
  const [sourceFilter, setSourceFilter] = useState<string>(ALL_SOURCES);

  const filterOptions = useMemo<FilterSelectOption<string>[]>(
    () => [
      { value: ALL_SOURCES, label: "All sources" },
      ...ACCESS_CONNECTORS.map((connector) => ({
        value: connector.id,
        label: connector.label,
      })),
    ],
    [],
  );

  const visibleConnectors =
    sourceFilter === ALL_SOURCES
      ? ACCESS_CONNECTORS
      : ACCESS_CONNECTORS.filter((connector) => connector.id === sourceFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-app-text-muted">
          Credentials are stored per source and used for ingestion.
        </p>

        <FilterSelect
          label="Filter access by source"
          value={sourceFilter}
          options={filterOptions}
          onChange={setSourceFilter}
          className="w-full sm:w-48"
        />
      </div>

      <div className="space-y-8">
        {visibleConnectors.map((connector) => (
          // Keyed by id so switching the filter remounts nothing that stays
          // visible — a group keeps its loaded entries while others come and go.
          <AccessConnectorGroup key={connector.id} connector={connector} />
        ))}
      </div>
    </div>
  );
}
