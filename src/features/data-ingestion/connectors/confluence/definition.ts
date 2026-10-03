import { BookOpen } from "lucide-react";
import { connectorService } from "../../../../services/connectorService.ts";
import {
  confluenceService,
  type ConfluenceConnectionDto,
  type ConfluenceIngestionResult,
} from "../../../../services/sources/confluenceService.ts";
import { confluenceSpaceOf } from "../../sourceDetails.ts";
import { requireProjectId } from "../actionContext.ts";
import type { ConnectorDefinition, ManualSyncOutcome } from "../types.ts";
import { ConfluenceDetailsSection } from "./DetailsSection.tsx";

/** Turns the synchronous Confluence ingestion result into the outcome every connector reports. */
function toOutcome(result: ConfluenceIngestionResult): ManualSyncOutcome {
  if (result.status === "COMPLETED") {
    return {
      status: "COMPLETED",
      title: "Confluence sync completed",
      description: `${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`,
    };
  }

  if (result.status === "PARTIAL") {
    return {
      status: "PARTIAL",
      title: "Confluence sync finished with errors",
      description: `${result.failed} pages failed out of ${result.discovered} discovered.`,
    };
  }

  return {
    status: "FAILED",
    title: "Confluence sync failed",
    description: "No pages could be ingested. Check connection permissions.",
  };
}

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
  chat: { filterable: true },
  DetailsSection: ConfluenceDetailsSection,
  // Confluence runs carry the connection id as their repository id.
  runFilter: {
    param: "repositoryId",
    valueOf: (source) => confluenceSpaceOf(source)?.connectionId ?? null,
  },

  actions: {
    // Confluence ingests synchronously, so the sync reports how it went itself.
    manualSync: {
      isAvailable: (source) => Boolean(confluenceSpaceOf(source)?.connectionId),
      unavailableReason: "Space updates need the Confluence space ID.",
      async run(source, context) {
        // The connection UUID, rather than source.sourceId which may hold a raw
        // status-row ref string.
        const connectionId = confluenceSpaceOf(source)?.connectionId;
        if (!connectionId) {
          throw new Error("Confluence connection ID is not available for this source.");
        }

        return toOutcome(
          await confluenceService.syncConnection(
            requireProjectId(context, "syncing a Confluence space"),
            connectionId,
          ),
        );
      },
    },
    unlink: {
      isAvailable: (source) => Boolean(confluenceSpaceOf(source)?.connectionId),
      // A connection belongs to a single project, so removing it deletes the
      // connection itself: the pages already ingested stay, but the space has to
      // be set up again.
      removalHint:
        "The pages it already ingested are kept. Connecting the space again sets it up from scratch.",
      async run(source, context) {
        const connectionId = confluenceSpaceOf(source)?.connectionId;
        if (!connectionId) throw new Error("This source cannot be removed from the project.");

        await confluenceService.deleteConnection(
          requireProjectId(context, "removing it"),
          connectionId,
        );
      },
    },
    setEnabled: {
      isAvailable: (source) => Boolean(confluenceSpaceOf(source)?.connectionId),
      async run(source, enabled, context) {
        const connectionId = confluenceSpaceOf(source)?.connectionId;
        if (!connectionId) throw new Error("Confluence connection ID is not available.");

        // Confluence sources belong to exactly one project, so the patch is scoped to it.
        await connectorService.patchConnectorSources(
          "confluence",
          [{ sourceId: connectionId, enabled }],
          requireProjectId(context, "changing the source"),
        );
      },
    },
    schedule: {
      isAvailable: (source) => Boolean(confluenceSpaceOf(source)?.connectionId),
      // Confluence has no dedicated config endpoint: the connection itself carries
      // the schedule, so the form reads it straight off the connection.
      async load(source, context) {
        const connectionId = confluenceSpaceOf(source)?.connectionId;
        if (!connectionId) throw new Error("Space sync config is not available.");

        const connection = await confluenceService.getConnection(
          requireProjectId(context, "loading the sync schedule"),
          connectionId,
        );

        return {
          autoUpdate: connection.autoUpdate ?? false,
          spec: connection.spec ?? null,
          nextSyncAt: connection.nextSyncAt ?? null,
        };
      },
      async save(source, request, context) {
        const connectionId = confluenceSpaceOf(source)?.connectionId;
        if (!connectionId) throw new Error("Space sync config is not available.");

        await confluenceService.configureSchedule(
          requireProjectId(context, "saving the sync schedule"),
          connectionId,
          { schedule: request.schedule, autoUpdate: request.autoUpdate },
        );
      },
    },
  },

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

  resourceSyncTimes: () => [],

  runReferences: (details) => {
    if (details.system !== "CONFLUENCE" || !details.space) return [];

    const { connectionId, baseUrl, spaceId, spaceKey } = details.space;
    const composite = baseUrl && spaceId ? `${baseUrl}|${spaceId}` : "";

    return [connectionId, composite, composite.toLowerCase(), spaceKey, spaceId].filter(Boolean);
  },
};
