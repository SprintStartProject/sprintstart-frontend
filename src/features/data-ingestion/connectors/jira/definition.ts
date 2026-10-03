import { Ticket } from "lucide-react";
import type { JiraInstanceDto } from "../../../../services/sources/jiraService.ts";
import type { ConnectorDefinition } from "../types.ts";

/** A Jira instance, identified by its URL and ingested as a whole. */
export const jiraConnector: ConnectorDefinition<JiraInstanceDto> = {
  meta: {
    system: "JIRA",
    connectorId: "jira",
    label: "Jira",
    name: "Jira Project Board",
    noun: { singular: "instance", plural: "instances" },
    icon: Ticket,
    description: "Indexes Jira issues, tasks, epics, comments and project-related metadata.",
  },
  supportsSchedule: true,
  chat: { filterable: true },

  identity: (status, instance) => ({
    sourceId: status?.sourceId ?? instance?.instanceUrl ?? "",
    name: status?.displayName ?? instance?.displayName ?? "",
  }),

  fallbackBackendStatus: (instance) =>
    instance?.sourceEnabled === false ? "DISABLED" : "CONNECTED",

  toDetails: (status, instance) => {
    const instanceUrl = status?.sourceId ?? instance?.instanceUrl;

    return {
      system: "JIRA",
      // The status row carries no credential metadata, so the instance record is
      // merged in purely for the credential shown in the details panel.
      instance: instanceUrl
        ? {
            instanceUrl,
            displayName: instance?.displayName ?? status?.displayName ?? instanceUrl,
            credentialName: instance?.updateCredentialName ?? "",
            credentialUserEmail: instance?.updateCredentialUserEmail ?? "",
          }
        : null,
      syncTimes: { issues: status?.lastIssuesSyncAt ?? null },
    };
  },

  runReferences: (details) =>
    details.system === "JIRA" && details.instance ? [details.instance.instanceUrl] : [],
};
