import { useCallback, useState } from "react";
import { discoverErrorMessage, parseFreshRequest } from "./discoveryRules";
import type { DiscoveredRepositoryItem, RepositoryDiscoveryAdapter } from "./discoveryTypes";

const PAGE_SIZE = 20;

type DiscoverState = "idle" | "loading" | "loadingMore" | "loaded" | "error";

type DiscoveryRunInput = {
  adapter: RepositoryDiscoveryAdapter;
  ownerInput: string;
  credentialName: string;
  /** A fresh discovery starts with a clean slate: clears the ticks and sets the filter. */
  onFreshResults: (filter: string) => void;
  /** After a fresh discovery: reads what is connected, to classify the results. */
  loadConnected: () => Promise<void>;
  /** The credential changed under the results: the picker's own state goes too. */
  onReset: () => void;
};

type DiscoveryRun = {
  repositories: DiscoveredRepositoryItem[];
  /** The owner that produced the results; used at connect time, since repos carry only a name. */
  resolvedOwner: string;
  page: number;
  hasMore: boolean;
  state: DiscoverState;
  error: string | null;
  run: (page: number) => Promise<void>;
};

type Results = {
  repositories: DiscoveredRepositoryItem[];
  resolvedOwner: string;
  resolvedCredential: string;
  page: number;
  hasMore: boolean;
};

const NO_RESULTS: Results = {
  repositories: [],
  resolvedOwner: "",
  resolvedCredential: "",
  page: 0,
  hasMore: false,
};

/**
 * Discovery and paging. The owner and credential that actually produced the current results are
 * kept, and "Load more" continues with those, so editing the inputs afterwards cannot mix another
 * owner's pages into these results. The results belong to their credential — it is also what the
 * parent connects with — so switching it drops them and needs a fresh discovery.
 */
export function useDiscoveryRun(input: DiscoveryRunInput): DiscoveryRun {
  const { adapter, ownerInput, credentialName, onFreshResults, loadConnected, onReset } = input;
  const [results, setResults] = useState<Results>(NO_RESULTS);
  const [state, setState] = useState<DiscoverState>("idle");
  const [error, setError] = useState<string | null>(null);

  if (results.resolvedCredential && results.resolvedCredential !== credentialName.trim()) {
    setResults(NO_RESULTS);
    setState("idle");
    onReset();
  }

  const fail = useCallback((message: string) => {
    setState("error");
    setError(message);
  }, []);

  const run = useCallback(
    async (nextPage: number) => {
      const loadingMore = nextPage > 0;
      let { resolvedOwner: owner, resolvedCredential: credential } = results;
      let repositoryName: string | null = null;

      // "Load more" continues the discovery that produced the current results; it never re-reads the
      // editable fields. Only a fresh discovery does that.
      if (!loadingMore) {
        const request = parseFreshRequest(adapter, ownerInput, credentialName);
        if (!request.ok) return fail(request.error);
        ({ owner, credential, repositoryName } = request);
      }

      setState(loadingMore ? "loadingMore" : "loading");
      setError(null);

      try {
        const result = await adapter.discover(owner, credential, nextPage, PAGE_SIZE);

        setResults((current) => ({
          repositories: loadingMore
            ? [...current.repositories, ...result.repositories]
            : result.repositories,
          resolvedOwner: owner,
          resolvedCredential: credential,
          page: nextPage,
          hasMore: result.hasMore,
        }));
        setState("loaded");

        if (!loadingMore) {
          // A pasted "owner/name" pre-filters to that repository; a bare owner clears any leftover
          // filter. Selections are cleared so a repository sharing a name with one picked under a
          // previous owner is not silently re-selected.
          onFreshResults(repositoryName ?? "");
          await loadConnected();
        }
      } catch (caught) {
        fail(discoverErrorMessage(adapter, caught, owner));
      }
    },
    [adapter, credentialName, fail, loadConnected, onFreshResults, ownerInput, results],
  );

  return {
    repositories: results.repositories,
    resolvedOwner: results.resolvedOwner,
    page: results.page,
    hasMore: results.hasMore,
    state,
    error,
    run,
  };
}
