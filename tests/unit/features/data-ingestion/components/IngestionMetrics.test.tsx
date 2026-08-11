import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GitBranch, Database } from "lucide-react";
import { IngestionMetrics } from "../../../../../src/features/data-ingestion/components/IngestionMetrics";
import type { DataSource } from "../../../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";

function createMockSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    sourceId: "source-github",
    sourceSystem: "GITHUB",
    name: "GitHub Repository",
    type: "GitHub",
    icon: GitBranch,
    status: "connected",
    statusLabel: "Synced",
    ingestionStatus: "connected",
    ingestionStatusLabel: "Synced",
    statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
    artifacts: 10,
    lastSync: "2026-07-05",
    errors: 0,
    latestIngestedCount: 10,
    latestUpdatedCount: 3,
    totalArtifactCount: 10,
    deletedCount: 0,
    runIds: [],
    sharesSourceSystem: false,
    lastCommitsSyncAt: null,
    lastIssuesSyncAt: null,
    lastPullRequestsSyncAt: null,
    lastRunAt: "2026-07-05T10:00:00Z",
    failedItems: [],
    githubRepository: null,
    description: "Indexes repositories.",
    ...overrides,
  };
}

describe("IngestionMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders four metric cards", () => {
    const sources: DataSource[] = [createMockSource()];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("Synced Sources")).toBeInTheDocument();
    expect(screen.getByText("Latest Ingested")).toBeInTheDocument();
    expect(screen.getByText("Sync Errors")).toBeInTheDocument();
    expect(screen.getByText("Stale Artifacts")).toBeInTheDocument();
  });

  it("shows the correct synced sources ratio", () => {
    const sources: DataSource[] = [
      createMockSource({ sourceSystem: "GITHUB", lastRunAt: "2026-07-05T10:00:00Z" }),
      createMockSource({
        sourceSystem: "JIRA",
        icon: Database,
        lastRunAt: null,
      }),
    ];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("sums the latest ingested counts across all sources", () => {
    const sources: DataSource[] = [
      createMockSource({ sourceSystem: "GITHUB", latestIngestedCount: 10 }),
      createMockSource({
        sourceSystem: "JIRA",
        icon: Database,
        latestIngestedCount: 5,
      }),
    ];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("sums the errors across all sources", () => {
    const sources: DataSource[] = [
      createMockSource({ sourceSystem: "GITHUB", errors: 2 }),
      createMockSource({ sourceSystem: "JIRA", icon: Database, errors: 3 }),
    ];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("always renders N/A for stale artifacts", () => {
    const sources: DataSource[] = [createMockSource()];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders subtitles for each metric card", () => {
    const sources: DataSource[] = [createMockSource()];

    render(<IngestionMetrics sources={sources} />);

    expect(screen.getByText("sources with at least one ingestion run")).toBeInTheDocument();
    expect(screen.getByText("from latest source statuses")).toBeInTheDocument();
    expect(screen.getByText("failed items from latest statuses")).toBeInTheDocument();
    expect(screen.getByText("not provided by current service")).toBeInTheDocument();
  });

  it("handles an empty sources array", () => {
    render(<IngestionMetrics sources={[]} />);

    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBe(2);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
