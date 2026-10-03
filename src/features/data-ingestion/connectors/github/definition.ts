import { GitBranch } from "lucide-react";
import type { ProjectSource } from "../../../../services/projectService.ts";
import type { GithubRepositoryDetails, SourceInstanceIngestionStatus } from "../../types.ts";
import type { ConnectorDefinition } from "../types.ts";

function repositoryFromStatus(status: SourceInstanceIngestionStatus): GithubRepositoryDetails {
  return {
    owner: status.owner ?? "",
    name: status.name ?? "",
    repositoryId: status.repositoryId,
    fullName: status.sourceId,
    url: status.sourceUrl,
    enabled: status.enabled,
  };
}

/** A GitHub repository, connected to a project and ingested per repository. */
export const githubConnector: ConnectorDefinition<ProjectSource> = {
  meta: {
    system: "GITHUB",
    connectorId: "github",
    label: "GitHub",
    name: "GitHub Repository",
    noun: { singular: "repository", plural: "repositories" },
    icon: GitBranch,
    description: "Indexes repositories, README files, pull requests, issues and source files.",
    connector: {
      label: "GitHub Repository Connector",
      description:
        "Commits, files, issues and pull request metadata from connected GitHub repositories.",
    },
  },
  supportsSchedule: true,
  chat: { filterable: true },

  identity(status, projectSource) {
    if (projectSource) return { sourceId: projectSource.id, name: projectSource.name };

    // GitHub rows carry a repositoryId; fall back to the connector-neutral
    // sourceId so the card always has a stable selection key.
    return {
      sourceId: status?.repositoryId ?? status?.sourceId ?? "",
      name: status?.displayName ?? "",
    };
  },

  fallbackBackendStatus: (projectSource) => projectSource?.status ?? "CONNECTED",

  toDetails: (status) => ({
    system: "GITHUB",
    repository: status ? repositoryFromStatus(status) : null,
    syncTimes: {
      commits: status?.lastCommitsSyncAt ?? null,
      issues: status?.lastIssuesSyncAt ?? null,
      pullRequests: status?.lastPullRequestsSyncAt ?? null,
    },
  }),

  runReferences: (details) =>
    details.system === "GITHUB" && details.repository ? [details.repository.fullName] : [],
};
