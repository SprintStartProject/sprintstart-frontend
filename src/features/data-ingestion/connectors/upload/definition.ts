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
  supportsSchedule: false,
  // Uploads are always offered in the chat filter; the backend skips them when it
  // validates a source filter against the enabled connectors.
  chat: { filterable: true },

  identity: (status, projectSource) =>
    status
      ? { sourceId: status.sourceId, name: status.displayName }
      : { sourceId: projectSource?.id ?? "", name: projectSource?.name ?? "" },

  fallbackBackendStatus: (projectSource) => projectSource?.status ?? "CONNECTED",

  toDetails: () => ({ system: "UPLOAD" }),

  runReferences: () => [],
};
