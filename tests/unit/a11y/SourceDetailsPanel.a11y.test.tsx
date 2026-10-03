import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { SourceDetailsPanel } from "../../../src/features/data-ingestion/components/SourceDetailsPanel";
import type { DataSource } from "../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../src/features/data-ingestion/data";

vi.mock("../../../src/services/ingestionService", () => ({
  getIngestionStatus: vi.fn().mockResolvedValue([]),
}));

const source: DataSource = {
  sourceId: "source-github",
  sourceSystem: "GITHUB",
  name: "GitHub Repository",
  type: "GitHub",
  status: "connected",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 42,
  lastSync: "2026-07-01",
  errors: 0,
  latestIngestedCount: 10,
  latestUpdatedCount: 5,
  totalArtifactCount: 42,
  deletedCount: 0,
  sharesSourceSystem: false,
  lastRunAt: "2026-07-01T00:00:00.000Z",
  icon: GitBranch,
  failedItems: [],
  details: {
    system: "GITHUB",
    repository: null,
    syncTimes: { commits: null, issues: null, pullRequests: null },
  },
  description: "Indexes repositories.",
};

describe("SourceDetailsPanel Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <SourceDetailsPanel
          source={source}
          projectId="p1"
          canManage
          canUnlink
          onChanged={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
