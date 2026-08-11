import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PmDashboardPage } from "../../../src/pages/PmDashboardPage";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
      }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user1", firstName: "Test", lastName: "User" } }),
}));

vi.mock("../../../src/features/team-management/components/TeamManagementWidget", () => ({
  TeamManagementWidget: () => <div data-testid="team-management-widget">Team Management</div>,
}));

vi.mock("../../../src/features/faq/components/FaqWidget", () => ({
  FaqWidget: () => <div data-testid="faq-widget">FAQ</div>,
}));

vi.mock("../../../src/features/knowledge-gaps/components/KnowledgeGapWidget", () => ({
  KnowledgeGapWidget: () => <div data-testid="knowledge-gap-widget">Knowledge Gaps</div>,
}));

describe("PmDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header with title and subtitle", () => {
    render(
      <MemoryRouter>
        <PmDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("PM Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Track team onboarding/)).toBeInTheDocument();
  });

  it("composes the TeamManagementWidget", () => {
    render(
      <MemoryRouter>
        <PmDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("team-management-widget")).toBeInTheDocument();
  });

  it("composes the FaqWidget in the Insights section", () => {
    render(
      <MemoryRouter>
        <PmDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("faq-widget")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
  });

  it("composes the KnowledgeGapWidget in the Insights section", () => {
    render(
      <MemoryRouter>
        <PmDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("knowledge-gap-widget")).toBeInTheDocument();
  });
});
