import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { SourceList } from "../../../src/features/data-ingestion/components/SourceList";
import { GitBranch } from "lucide-react";
import type { DataSource } from "../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../src/features/data-ingestion/data";

const sources: DataSource[] = [
  {
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
    description: "Indexes repositories and source files.",
    failedItems: [],
    githubRepository: null,
  },
];

describe("SourceList Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <SourceList sources={sources} selectedSourceId={null} onSelectSource={vi.fn()} />
        </main>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /GitHub Repository/ })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
