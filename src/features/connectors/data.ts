import { Plug } from "lucide-react";
import type { ConnectorDto } from "../../services/connectorService.ts";
import { findConnectorById } from "../data-ingestion/connectors/registry.ts";
import type { ConnectorListItem, ConnectorMeta } from "./types.ts";

const FALLBACK_CONNECTOR_META: Omit<ConnectorMeta, "label"> = {
  description: "Sources managed by this connector.",
  icon: Plug,
};

/**
 * Label, description and icon for a connector. GitHub and Confluence have their own; any other
 * connector the backend reports gets its backend name and a generic description and icon.
 */
export function getConnectorMeta(connector: ConnectorDto): ConnectorMeta {
  // The registry words the connectors the frontend knows; one without wording
  // there (such as Jira) is listed under the name the backend reports for it.
  const known = findConnectorById(connector.id)?.meta;

  if (known?.connector) {
    return { ...known.connector, icon: known.icon };
  }

  return {
    label: connector.name,
    ...FALLBACK_CONNECTOR_META,
  };
}

export function toConnectorListItems(connectors: ConnectorDto[]): ConnectorListItem[] {
  return connectors.map((connector) => ({
    ...connector,
    meta: getConnectorMeta(connector),
  }));
}

/**
 * Fingerprint of a connector's sources and their allow/deny state, independent of their order.
 * A pending edit that was made against a different fingerprint is stale and gets dropped.
 */
export function buildSourceKey(sources: { id: string; enabled: boolean }[]): string {
  return sources
    .map((source) => `${source.id}:${source.enabled}`)
    .sort()
    .join("|");
}
