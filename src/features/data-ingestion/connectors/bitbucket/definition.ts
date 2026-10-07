import type { ProjectSource } from "../../../../services/projectService.ts";
import { BitbucketIcon } from "../../../../components/icons/BitbucketIcon.tsx";
import { connectorService } from "../../../../services/connectorService.ts";
import {
  configureBitbucketRepository,
  getBitbucketRepositoryConfig,
  removeBitbucketRepositoryFromProject,
  updateBitbucketRepository,
} from "../../../../services/sources/bitbucketService.ts";
import { bitbucketRepositoryOf } from "../../sourceDetails.ts";
import type { BitbucketRepositoryDetails, SourceInstanceIngestionStatus } from "../../types.ts";
import { requireProjectId } from "../actionContext.ts";
import { projectSourceConnections } from "../projectSources.ts";
import type { ConnectorDefinition } from "../types.ts";
import { BitbucketDetailsSection } from "./DetailsSection.tsx";
import { BitbucketDraftForm } from "./DraftForm.tsx";
import { connectBitbucketDraft, isSameBitbucketDraft, type BitbucketDraftSource } from "./draft.ts";
import { BitbucketWorkspaceMetadataView } from "./WorkspaceMetadataView.tsx";

/**
 * A status row names a repository `workspace/slug` (`sourceId`) and carries the
 * workspace as `owner` and the slug as `name`; the split of `sourceId` covers a
 * row that leaves them out.
 */
function repositoryFromStatus(status: SourceInstanceIngestionStatus): BitbucketRepositoryDetails {
  const [fallbackWorkspace = "", fallbackSlug = ""] = status.sourceId.split("/");

  return {
    repositoryId: status.repositoryId,
    workspace: status.owner ?? fallbackWorkspace,
    slug: status.name ?? fallbackSlug,
    fullName: status.sourceId,
    url: status.sourceUrl,
    enabled: status.enabled,
  };
}

/** A Bitbucket Cloud repository, connected to a project and ingested per repository. */
export const bitbucketConnector: ConnectorDefinition<ProjectSource, BitbucketDraftSource> = {
  meta: {
    system: "BITBUCKET",
    connectorId: "bitbucket",
    label: "Bitbucket",
    name: "Bitbucket Repository",
    noun: { singular: "repository", plural: "repositories" },
    icon: BitbucketIcon,
    description:
      "Indexes pull requests, README files and source files from Bitbucket Cloud repositories.",
    connector: {
      label: "Bitbucket Repository Connector",
      description: "Pull requests, files and metadata from connected Bitbucket Cloud repositories.",
    },
  },
  chat: {
    filterable: true,
    matchesCitationUrl: (url) => url.includes("bitbucket.org"),
  },
  knowledgeBase: {
    label: "Bitbucket",
    facetOrder: 2,
    icon: BitbucketIcon,
    linkLabel: "Open in Bitbucket",
    repositoryFacet: true,
    // The knowledge base filters Bitbucket artifacts by `workspace/slug`.
    scopeOf: (details) =>
      details.system === "BITBUCKET" && details.repository
        ? { repositories: [details.repository.fullName] }
        : {},
    // A workspace's profile is metadata only: it has no stored content to fetch.
    metadataView: {
      appliesTo: (artifact) => artifact.artifactType === "ORG_METADATA",
      View: BitbucketWorkspaceMetadataView,
    },
  },
  DetailsSection: BitbucketDetailsSection,
  // Bitbucket runs carry the connection id as their repository id.
  runFilter: {
    param: "repositoryId",
    valueOf: (source) => bitbucketRepositoryOf(source)?.repositoryId ?? null,
  },

  draft: {
    DraftForm: BitbucketDraftForm,
    formHint: "Pick a credential and a workspace, then choose the repositories to index.",
    title: (draft) => `${draft.workspace}/${draft.slug}`,
    detail: (draft) => draft.credentialName,
    // A repository ingested elsewhere is linked rather than fetched, so "Not connected yet"
    // would misdescribe it.
    pendingNote: (draft) => (draft.repositoryId ? "Already ingested, will be linked" : null),
    isSame: isSameBitbucketDraft,
    connect: connectBitbucketDraft,
  },

  connections: projectSourceConnections,

  actions: {
    update: {
      isAvailable: (source) => Boolean(bitbucketRepositoryOf(source)?.repositoryId),
      unavailableReason: "Repository updates need the Bitbucket connection.",
      async run(source) {
        const repositoryId = bitbucketRepositoryOf(source)?.repositoryId;
        if (!repositoryId) throw new Error("Repository details are not available for this source.");

        await updateBitbucketRepository(repositoryId);
      },
    },
    unlink: {
      isAvailable: (source) => Boolean(bitbucketRepositoryOf(source)?.repositoryId),
      // A repository is shared between projects and only loses the project
      // association, so re-linking restores it as it was.
      removalHint: "The repository and its artifacts are kept. You can re-link it later.",
      async run(source, context) {
        const repositoryId = bitbucketRepositoryOf(source)?.repositoryId;
        if (!repositoryId) throw new Error("This repository cannot be removed from the project.");

        await removeBitbucketRepositoryFromProject(
          repositoryId,
          requireProjectId(context, "removing it"),
        );
      },
    },
    setEnabled: {
      isAvailable: (source) => bitbucketRepositoryOf(source) !== null,
      async run(source, enabled) {
        const repository = bitbucketRepositoryOf(source);
        if (!repository) throw new Error("Repository details are not available for this source.");

        // Bitbucket repositories go through the same generic connector endpoint as
        // GitHub, keyed by `workspace/slug`.
        await connectorService.patchConnectorSources("bitbucket", [
          { sourceId: repository.fullName, enabled },
        ]);
      },
    },
    schedule: {
      // The scheduler passes over a repository with auto update off instead of
      // marking it out of date.
      skipsWhenAutoUpdateOff: true,
      isAvailable: (source) => bitbucketRepositoryOf(source) !== null,
      async load(source) {
        const repository = bitbucketRepositoryOf(source);
        if (!repository) throw new Error("Repository sync config is not available.");

        return getBitbucketRepositoryConfig(repository);
      },
      async save(source, request) {
        const repository = bitbucketRepositoryOf(source);
        if (!repository) throw new Error("Repository sync config is not available.");

        await configureBitbucketRepository(repository, request);
      },
    },
  },

  identity(status, projectSource) {
    if (status)
      return { sourceId: status.repositoryId ?? status.sourceId, name: status.displayName };

    return { sourceId: projectSource?.id ?? "", name: projectSource?.name ?? "" };
  },

  fallbackBackendStatus: (projectSource) => projectSource?.status ?? "CONNECTED",

  toDetails: (status) => ({
    system: "BITBUCKET",
    repository: status ? repositoryFromStatus(status) : null,
    syncTimes: { pullRequests: status?.lastPullRequestsSyncAt ?? null },
  }),

  // Bitbucket only reports a pull-request sync time; commits and issues are never synced.
  resourceSyncTimes: (details) =>
    details.system === "BITBUCKET"
      ? [{ label: "Pull requests", value: details.syncTimes.pullRequests }]
      : [],

  runReferences: (details) =>
    details.system === "BITBUCKET" && details.repository ? [details.repository.fullName] : [],
};
