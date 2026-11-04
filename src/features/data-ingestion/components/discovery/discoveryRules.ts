import type { SourceSystem } from "../../types.ts";
import type {
  DiscoveredRepositoryItem,
  DiscoverySelection,
  RepositoryDiscoveryAdapter,
  RepositoryLinkState,
} from "./discoveryTypes";

/** "owner/name", lowercased: the key a repository is known by across the ingestion rows. */
export function fullNameOf(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

type IngestionStatus = {
  sourceSystem?: SourceSystem;
  sourceId: string;
  repositoryId?: string | null;
};

type ConnectedIndex = {
  /** "owner/name" (lowercased) -> repository id, for every repo connected anywhere. */
  idsByFullName: Map<string, string>;
  /** The subset already belonging to the current project. */
  projectFullNames: Set<string>;
};

/**
 * Which repositories of one provider are connected anywhere, and which to this project. A row
 * without a system label predates the field and is a GitHub row, the same fallback the ingestion
 * service applies when it maps the response. Only repository rows carry a repositoryId;
 * connector-neutral rows (Jira) have none and are not link-by-repository candidates here.
 */
export function connectedIndex(
  allConnected: IngestionStatus[],
  connectedToProject: IngestionStatus[],
  sourceSystem: SourceSystem,
): ConnectedIndex {
  const isOfProvider = (status: IngestionStatus) =>
    (status.sourceSystem ?? "GITHUB") === sourceSystem;

  return {
    idsByFullName: new Map(
      allConnected
        .filter(isOfProvider)
        .flatMap((status) =>
          status.repositoryId
            ? ([[status.sourceId.toLowerCase(), status.repositoryId]] as [string, string][])
            : [],
        ),
    ),
    projectFullNames: new Set(
      connectedToProject.filter(isOfProvider).map((status) => status.sourceId.toLowerCase()),
    ),
  };
}

/** What connecting one repository would mean, from what is known about where it is connected. */
export function linkStateOf(
  repository: DiscoveredRepositoryItem,
  fullName: string,
  index: ConnectedIndex,
): RepositoryLinkState {
  if (index.projectFullNames.has(fullName)) return "in-project";
  if (!repository.alreadyConnected) return "new";
  return index.idsByFullName.has(fullName) ? "linkable" : "unresolved";
}

export function linkStatesFor(
  repositories: DiscoveredRepositoryItem[],
  owner: string,
  index: ConnectedIndex,
): Map<string, RepositoryLinkState> {
  return new Map(
    repositories.map((repository) => [
      repository.name,
      linkStateOf(repository, fullNameOf(owner, repository.name), index),
    ]),
  );
}

export function isSelectableState(state: RepositoryLinkState): boolean {
  return state === "new" || state === "linkable";
}

/** The repositories whose name or label contains the filter text, case-insensitively. */
export function filterRepositories(
  repositories: DiscoveredRepositoryItem[],
  filter: string,
): DiscoveredRepositoryItem[] {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return repositories;

  return repositories.filter(
    (repository) =>
      repository.name.toLowerCase().includes(normalized) ||
      (repository.label?.toLowerCase().includes(normalized) ?? false),
  );
}

export function toggled(selected: ReadonlySet<string>, name: string): Set<string> {
  const next = new Set(selected);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

/** Selects every given name, or — when they are all selected already — clears them. */
export function toggledAll(
  selected: ReadonlySet<string>,
  names: string[],
  allSelected: boolean,
): Set<string> {
  const next = new Set(selected);
  names.forEach((name) => (allSelected ? next.delete(name) : next.add(name)));
  return next;
}

type SelectionInput = {
  repositories: DiscoveredRepositoryItem[];
  selected: ReadonlySet<string>;
  owner: string;
  linkStates: Map<string, RepositoryLinkState>;
  idsByFullName: Map<string, string>;
};

/** The resolved selection handed to the parent's connect flow. */
export function selectionFrom(input: SelectionInput): DiscoverySelection[] {
  return input.repositories
    .filter((repository) => input.selected.has(repository.name))
    .map((repository) => ({
      owner: input.owner,
      name: repository.name,
      isPrivate: repository.isPrivate,
      linkState: input.linkStates.get(repository.name) ?? "new",
      repositoryId: input.idsByFullName.get(fullNameOf(input.owner, repository.name)),
    }));
}

type FreshRequest =
  | { ok: true; owner: string; repositoryName: string | null; credential: string }
  | { ok: false; error: string };

/**
 * Reads the editable fields for a fresh discovery. The single field accepts an owner handle, a bare
 * "owner/name", or a full URL to either: when it carries a repository name the owner is still
 * discovered but that one repository is isolated in the results; a bare owner lists all of them.
 */
export function parseFreshRequest(
  adapter: RepositoryDiscoveryAdapter,
  ownerInput: string,
  credentialName: string,
): FreshRequest {
  const parsedInput = adapter.parseInput(ownerInput);
  if (!parsedInput) return { ok: false, error: adapter.invalidInputMessage };

  const credential = credentialName.trim();
  if (!credential) return { ok: false, error: adapter.credentialRequiredMessage };

  return { ok: true, owner: parsedInput.owner, repositoryName: parsedInput.name, credential };
}

/** The adapter's wording for a failed discovery, else the error's own message. */
export function discoverErrorMessage(
  adapter: RepositoryDiscoveryAdapter,
  error: unknown,
  owner: string,
): string {
  return (
    adapter.describeError?.(error, owner) ??
    (error instanceof Error ? error.message : "Repositories could not be discovered.")
  );
}
