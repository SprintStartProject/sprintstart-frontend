import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { ApiError } from "../../../services/apiClient.ts";
import {
  discoverRepositories,
  type DiscoveredRepository,
} from "../../../services/sources/githubService.ts";
import { getIngestionSourceStatuses } from "../../../services/ingestionService.ts";
import {
  parseGithubOwnerInput,
  parseGithubRepositoryReference,
} from "../../../services/sources/githubRepositoryInput.ts";

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

/** A resolved, selected repository handed to the parent's connect flow. */
export type DiscoverySelection = {
  /** The owner that actually produced the results (repos carry only a name). */
  owner: string;
  name: string;
  isPrivate: boolean;
  linkState: RepositoryLinkState;
  /** Present for `linkable` repos, so they can be linked instead of re-ingested. */
  repositoryId?: string;
};

type GithubRepositoryDiscoveryProps = {
  tokenNames: string[];
  /**
   * Project the repositories would be connected to, or `null` when there is no
   * project yet (e.g. the create-project wizard stages the selection first). With
   * no project the "already in this project" classification is skipped, but the
   * global "ingested elsewhere" check still runs.
   */
  projectId: string | null;
  projectName?: string;
  /** Controlled token selection (the parent needs it at connect time). */
  tokenName: string;
  onTokenNameChange: (name: string) => void;
  /** Reports the resolved selection whenever it changes. Must be stable. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
  /** True while the parent runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
  /** Connect error from the parent, shown below any discovery error. */
  connectError?: string | null;
  /**
   * Hides the built-in "no stored token" banner. Set when the parent shows its
   * own missing-token hint (e.g. the wizard's compact notice next to its inline
   * "Add token" button) so the message is not duplicated.
   */
  suppressMissingTokenNotice?: boolean;
};

const PAGE_SIZE = 20;

/**
 * GitHub org/user repository discovery: searchable, paginated, multi-select, with
 * an "already ingested elsewhere → link instead of re-ingest" classification.
 *
 * Owns discovery and the selection set; the resolved selection is reported up via
 * {@link GithubRepositoryDiscoveryProps.onSelectionChange} so the parent keeps its
 * own connect button and decides what connecting means (immediate connect on the
 * Data Ingestion page, staged connect in the create-project wizard).
 */
export function GithubRepositoryDiscovery({
  tokenNames,
  projectId,
  tokenName,
  onTokenNameChange,
  onSelectionChange,
  isConnecting = false,
  connectError,
  suppressMissingTokenNotice = false,
}: GithubRepositoryDiscoveryProps) {
  const hasTokens = tokenNames.length > 0;

  const [ownerInput, setOwnerInput] = useState("");
  const [filter, setFilter] = useState("");

  // The owner that actually produced the current results, used at connect time
  // (discovered repos carry only their name, not their owner).
  const [resolvedOwner, setResolvedOwner] = useState("");
  const [repositories, setRepositories] = useState<DiscoveredRepository[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // "owner/name" (lowercased) -> repository id, for every repo connected anywhere,
  // plus the subset already belonging to the current project.
  const [repositoryIdsByFullName, setRepositoryIdsByFullName] = useState<Map<string, string>>(
    new Map(),
  );
  const [projectFullNames, setProjectFullNames] = useState<Set<string>>(new Set());

  const [discoverState, setDiscoverState] = useState<
    "idle" | "loading" | "loadingMore" | "loaded" | "error"
  >("idle");
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const isBusy = discoverState === "loading" || isConnecting;

  // Discovery only reports *that* a repo is already a source, not its id or which
  // projects it belongs to. The per-repo status endpoint supplies both, so an
  // already-ingested repo can be linked to this project instead of being blocked.
  const loadConnectedRepositories = useCallback(async () => {
    try {
      const [allConnected, connectedToProject] = await Promise.all([
        getIngestionSourceStatuses(),
        projectId ? getIngestionSourceStatuses(projectId) : Promise.resolve([]),
      ]);

      setRepositoryIdsByFullName(
        new Map(
          // Only GitHub rows carry a repositoryId; connector-neutral rows (Jira)
          // have none and are not link-by-repository candidates here.
          allConnected.flatMap((status) =>
            status.repositoryId
              ? ([[status.sourceId.toLowerCase(), status.repositoryId]] as [string, string][])
              : [],
          ),
        ),
      );
      setProjectFullNames(
        new Set(connectedToProject.map((status) => status.sourceId.toLowerCase())),
      );
    } catch {
      // Degrades gracefully: without ids, already-connected repos stay
      // unselectable rather than offering an action that would fail.
      setRepositoryIdsByFullName(new Map());
      setProjectFullNames(new Set());
    }
  }, [projectId]);

  const runDiscovery = useCallback(
    async (nextPage: number) => {
      // The single field accepts an org/user handle, a bare "owner/name", or a
      // full GitHub URL to either. When it carries a repository name we still
      // discover the owner but isolate that one repository in the results; a
      // bare owner lists all of them.
      const repoReference = parseGithubRepositoryReference(ownerInput);
      const owner = repoReference?.owner ?? parseGithubOwnerInput(ownerInput);

      if (!owner) {
        setDiscoverState("error");
        setDiscoverError(
          "Enter a GitHub organization, user, or repository URL (e.g. octocat or github.com/octocat/hello-world).",
        );
        return;
      }

      if (!tokenName.trim()) {
        setDiscoverState("error");
        setDiscoverError("Choose a stored GitHub access token.");
        return;
      }

      const loadingMore = nextPage > 0;
      setDiscoverState(loadingMore ? "loadingMore" : "loading");
      setDiscoverError(null);

      try {
        // "auto" resolves org-vs-user on the service side (org first, then user
        // on a 404), so the user never has to know or pick which kind they typed.
        const result = await discoverRepositories(
          owner,
          tokenName.trim(),
          "auto",
          nextPage,
          PAGE_SIZE,
        );

        setResolvedOwner(owner);
        setHasMore(result.hasMore);
        setPage(nextPage);
        setRepositories((current) =>
          loadingMore ? [...current, ...result.repositories] : result.repositories,
        );
        setDiscoverState("loaded");

        if (!loadingMore) {
          // A fresh discovery starts with a clean slate: clear selections so a
          // repository sharing a name with one picked under a previous owner is
          // not silently re-selected. A pasted "owner/name" pre-filters to that
          // repository; a bare owner clears any leftover filter.
          setSelected(new Set());
          setFilter(repoReference ? repoReference.name : "");
          await loadConnectedRepositories();
        }
      } catch (error) {
        setDiscoverState("error");

        if (error instanceof ApiError && error.status === 404) {
          setDiscoverError(
            `No GitHub organization or user "${owner}" was found for the selected token.`,
          );
        } else if (error instanceof ApiError && error.status === 429) {
          setDiscoverError("GitHub rate limit reached. Please wait a moment and try again.");
        } else {
          setDiscoverError(
            error instanceof Error ? error.message : "Repositories could not be discovered.",
          );
        }
      }
    },
    [loadConnectedRepositories, ownerInput, tokenName],
  );

  const filteredRepositories = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return repositories;

    return repositories.filter((repository) => repository.name.toLowerCase().includes(normalized));
  }, [filter, repositories]);

  const linkStateByName = useMemo(() => {
    const states = new Map<string, RepositoryLinkState>();

    repositories.forEach((repository) => {
      const fullName = `${resolvedOwner}/${repository.name}`.toLowerCase();

      if (projectFullNames.has(fullName)) {
        states.set(repository.name, "in-project");
      } else if (!repository.alreadyConnected) {
        states.set(repository.name, "new");
      } else if (repositoryIdsByFullName.has(fullName)) {
        states.set(repository.name, "linkable");
      } else {
        states.set(repository.name, "unresolved");
      }
    });

    return states;
  }, [projectFullNames, repositories, repositoryIdsByFullName, resolvedOwner]);

  const isSelectable = useCallback(
    (name: string) => {
      const state = linkStateByName.get(name) ?? "new";
      return state === "new" || state === "linkable";
    },
    [linkStateByName],
  );

  const selectableVisible = filteredRepositories.filter((repository) =>
    isSelectable(repository.name),
  );
  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((repository) => selected.has(repository.name));

  const toggleRepository = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableVisible.forEach((repository) => next.delete(repository.name));
      } else {
        selectableVisible.forEach((repository) => next.add(repository.name));
      }
      return next;
    });
  };

  const selection = useMemo<DiscoverySelection[]>(() => {
    return repositories
      .filter((repository) => selected.has(repository.name))
      .map((repository) => {
        const fullName = `${resolvedOwner}/${repository.name}`.toLowerCase();

        return {
          owner: resolvedOwner,
          name: repository.name,
          isPrivate: repository.isPrivate,
          linkState: linkStateByName.get(repository.name) ?? "new",
          repositoryId: repositoryIdsByFullName.get(fullName),
        };
      });
  }, [linkStateByName, repositories, repositoryIdsByFullName, resolvedOwner, selected]);

  // Report the resolved selection up. `onSelectionChange` must be stable (a
  // useState setter or a memoised callback) so this only fires when the
  // selection actually changes.
  useEffect(() => {
    onSelectionChange(selection);
  }, [onSelectionChange, selection]);

  const selectedCount = selection.length;

  return (
    <div className="space-y-5">
      {!hasTokens && !suppressMissingTokenNotice && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          Add a GitHub personal access token in Settings first, then come back to discover
          repositories.
        </div>
      )}

      <form
        className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void runDiscovery(0);
        }}
      >
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="discovery-owner" className="text-sm font-medium text-app-text">
            Organization, user, or URL
          </label>
          <Input
            id="discovery-owner"
            value={ownerInput}
            onChange={(event) => setOwnerInput(event.target.value)}
            disabled={isBusy || !hasTokens}
            placeholder="octocat, github.com/octocat, or a repo URL"
            className="mt-2"
          />
        </div>

        <div>
          <span className="text-sm font-medium text-app-text">Access token</span>
          <DropdownSelect
            label="Access token"
            value={tokenName}
            options={
              hasTokens
                ? tokenNames.map((name) => ({ value: name, label: name }))
                : [{ value: "", label: "No saved tokens" }]
            }
            onChange={onTokenNameChange}
            disabled={isBusy || !hasTokens}
            className="mt-2 sm:w-52"
          />
        </div>

        <Button
          variant="primary"
          type="submit"
          disabled={isBusy || !hasTokens}
          loading={discoverState === "loading"}
          icon={<Search className="h-4 w-4" />}
        >
          Discover
        </Button>
      </form>

      {discoverError && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{discoverError}</span>
        </div>
      )}

      {connectError && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{connectError}</span>
        </div>
      )}

      {discoverState === "loading" && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-app-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Discovering repositories…
        </div>
      )}

      {discoverState === "loaded" && repositories.length === 0 && (
        <EmptyState icon={<GitBranch className="h-8 w-8" />} title="No repositories found">
          The token may only see public repositories. Private repositories require a token with
          broader scope (e.g. <code>read:org</code> / repo access).
        </EmptyState>
      )}

      {repositories.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:max-w-xs sm:flex-1">
              <Input
                size="sm"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter repositories"
                aria-label="Filter repositories"
                icon={<Search className="h-4 w-4" />}
              />
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-app-text-muted">{selectedCount} selected</span>
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={selectableVisible.length === 0}
                className="rounded-lg px-2 py-1 font-semibold text-app-brand-text transition hover:bg-app-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {allVisibleSelected ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>

          <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {filteredRepositories.map((repository) => {
              const isSelected = selected.has(repository.name);
              const linkState = linkStateByName.get(repository.name) ?? "new";
              const disabledRow = !isSelectable(repository.name);

              return (
                <li key={repository.name}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      disabledRow
                        ? "cursor-not-allowed border-app-border bg-app-surface-muted opacity-70"
                        : isSelected
                          ? "border-app-brand bg-app-brand-soft shadow-sm"
                          : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover"
                    }`}
                  >
                    <span className="relative flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabledRow}
                        onChange={() => toggleRepository(repository.name)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-app-focus peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-app-surface ${
                          isSelected
                            ? "border-app-brand bg-app-brand text-white"
                            : "border-app-border-strong bg-app-surface"
                        } ${disabledRow ? "opacity-60" : ""}`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </span>

                    {/* Name and badges share one wrapping row: on a narrow row
                        the badges drop to the next line instead of squeezing the
                        name to a couple of characters. Stays single-line and
                        right-aligned from sm up (name grows via sm:flex-1). */}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
                      {repository.alreadyConnected && (
                        <span
                          role="img"
                          aria-label={repository.isEnabled === false ? "Disabled" : "Enabled"}
                          title={repository.isEnabled === false ? "Disabled" : "Enabled"}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            repository.isEnabled === false
                              ? "bg-app-text-disabled"
                              : "bg-app-success-solid"
                          }`}
                        />
                      )}

                      <span className="max-w-full min-w-0 truncate text-sm font-medium text-app-text sm:flex-1">
                        {repository.name}
                      </span>

                      <Badge
                        variant={repository.isPrivate ? "orange" : "success"}
                        size="sm"
                        className="gap-1"
                      >
                        {repository.isPrivate && <Lock className="h-3 w-3" aria-hidden="true" />}
                        {repository.isPrivate ? "Private" : "Public"}
                      </Badge>

                      {linkState === "in-project" && (
                        <Badge variant="neutral" size="sm" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          In this project
                        </Badge>
                      )}

                      {linkState === "linkable" && (
                        <Badge
                          variant="brand"
                          size="sm"
                          className="gap-1"
                          title="Already ingested. Adding it here reuses its artifacts instead of ingesting again."
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Already ingested
                        </Badge>
                      )}

                      {linkState === "unresolved" && (
                        <Badge
                          variant="neutral"
                          size="sm"
                          className="gap-1"
                          title="Connected to another project, but its repository id could not be resolved."
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Connected
                        </Badge>
                      )}
                    </div>

                    <a
                      href={repository.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Open ${repository.name} on GitHub`}
                      className="shrink-0 text-app-text-muted transition hover:text-app-brand"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </label>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void runDiscovery(page + 1)}
                disabled={discoverState === "loadingMore"}
                className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {discoverState === "loadingMore" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
