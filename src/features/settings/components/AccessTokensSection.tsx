import { useState } from "react";
import {
  AccessManagementView,
  DEFAULT_ACCESS_SOURCE_FILTER,
} from "../../access/components/AccessManagementView";

/**
 * Access-token hub for the Settings page.
 *
 * Renders the same unified, source-filterable list as the admin Access
 * Management page, so the two never drift apart again — this section and that
 * tab previously kept their own copies of the GitHub PAT UI.
 *
 * Owns the filter because the view does not: here the section is always
 * mounted, so this state simply lives as long as the page does.
 */
export function AccessTokensSection() {
  const [sourceFilter, setSourceFilter] = useState<string>(DEFAULT_ACCESS_SOURCE_FILTER);

  return (
    <AccessManagementView sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter} />
  );
}
