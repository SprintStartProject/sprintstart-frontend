import { Plug } from "lucide-react";
import type { ConnectorDto } from "../../services/connectorService.ts";
import { findConnectorById } from "../data-ingestion/connectors/registry.ts";
import type { ConnectorListItem, ConnectorMeta } from "./types.ts";

const FALLBACK_CONNECTOR_META: Omit<ConnectorMeta, "label"> = {
  description: "Sources managed by this connector.",
  icon: Plug,
};

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

export function buildSourceKey(sources: { id: string; enabled: boolean }[]): string {
  return sources
    .map((source) => `${source.id}:${source.enabled}`)
    .sort()
    .join("|");
}
