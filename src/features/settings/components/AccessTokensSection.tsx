import { AccessManagementView } from "../../access/components/AccessManagementView";

/**
 * Access-token hub for the Settings page.
 *
 * Renders the same unified, source-filterable list as the admin Access
 * Management page, so the two never drift apart again — this section and that
 * tab previously kept their own copies of the GitHub PAT UI.
 */
export function AccessTokensSection() {
  return <AccessManagementView />;
}
