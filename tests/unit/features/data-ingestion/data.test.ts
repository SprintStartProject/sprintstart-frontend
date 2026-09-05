import { describe, it, expect } from "vitest";
import {
  SOURCE_SYSTEMS,
  SOURCE_META,
  INGESTION_RUN_LIMIT,
  DETAILS_RUN_LIMIT,
  createJiraSourceFromInstance,
  createConfluenceSourceFromConnection,
  createConfluenceSourceFromInstance,
  buildRunSourceLabels,
  getRunSourceLabel,
  deriveConnectionStatus,
  deriveSyncStatus,
  getSourceStatus,
  getSourceStatusLabel,
  getRunStatusLabel,
  getRunStatusTone,
  isRunInProgress,
  getSourceLabel,
  formatDateTime,
  formatRunFinishedAt,
  formatNumber,
} from "../../../../src/features/data-ingestion/data";
import type {
  ConnectionStatus,
  IngestionRun,
  IngestionRunStatus,
  SourceInstanceIngestionStatus,
} from "../../../../src/features/data-ingestion/types";
import type { JiraInstanceDto } from "../../../../src/services/sources/jiraService";
import type { ConfluenceConnectionDto } from "../../../../src/services/sources/confluenceService";

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

  describe("limits", () => {
    it("exports sensible positive limits", () => {
      expect(INGESTION_RUN_LIMIT).toBeGreaterThan(0);
      expect(DETAILS_RUN_LIMIT).toBeGreaterThan(0);
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

  describe("getSourceStatus", () => {
    it("returns warning when the source has never synced", () => {
      expect(getSourceStatus(true, false, "COMPLETED")).toBe("warning");
    });

    it("returns running when a run is in progress", () => {
      expect(getSourceStatus(false, false, "RUNNING")).toBe("running");
      expect(getSourceStatus(false, false, "CONNECTED")).toBe("running");
    });

    it("returns warning for FAILED and PARTIAL run statuses", () => {
      expect(getSourceStatus(false, false, "FAILED")).toBe("warning");
      expect(getSourceStatus(false, false, "PARTIAL")).toBe("warning");
    });

    it("returns warning when there are errors regardless of status", () => {
      expect(getSourceStatus(false, true, "COMPLETED")).toBe("warning");
    });

    it("returns connected for a clean completed run", () => {
      expect(getSourceStatus(false, false, "COMPLETED")).toBe("connected");
    });
  });

  describe("getSourceStatusLabel", () => {
    it("labels the never-synced state", () => {
      expect(getSourceStatusLabel(true, false, null)).toBe("Not synced");
    });

    it("labels the running state", () => {
      expect(getSourceStatusLabel(false, false, "RUNNING")).toBe("Running");
    });

    it("labels FAILED and PARTIAL", () => {
      expect(getSourceStatusLabel(false, false, "FAILED")).toBe("Failed");
      expect(getSourceStatusLabel(false, false, "PARTIAL")).toBe("Partial");
    });

    it("labels the error-warning state", () => {
      expect(getSourceStatusLabel(false, true, "COMPLETED")).toBe("Warning");
    });

    it("labels COMPLETED as Synced", () => {
      expect(getSourceStatusLabel(false, false, "COMPLETED")).toBe("Synced");
    });

    it("defaults to Connected for a clean connected status without errors", () => {
      expect(getSourceStatusLabel(false, false, "COMPLETED")).toBe("Synced");
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

  describe("createJiraSourceFromInstance", () => {
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
        const source = createJiraSourceFromInstance(status({ connectionStatus }));
        expect(source.backendStatus).toBe(connectionStatus);
      });
    }

    it("overrides the status with DISABLED when the source is disabled", () => {
      const source = createJiraSourceFromInstance(
        status({ connectionStatus: "CONNECTED", enabled: false }),
      );
      expect(source.backendStatus).toBe("DISABLED");
      expect(source.statusView.state).toBe("disabled");
    });

    it("carries the instance identity and merged credential in jiraInstance, not githubRepository", () => {
      const source = createJiraSourceFromInstance(status(), instance());
      expect(source.sourceSystem).toBe("JIRA");
      expect(source.sourceId).toBe("https://acme.atlassian.net");
      expect(source.name).toBe("Team board");
      expect(source.githubRepository).toBeNull();
      expect(source.jiraInstance).toEqual({
        instanceUrl: "https://acme.atlassian.net",
        displayName: "Team board",
        credentialName: "default",
        credentialUserEmail: "jira@corp.com",
      });
    });

    it("takes counters and the real artifact total from the status row", () => {
      const source = createJiraSourceFromInstance(status(), instance());
      expect(source.artifacts).toBe(128);
      expect(source.latestIngestedCount).toBe(42);
      expect(source.latestUpdatedCount).toBe(3);
      expect(source.deletedCount).toBe(1);
      // The status row's artifactCount is the real stored total, no longer the
      // last run's ingested count.
      expect(source.totalArtifactCount).toBe(128);
    });

    it("still renders with empty credentials when no instance DTO is matched", () => {
      const source = createJiraSourceFromInstance(status());
      expect(source.artifacts).toBe(128);
      expect(source.jiraInstance).toEqual({
        instanceUrl: "https://acme.atlassian.net",
        displayName: "Team board",
        credentialName: "",
        credentialUserEmail: "",
      });
    });

    it("reports never-synced when the status row has no last run", () => {
      const source = createJiraSourceFromInstance(status({ lastRunTime: null }));
      expect(source.statusView.state).toBe("attention");
      expect(source.lastRunAt).toBeNull();
    });
    it("shows a synced badge after a successful Jira sync", () => {
      const source = createJiraSourceFromInstance(status());

      expect(source.ingestionStatusLabel).toBe("Synced");
    });

    it("surfaces a disabled Jira connector while preserving the synced badge", () => {
      const source = createJiraSourceFromInstance(status(), instance(), false);

      expect(source.statusView.label).toBe("Connector disabled");
      expect(source.ingestionStatusLabel).toBe("Synced");
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
      const source = createJiraSourceFromInstance(jiraStatus({ connectionStatus: "UPDATING" }));

      const connection = deriveConnectionStatus(source);
      const sync = deriveSyncStatus(source);

      expect(connection.label).toBe("Connected");
      expect(connection.spinning).toBe(false);
      expect(sync.label).toBe("Syncing");
      expect(sync.spinning).toBe(true);
    });

    it("shows Connected next to Synced when healthy and idle", () => {
      const source = createJiraSourceFromInstance(jiraStatus());

      expect(deriveConnectionStatus(source).label).toBe("Connected");
      expect(deriveSyncStatus(source).label).toBe("Synced");
    });

    it("shows Disabled while keeping the last sync freshness", () => {
      const source = createJiraSourceFromInstance(jiraStatus({ enabled: false }));

      expect(deriveConnectionStatus(source).state).toBe("disabled");
      expect(deriveSyncStatus(source).label).toBe("Synced");
    });

    it("shows Connected next to Not synced before the first run", () => {
      const source = createJiraSourceFromInstance(jiraStatus({ lastRunTime: null }));

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
      pageAllowlist: [],
      pageDenylist: [],
      credentialsConfigured: true,
      createdAt: "2026-08-28T10:00:00Z",
      updatedAt: "2026-08-28T10:00:00Z",
      version: 1,
      sourceEnabled: true,
    };

    it("resolves Confluence runs by composite baseUrl|spaceId, spaceKey, and connectionId", () => {
      const source = createConfluenceSourceFromConnection(confluenceConn);
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

    it("matches Confluence runs in createConfluenceSourceFromConnection using repositoryId", () => {
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

      const source = createConfluenceSourceFromConnection(confluenceConn, [run]);
      expect(source.ingestionStatusLabel).toBe("Synced");
      expect(source.artifacts).toBe(6);
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

      const source = createConfluenceSourceFromInstance(status, confluenceConn);
      expect(source.sourceId).toBe("conn-uuid-1");
      expect(source.sourceSystem).toBe("CONFLUENCE");
      expect(source.name).toBe("DOCS");
      expect(source.ingestionStatusLabel).toBe("Synced");
      expect(source.artifacts).toBe(12);
    });
  });
});
