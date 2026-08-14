import { AccessManagementView } from "../../access/components/AccessManagementView";

type TokensTabProps = {
  sourceFilter: string;
  onSourceFilterChange: (sourceFilter: string) => void;
};

/**
 * Access section of the Access Management page.
 *
 * A thin shell over {@link AccessManagementView}: the section used to carry a
 * `GitHub | Jira` segmented control of its own — a second tab bar under the
 * page's — which does not survive more connectors. Sources now come from the
 * access connector registry, so this stays unchanged as they are added.
 *
 * The filter is passed through from the page rather than owned here, because
 * switching tabs unmounts this whole section.
 */
export function TokensTab({ sourceFilter, onSourceFilterChange }: TokensTabProps) {
  return (
    <AccessManagementView sourceFilter={sourceFilter} onSourceFilterChange={onSourceFilterChange} />
  );
}
