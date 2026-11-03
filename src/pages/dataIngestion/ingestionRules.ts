import type { RunStatusFilter } from "../../features/data-ingestion/components/RunHistoryFilters.tsx";
import { CONNECTORS, getConnector } from "../../features/data-ingestion/connectors/registry.ts";
import type { SourceSystem } from "../../features/data-ingestion/connectors/sourceSystems.ts";
import { githubRepositoryOf } from "../../features/data-ingestion/sourceDetails.ts";
import type { DataSource, IngestionRunFilter } from "../../features/data-ingestion/types.ts";

/**
 * How long a connect or an update keeps the page reloading, so the run it just started shows up
 * even though none was running yet when it was triggered.
 */
export const POLLING_WINDOW_MS = 60_000;

/**
 * Small enough that the run table stays scannable and pagination is actually reachable rather
 * than a single page of rows.
 */
export const RUN_PAGE_SIZE = 10;

export type RunFilterState = {
  status: RunStatusFilter;
  /** The selected source's `value` (GitHub repo id, Jira instance URL, or Confluence connection id), or `"ALL"`. */
  sourceValue: string;
  /**
   * How to translate `sourceValue` into a query param: GitHub and Confluence filter by
   * `repositoryId`, Jira by `sourceRef`. Null while no specific source is selected.
   */
  sourceSystem: SourceSystem | null;
};

export const DEFAULT_RUN_FILTER: RunFilterState = {
  status: "ALL",
  sourceValue: "ALL",
  sourceSystem: null,
};

/**
 * A source offered in the run-history filter. `value` is the GitHub repository id, Jira instance
 * URL, or Confluence connection id; `sourceSystem` decides which query param it maps to
 * (repositoryId vs. sourceRef).
 */
export type RunSourceFilterOption = {
  value: string;
  label: string;
  sourceSystem: SourceSystem;
};

/**
 * Wording for the project-wide sync-settings modal, per connector. `one` and `many` name the
 * connector's sources so the copy reads naturally in both the "overwrites every … in this
 * project" and the "updates all … in this project" sentences.
 */
export function getSyncSettingsCopy(system: SourceSystem) {
  const { meta, actions } = CONNECTORS[system];
  const { label, noun } = meta;

  return {
    label,
    one: `${label} ${noun.singular}`,
    many: `${label} ${noun.plural}`,
    skipsWhenAutoUpdateOff: actions.schedule?.skipsWhenAutoUpdateOff === true,
  };
}

export function hasSourceId(sources: DataSource[], sourceId: string) {
  return sources.some((source) => source.sourceId === sourceId);
}

/**
 * Turns a `?sourceId=` value into the id this page actually selects by.
 *
 * A card's id is its project-source id, but callers do not always have one. The knowledge-gap
 * detail page links here from a gap, and a gap identifies itself by component -- `owner/repo`,
 * which is the GitHub repository's full name. Accepting that spelling too is what lets its
 * "Update data source" button open the repository rather than dropping the reader on the page
 * and leaving them to find it.
 *
 * Case-insensitive on the component: GitHub treats owner and repository names that way, and the
 * component string reaches us from the AI service.
 */
export function resolveRequestedSourceId(sources: DataSource[], requested: string): string | null {
  if (requested.length === 0) return null;
  if (hasSourceId(sources, requested)) return requested;

  const byComponent = sources.find(
    (source) => githubRepositoryOf(source)?.fullName.toLowerCase() === requested.toLowerCase(),
  );

  return byComponent?.sourceId ?? null;
}

/**
 * The source selected after the list or the requested id changed.
 *
 * A requested source wins. Otherwise the current selection stays while the list is transiently
 * empty (an in-flight refresh), so an open details drawer is not dropped; it is cleared only when
 * the list is populated and the source is genuinely gone.
 */
export function nextSelectedSourceId(
  current: string | null,
  sources: DataSource[],
  resolvedRequested: string | null,
): string | null {
  if (resolvedRequested) return resolvedRequested;
  if (!current || sources.length === 0) return current;

  return hasSourceId(sources, current) ? current : null;
}

/** The server-side query for the run history, scoped to the project and the chosen filters. */
export function buildRunQuery(
  filter: RunFilterState,
  page: number,
  projectId: string,
): IngestionRunFilter {
  // The connector says which query parameter scopes its runs (repositoryId is the backend
  // source-instance UUID, sourceRef the run's source reference).
  const scope =
    filter.sourceValue !== "ALL" && filter.sourceSystem
      ? getConnector(filter.sourceSystem).runFilter?.param
      : undefined;

  return {
    page,
    size: RUN_PAGE_SIZE,
    projectId: projectId || undefined,
    repositoryId: scope === "repositoryId" ? filter.sourceValue : undefined,
    sourceRef: scope === "sourceRef" ? filter.sourceValue : undefined,
    status: filter.status !== "ALL" ? filter.status : undefined,
  };
}

/**
 * Sources offered in the run filter, from the project's connected sources. Each connector says
 * which query parameter scopes its runs and by which value; a source whose connector cannot tell
 * its runs apart is not offered.
 */
export function runSourceOptionsOf(sources: DataSource[]): RunSourceFilterOption[] {
  return sources.flatMap((source): RunSourceFilterOption[] => {
    const value = getConnector(source.sourceSystem).runFilter?.valueOf(source);

    return value ? [{ value, label: source.name, sourceSystem: source.sourceSystem }] : [];
  });
}

export function isRunFilterActive(filter: RunFilterState): boolean {
  return filter.status !== "ALL" || filter.sourceValue !== "ALL";
}

/** How many sources are in each state, for the headline badges. */
export function sourceHealthOf(sources: DataSource[]) {
  const count = (state: DataSource["statusView"]["state"]) =>
    sources.filter((source) => source.statusView.state === state).length;

  return {
    total: sources.length,
    connected: count("connected"),
    syncing: count("syncing"),
    attention: count("attention"),
    disabled: count("disabled"),
  };
}

export type SourceHealth = ReturnType<typeof sourceHealthOf>;
