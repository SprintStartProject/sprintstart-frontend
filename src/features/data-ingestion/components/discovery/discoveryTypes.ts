import type { ReactNode } from "react";
import type { SourceSystem } from "../../types.ts";

/**
 * What connecting a discovered repository to the current project would mean.
 *
 * `alreadyConnected` from discovery is global: it says the repo is a SprintStart
 * source *somewhere*, not that it belongs to this project. Such a repo can be
 * linked to the current project without fetching or ingesting it again, which is
 * why it stays selectable instead of being greyed out.
 */
export type RepositoryLinkState =
  /** Not a source yet: connecting fetches and ingests it. */
  | "new"
  /** Ingested elsewhere: connecting only links it, reusing its artifacts. */
  | "linkable"
  /** Already a source of this project: nothing left to do. */
  | "in-project"
  /** Ingested elsewhere, but its repository id could not be resolved. */
  | "unresolved";

/**
 * A resolved, selected repository handed to the parent's connect flow. `owner`
 * is the GitHub owner or the Bitbucket workspace, `name` the repository name or
 * slug.
 */
export type DiscoverySelection = {
  /** The owner that actually produced the results (repos carry only a name). */
  owner: string;
  name: string;
  isPrivate: boolean;
  linkState: RepositoryLinkState;
  /** Present for `linkable` repos, so they can be linked instead of re-ingested. */
  repositoryId?: string;
};

/** One repository of a discovery page, normalized across providers. */
export type DiscoveredRepositoryItem = {
  /** Repository name (GitHub) or slug (Bitbucket): the key and what a selection carries. */
  name: string;
  /** Text shown in the row when it differs from `name` (a Bitbucket display name). */
  label?: string;
  isPrivate: boolean;
  /** Browser URL of the repository; the row shows no link when null. */
  url: string | null;
  alreadyConnected: boolean;
  isEnabled: boolean | null;
};

export type RepositoryDiscoveryPage = {
  repositories: DiscoveredRepositoryItem[];
  hasMore: boolean;
};

/**
 * What differs between the providers: how a page is fetched, how the owner field
 * is read, which ingestion rows count as "the same provider", and the wording.
 * Must be a stable reference (a module-level constant) so discovery callbacks are
 * not rebuilt on every render.
 */
export type RepositoryDiscoveryAdapter = {
  /**
   * The source system a repository belongs to. Only ingestion rows of this
   * system count as "already ingested" or "in this project", so a Bitbucket
   * repository sharing `owner/name` with a GitHub one is not seen as linkable.
   */
  sourceSystem: SourceSystem;
  /** Provider name for the link labels, e.g. "GitHub". */
  providerName: string;
  /** Loads one 0-based page of `owner`'s repositories with the named credential. */
  discover: (
    owner: string,
    credentialName: string,
    page: number,
    pageSize: number,
  ) => Promise<RepositoryDiscoveryPage>;
  /**
   * Reads the free-form owner field: the owner (organization, user or
   * workspace) and, when the input names a single repository, its name. Returns
   * null when no owner can be found.
   */
  parseInput: (value: string) => { owner: string; name: string | null } | null;
  ownerLabel: string;
  ownerPlaceholder: string;
  /** Shown when {@link parseInput} finds no owner. */
  invalidInputMessage: string;
  /** Shown when no credential is selected. */
  credentialRequiredMessage: string;
  /** Banner shown while the user has no stored credential at all. */
  missingCredentialNotice: string;
  /** Empty-state body when discovery returns no repositories. */
  emptyResultHint: ReactNode;
  /**
   * Provider-specific wording for a failed discovery (e.g. an unknown owner or a
   * rate limit). Return null to fall back to the error's own message.
   */
  describeError?: (error: unknown, owner: string) => string | null;
};
