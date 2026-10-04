import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  githubRepositoryOf,
  jiraInstanceOf,
} from "../../../../src/features/data-ingestion/sourceDetails";
import { fetchIngestionSources } from "../../../../src/features/data-ingestion/ingestionSources";
import type { SourceInstanceIngestionStatus } from "../../../../src/features/data-ingestion/types";

const { mockGetIngestionSourceStatuses } = vi.hoisted(() => ({
  mockGetIngestionSourceStatuses: vi.fn(),
}));

vi.mock("../../../../src/services/ingestionService", () => ({
  getIngestionSourceStatuses: mockGetIngestionSourceStatuses,
}));

function row(overrides: Partial<SourceInstanceIngestionStatus>): SourceInstanceIngestionStatus {
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
  };
}

describe("fetchIngestionSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes the status rows to the project and maps each row by its source system", async () => {
    mockGetIngestionSourceStatuses.mockResolvedValue([
      row({}),
      row({
        sourceSystem: "JIRA",
        sourceId: "https://acme.atlassian.net",
        displayName: "Team board",
        repositoryId: null,
        owner: null,
        name: null,
      }),
      row({ sourceSystem: "UPLOAD", sourceId: "uploads", displayName: "Uploads" }),
    ]);

    const sources = await fetchIngestionSources("proj1");

    expect(mockGetIngestionSourceStatuses).toHaveBeenCalledWith("proj1");
    expect(sources.map((source) => source.sourceSystem)).toEqual(["GITHUB", "JIRA", "UPLOAD"]);
    expect(sources.map((source) => source.details.system)).toEqual(["GITHUB", "JIRA", "UPLOAD"]);
    expect(githubRepositoryOf(sources[0])?.fullName).toBe("acme/monorepo");
    expect(githubRepositoryOf(sources[1])).toBeNull();
    expect(jiraInstanceOf(sources[1])?.instanceUrl).toBe("https://acme.atlassian.net");
  });
});
