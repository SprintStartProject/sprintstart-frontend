import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { KnowledgeGapsDetailPage } from "../../../../../src/features/knowledge-gaps/components/KnowledgeGapsDetailPage";
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

const createGap = (component: string): KnowledgeGap => ({
  id: "gap1",
  component,
  missingTypes: ["README"],
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-10T00:00:00Z",
  owners: [],
  severity: "high",
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/insights/knowledge-gaps/gap1"]}>
      <Routes>
        <Route path="/insights/knowledge-gaps/:gapId" element={<KnowledgeGapsDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("KnowledgeGapsDetailPage", () => {
  beforeEach(() => {
    mocks.fetchKnowledgeGap.mockReset();
    mocks.fetchKnowledgeGap.mockResolvedValue(createGap("Auth Service"));
    mocks.getTeamOverview.mockResolvedValue([]);
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "project-a" });
  });

  it("loads the gap for the selected project", async () => {
    renderPage();

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-a", "gap1"));
    expect(await screen.findByText("Auth Service")).toBeInTheDocument();
  });

  /**
   * The header's project switcher is reachable from this page. Without the
   * project among the fetch's dependencies the old project's gap stayed on
   * screen under the new project's name — and the owner control writes to
   * whichever project the context now names, so the two must not diverge.
   */
  it("refetches when the project is switched underneath it", async () => {
    const { rerender } = renderPage();

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-a", "gap1"));

    mocks.fetchKnowledgeGap.mockResolvedValue(createGap("Billing Service"));
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "project-b" });

    rerender(
      <MemoryRouter initialEntries={["/insights/knowledge-gaps/gap1"]}>
        <Routes>
          <Route path="/insights/knowledge-gaps/:gapId" element={<KnowledgeGapsDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.fetchKnowledgeGap).toHaveBeenCalledWith("project-b", "gap1"));
    expect(await screen.findByText("Billing Service")).toBeInTheDocument();
  });
});
