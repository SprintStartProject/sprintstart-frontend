import { GitBranch } from "lucide-react";
import type { ProjectSource } from "../../../../services/projectService.ts";
import { connectorService } from "../../../../services/connectorService.ts";
import {
  configureGithubRepository,
  getGithubRepositoryConfig,
  removeRepositoryFromProject,
  updateGithubRepository,
} from "../../../../services/sources/githubService.ts";
import { githubRepositoryOf } from "../../sourceDetails.ts";
import type { GithubRepositoryDetails, SourceInstanceIngestionStatus } from "../../types.ts";
import { requireProjectId } from "../actionContext.ts";
import { projectSourceConnections } from "../projectSources.ts";
import type { ConnectorDefinition } from "../types.ts";
import { GithubDetailsSection } from "./DetailsSection.tsx";
import { GithubOrgMetadataView } from "./OrgMetadataView.tsx";
import { GithubDraftForm } from "./DraftForm.tsx";
import { connectGithubDraft, isSameGithubDraft, type GithubDraftSource } from "./draft.ts";

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
export const githubConnector: ConnectorDefinition<ProjectSource, GithubDraftSource> = {
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
  chat: { filterable: true, isDefaultCitationSource: true },
  knowledgeBase: {
    label: "GitHub",
    facetOrder: 1,
    icon: GitBranch,
    linkLabel: "Open in GitHub",
    // The knowledge base filters GitHub artifacts by `owner/name`.
    scopeOf: (details) =>
      details.system === "GITHUB" && details.repository
        ? { repositories: [`${details.repository.owner}/${details.repository.name}`] }
        : {},
    // An organization's profile is metadata only: its content endpoint redirects to GitHub.
    metadataView: {
      appliesTo: (artifact) => artifact.artifactType === "ORG_METADATA",
      View: GithubOrgMetadataView,
    },
  },
  DetailsSection: GithubDetailsSection,
  runFilter: {
    param: "repositoryId",
    valueOf: (source) => githubRepositoryOf(source)?.repositoryId ?? null,
  },

  draft: {
    DraftForm: GithubDraftForm,
    formHint: "Pick the repositories to index, then add them to your source list.",
    title: (draft) => `${draft.owner}/${draft.name}`,
    detail: (draft) => draft.tokenName,
    // A repository ingested elsewhere is linked rather than fetched, so "Not connected yet"
    // would misdescribe it.
    pendingNote: (draft) => (draft.repositoryId ? "Already ingested, will be linked" : null),
    // The knowledge-gaps analysis keys a repository's component by `owner/name`.
    ownerComponent: (draft) => `${draft.owner}/${draft.name}`,
    isSame: isSameGithubDraft,
    connect: connectGithubDraft,
  },

  connections: projectSourceConnections,

  actions: {
    update: {
      isAvailable: (source) => githubRepositoryOf(source) !== null,
      unavailableReason: "Repository updates need GitHub owner and repository name.",
      async run(source) {
        const repository = githubRepositoryOf(source);
        if (!repository) throw new Error("Repository details are not available for this source.");

        await updateGithubRepository(repository);
      },
    },
    unlink: {
      isAvailable: (source) => Boolean(githubRepositoryOf(source)?.repositoryId),
      // A repository is shared between projects and only loses the project
      // association, so re-linking restores it as it was.
      removalHint: "The repository and its artifacts are kept. You can re-link it later.",
      async run(source, context) {
        const repositoryId = githubRepositoryOf(source)?.repositoryId;
        if (!repositoryId) throw new Error("This repository cannot be removed from the project.");

        await removeRepositoryFromProject(repositoryId, requireProjectId(context, "removing it"));
      },
    },
    setEnabled: {
      isAvailable: (source) => githubRepositoryOf(source) !== null,
      async run(source, enabled) {
        const repository = githubRepositoryOf(source);
        if (!repository) throw new Error("Repository details are not available for this source.");

        await connectorService.patchConnectorSources("github", [
          { sourceId: repository.fullName, enabled },
        ]);
      },
    },
    schedule: {
      isAvailable: (source) => githubRepositoryOf(source) !== null,
      async load(source) {
        const repository = githubRepositoryOf(source);
        if (!repository) throw new Error("Repository sync config is not available.");

        return getGithubRepositoryConfig(repository);
      },
      async save(source, request) {
        const repository = githubRepositoryOf(source);
        if (!repository) throw new Error("Repository sync config is not available.");

        await configureGithubRepository(repository, request);
      },
    },
  },

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

  // GitHub exposes one timestamp per resource type.
  resourceSyncTimes: (details) =>
    details.system === "GITHUB"
      ? [
          { label: "Commits", value: details.syncTimes.commits },
          { label: "Issues", value: details.syncTimes.issues },
          { label: "Pull requests", value: details.syncTimes.pullRequests },
        ]
      : [],

  runReferences: (details) =>
    details.system === "GITHUB" && details.repository ? [details.repository.fullName] : [],
};
