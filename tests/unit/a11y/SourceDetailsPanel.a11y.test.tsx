import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { BitbucketIcon } from "../../../src/components/icons/BitbucketIcon";
import { SourceDetailsPanel } from "../../../src/features/data-ingestion/components/SourceDetailsPanel";
import type { DataSource } from "../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../src/features/data-ingestion/data";

vi.mock("../../../src/services/ingestionService", () => ({
  getIngestionRuns: vi.fn().mockResolvedValue([]),
  getIngestionStatus: vi.fn().mockResolvedValue([]),
}));

const source: DataSource = {
  sourceId: "source-github",
  sourceSystem: "GITHUB",
  name: "GitHub Repository",
  type: "GitHub",
  status: "connected",
  statusLabel: "Connected",
  ingestionStatus: "connected",
  ingestionStatusLabel: "Synced",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 42,
  lastSync: "2026-07-01",
  errors: 0,
  latestIngestedCount: 10,
  latestUpdatedCount: 5,
  totalArtifactCount: 42,
  deletedCount: 0,
  runIds: [],
  sharesSourceSystem: false,
  lastCommitsSyncAt: null,
  lastIssuesSyncAt: null,
  lastPullRequestsSyncAt: null,
  lastRunAt: "2026-07-01T00:00:00.000Z",
  icon: GitBranch,
  failedItems: [],
  githubRepository: null,
  description: "Indexes repositories.",
};

describe("SourceDetailsPanel Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <SourceDetailsPanel source={source} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no a11y violations for a Bitbucket repository with all actions", async () => {
    const bitbucketRepository = {
      repositoryId: "bb-repo-1",
      workspace: "acme",
      slug: "widgets",
      fullName: "acme/widgets",
      url: "https://bitbucket.org/acme/widgets",
      enabled: true,
    };
    const bitbucketSource: DataSource = {
      ...source,
      sourceId: "bb-repo-1",
      sourceSystem: "BITBUCKET",
      name: "acme/widgets",
      type: "Bitbucket",
      icon: BitbucketIcon,
      lastPullRequestsSyncAt: "2026-07-01T00:00:00.000Z",
      bitbucketRepository,
    };

    const { baseElement } = render(
      <MemoryRouter>
        <SourceDetailsPanel
          source={bitbucketSource}
          canManageSyncSettings
          onUpdateSource={vi.fn().mockResolvedValue(undefined)}
          onLoadBitbucketConfig={vi.fn().mockResolvedValue({
            autoUpdate: true,
            spec: { type: "INTERVAL", everyMinutes: 30 },
            nextSyncAt: null,
          })}
          onSaveBitbucketConfig={vi.fn().mockResolvedValue(undefined)}
          onSetBitbucketSourceEnabled={vi.fn().mockResolvedValue(undefined)}
          onUnlinkSource={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("acme/widgets").length).toBeGreaterThan(0);
    });
    await screen.findByLabelText("Minutes");

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
