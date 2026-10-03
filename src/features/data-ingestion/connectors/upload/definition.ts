import { FileText } from "lucide-react";
import type { ProjectSource } from "../../../../services/projectService.ts";
import type { ConnectorDefinition } from "../types.ts";

/** Manually uploaded documentation. Not a connector: nothing to schedule or enable upstream. */
export const uploadConnector: ConnectorDefinition<ProjectSource> = {
  meta: {
    system: "UPLOAD",
    connectorId: "upload",
    label: "Upload",
    name: "Uploaded Documentation",
    noun: { singular: "file", plural: "files" },
    icon: FileText,
    description: "Indexes manually uploaded documentation, markdown files and project knowledge.",
  },
  // Uploads are always offered in the chat filter; the backend skips them when it
  // validates a source filter against the enabled connectors.
  chat: { filterable: true },
  // There is no upstream to update, unlink from a project, switch or schedule.
  actions: {},
  DetailsSection: null,

  identity: (status, projectSource) =>
    status
      ? { sourceId: status.sourceId, name: status.displayName }
      : { sourceId: projectSource?.id ?? "", name: projectSource?.name ?? "" },

  fallbackBackendStatus: (projectSource) => projectSource?.status ?? "CONNECTED",

  toDetails: () => ({ system: "UPLOAD" }),

  resourceSyncTimes: () => [],

  runReferences: () => [],
};
