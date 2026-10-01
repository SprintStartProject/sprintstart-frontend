import { describe, expect, it } from "vitest";
import {
  buildRunSourceLabels,
  createNotionSourceFromConnection,
  createNotionSourceFromInstance,
  getRunSourceLabel,
} from "../../../../src/features/data-ingestion/data";
import type {
  IngestionRun,
  SourceInstanceIngestionStatus,
} from "../../../../src/features/data-ingestion/types";
import type { NotionConnectionDto } from "../../../../src/services/sources/notionService";

const connection: NotionConnectionDto = {
  id: "conn-1",
  projectId: "proj-1",
  pageId: "page-1",
  pageTitle: "Sprint Planning",
  pageUrl: "https://www.notion.so/Sprint-Planning-page1",
  credentialName: "wiki",
  sourceEnabled: true,
  autoUpdate: false,
  scheduleSpec: null,
  nextSyncAt: null,
  lastEditedTime: null,
  contentHash: null,
  lastSyncedAt: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  version: 1,
};

const status: SourceInstanceIngestionStatus = {
  sourceSystem: "NOTION",
  sourceId: "https://www.notion.so/Sprint-Planning-page1",
  displayName: "Sprint Planning",
  repositoryId: null,
  owner: null,
  name: null,
  sourceUrl: "https://www.notion.so/Sprint-Planning-page1",
  connectionStatus: "CONNECTED",
  enabled: true,
  lastRunTime: "2026-08-28T10:00:00Z",
  ingestedCount: 1,
  updatedCount: 0,
  deletedCount: 0,
  failedCount: 0,
  failedItems: [],
  artifactCount: 4,
  lastCommitsSyncAt: null,
  lastIssuesSyncAt: null,
  lastPullRequestsSyncAt: null,
};

function run(overrides: Partial<IngestionRun> = {}): IngestionRun {
  return {
    runId: "run-1",
    sourceSystem: "NOTION",
    sourceId: "https://www.notion.so/Sprint-Planning-page1",
    owner: null,
    name: null,
    repositoryId: "conn-1",
    startedAt: "2026-08-28T10:00:00Z",
    finishedAt: "2026-08-28T10:01:00Z",
    ingestedCount: 1,
    updatedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    status: "COMPLETED",
    failedItems: [],
    failureReason: null,
    aiSyncStatus: "SUCCEEDED",
    aiSyncFailureReason: null,
    ...overrides,
  };
}

describe("createNotionSourceFromInstance", () => {
  it("keys the card by the connection id, not by the page URL of the status row", () => {
    const source = createNotionSourceFromInstance(status, connection);

    expect(source.sourceId).toBe("conn-1");
    expect(source.sourceSystem).toBe("NOTION");
    expect(source.type).toBe("Notion");
    expect(source.name).toBe("Sprint Planning");
  });

  it("takes the real artifact count and counters from the status row", () => {
    const source = createNotionSourceFromInstance(status, connection);

    expect(source.artifacts).toBe(4);
    expect(source.totalArtifactCount).toBe(4);
    expect(source.ingestionStatusLabel).toBe("Synced");
    expect(source.errors).toBe(0);
  });

  it("carries the page identity for the actions and the drawer", () => {
    const source = createNotionSourceFromInstance(status, {
      ...connection,
      lastSyncedAt: "2026-08-28T10:00:00Z",
    });

    expect(source.notionPage).toEqual({
      connectionId: "conn-1",
      pageId: "page-1",
      pageUrl: "https://www.notion.so/Sprint-Planning-page1",
      credentialName: "wiki",
      lastSyncedAt: "2026-08-28T10:00:00Z",
    });
  });

  it("is disabled when either the status row or the connection says so", () => {
    expect(
      createNotionSourceFromInstance({ ...status, connectionStatus: "DISABLED" }, connection)
        .backendStatus,
    ).toBe("DISABLED");
    expect(
      createNotionSourceFromInstance(status, { ...connection, sourceEnabled: false }).backendStatus,
    ).toBe("DISABLED");
  });

  it("shows the next sync only when one is scheduled", () => {
    expect(createNotionSourceFromInstance(status, connection).nextSync).toBe("Not scheduled");
    expect(
      createNotionSourceFromInstance(status, {
        ...connection,
        nextSyncAt: "2026-09-01T00:00:00Z",
      }).nextSync,
    ).not.toBe("Not scheduled");
  });

  it("flags failures from the status row", () => {
    const source = createNotionSourceFromInstance({ ...status, failedCount: 2 }, connection);

    expect(source.errors).toBe(2);
    expect(source.ingestionStatus).toBe("warning");
  });
});

describe("createNotionSourceFromConnection", () => {
  it("names the card after the page and starts out never synced", () => {
    const source = createNotionSourceFromConnection(connection);

    expect(source.name).toBe("Sprint Planning");
    expect(source.sourceId).toBe("conn-1");
    expect(source.lastSync).toBe("Never");
    expect(source.ingestionStatus).toBe("warning");
  });

  it("matches a run through the connection id carried as repositoryId", () => {
    const source = createNotionSourceFromConnection(connection, [
      run({ sourceId: "something-else", repositoryId: "conn-1", ingestedCount: 3 }),
    ]);

    expect(source.ingestionStatusLabel).toBe("Synced");
    expect(source.artifacts).toBe(3);
    expect(source.runIds).toEqual(["run-1"]);
  });

  it("ignores runs of other pages and other systems", () => {
    const source = createNotionSourceFromConnection(connection, [
      run({ repositoryId: "conn-2", sourceId: "https://www.notion.so/other" }),
      run({ sourceSystem: "CONFLUENCE", repositoryId: "conn-1" }),
    ]);

    expect(source.runIds).toEqual([]);
    expect(source.ingestionStatus).toBe("warning");
  });

  it("counts a synced connection as synced even before its run has loaded", () => {
    const source = createNotionSourceFromConnection({
      ...connection,
      lastSyncedAt: "2026-08-28T10:00:00Z",
    });

    expect(source.ingestionStatusLabel).toBe("Synced");
    expect(source.lastSync).not.toBe("Never");
  });

  it("is disabled when the connection is", () => {
    expect(
      createNotionSourceFromConnection({ ...connection, sourceEnabled: false }).backendStatus,
    ).toBe("DISABLED");
  });
});

describe("run labels for Notion pages", () => {
  it("resolves a run by connection id, page id or page URL to the page title", () => {
    const labels = buildRunSourceLabels([createNotionSourceFromConnection(connection)]);

    expect(labels.get("conn-1")).toBe("Sprint Planning");
    expect(labels.get("page-1")).toBe("Sprint Planning");
    expect(getRunSourceLabel(run(), labels)).toBe("Sprint Planning");
  });
});
