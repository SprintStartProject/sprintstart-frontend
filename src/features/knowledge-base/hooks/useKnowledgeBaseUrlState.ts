import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_FORMAT_ORDER, DEFAULT_SOURCE_ORDER, KNOWLEDGE_TAB_ORDER } from "../tabs.ts";
import type { KnowledgeTab } from "../tabs.ts";
import type { SourceSystem, UploadFormat } from "../types.ts";

/** Page size used when the URL names none. Mirrors the backend's list default. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Largest page size the list endpoint accepts (`@Max(MAX_PAGE_SIZE)` in the backend's
 * `ArtifactController`). A hand-edited `?size=500` is clamped to it instead of being sent
 * through to a guaranteed 400.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Page sizes the page-size control offers. All inside the backend's 1..100 bound;
 * a hand-edited `?size=` outside this list still works (it is only clamped) and
 * is shown as an extra option, so the control never lies about the current size.
 */
export const PAGE_SIZE_OPTIONS: readonly number[] = [DEFAULT_PAGE_SIZE, 50, MAX_PAGE_SIZE];

/**
 * Query-string keys the Knowledge Base page owns. Short, human-readable names, because these
 * URLs are meant to be pasted into chats and tickets.
 */
export const KB_URL_PARAM = {
  tab: "tab",
  search: "q",
  sources: "sources",
  repositories: "repos",
  format: "format",
  page: "page",
  size: "size",
  artifact: "artifact",
} as const;

/**
 * The params that describe *one project's* corpus. A project switch drops them: a repository or
 * an open artifact from project A means nothing in project B, and the empty list it would produce
 * reads as "this project has no knowledge". `size` is deliberately not in here — it is a reading
 * preference, not a statement about the project's content.
 */
const PROJECT_SCOPED_PARAMS: readonly string[] = [
  KB_URL_PARAM.tab,
  KB_URL_PARAM.search,
  KB_URL_PARAM.sources,
  KB_URL_PARAM.repositories,
  KB_URL_PARAM.format,
  KB_URL_PARAM.page,
  KB_URL_PARAM.artifact,
];

/** Everything "Clear filters" resets. Unlike a project switch it keeps the open artifact. */
const FILTER_PARAMS: readonly string[] = [
  KB_URL_PARAM.tab,
  KB_URL_PARAM.search,
  KB_URL_PARAM.sources,
  KB_URL_PARAM.repositories,
  KB_URL_PARAM.format,
  KB_URL_PARAM.page,
];

const TAB_VALUES: ReadonlySet<string> = new Set(KNOWLEDGE_TAB_ORDER);
const SOURCE_VALUES: ReadonlySet<string> = new Set(DEFAULT_SOURCE_ORDER);
const FORMAT_VALUES: ReadonlySet<string> = new Set(DEFAULT_FORMAT_ORDER);
const NO_SOURCES: ReadonlySet<SourceSystem> = new Set<SourceSystem>();
const NO_STRINGS: ReadonlySet<string> = new Set<string>();

/** The Knowledge Base filter state as the URL describes it, already validated. */
export interface KnowledgeBaseUrlState {
  /** Artifact type tab; `"ALL"` when the URL names none (or names one that does not exist). */
  tab: KnowledgeTab;
  /** Search text exactly as written to `?q=`; trimming is the request builder's job. */
  search: string;
  sources: ReadonlySet<SourceSystem>;
  /** Only ever non-empty while GitHub is among `sources` — see {@link parseKnowledgeBaseSearch}. */
  repositories: ReadonlySet<string>;
  /** Only ever non-null while Uploads is among `sources` — see {@link parseKnowledgeBaseSearch}. */
  format: UploadFormat | null;
  /** 1-based. Not clamped to the result's page count here — the URL cannot know it. */
  page: number;
  size: number;
  /** The artifact open in the viewer drawer, if any. */
  artifactId: string | null;
}

/**
 * Reads a set-valued param. Accepts both `?sources=GITHUB,JIRA` (what this hook writes) and
 * `?sources=GITHUB&sources=JIRA` (what a hand-built link or the backend's own style would use),
 * de-duplicated in first-seen order.
 */
function readList(params: URLSearchParams, key: string): string[] {
  const values = params
    .getAll(key)
    .flatMap((raw) => raw.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(values));
}

/** Reads an integer param clamped to `[1, max]`; anything that is not an integer is the fallback. */
function readPositiveInt(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, 1), max);
}

/**
 * Parses the Knowledge Base query string into validated filter state.
 *
 * Validation is "drop what cannot be honoured", never "fail": an unknown tab, source or format is
 * ignored (so `?tab=BOGUS` shows everything instead of sending `types=BOGUS` for a 400), page and
 * size are clamped to what the backend accepts, and enum values are matched case-insensitively
 * because people type URLs by hand.
 *
 * The two dependent facets keep the invariant the toggles enforce: a `format` only counts while
 * Uploads is selected and `repos` only while GitHub is. Otherwise a shared link could carry a
 * filter the panel does not even show — narrowing the list with no visible way to undo it.
 *
 * @param params The current `location.search`, parsed.
 * @returns The state the page should render. Never throws.
 */
export function parseKnowledgeBaseSearch(params: URLSearchParams): KnowledgeBaseUrlState {
  const rawTab = params.get(KB_URL_PARAM.tab)?.trim().toUpperCase() ?? "";
  const tab: KnowledgeTab = TAB_VALUES.has(rawTab) ? (rawTab as KnowledgeTab) : "ALL";

  const sourceList = readList(params, KB_URL_PARAM.sources)
    .map((value) => value.toUpperCase())
    .filter((value): value is SourceSystem => SOURCE_VALUES.has(value));
  const sources: ReadonlySet<SourceSystem> =
    sourceList.length > 0 ? new Set(sourceList) : NO_SOURCES;

  const rawFormat = params.get(KB_URL_PARAM.format)?.trim().toUpperCase() ?? "";
  const format =
    sources.has("UPLOAD") && FORMAT_VALUES.has(rawFormat) ? (rawFormat as UploadFormat) : null;

  const repositoryList = sources.has("GITHUB") ? readList(params, KB_URL_PARAM.repositories) : [];
  const repositories: ReadonlySet<string> =
    repositoryList.length > 0 ? new Set(repositoryList) : NO_STRINGS;

  return {
    tab,
    search: params.get(KB_URL_PARAM.search) ?? "",
    sources,
    repositories,
    format,
    page: readPositiveInt(params.get(KB_URL_PARAM.page), 1, Number.MAX_SAFE_INTEGER),
    size: readPositiveInt(params.get(KB_URL_PARAM.size), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    artifactId: params.get(KB_URL_PARAM.artifact) || null,
  };
}

/**
 * Serialises params back into a `location.search` string (`""` when empty). Commas and slashes
 * are left readable — `?sources=GITHUB,JIRA&repos=acme/api` rather than `%2C`/`%2F` — both are
 * legal in a query string and `URLSearchParams` reads them back unchanged.
 */
export function toKnowledgeBaseSearchString(params: URLSearchParams): string {
  const query = params.toString().replace(/%2C/gi, ",").replace(/%2F/gi, "/");
  return query ? `?${query}` : "";
}

/** Writes a set-valued param as one comma-separated value, or removes it when empty. */
function writeList(params: URLSearchParams, key: string, values: Iterable<string>): void {
  const list = Array.from(values);
  if (list.length > 0) params.set(key, list.join(","));
  else params.delete(key);
}

/** Adds `value` to the set-valued param `key` if absent, removes it if present. */
function toggleInList(params: URLSearchParams, key: string, value: string): boolean {
  const current = readList(params, key);
  const isRemoving = current.includes(value);
  writeList(
    params,
    key,
    isRemoving ? current.filter((entry) => entry !== value) : [...current, value],
  );
  return isRemoving;
}

/** Removes every key in `keys` from a copy of `search`, returned as a search string. */
function withoutParams(search: string, keys: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const key of keys) params.delete(key);
  return toKnowledgeBaseSearchString(params);
}

/**
 * How a write lands in the browser history. Discrete choices (a tab, a facet, a page) `push`, so
 * Back undoes the last click instead of leaving the page; continuous or corrective writes (search
 * typing, the drawer's `?artifact=`, clamping, a project switch) `replace`, so Back does not walk
 * through every keystroke or through states nobody chose.
 */
export type KnowledgeBaseHistoryMode = "push" | "replace";

/** Options for {@link useKnowledgeBaseUrlState}. */
export interface KnowledgeBaseUrlStateOptions {
  /**
   * Whether `projectId` is final. The page resolves the project as "the global selection, else the
   * user's first project" and the global selection is `""` until the project list has loaded, so
   * during that window `projectId` can move from the fallback to the real selection. That move is
   * not a project *switch* and must not wipe the filters of the link somebody just opened; only
   * changes between two settled ids count. Defaults to `true`.
   */
  projectSettled?: boolean;
}

/** State and writers returned by {@link useKnowledgeBaseUrlState}. */
export interface KnowledgeBaseUrlStateApi {
  state: KnowledgeBaseUrlState;
  /**
   * The settled project the current filters belong to. Changes exactly when a project switch
   * clears them, so a consumer holding derived local state (the search input) can reset with it.
   */
  scopeProjectId: string | null;
  setTab: (tab: KnowledgeTab) => void;
  /** Replace-mode write of `?q=`, resetting the page. */
  setSearch: (search: string) => void;
  toggleSource: (source: SourceSystem) => void;
  toggleFormat: (format: UploadFormat) => void;
  toggleRepository: (repository: string) => void;
  setPage: (page: number, mode?: KnowledgeBaseHistoryMode) => void;
  /** Push-mode write of `?size=`, resetting the page. */
  setSize: (size: number) => void;
  /** Resets every filter (not the page size, not the open artifact) in one history entry. */
  clearFilters: () => void;
  /** Opens (`id`) or closes (`null`) the viewer drawer, in replace mode. */
  setArtifactId: (artifactId: string | null) => void;
}

/**
 * Makes the URL the single source of truth for the Knowledge Base filters, so a refresh keeps
 * them, a link is shareable, and Back undoes the last filter click.
 *
 * This is the only writer of the page's query string — the drawer's `?artifact=` deep link lives
 * here too, because two independent writers of one `URLSearchParams` overwrite each other.
 *
 * Writes go through a ref holding the latest search string rather than through the render's
 * snapshot. React Router applies location changes inside `startTransition`, so two writes in one
 * event (a test's `act`, a double click) would otherwise each start from the same stale snapshot
 * and the second would silently undo the first.
 *
 * On a switch between two settled projects the project-scoped params are removed with a single
 * `replace`. Until that navigation lands the hook already *reports* the cleared state, so no
 * request is ever sent for project B with project A's filters.
 *
 * @param projectId The project the page is scoped to, or null while there is none.
 * @param options See {@link KnowledgeBaseUrlStateOptions}.
 */
export function useKnowledgeBaseUrlState(
  projectId: string | null,
  { projectSettled = true }: KnowledgeBaseUrlStateOptions = {},
): KnowledgeBaseUrlStateApi {
  const location = useLocation();
  const navigate = useNavigate();

  const latestSearchRef = useRef(location.search);
  useLayoutEffect(() => {
    latestSearchRef.current = location.search;
  }, [location.search]);

  /*
    Project-switch detection, derived during render (the same "adjust state when a prop changes"
    pattern the old reset block used) so the very render that sees project B already reports B's
    clean state. `staleSearch` remembers the query string that belonged to the previous project:
    while the location still equals it, its project-scoped params are masked out; once the
    clearing navigation lands the location differs and the mask retires itself.
  */
  const [scopeProjectId, setScopeProjectId] = useState<string | null>(null);
  const [staleSearch, setStaleSearch] = useState<string | null>(null);
  let activeStaleSearch = staleSearch;
  if (projectSettled && projectId && projectId !== scopeProjectId) {
    setScopeProjectId(projectId);
    if (scopeProjectId !== null) {
      setStaleSearch(location.search);
      activeStaleSearch = location.search;
    }
  } else if (staleSearch !== null && location.search !== staleSearch) {
    setStaleSearch(null);
    activeStaleSearch = null;
  }

  const effectiveSearch =
    activeStaleSearch !== null && location.search === activeStaleSearch
      ? withoutParams(location.search, PROJECT_SCOPED_PARAMS)
      : location.search;

  const state = useMemo(
    () => parseKnowledgeBaseSearch(new URLSearchParams(effectiveSearch)),
    [effectiveSearch],
  );

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void, mode: KnowledgeBaseHistoryMode) => {
      const current = toKnowledgeBaseSearchString(new URLSearchParams(latestSearchRef.current));
      const params = new URLSearchParams(latestSearchRef.current);
      mutate(params);
      const next = toKnowledgeBaseSearchString(params);
      // A no-op write must not add a history entry: Back would then appear to do nothing.
      if (next === current) return;
      latestSearchRef.current = next;
      void navigate({ search: next }, { replace: mode === "replace", preventScrollReset: true });
    },
    [navigate],
  );

  useEffect(() => {
    if (staleSearch === null) return;
    commit((params) => {
      for (const key of PROJECT_SCOPED_PARAMS) params.delete(key);
    }, "replace");
  }, [staleSearch, commit]);

  const setTab = useCallback(
    (tab: KnowledgeTab) =>
      commit((params) => {
        if (tab === "ALL") params.delete(KB_URL_PARAM.tab);
        else params.set(KB_URL_PARAM.tab, tab);
        params.delete(KB_URL_PARAM.page);
      }, "push"),
    [commit],
  );

  const setSearch = useCallback(
    (search: string) =>
      commit((params) => {
        if (search.trim() === "") params.delete(KB_URL_PARAM.search);
        else params.set(KB_URL_PARAM.search, search);
        params.delete(KB_URL_PARAM.page);
      }, "replace"),
    [commit],
  );

  const toggleSource = useCallback(
    (source: SourceSystem) =>
      commit((params) => {
        const isRemoving = toggleInList(params, KB_URL_PARAM.sources, source);
        // The dependent facets describe one source each; they go when their source goes.
        if (isRemoving && source === "UPLOAD") params.delete(KB_URL_PARAM.format);
        if (isRemoving && source === "GITHUB") params.delete(KB_URL_PARAM.repositories);
        params.delete(KB_URL_PARAM.page);
      }, "push"),
    [commit],
  );

  const toggleFormat = useCallback(
    (format: UploadFormat) =>
      commit((params) => {
        const current = params.get(KB_URL_PARAM.format)?.toUpperCase();
        if (current === format) params.delete(KB_URL_PARAM.format);
        else params.set(KB_URL_PARAM.format, format);
        params.delete(KB_URL_PARAM.page);
      }, "push"),
    [commit],
  );

  const toggleRepository = useCallback(
    (repository: string) =>
      commit((params) => {
        toggleInList(params, KB_URL_PARAM.repositories, repository);
        params.delete(KB_URL_PARAM.page);
      }, "push"),
    [commit],
  );

  const setPage = useCallback(
    (page: number, mode: KnowledgeBaseHistoryMode = "push") =>
      commit((params) => {
        if (page <= 1) params.delete(KB_URL_PARAM.page);
        else params.set(KB_URL_PARAM.page, String(page));
      }, mode),
    [commit],
  );

  const setSize = useCallback(
    (size: number) =>
      commit((params) => {
        const clamped = Math.min(Math.max(Math.trunc(size), 1), MAX_PAGE_SIZE);
        if (clamped === DEFAULT_PAGE_SIZE) params.delete(KB_URL_PARAM.size);
        else params.set(KB_URL_PARAM.size, String(clamped));
        params.delete(KB_URL_PARAM.page);
      }, "push"),
    [commit],
  );

  const clearFilters = useCallback(
    () =>
      commit((params) => {
        for (const key of FILTER_PARAMS) params.delete(key);
      }, "push"),
    [commit],
  );

  const setArtifactId = useCallback(
    (artifactId: string | null) =>
      commit((params) => {
        if (artifactId) params.set(KB_URL_PARAM.artifact, artifactId);
        else params.delete(KB_URL_PARAM.artifact);
      }, "replace"),
    [commit],
  );

  return {
    state,
    scopeProjectId,
    setTab,
    setSearch,
    toggleSource,
    toggleFormat,
    toggleRepository,
    setPage,
    setSize,
    clearFilters,
    setArtifactId,
  };
}
