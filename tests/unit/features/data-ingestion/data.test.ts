import { describe, it, expect } from "vitest";
import {
  SOURCE_META,
  createDataSource,
  createDataSourceFromStatus,
  buildRunSourceLabels,
  getRunSourceLabel,
  deriveConnectionStatus,
  deriveSyncStatus,
  getRunStatusLabel,
  getRunStatusTone,
  isRunInProgress,
  getSourceLabel,
  formatDateTime,
  formatRunFinishedAt,
  formatNumber,
} from "../../../../src/features/data-ingestion/data";
import { CONNECTORS } from "../../../../src/features/data-ingestion/connectors/registry";
import { SOURCE_SYSTEMS } from "../../../../src/features/data-ingestion/connectors/sourceSystems";
import {
  confluenceSpaceOf,
  githubRepositoryOf,
  jiraInstanceOf,
} from "../../../../src/features/data-ingestion/sourceDetails";
import type {
  ConnectionStatus,
  IngestionRun,
  IngestionRunStatus,
  SourceInstanceIngestionStatus,
} from "../../../../src/features/data-ingestion/types";
import type { JiraInstanceDto } from "../../../../src/services/sources/jiraService";
import type { ConfluenceConnectionDto } from "../../../../src/services/sources/confluenceService";

const jiraCard = (
  status: SourceInstanceIngestionStatus,
  instance?: JiraInstanceDto | null,
  connectorEnabled?: boolean,
) =>
  createDataSource({
    definition: CONNECTORS.JIRA,
    status,
    connection: instance ?? null,
    connectorEnabled,
  });

const confluenceCard = (
  status: SourceInstanceIngestionStatus | null,
  connection: ConfluenceConnectionDto,
  latestRun?: IngestionRun | null,
) => createDataSource({ definition: CONNECTORS.CONFLUENCE, status, connection, latestRun });

describe("data-ingestion data helpers", () => {
  describe("SOURCE_SYSTEMS / SOURCE_META", () => {
    it("lists all known source systems", () => {
      expect(SOURCE_SYSTEMS).toEqual(["GITHUB", "JIRA", "UPLOAD", "CONFLUENCE"]);
    });

    it("provides meta for every source system", () => {
      for (const sys of SOURCE_SYSTEMS) {
        expect(SOURCE_META[sys].name).toBeTruthy();
        expect(SOURCE_META[sys].type).toBeTruthy();
        expect(SOURCE_META[sys].icon).toBeDefined();
        expect(SOURCE_META[sys].description).toBeTruthy();
      }
    });
  });

  describe("isRunInProgress", () => {
    it("returns true for CONNECTED and RUNNING", () => {
      expect(isRunInProgress("CONNECTED")).toBe(true);
      expect(isRunInProgress("RUNNING")).toBe(true);
    });

    it("returns false for terminal statuses", () => {
      expect(isRunInProgress("COMPLETED")).toBe(false);
      expect(isRunInProgress("PARTIAL")).toBe(false);
      expect(isRunInProgress("FAILED")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isRunInProgress(null)).toBe(false);
      expect(isRunInProgress(undefined)).toBe(false);
    });
  });

  describe("getRunStatusLabel", () => {
    it("returns Running for CONNECTED and RUNNING", () => {
      expect(getRunStatusLabel("CONNECTED")).toBe("Running");
      expect(getRunStatusLabel("RUNNING")).toBe("Running");
    });

    it("returns Success for COMPLETED", () => {
      expect(getRunStatusLabel("COMPLETED")).toBe("Success");
    });

    it("returns Partial and Failed for those statuses", () => {
      expect(getRunStatusLabel("PARTIAL")).toBe("Partial");
      expect(getRunStatusLabel("FAILED")).toBe("Failed");
    });
  });

  describe("getRunStatusTone", () => {
    it("returns success for COMPLETED", () => {
      expect(getRunStatusTone("COMPLETED")).toBe("success");
    });

    it("returns running for in-progress statuses", () => {
      expect(getRunStatusTone("RUNNING")).toBe("running");
      expect(getRunStatusTone("CONNECTED")).toBe("running");
    });

    it("returns warning for FAILED and PARTIAL", () => {
      expect(getRunStatusTone("FAILED")).toBe("warning");
      expect(getRunStatusTone("PARTIAL")).toBe("warning");
    });
  });

  describe("getSourceLabel", () => {
    it("returns the meta type for a source system", () => {
      expect(getSourceLabel("GITHUB")).toBe(SOURCE_META.GITHUB.type);
      expect(getSourceLabel("JIRA")).toBe(SOURCE_META.JIRA.type);
    });
  });

  describe("formatDateTime", () => {
    it('returns "Never" for null', () => {
      expect(formatDateTime(null)).toBe("Never");
    });

    it("passes through unparseable values", () => {
      expect(formatDateTime("not-a-date")).toBe("not-a-date");
    });

    it("formats a valid ISO timestamp", () => {
      const result = formatDateTime("2026-07-05T10:00:00Z");
      expect(result).not.toBe("Never");
      expect(result).toContain("2026");
    });
  });

  describe("formatRunFinishedAt", () => {
    it("returns the formatted timestamp when present", () => {
      const result = formatRunFinishedAt("2026-07-05T10:00:00Z", "COMPLETED");
      expect(result).toContain("2026");
    });

    it('returns "In progress" when null and status is running', () => {
      expect(formatRunFinishedAt(null, "RUNNING")).toBe("In progress");
    });

    it('returns "Not reported" when null and status is terminal', () => {
      expect(formatRunFinishedAt(null, "COMPLETED")).toBe("Not reported");
    });
  });

  describe("formatNumber", () => {
    it("formats an integer with locale separators", () => {
      expect(formatNumber(1234567)).toMatch(/1.234.567|1,234,567/);
    });
  });

  describe("all run statuses are covered by getRunStatusLabel", () => {
    const statuses: IngestionRunStatus[] = [
      "CONNECTED",
      "RUNNING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
    ];
    for (const status of statuses) {
      it(`labels ${status}`, () => {
        expect(getRunStatusLabel(status)).toBeTruthy();
      });
    }
  });

  describe("createDataSource for a Jira status row", () => {
    const status = (
      overrides: Partial<SourceInstanceIngestionStatus> = {},
    ): SourceInstanceIngestionStatus => ({
      sourceSystem: "JIRA",
      sourceId: "https://acme.atlassian.net",
      displayName: "Team board",
      repositoryId: null,
      owner: null,
      name: null,
      sourceUrl: "https://acme.atlassian.net",
      connectionStatus: "CONNECTED",
      enabled: true,
      lastRunTime: "2026-07-28T10:00:00Z",
      ingestedCount: 42,
      updatedCount: 3,
      deletedCount: 1,
      failedCount: 0,
      failedItems: [],
      artifactCount: 128,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: "2026-07-28T10:00:00Z",
      lastPullRequestsSyncAt: null,
      ...overrides,
    });

    const instance = (overrides: Partial<JiraInstanceDto> = {}): JiraInstanceDto => ({
      instanceUrl: "https://acme.atlassian.net",
      displayName: "Team board",
      lastUpdate: "2026-07-28T10:00:00Z",
      projectIds: ["p1"],
      sourceEnabled: true,
      status: "UP_TO_DATE",
      updateCredentialName: "default",
      updateCredentialUserEmail: "jira@corp.com",
      ...overrides,
    });

    const cases: ConnectionStatus[] = ["CONNECTED", "UPDATING", "OUT_OF_DATE", "FAILED"];

    for (const connectionStatus of cases) {
      it(`carries the ${connectionStatus} connection status`, () => {
        const source = jiraCard(status({ connectionStatus }));
        expect(source.backendStatus).toBe(connectionStatus);
      });
    }

    it("overrides the status with DISABLED when the source is disabled", () => {
      const source = jiraCard(status({ connectionStatus: "CONNECTED", enabled: false }));
      expect(source.backendStatus).toBe("DISABLED");
      expect(source.statusView.state).toBe("disabled");
    });

    it("carries the instance identity and merged credential in its Jira details", () => {
      const source = jiraCard(status(), instance());
      expect(source.sourceSystem).toBe("JIRA");
      expect(source.sourceId).toBe("https://acme.atlassian.net");
      expect(source.name).toBe("Team board");
      expect(githubRepositoryOf(source)).toBeNull();
      expect(jiraInstanceOf(source)).toEqual({
        instanceUrl: "https://acme.atlassian.net",
        displayName: "Team board",
        credentialName: "default",
        credentialUserEmail: "jira@corp.com",
      });
    });

    it("takes counters and the real artifact total from the status row", () => {
      const source = jiraCard(status(), instance());
      expect(source.artifacts).toBe(128);
      expect(source.latestIngestedCount).toBe(42);
      expect(source.latestUpdatedCount).toBe(3);
      expect(source.deletedCount).toBe(1);
      // The status row's artifactCount is the real stored total, no longer the
      // last run's ingested count.
      expect(source.totalArtifactCount).toBe(128);
    });

    it("still renders with empty credentials when no instance DTO is matched", () => {
      const source = jiraCard(status());
      expect(source.artifacts).toBe(128);
      expect(jiraInstanceOf(source)).toEqual({
        instanceUrl: "https://acme.atlassian.net",
        displayName: "Team board",
        credentialName: "",
        credentialUserEmail: "",
      });
    });

    it("reports never-synced when the status row has no last run", () => {
      const source = jiraCard(status({ lastRunTime: null }));
      expect(source.statusView.state).toBe("attention");
      expect(source.lastRunAt).toBeNull();
    });
    it("shows a synced badge after a successful Jira sync", () => {
      const source = jiraCard(status());

      expect(deriveSyncStatus(source).label).toBe("Synced");
    });

    it("surfaces a disabled Jira connector while preserving the synced badge", () => {
      const source = jiraCard(status(), instance(), false);

      expect(source.statusView.label).toBe("Connector disabled");
      expect(deriveSyncStatus(source).label).toBe("Synced");
    });
  });

  describe("createDataSourceFromStatus", () => {
    const row = (
      overrides: Partial<SourceInstanceIngestionStatus>,
    ): SourceInstanceIngestionStatus => ({
      sourceSystem: "GITHUB",
      sourceId: "acme/monorepo",
      displayName: "acme/monorepo",
      repositoryId: "repo-1",
      owner: "acme",
      name: "monorepo",
      sourceUrl: "https://github.com/acme/monorepo",
      connectionStatus: "CONNECTED",
      enabled: true,
      lastRunTime: "2026-07-28T10:00:00Z",
      ingestedCount: 1,
      updatedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      failedItems: [],
      artifactCount: 10,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: null,
      lastPullRequestsSyncAt: null,
      ...overrides,
    });

    it("keeps GitHub repository details on a GitHub row", () => {
      const source = createDataSourceFromStatus(row({}));

      expect(source.sourceSystem).toBe("GITHUB");
      expect(githubRepositoryOf(source)?.fullName).toBe("acme/monorepo");
    });

    it("maps a Jira row with the Jira identity and no GitHub details", () => {
      const source = createDataSourceFromStatus(
        row({
          sourceSystem: "JIRA",
          sourceId: "https://acme.atlassian.net",
          displayName: "Team board",
          repositoryId: null,
          owner: null,
          name: null,
        }),
      );

      expect(source.sourceSystem).toBe("JIRA");
      expect(githubRepositoryOf(source)).toBeNull();
      expect(jiraInstanceOf(source)?.instanceUrl).toBe("https://acme.atlassian.net");
    });

    it("maps a Confluence row and an upload row without GitHub details", () => {
      const confluence = createDataSourceFromStatus(
        row({ sourceSystem: "CONFLUENCE", sourceId: "https://acme.atlassian.net|1" }),
      );
      const upload = createDataSourceFromStatus(
        row({ sourceSystem: "UPLOAD", sourceId: "uploads" }),
      );

      expect(confluence.sourceSystem).toBe("CONFLUENCE");
      expect(githubRepositoryOf(confluence)).toBeNull();
      expect(upload.sourceSystem).toBe("UPLOAD");
      expect(githubRepositoryOf(upload)).toBeNull();
    });
  });

  describe("deriveConnectionStatus / deriveSyncStatus", () => {
    const jiraStatus = (
      overrides: Partial<SourceInstanceIngestionStatus> = {},
    ): SourceInstanceIngestionStatus => ({
      sourceSystem: "JIRA",
      sourceId: "https://acme.atlassian.net",
      displayName: "Team board",
      repositoryId: null,
      owner: null,
      name: null,
      sourceUrl: "https://acme.atlassian.net",
      connectionStatus: "CONNECTED",
      enabled: true,
      lastRunTime: "2026-07-28T10:00:00Z",
      ingestedCount: 42,
      updatedCount: 3,
      deletedCount: 1,
      failedCount: 0,
      failedItems: [],
      artifactCount: 128,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: "2026-07-28T10:00:00Z",
      lastPullRequestsSyncAt: null,
      ...overrides,
    });

    it("shows Connected next to a spinning Syncing badge while a sync runs", () => {
      const source = jiraCard(jiraStatus({ connectionStatus: "UPDATING" }));

      const connection = deriveConnectionStatus(source);
      const sync = deriveSyncStatus(source);

      expect(connection.label).toBe("Connected");
      expect(connection.spinning).toBe(false);
      expect(sync.label).toBe("Syncing");
      expect(sync.spinning).toBe(true);
    });

    it("shows Connected next to Synced when healthy and idle", () => {
      const source = jiraCard(jiraStatus());

      expect(deriveConnectionStatus(source).label).toBe("Connected");
      expect(deriveSyncStatus(source).label).toBe("Synced");
    });

    it("shows Disabled while keeping the last sync freshness", () => {
      const source = jiraCard(jiraStatus({ enabled: false }));

      expect(deriveConnectionStatus(source).state).toBe("disabled");
      expect(deriveSyncStatus(source).label).toBe("Synced");
    });

    it("shows Connected next to Not synced before the first run", () => {
      const source = jiraCard(jiraStatus({ lastRunTime: null }));

      expect(deriveConnectionStatus(source).label).toBe("Connected");
      expect(deriveSyncStatus(source).label).toBe("Not synced");
    });
  });

  describe("buildRunSourceLabels and getRunSourceLabel with Confluence", () => {
    const confluenceConn: ConfluenceConnectionDto = {
      id: "conn-uuid-1",
      projectId: "proj-1",
      baseUrl: "https://myteam.atlassian.net",
      spaceId: "123456",
      spaceKey: "DOCS",
      spaceName: null,
      credentialName: "default",
      pageAllowlist: [],
      pageDenylist: [],
      credentialsConfigured: true,
      createdAt: "2026-08-28T10:00:00Z",
      updatedAt: "2026-08-28T10:00:00Z",
      version: 1,
      sourceEnabled: true,
    };

    it("resolves Confluence runs by composite baseUrl|spaceId, spaceKey, and connectionId", () => {
      const source = confluenceCard(null, confluenceConn);
      const labels = buildRunSourceLabels([source]);

      expect(labels.get("conn-uuid-1")).toBe("DOCS");
      expect(labels.get("https://myteam.atlassian.net|123456")).toBe("DOCS");
      expect(labels.get("https://myteam.atlassian.net|123456".toLowerCase())).toBe("DOCS");
      expect(labels.get("DOCS")).toBe("DOCS");

      const runWithCompositeRef: IngestionRun = {
        runId: "run-1",
        sourceSystem: "CONFLUENCE",
        sourceId: "https://myteam.atlassian.net|123456",
        owner: null,
        name: null,
        repositoryId: "conn-uuid-1",
        startedAt: "2026-08-28T10:00:00Z",
        finishedAt: "2026-08-28T10:05:00Z",
        ingestedCount: 10,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        status: "COMPLETED",
        failedItems: [],
        failureReason: null,
        aiSyncStatus: "SUCCEEDED",
        aiSyncFailureReason: null,
      };

      expect(getRunSourceLabel(runWithCompositeRef, labels)).toBe("DOCS");
    });

    it("builds a Confluence card without a status row from the latest run", () => {
      const run: IngestionRun = {
        runId: "run-2",
        sourceSystem: "CONFLUENCE",
        sourceId: "https://different-ref|9999",
        owner: null,
        name: null,
        repositoryId: "conn-uuid-1",
        startedAt: "2026-08-28T10:00:00Z",
        finishedAt: "2026-08-28T10:05:00Z",
        ingestedCount: 5,
        updatedCount: 1,
        deletedCount: 0,
        failedCount: 0,
        status: "COMPLETED",
        failedItems: [],
        failureReason: null,
        aiSyncStatus: "SUCCEEDED",
        aiSyncFailureReason: null,
      };

      const source = confluenceCard(null, confluenceConn, run);
      expect(deriveSyncStatus(source).label).toBe("Synced");
      // Without a status row a space counts the pages its newest run created and updated.
      expect(source.artifacts).toBe(6);
      expect(source.totalArtifactCount).toBe(6);
    });

    it("names the card from spaceName, falling back to spaceKey when there is none", () => {
      expect(confluenceCard(null, { ...confluenceConn, spaceName: "Docs Space" }).name).toBe(
        "Docs Space",
      );
      expect(confluenceCard(null, { ...confluenceConn, spaceName: null }).name).toBe("DOCS");
    });

    it("carries spaceName and credentialName onto the source's confluenceSpace details", () => {
      const source = confluenceCard(null, {
        ...confluenceConn,
        spaceName: "Docs Space",
        credentialName: "team-cred",
      });

      expect(confluenceSpaceOf(source)?.spaceName).toBe("Docs Space");
      expect(confluenceSpaceOf(source)?.credentialName).toBe("team-cred");
    });

    it("creates Confluence source from status instance", () => {
      const status: SourceInstanceIngestionStatus = {
        sourceSystem: "CONFLUENCE",
        sourceId: "https://myteam.atlassian.net|123456",
        displayName: "DOCS",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://myteam.atlassian.net/wiki/spaces/DOCS",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-08-28T10:00:00Z",
        ingestedCount: 10,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 12,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      };

      const source = confluenceCard(status, confluenceConn);
      expect(source.sourceId).toBe("conn-uuid-1");
      expect(source.sourceSystem).toBe("CONFLUENCE");
      expect(source.name).toBe("DOCS");
      expect(deriveSyncStatus(source).label).toBe("Synced");
      expect(source.artifacts).toBe(12);
    });

    it("keeps spaceName and credentialName once a status row takes over the card", () => {
      const status: SourceInstanceIngestionStatus = {
        sourceSystem: "CONFLUENCE",
        sourceId: "https://myteam.atlassian.net|123456",
        displayName: "Docs Space",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://myteam.atlassian.net/wiki/spaces/DOCS",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-08-28T10:00:00Z",
        ingestedCount: 10,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 12,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      };

      const source = confluenceCard(status, {
        ...confluenceConn,
        spaceName: "Docs Space",
        credentialName: "team-cred",
      });

      expect(confluenceSpaceOf(source)?.spaceName).toBe("Docs Space");
      expect(confluenceSpaceOf(source)?.credentialName).toBe("team-cred");
    });
  });
});
