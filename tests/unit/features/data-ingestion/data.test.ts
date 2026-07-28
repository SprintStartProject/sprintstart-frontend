import { describe, it, expect } from "vitest";
import {
  SOURCE_SYSTEMS,
  SOURCE_META,
  INGESTION_RUN_LIMIT,
  DETAILS_RUN_LIMIT,
  createJiraSourceFromInstance,
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
import type { IngestionRunStatus } from "../../../../src/features/data-ingestion/types";
import type {
  JiraInstanceDto,
  JiraInstanceStatus,
} from "../../../../src/services/sources/jiraService";

describe("data-ingestion data helpers", () => {
  describe("SOURCE_SYSTEMS / SOURCE_META", () => {
    it("lists all known source systems", () => {
      expect(SOURCE_SYSTEMS).toEqual(["GITHUB", "JIRA", "UPLOAD"]);
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
    const instance = (
      overrides: Partial<JiraInstanceDto> = {},
    ): JiraInstanceDto => ({
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

    const cases: Array<[JiraInstanceStatus, string]> = [
      ["UP_TO_DATE", "CONNECTED"],
      ["UPDATING", "UPDATING"],
      ["OUT_OF_DATE", "OUT_OF_DATE"],
      ["FAILED", "FAILED"],
    ];

    for (const [jiraStatus, backendStatus] of cases) {
      it(`maps ${jiraStatus} to ${backendStatus}`, () => {
        const source = createJiraSourceFromInstance(
          instance({ status: jiraStatus }),
        );
        expect(source.backendStatus).toBe(backendStatus);
      });
    }

    it("overrides the status with DISABLED when the source is disabled", () => {
      const source = createJiraSourceFromInstance(
        instance({ status: "UP_TO_DATE", sourceEnabled: false }),
      );
      expect(source.backendStatus).toBe("DISABLED");
      expect(source.statusView.state).toBe("disabled");
    });

    it("carries the instance identity and credential in jiraInstance, not githubRepository", () => {
      const source = createJiraSourceFromInstance(instance());
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

    it("fills run-derived counters from a matched latest run", () => {
      const source = createJiraSourceFromInstance(instance(), {
        runId: "r1",
        sourceSystem: "JIRA",
        sourceId: "https://acme.atlassian.net",
        owner: null,
        name: null,
        repositoryId: null,
        startedAt: "2026-07-28T10:00:00Z",
        finishedAt: "2026-07-28T10:05:00Z",
        ingestedCount: 42,
        updatedCount: 3,
        deletedCount: 1,
        failedCount: 0,
        status: "COMPLETED",
        failedItems: [],
        failureReason: null,
        aiSyncStatus: "SUCCEEDED",
        aiSyncFailureReason: null,
      });
      expect(source.artifacts).toBe(42);
      expect(source.latestUpdatedCount).toBe(3);
      expect(source.totalArtifactCount).toBe(42);
    });

    it("falls back to the display name only, with zero counters, without a run", () => {
      const source = createJiraSourceFromInstance(instance());
      expect(source.artifacts).toBe(0);
      expect(source.errors).toBe(0);
      expect(source.failedItems).toEqual([]);
    });
  });
});
