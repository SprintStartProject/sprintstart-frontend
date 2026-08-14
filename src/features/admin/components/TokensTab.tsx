import { AccessManagementView } from "../../access/components/AccessManagementView";

/**
 * Access section of the Access Management page.
 *
 * A thin shell over {@link AccessManagementView}: the section used to carry a
 * `GitHub | Jira` segmented control of its own — a second tab bar under the
 * page's — which does not survive more connectors. Sources now come from the
 * access connector registry, so this stays unchanged as they are added.
 */
export function TokensTab() {
  return <AccessManagementView />;
}
