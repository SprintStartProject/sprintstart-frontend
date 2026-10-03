import { Ticket } from "lucide-react";
import { connectorService } from "../../../../services/connectorService.ts";
import {
  configureJiraInstance,
  getJiraConfig,
  removeJiraInstanceFromProject,
  updateJiraInstance,
  type JiraInstanceDto,
} from "../../../../services/sources/jiraService.ts";
import { jiraInstanceOf } from "../../sourceDetails.ts";
import { requireProjectId } from "../actionContext.ts";
import type { ConnectorDefinition } from "../types.ts";
import { JiraDetailsSection } from "./DetailsSection.tsx";
import { JiraDraftForm } from "./DraftForm.tsx";
import { connectJiraDraft, isSameJiraDraft, type JiraDraftSource } from "./draft.ts";

/** A Jira instance, identified by its URL and ingested as a whole. */
export const jiraConnector: ConnectorDefinition<JiraInstanceDto, JiraDraftSource> = {
  meta: {
    system: "JIRA",
    connectorId: "jira",
    label: "Jira",
    name: "Jira Project Board",
    noun: { singular: "instance", plural: "instances" },
    icon: Ticket,
    description: "Indexes Jira issues, tasks, epics, comments and project-related metadata.",
  },
  chat: {
    filterable: true,
    // Jira and Confluence share the atlassian.net host; Confluence's /wiki/ path tells them apart.
    matchesCitationUrl: (url, name) =>
      (url.includes("atlassian.net") && !url.includes("/wiki/")) ||
      url.includes("/browse/") ||
      name.startsWith("jira #"),
  },
  knowledgeBase: { label: "Jira", facetOrder: 2, icon: Ticket, linkLabel: "Open in Jira" },
  DetailsSection: JiraDetailsSection,
  // A Jira run is scoped by its source reference, which is the instance URL.
  runFilter: { param: "sourceRef", valueOf: (source) => source.sourceId },

  draft: {
    DraftForm: JiraDraftForm,
    formHint: "Point to your Jira instance and pick a credential, then add it to the list.",
    title: (draft) => draft.displayName,
    detail: (draft) => draft.url,
    isSame: isSameJiraDraft,
    connect: connectJiraDraft,
  },

  actions: {
    update: {
      isAvailable: (source) => jiraInstanceOf(source) !== null,
      unavailableReason: "Instance updates need the Jira instance URL.",
      async run(source) {
        const instance = jiraInstanceOf(source);
        if (!instance) throw new Error("Instance details are not available for this source.");

        await updateJiraInstance({ instanceUrl: instance.instanceUrl });
      },
    },
    unlink: {
      isAvailable: (source) => jiraInstanceOf(source) !== null,
      // An instance is shared between projects and only loses the project
      // association, so re-linking restores it as it was.
      removalHint: "The instance and its artifacts are kept. You can re-link it later.",
      async run(source, context) {
        const instance = jiraInstanceOf(source);
        if (!instance) throw new Error("This source cannot be removed from the project.");

        await removeJiraInstanceFromProject(
          instance.instanceUrl,
          requireProjectId(context, "removing it"),
        );
      },
    },
    setEnabled: {
      isAvailable: (source) => jiraInstanceOf(source) !== null,
      async run(source, enabled) {
        const instance = jiraInstanceOf(source);
        if (!instance) throw new Error("Instance details are not available for this source.");

        // The JiraConnector's patchSource flips `sourceEnabled` and the AI service
        // is notified, keyed by the instance URL.
        await connectorService.patchConnectorSources("jira", [
          { sourceId: instance.instanceUrl, enabled },
        ]);
      },
    },
    schedule: {
      isAvailable: (source) => jiraInstanceOf(source) !== null,
      async load(source) {
        const instance = jiraInstanceOf(source);
        if (!instance) throw new Error("Instance sync config is not available.");

        return getJiraConfig(instance.instanceUrl);
      },
      async save(source, request) {
        const instance = jiraInstanceOf(source);
        if (!instance) throw new Error("Instance sync config is not available.");

        await configureJiraInstance({ instanceUrl: instance.instanceUrl, ...request });
      },
    },
  },

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

  // Jira refreshes issue data (comments and change history included) as one resource.
  resourceSyncTimes: (details) =>
    details.system === "JIRA" ? [{ label: "Issues", value: details.syncTimes.issues }] : [],

  runReferences: (details) =>
    details.system === "JIRA" && details.instance ? [details.instance.instanceUrl] : [],
};
