import { BookOpen, GitBranch, Plug } from "lucide-react";
import type { ConnectorDto } from "../../services/connectorService.ts";
import type { ConnectorListItem, ConnectorMeta } from "./types.ts";

/**
 * Presentation metadata for connectors known to the frontend today.
 */
const CONNECTOR_META: Record<string, ConnectorMeta> = {
  github: {
    label: "GitHub Repository Connector",
    description:
      "Commits, files, issues and pull request metadata from connected GitHub repositories.",
    icon: GitBranch,
  },
  confluence: {
    label: "Confluence Cloud Connector",
    description: "Pages and spaces from connected Confluence Cloud tenants.",
    icon: BookOpen,
  },
};

const FALLBACK_CONNECTOR_META: Omit<ConnectorMeta, "label"> = {
  description: "Sources managed by this connector.",
  icon: Plug,
};

export function getConnectorMeta(connector: ConnectorDto): ConnectorMeta {
  const knownMeta = CONNECTOR_META[connector.id];

  if (knownMeta) {
    return knownMeta;
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
