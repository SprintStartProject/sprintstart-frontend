import { useState } from "react";
import {
  AccessManagementView,
  DEFAULT_ACCESS_SOURCE_FILTER,
} from "../../access/components/AccessManagementView";

/**
 * Access-token hub for the Settings page.
 *
 * Renders the same unified, source-filterable list as the admin Access
 * Management page, so the two cannot drift apart.
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
