import { NotebookText } from "lucide-react";
import { connectorService } from "../../../../services/connectorService.ts";
import {
  notionService,
  type NotionWorkspaceConnectionDto,
  type NotionWorkspaceSyncResult,
} from "../../../../services/sources/notionService.ts";
import { notionWorkspaceOf } from "../../sourceDetails.ts";
import { requireProjectId } from "../actionContext.ts";
import type { ConnectorDefinition, ManualSyncOutcome } from "../types.ts";
import { notionConnections } from "./connections.ts";
import { NotionDetailsSection } from "./DetailsSection.tsx";
import { NotionDraftForm } from "./DraftForm.tsx";
import { connectNotionDraft, isSameNotionDraft, type NotionDraftSource } from "./draft.ts";

function pagesLabel(count: number): string {
  return count === 1 ? "1 page" : `${count} pages`;
}

/** Turns the synchronous Notion sync result into the outcome every connector reports. */
function toOutcome(result: NotionWorkspaceSyncResult): ManualSyncOutcome {
  if (result.failure || result.outcome === "FAILED") {
    return {
      status: "FAILED",
      title: "Notion sync failed",
      description: result.failure?.message
        ? `${result.failure.message} (${result.failure.stage.toLowerCase()})`
        : "No pages could be synced. Check that the token still has access.",
    };
  }

  if (result.outcome === "PARTIAL" || result.failedPages > 0) {
    return {
      status: "PARTIAL",
      title: "Notion sync finished with errors",
      description: `${pagesLabel(result.failedPages)} failed, ${result.successfulPages} synced.`,
    };
  }

  const removed = result.removedPages > 0 ? `, ${result.removedPages} removed` : "";

  return {
    status: "COMPLETED",
    title: "Notion workspace synced",
    description:
      result.successfulPages + result.removedPages === 0
        ? "No pages found. Share pages with the Notion integration, then sync again."
        : `${pagesLabel(result.successfulPages)} synced${removed}.`,
  };
}

/** A Notion workspace, connected to a project through its own connection record. */
export const notionConnector: ConnectorDefinition<NotionWorkspaceConnectionDto, NotionDraftSource> =
  {
    meta: {
      system: "NOTION",
      connectorId: "notion",
      label: "Notion",
      name: "Notion Workspace",
      noun: { singular: "workspace", plural: "workspaces" },
      icon: NotebookText,
      description: "Indexes the pages a Notion token can see, one workspace per connection.",
      connector: {
        label: "Notion Cloud Connector",
        description: "Pages from connected Notion workspaces.",
      },
    },
    chat: {
      filterable: true,
      matchesCitationUrl: (url) => url.includes("notion.so") || url.includes("notion.site"),
    },
    knowledgeBase: {
      label: "Notion",
      facetOrder: 5,
      icon: NotebookText,
      linkLabel: "Open in Notion",
      // Notion pages are stored as Markdown.
      markdown: true,
    },
    DetailsSection: NotionDetailsSection,
    // Notion runs carry the connection id as their repository id.
    runFilter: {
      param: "repositoryId",
      valueOf: (source) => notionWorkspaceOf(source)?.connectionId ?? null,
    },

    draft: {
      DraftForm: NotionDraftForm,
      formHint: "Pick a credential to index every page its token can see in Notion.",
      title: (draft) => draft.workspaceName,
      detail: (draft) => `${draft.credentialName} · ${pagesLabel(draft.pageCount)} visible`,
      isSame: isSameNotionDraft,
      connect: connectNotionDraft,
    },

    connections: notionConnections,

    actions: {
      // Notion ingests synchronously, so the sync reports how it went itself.
      manualSync: {
        isAvailable: (source) => Boolean(notionWorkspaceOf(source)?.connectionId),
        unavailableReason: "Workspace updates need the Notion connection.",
        async run(source, context) {
          const connectionId = notionWorkspaceOf(source)?.connectionId;
          if (!connectionId)
            throw new Error("Notion connection ID is not available for this source.");

          return toOutcome(
            await notionService.syncConnection(
              requireProjectId(context, "syncing a Notion workspace"),
              connectionId,
            ),
          );
        },
      },
      unlink: {
        isAvailable: (source) => Boolean(notionWorkspaceOf(source)?.connectionId),
        // A connection belongs to a single project, so removing it deletes the connection
        // itself and takes its pages out of the project's knowledge base.
        removalHint:
          "Its pages leave the knowledge base. Connecting the workspace again indexes it from scratch.",
        async run(source, context) {
          const connectionId = notionWorkspaceOf(source)?.connectionId;
          if (!connectionId) throw new Error("This source cannot be removed from the project.");

          await notionService.deleteConnection(
            requireProjectId(context, "removing it"),
            connectionId,
          );
        },
      },
      setEnabled: {
        isAvailable: (source) => Boolean(notionWorkspaceOf(source)?.connectionId),
        async run(source, enabled, context) {
          const connectionId = notionWorkspaceOf(source)?.connectionId;
          if (!connectionId) throw new Error("Notion connection ID is not available.");

          // Notion connections belong to exactly one project, so the patch is scoped to it.
          await connectorService.patchConnectorSources(
            "notion",
            [{ sourceId: connectionId, enabled }],
            requireProjectId(context, "changing the source"),
          );
        },
      },
      schedule: {
        // The scheduler only claims connections that have auto update on.
        skipsWhenAutoUpdateOff: true,
        isAvailable: (source) => Boolean(notionWorkspaceOf(source)?.connectionId),
        // Notion has no endpoint for a single connection: the project's list carries the schedule.
        async load(source, context) {
          const connectionId = notionWorkspaceOf(source)?.connectionId;
          if (!connectionId) throw new Error("Workspace sync config is not available.");

          const connections = await notionService.listConnections(
            requireProjectId(context, "loading the sync schedule"),
          );
          const connection = connections.find((candidate) => candidate.id === connectionId);
          if (!connection) throw new Error("Workspace sync config is not available.");

          return {
            autoUpdate: connection.autoUpdate,
            spec: connection.scheduleSpec,
            nextSyncAt: connection.nextSyncAt,
          };
        },
        async save(source, request, context) {
          const connectionId = notionWorkspaceOf(source)?.connectionId;
          if (!connectionId) throw new Error("Workspace sync config is not available.");

          await notionService.configureSchedule(
            requireProjectId(context, "saving the sync schedule"),
            connectionId,
            { schedule: request.schedule, autoUpdate: request.autoUpdate },
          );
        },
      },
    },

    identity: (status, connection) => ({
      sourceId: connection?.id ?? status?.sourceId ?? "",
      name: status?.displayName ?? connection?.workspaceName ?? "",
    }),

    fallbackBackendStatus: (connection) =>
      connection?.sourceEnabled === false ? "DISABLED" : "CONNECTED",

    toDetails: (status, connection) => ({
      system: "NOTION",
      workspace:
        status || connection
          ? {
              connectionId: connection?.id ?? null,
              sourceRef: status?.sourceId ?? connection?.workspaceId ?? connection?.id ?? "",
              workspaceName: connection?.workspaceName ?? status?.displayName ?? "",
              credentialName: connection?.credentialName ?? null,
            }
          : null,
    }),

    resourceSyncTimes: () => [],

    // A run carries the workspace id as its `sourceId`, or the connection id when Notion names none.
    runReferences: (details) => {
      if (details.system !== "NOTION" || !details.workspace) return [];

      return [details.workspace.sourceRef, details.workspace.connectionId].filter(
        (reference): reference is string => Boolean(reference),
      );
    },
  };
