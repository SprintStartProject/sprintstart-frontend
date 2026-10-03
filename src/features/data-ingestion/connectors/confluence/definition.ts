import { BookOpen } from "lucide-react";
import type { ConfluenceConnectionDto } from "../../../../services/sources/confluenceService.ts";
import type { ConnectorDefinition } from "../types.ts";

/** A Confluence space, connected to a project through its own connection record. */
export const confluenceConnector: ConnectorDefinition<ConfluenceConnectionDto> = {
  meta: {
    system: "CONFLUENCE",
    connectorId: "confluence",
    label: "Confluence",
    name: "Confluence Space",
    noun: { singular: "space", plural: "spaces" },
    icon: BookOpen,
    description: "Indexes pages, hierarchical documents and spaces from Confluence Cloud.",
    connector: {
      label: "Confluence Cloud Connector",
      description: "Pages and spaces from connected Confluence Cloud tenants.",
    },
  },
  supportsSchedule: true,
  chat: { filterable: true },

  identity: (status, connection) => ({
    sourceId: connection?.id ?? status?.sourceId ?? "",
    name:
      status?.displayName ??
      connection?.spaceName ??
      connection?.spaceKey ??
      connection?.spaceId ??
      "",
  }),

  fallbackBackendStatus: (connection) =>
    connection?.sourceEnabled === false ? "DISABLED" : "CONNECTED",

  toDetails: (_status, connection) => ({
    system: "CONFLUENCE",
    // A status row alone cannot name the space, so a card without a connection
    // record has no space details.
    space: connection
      ? {
          connectionId: connection.id,
          baseUrl: connection.baseUrl,
          spaceId: connection.spaceId,
          spaceKey: connection.spaceKey,
          spaceName: connection.spaceName,
          credentialName: connection.credentialName,
        }
      : null,
  }),

  runReferences: (details) => {
    if (details.system !== "CONFLUENCE" || !details.space) return [];

    const { connectionId, baseUrl, spaceId, spaceKey } = details.space;
    const composite = baseUrl && spaceId ? `${baseUrl}|${spaceId}` : "";

    return [connectionId, composite, composite.toLowerCase(), spaceKey, spaceId].filter(Boolean);
  },
};
