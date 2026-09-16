import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeGapPanel } from "../../../../../src/features/knowledge-gaps/components/KnowledgeGapPanel";
import type { KnowledgeGap } from "../../../../../src/features/knowledge-gaps/types";
import type { ProjectContextValue } from "../../../../../src/features/projects/ProjectContext";
import { createProjectContextValue } from "../../../setup/projectContext";

const { mocks } = vi.hoisted(() => {
  const mocks: {
    projectContext: ProjectContextValue | null;
    fetchKnowledgeGap: ReturnType<typeof vi.fn>;
    getTeamOverview: ReturnType<typeof vi.fn>;
  } = {
    projectContext: null,
    fetchKnowledgeGap: vi.fn(),
    getTeamOverview: vi.fn(),
  };

  return { mocks };
});

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGap: mocks.fetchKnowledgeGap,
    setComponentOwners: vi.fn(),
  },
}));

vi.mock("../../../../../src/services/teamManagementService", () => ({
  getTeamOverview: mocks.getTeamOverview,
}));

const createGap = (component: string, missing: string): KnowledgeGap => ({
  id: "gap1",
  component,
  missingTypes: [missing],
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-10T00:00:00Z",
  owners: [],
  severity: "high",
});

const panel = () => (
  <MemoryRouter>
    <KnowledgeGapPanel gapId="gap1" gap={null} onClose={vi.fn()} />
  </MemoryRouter>
);

const renderPanel = () => render(panel());

describe("KnowledgeGapPanel", () => {
  beforeEach(() => {
    mocks.fetchKnowledgeGap.mockReset();
    mocks.fetchKnowledgeGap.mockResolvedValue(createGap("Auth Service", "README"));
    mocks.getTeamOverview.mockResolvedValue([]);
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "project-a" });
  });

  it("loads the gap for the selected project", async () => {
    renderPanel();

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-a", "gap1"));
    expect(await screen.findByText("README")).toBeInTheDocument();
  });

  /**
   * The sidebar's project switcher is reachable while the panel is open. Without the
   * project among the fetch's dependencies the old project's gap stayed on
   * screen under the new project's name — and the owner control writes to
   * whichever project the context now names, so the two must not diverge.
   */
  it("refetches when the project is switched underneath it", async () => {
    const { rerender } = renderPanel();

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-a", "gap1"));

    mocks.fetchKnowledgeGap.mockResolvedValue(createGap("Billing Service", "ADR"));
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "project-b" });

    rerender(panel());

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-b", "gap1"));
    expect(await screen.findByText("ADR")).toBeInTheDocument();
  });
});
