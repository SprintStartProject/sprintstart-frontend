import { describe, expect, it } from "vitest";
import { buildDataSources } from "../../../../src/features/data-ingestion/buildSources";
import { CONNECTORS } from "../../../../src/features/data-ingestion/connectors/registry";
import { createDataSource, formatDateTime } from "../../../../src/features/data-ingestion/data";
import {
  bitbucketRepositoryOf,
  confluenceSpaceOf,
  githubRepositoryOf,
  jiraInstanceOf,
  notionWorkspaceOf,
} from "../../../../src/features/data-ingestion/sourceDetails";
import type {
  IngestionRun,
  SourceInstanceIngestionStatus,
} from "../../../../src/features/data-ingestion/types";
import type { ProjectSource } from "../../../../src/services/projectService";
import type { ConfluenceConnectionDto } from "../../../../src/services/sources/confluenceService";
import type { JiraInstanceDto } from "../../../../src/services/sources/jiraService";
import type { NotionWorkspaceConnectionDto } from "../../../../src/services/sources/notionService";

function status(overrides: Partial<SourceInstanceIngestionStatus>): SourceInstanceIngestionStatus {
  return {
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
    ingestedCount: 4,
    updatedCount: 2,
    deletedCount: 1,
    failedCount: 0,
    failedItems: [],
    artifactCount: 40,
    lastCommitsSyncAt: "2026-07-28T09:00:00Z",
    lastIssuesSyncAt: null,
    lastPullRequestsSyncAt: null,
    ...overrides,
  };
}

function run(overrides: Partial<IngestionRun>): IngestionRun {
  return {
    runId: "run-1",
    sourceSystem: "GITHUB",
    sourceId: "acme/monorepo",
    owner: "acme",
    name: "monorepo",
    repositoryId: "repo-1",
    startedAt: "2026-07-28T10:00:00Z",
    finishedAt: null,
    ingestedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    status: "RUNNING",
    failedItems: [],
    failureReason: null,
    aiSyncStatus: "NOT_APPLICABLE",
    aiSyncFailureReason: null,
    ...overrides,
  };
}

const githubProjectSource: ProjectSource = {
  id: "ps-1",
  name: "acme/monorepo",
  type: "GITHUB",
  status: "CONNECTED",
};

const confluenceConnection: ConfluenceConnectionDto = {
  id: "conn-1",
  projectId: "p1",
  baseUrl: "https://acme.atlassian.net",
  spaceId: "123",
  spaceKey: "DOCS",
  spaceName: "Docs",
  credentialName: "default",
  pageAllowlist: [],
  pageDenylist: [],
  credentialsConfigured: true,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  version: 1,
  sourceEnabled: true,
};

const notionConnection: NotionWorkspaceConnectionDto = {
  id: "notion-conn-1",
  projectId: "p1",
  workspaceId: "ws-1",
  workspaceName: "Acme Workspace",
  workspaceUrl: "https://www.notion.so/acme",
  credentialName: "wiki",
  sourceEnabled: true,
  autoUpdate: false,
  schedule: "every 60 minutes",
  scheduleSpec: { type: "INTERVAL", everyMinutes: 60 },
  nextSyncAt: null,
  lastSyncedAt: null,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  version: 1,
};

const notionStatus = status({
  sourceSystem: "NOTION",
  sourceId: "ws-1",
  displayName: "Acme Workspace",
  repositoryId: null,
  owner: null,
  name: null,
  sourceUrl: "https://www.notion.so/acme",
  artifactCount: 12,
});

const none = {
  projectSources: [],
  statuses: [],
  jiraInstances: [],
  confluenceConnections: [],
  notionConnections: [],
  latestRuns: [],
  connectorEnabledById: new Map<string, boolean>(),
};

describe("buildDataSources", () => {
  it("builds a GitHub card keyed by the project source from its status row", () => {
    const [card] = buildDataSources({
      ...none,
      projectSources: [githubProjectSource],
      statuses: [status({})],
    });

    expect(card.sourceId).toBe("ps-1");
    expect(card.totalArtifactCount).toBe(40);
    expect(githubRepositoryOf(card)?.repositoryId).toBe("repo-1");
    expect(card.details).toMatchObject({
      system: "GITHUB",
      syncTimes: { commits: "2026-07-28T09:00:00Z" },
    });
  });

  it("takes a GitHub card's run status from its own repository's run only", () => {
    const cards = buildDataSources({
      ...none,
      projectSources: [
        githubProjectSource,
        { ...githubProjectSource, id: "ps-2", name: "acme/other" },
      ],
      statuses: [
        status({}),
        status({
          sourceId: "acme/other",
          displayName: "acme/other",
          repositoryId: "repo-2",
          name: "other",
        }),
      ],
      latestRuns: [run({ repositoryId: "repo-2", sourceId: "acme/other" })],
    });

    expect(cards.map((card) => card.statusView.state)).toEqual(["connected", "syncing"]);
  });

  it("prefers a GitHub source's own run over a sibling's when it has no status row", () => {
    const [card] = buildDataSources({
      ...none,
      projectSources: [githubProjectSource],
      latestRuns: [
        run({
          runId: "sibling",
          ingestedCount: 99,
          status: "COMPLETED",
          repositoryId: "repo-2",
          sourceId: "acme/other",
        }),
        run({ runId: "own", ingestedCount: 3, status: "COMPLETED" }),
      ],
    });

    expect(card.artifacts).toBe(3);
  });

  it("falls back to the source system's latest run for a GitHub source without a status row", () => {
    const [card] = buildDataSources({
      ...none,
      projectSources: [githubProjectSource],
      latestRuns: [run({ ingestedCount: 7, status: "COMPLETED", repositoryId: "other" })],
    });

    expect(card.sourceId).toBe("ps-1");
    expect(card.artifacts).toBe(7);
    expect(card.totalArtifactCount).toBe(0);
    expect(githubRepositoryOf(card)).toBeNull();
  });

  it("builds Bitbucket cards from the status rows alone, without a second card per project source", () => {
    const cards = buildDataSources({
      ...none,
      projectSources: [
        { id: "bb-ps", name: "acme/widgets", type: "BITBUCKET", status: "CONNECTED" },
      ],
      statuses: [
        status({
          sourceSystem: "BITBUCKET",
          sourceId: "acme/widgets",
          displayName: "acme/widgets",
          repositoryId: "bb-1",
          owner: "acme",
          name: "widgets",
          sourceUrl: "https://bitbucket.org/acme/widgets",
          artifactCount: 12,
          lastPullRequestsSyncAt: "2026-07-28T08:00:00Z",
        }),
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].sourceSystem).toBe("BITBUCKET");
    expect(cards[0].sourceId).toBe("bb-1");
    expect(cards[0].totalArtifactCount).toBe(12);
    expect(bitbucketRepositoryOf(cards[0])).toMatchObject({
      workspace: "acme",
      slug: "widgets",
      repositoryId: "bb-1",
    });
    expect(cards[0].details).toMatchObject({ syncTimes: { pullRequests: "2026-07-28T08:00:00Z" } });
  });

  it("keeps GitHub and Bitbucket cards of the same name apart", () => {
    const cards = buildDataSources({
      ...none,
      projectSources: [githubProjectSource],
      statuses: [
        status({}),
        status({
          sourceSystem: "BITBUCKET",
          repositoryId: "bb-1",
          sourceUrl: "https://bitbucket.org/acme/monorepo",
        }),
      ],
    });

    expect(cards.map((card) => card.sourceSystem)).toEqual(["GITHUB", "BITBUCKET"]);
    expect(githubRepositoryOf(cards[0])).not.toBeNull();
    expect(githubRepositoryOf(cards[1])).toBeNull();
  });

  it("shows a Bitbucket repository as disabled when its connector is globally disabled", () => {
    const [card] = buildDataSources({
      ...none,
      statuses: [status({ sourceSystem: "BITBUCKET", repositoryId: "bb-1" })],
      connectorEnabledById: new Map([["bitbucket", false]]),
    });

    expect(card.statusView.state).toBe("disabled");
    expect(card.statusView.label).toBe("Connector disabled");
  });

  it("builds Jira cards from the status rows and merges the instance record by URL", () => {
    const instance: JiraInstanceDto = {
      instanceUrl: "https://Acme.atlassian.net",
      displayName: "Board",
      lastUpdate: "2026-07-01T00:00:00Z",
      projectIds: ["p1"],
      sourceEnabled: true,
      status: "UP_TO_DATE",
      updateCredentialName: "cred",
      updateCredentialUserEmail: "a@b.c",
    };

    const [card] = buildDataSources({
      ...none,
      projectSources: [{ id: "j", name: "Board", type: "JIRA", status: "CONNECTED" }],
      statuses: [
        status({
          sourceSystem: "JIRA",
          sourceId: "https://acme.atlassian.net",
          displayName: "Board",
          repositoryId: null,
        }),
      ],
      jiraInstances: [instance],
    });

    expect(card.sourceSystem).toBe("JIRA");
    expect(jiraInstanceOf(card)?.credentialName).toBe("cred");
  });

  it("shows a source whose connector is globally disabled as disabled", () => {
    const [card] = buildDataSources({
      ...none,
      projectSources: [githubProjectSource],
      statuses: [status({})],
      connectorEnabledById: new Map([["github", false]]),
    });

    expect(card.statusView.label).toBe("Connector disabled");
  });

  it("matches a Confluence connection to its status row by composite ref", () => {
    const [card] = buildDataSources({
      ...none,
      confluenceConnections: [confluenceConnection],
      statuses: [
        status({
          sourceSystem: "CONFLUENCE",
          sourceId: "https://acme.atlassian.net|123",
          displayName: "Docs",
          repositoryId: null,
        }),
      ],
    });

    expect(card.sourceId).toBe("conn-1");
    expect(card.totalArtifactCount).toBe(40);
    expect(confluenceSpaceOf(card)?.spaceKey).toBe("DOCS");
  });

  it("finds the latest run of a Confluence connection by its repositoryId", () => {
    const [card] = buildDataSources({
      ...none,
      confluenceConnections: [confluenceConnection],
      latestRuns: [
        run({
          runId: "r2",
          sourceSystem: "CONFLUENCE",
          sourceId: "https://different-ref|9999",
          repositoryId: "conn-1",
          status: "COMPLETED",
          ingestedCount: 5,
          aiSyncStatus: "SUCCEEDED",
        }),
      ],
    });

    expect(card.artifacts).toBe(5);
    expect(card.lastRunAt).toBe("2026-07-28T10:00:00Z");
  });

  it("counts a Confluence space without a status row by its run's created and updated pages", () => {
    const finishedAt = "2026-07-28T10:30:00Z";
    const [card] = buildDataSources({
      ...none,
      confluenceConnections: [confluenceConnection],
      latestRuns: [
        run({
          sourceSystem: "CONFLUENCE",
          repositoryId: "conn-1",
          status: "COMPLETED",
          ingestedCount: 5,
          updatedCount: 3,
          finishedAt,
        }),
      ],
    });

    expect(card.artifacts).toBe(8);
    expect(card.totalArtifactCount).toBe(8);
    expect(card.lastSync).toBe(formatDateTime(finishedAt));
    expect(card.lastRunAt).toBe("2026-07-28T10:00:00Z");
  });

  it("keeps an upload source alive through the run fallback and drops it once a status row exists", () => {
    const uploadSource: ProjectSource = {
      id: "u",
      name: "Uploads",
      type: "UPLOAD",
      status: "CONNECTED",
    };

    const withoutRow = buildDataSources({ ...none, projectSources: [uploadSource] });
    const withRow = buildDataSources({
      ...none,
      projectSources: [uploadSource],
      statuses: [
        status({
          sourceSystem: "UPLOAD",
          sourceId: "uploads",
          displayName: "Uploaded docs",
          repositoryId: null,
        }),
      ],
    });

    expect(withoutRow.map((card) => card.sourceId)).toEqual(["u"]);
    expect(withRow.map((card) => card.sourceId)).toEqual(["uploads"]);
  });

  it("flags sources that share their source system", () => {
    const cards = buildDataSources({
      ...none,
      projectSources: [githubProjectSource, { ...githubProjectSource, id: "ps-2" }],
    });

    expect(cards.every((card) => card.sharesSourceSystem)).toBe(true);
  });
});

describe("buildDataSources for Notion", () => {
  it("builds a card from the status row keyed by the connection record", () => {
    const [card] = buildDataSources({
      ...none,
      statuses: [notionStatus],
      notionConnections: [notionConnection],
    });

    expect(card.sourceSystem).toBe("NOTION");
    expect(card.sourceId).toBe("notion-conn-1");
    expect(card.name).toBe("Acme Workspace");
    expect(card.totalArtifactCount).toBe(12);
    expect(notionWorkspaceOf(card)).toEqual({
      connectionId: "notion-conn-1",
      sourceRef: "ws-1",
      workspaceName: "Acme Workspace",
      credentialName: "wiki",
    });
  });

  it("still shows the card, without a connection id, when the connections cannot be read", () => {
    const [card] = buildDataSources({ ...none, statuses: [notionStatus] });

    expect(card.sourceId).toBe("ws-1");
    expect(notionWorkspaceOf(card)).toMatchObject({
      connectionId: null,
      workspaceName: "Acme Workspace",
      credentialName: null,
    });
  });

  it("matches a connection without a workspace id through its own id", () => {
    const [card] = buildDataSources({
      ...none,
      statuses: [{ ...notionStatus, sourceId: "notion-conn-1" }],
      notionConnections: [{ ...notionConnection, workspaceId: null }],
    });

    expect(notionWorkspaceOf(card)?.connectionId).toBe("notion-conn-1");
  });

  it("gives two connections that see the same workspace one card each", () => {
    const second = { ...notionConnection, id: "notion-conn-2", credentialName: "docs" };

    const cards = buildDataSources({
      ...none,
      statuses: [notionStatus, notionStatus],
      notionConnections: [notionConnection, second],
    });

    expect(cards.map((card) => card.sourceId)).toEqual(["notion-conn-1", "notion-conn-2"]);
    expect(cards.map((card) => notionWorkspaceOf(card)?.credentialName)).toEqual(["wiki", "docs"]);
  });

  it("takes the AI-sync stage from the connection's own run", () => {
    const [card] = buildDataSources({
      ...none,
      statuses: [notionStatus],
      notionConnections: [notionConnection],
      latestRuns: [
        run({ sourceSystem: "NOTION", repositoryId: "other", status: "FAILED" }),
        run({ sourceSystem: "NOTION", repositoryId: "notion-conn-1", status: "RUNNING" }),
      ],
    });

    expect(card.statusView.state).toBe("syncing");
  });
});

describe("createDataSource without a status row", () => {
  it("derives counters, last sync and status from the latest run", () => {
    const card = createDataSource({
      definition: CONNECTORS.GITHUB,
      status: null,
      connection: githubProjectSource,
      latestRun: run({
        status: "FAILED",
        failedCount: 2,
        failedItems: [{ artifactType: "FILE", reference: "a", reason: "b" }],
        ingestedCount: 3,
      }),
    });

    expect(card.errors).toBe(2);
    expect(card.failedItems).toHaveLength(1);
    expect(card.latestIngestedCount).toBe(3);
    expect(card.statusView.state).toBe("attention");
  });

  it("reports never-synced when there is neither a row nor a run", () => {
    const card = createDataSource({
      definition: CONNECTORS.UPLOAD,
      status: null,
      connection: { id: "u", name: "Uploads", type: "UPLOAD", status: "CONNECTED" },
    });

    expect(card.lastRunAt).toBeNull();
    expect(card.statusView.label).toBe("Not synced");
  });
});
