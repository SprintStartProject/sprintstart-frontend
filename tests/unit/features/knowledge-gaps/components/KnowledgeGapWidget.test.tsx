import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeGapWidget } from "../../../../../src/features/knowledge-gaps/components/KnowledgeGapWidget";
import type { KnowledgeGapOverview } from "../../../../../src/features/knowledge-gaps/types";
import { MemoryRouter } from "react-router-dom";

const mockOverview: KnowledgeGapOverview = {
  gaps: [
    {
      id: "gap1",
      component: "Auth Service",
      missingTypes: ["README", "API Docs"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity: "high",
    },
    {
      id: "gap2",
      component: "API Gateway",
      missingTypes: ["Schema"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity: "medium",
    },
  ],
};

vi.mock("../../../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { fetchKnowledgeGaps: vi.fn() },
}));

import { useLiveFetch } from "../../../../../src/hooks/useLiveFetch";

vi.mocked(useLiveFetch).mockReturnValue({ data: mockOverview, loading: false, revalidating: false, error: false, refresh: () => {} });

function renderWidget() {
  return render(
    <MemoryRouter>
      <KnowledgeGapWidget />
    </MemoryRouter>,
  );
}

describe("KnowledgeGapWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveFetch).mockReturnValue({ data: mockOverview, loading: false, revalidating: false, error: false, refresh: () => {} });
  });

  it('renders the widget header with "Knowledge gaps"', () => {
    renderWidget();
    expect(screen.getByText("Knowledge gaps")).toBeInTheDocument();
  });

  it("renders the gap cards sorted by severity", () => {
    renderWidget();
    expect(screen.getByText("Auth Service")).toBeInTheDocument();
    expect(screen.getByText("API Gateway")).toBeInTheDocument();
  });

  it('shows the "See all" link with total count', () => {
    renderWidget();
    expect(screen.getByText(/See all \(2\)/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ data: null, loading: true, revalidating: false, error: false, refresh: () => {} });
    const { container } = renderWidget();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the empty/refresh state on error", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ data: null, loading: false, revalidating: false, error: true, refresh: () => {} });
    renderWidget();
    expect(
      screen.getByText("No knowledge gaps yet. Trigger a scan to detect them."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rescan/i })).toBeInTheDocument();
  });

  it("shows the empty/refresh state when there are no gaps", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ data: { gaps: [] }, loading: false, revalidating: false, error: false, refresh: () => {} });
    renderWidget();
    expect(
      screen.getByText("No knowledge gaps yet. Trigger a scan to detect them."),
    ).toBeInTheDocument();
  });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
vi.mock("../../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});
