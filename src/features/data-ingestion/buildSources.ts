import type { ProjectSource } from "../../services/projectService.ts";
import type { ConfluenceConnectionDto } from "../../services/sources/confluenceService.ts";
import { parseGithubRepositoryReference } from "../../services/sources/githubRepositoryInput.ts";
import type { JiraInstanceDto } from "../../services/sources/jiraService.ts";
import type { NotionWorkspaceConnectionDto } from "../../services/sources/notionService.ts";
import { CONNECTORS } from "./connectors/registry.ts";
import { toSourceSystem, type SourceSystem } from "./connectors/sourceSystems.ts";
import { createDataSource } from "./data.ts";
import type { DataSource, IngestionRun, SourceInstanceIngestionStatus } from "./types.ts";

type BuildDataSourcesInput = {
  projectSources: ProjectSource[];
  /** The project's status rows (`/api/v1/ingestion-sources/status`). */
  statuses: SourceInstanceIngestionStatus[];
  jiraInstances: JiraInstanceDto[];
  confluenceConnections: ConfluenceConnectionDto[];
  notionConnections: NotionWorkspaceConnectionDto[];
  /** The project's newest runs, newest first. */
  latestRuns: IngestionRun[];
  /** Connector id (lowercase, e.g. "github") -> globally enabled. */
  connectorEnabledById: Map<string, boolean>;
};

/**
 * Finds the GitHub status row that belongs to a connected project source. A
 * project source only carries an opaque id and a display name, so we match on
 * the repository id first, then on the `"owner/name"` recoverable from the
 * source's name or id.
 */
function matchGithubStatus(
  projectSource: ProjectSource,
  statuses: SourceInstanceIngestionStatus[],
): SourceInstanceIngestionStatus | null {
  const byRepositoryId = statuses.find((status) => status.repositoryId === projectSource.id);
  if (byRepositoryId) return byRepositoryId;

  const reference =
    parseGithubRepositoryReference(projectSource.name) ??
    parseGithubRepositoryReference(projectSource.id);
  if (!reference) return null;

  const fullName = `${reference.owner}/${reference.name}`.toLowerCase();

  return (
    statuses.find((status) => status.sourceId.toLowerCase() === fullName) ??
    statuses.find((status) => `${status.owner}/${status.name}`.toLowerCase() === fullName) ??
    null
  );
}

/** Finds the status row of a Confluence connection by its composite ref, space id or connection id. */
function matchConfluenceStatus(
  connection: ConfluenceConnectionDto,
  statuses: SourceInstanceIngestionStatus[],
): SourceInstanceIngestionStatus | null {
  return (
    statuses.find(
      (status) =>
        status.sourceSystem === "CONFLUENCE" &&
        (status.sourceId.toLowerCase() ===
          `${connection.baseUrl}|${connection.spaceId}`.toLowerCase() ||
          status.sourceId.toLowerCase() === connection.spaceId.toLowerCase() ||
          status.sourceId.toLowerCase() === connection.id.toLowerCase()),
    ) ?? null
  );
}

/** Finds the newest run of a Confluence connection, whichever reference the run carries. */
function matchConfluenceRun(
  connection: ConfluenceConnectionDto,
  runs: IngestionRun[],
): IngestionRun | null {
  const compositeRef = `${connection.baseUrl}|${connection.spaceId}`.toLowerCase();

  return (
    runs.find(
      (run) =>
        run.sourceSystem === "CONFLUENCE" &&
        (run.sourceId?.toLowerCase() === compositeRef ||
          run.sourceId?.toLowerCase() === connection.spaceId.toLowerCase() ||
          run.sourceId?.toLowerCase() === connection.id.toLowerCase() ||
          run.sourceId?.toLowerCase() === connection.spaceKey.toLowerCase() ||
          run.repositoryId === connection.id),
    ) ?? null
  );
}

/**
 * Pairs each Notion status row with its connection record. A row is keyed by the
 * workspace id (the connection id when Notion names none), which two connections of one
 * project can share when different tokens see the same workspace; rows and connections
 * both arrive oldest first, so each row takes the first connection with its key that no
 * earlier row has taken.
 */
function pairNotionConnections(
  rows: SourceInstanceIngestionStatus[],
  connections: NotionWorkspaceConnectionDto[],
): { status: SourceInstanceIngestionStatus; connection: NotionWorkspaceConnectionDto | null }[] {
  const unmatched = [...connections];

  return rows.map((status) => {
    const index = unmatched.findIndex(
      (connection) => (connection.workspaceId ?? connection.id) === status.sourceId,
    );
    const [connection = null] = index >= 0 ? unmatched.splice(index, 1) : [];

    return { status, connection };
  });
}

/** Finds the newest run of a Notion workspace: by connection id, else by the reference the run carries. */
function matchNotionRun(
  status: SourceInstanceIngestionStatus,
  connection: NotionWorkspaceConnectionDto | null,
  runs: IngestionRun[],
): IngestionRun | null {
  return (
    runs.find(
      (run) =>
        run.sourceSystem === "NOTION" &&
        (connection ? run.repositoryId === connection.id : run.sourceId === status.sourceId),
    ) ?? null
  );
}

/**
 * Builds the source cards for the Data Ingestion page, with the same generic
 * mapper for every connector.
 *
 * GitHub and upload cards are defined by the project's connected sources (their
 * stable `sourceId` is the project source's id, used for selection and deep
 * links). A GitHub source without a status row (an unresolvable repo) and an
 * upload source without one fall back to their source system's latest run.
 * Bitbucket, Jira, Confluence and Notion cards are built from the status rows and
 * connection records instead, so a project source list that includes them does
 * not double them.
 */
export function buildDataSources({
  projectSources,
  statuses,
  jiraInstances,
  confluenceConnections,
  notionConnections,
  latestRuns,
  connectorEnabledById,
}: BuildDataSourcesInput): DataSource[] {
  const enabledOf = (system: SourceSystem) =>
    connectorEnabledById.get(CONNECTORS[system].meta.connectorId);

  const latestRunBySystem = new Map<SourceSystem, IngestionRun>();
  const sourceCountBySystem = new Map<SourceSystem, number>();

  projectSources.forEach((projectSource) => {
    const system = toSourceSystem(projectSource.type);
    if (!system) return;

    sourceCountBySystem.set(system, (sourceCountBySystem.get(system) ?? 0) + 1);
  });

  // Runs arrive newest-first, so the first hit per key is the latest.
  const latestRunByRepository = new Map<string, IngestionRun>();

  latestRuns.forEach((run) => {
    if (!latestRunBySystem.has(run.sourceSystem)) {
      latestRunBySystem.set(run.sourceSystem, run);
    }

    [run.repositoryId, run.sourceId?.toLowerCase()].forEach((key) => {
      if (key && !latestRunByRepository.has(key)) {
        latestRunByRepository.set(key, run);
      }
    });
  });

  const hasUploadStatus = statuses.some((status) => status.sourceSystem === "UPLOAD");

  const projectSourceCards = projectSources.flatMap((projectSource): DataSource[] => {
    const system = toSourceSystem(projectSource.type);
    if (system !== "GITHUB" && system !== "UPLOAD") return [];

    // An upload source is skipped only when an authoritative status row exists, so
    // the card does not vanish when the artifact count is 0 or the run fallback is needed.
    if (system === "UPLOAD" && hasUploadStatus) return [];

    const sharesSourceSystem = (sourceCountBySystem.get(system) ?? 1) > 1;
    const connectorEnabled = enabledOf(system);
    const status = system === "GITHUB" ? matchGithubStatus(projectSource, statuses) : null;

    if (status) {
      // Strictly this repository's own latest run. Falling back to the newest run
      // of the source system would let one failing repo colour every other GitHub
      // card. The status row is authoritative for health anyway; a run only adds
      // the AI-sync stage, and having none loaded simply means "unknown".
      const repositoryRun =
        (status.repositoryId ? latestRunByRepository.get(status.repositoryId) : undefined) ??
        latestRunByRepository.get(status.sourceId.toLowerCase()) ??
        null;

      return [
        createDataSource({
          definition: CONNECTORS.GITHUB,
          status,
          connection: projectSource,
          latestRun: repositoryRun,
          connectorEnabled,
          sharesSourceSystem,
        }),
      ];
    }

    // No status row: prefer this repository's own run, so the card never shows a
    // sibling repo's AI-sync stage. Only when none is loaded does it fall back to the
    // newest run of the system (always the case for uploads, which have no repository).
    const reference =
      system === "GITHUB"
        ? (parseGithubRepositoryReference(projectSource.name) ??
          parseGithubRepositoryReference(projectSource.id))
        : null;
    const ownRun =
      system === "GITHUB"
        ? (latestRunByRepository.get(projectSource.id) ??
          (reference
            ? latestRunByRepository.get(`${reference.owner}/${reference.name}`.toLowerCase())
            : undefined))
        : undefined;

    return [
      createDataSource({
        definition: CONNECTORS[system],
        status: null,
        connection: projectSource,
        latestRun: ownRun ?? latestRunBySystem.get(system) ?? null,
        connectorEnabled,
        sharesSourceSystem,
      }),
    ];
  });

  // Bitbucket cards come from the status rows alone: every field the card and the
  // details panel show is on the row, so a project source of this type must not
  // add a second card.
  const bitbucketCards = statuses
    .filter((status) => status.sourceSystem === "BITBUCKET")
    .map((status) =>
      createDataSource({
        definition: CONNECTORS.BITBUCKET,
        status,
        connectorEnabled: enabledOf("BITBUCKET"),
      }),
    );

  // The status row carries no credential metadata, so the instance records are
  // merged in by URL purely for the credential shown in the details panel.
  const jiraInstanceByUrl = new Map(
    jiraInstances.map((instance) => [instance.instanceUrl.toLowerCase(), instance]),
  );

  const jiraCards = statuses
    .filter((status) => status.sourceSystem === "JIRA")
    .map((status) =>
      createDataSource({
        definition: CONNECTORS.JIRA,
        status,
        connection: jiraInstanceByUrl.get(status.sourceId.toLowerCase()) ?? null,
        connectorEnabled: enabledOf("JIRA"),
      }),
    );

  const confluenceCards = confluenceConnections.map((connection) => {
    const status = matchConfluenceStatus(connection, statuses);

    return createDataSource({
      definition: CONNECTORS.CONFLUENCE,
      status,
      connection,
      latestRun: status ? null : matchConfluenceRun(connection, latestRuns),
      connectorEnabled: enabledOf("CONFLUENCE"),
    });
  });

  // The status row names the workspace and its health; the connection record adds the
  // connection id every action keys on. A viewer who may not read the connections still
  // gets the cards, without those actions.
  const notionCards = pairNotionConnections(
    statuses.filter((status) => status.sourceSystem === "NOTION"),
    notionConnections,
  ).map(({ status, connection }) =>
    createDataSource({
      definition: CONNECTORS.NOTION,
      status,
      connection,
      latestRun: matchNotionRun(status, connection, latestRuns),
      connectorEnabled: enabledOf("NOTION"),
    }),
  );

  const uploadCards = statuses
    .filter((status) => status.sourceSystem === "UPLOAD")
    .map((status) =>
      createDataSource({
        definition: CONNECTORS.UPLOAD,
        status,
        connectorEnabled: enabledOf("UPLOAD"),
      }),
    );

  return [
    ...projectSourceCards,
    ...bitbucketCards,
    ...jiraCards,
    ...confluenceCards,
    ...notionCards,
    ...uploadCards,
  ];
}
