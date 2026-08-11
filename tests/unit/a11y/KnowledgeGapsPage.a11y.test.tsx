import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeGapsPage } from "../../../src/features/knowledge-gaps/components/KnowledgeGapsPage";

vi.mock("../../../src/hooks/useFetch", () => ({
  useFetch: () => ({
    data: {
      gaps: [
        {
          id: "gap1",
          component: "AuthService",
          missingTypes: ["API", "Guide"],
          lastIngested: "2026-07-01T00:00:00.000Z",
          refreshedAt: "2026-07-01T00:00:00.000Z",
          owners: [],
          severity: "high",
        },
        {
          id: "gap2",
          component: "OnboardingFlow",
          missingTypes: ["README"],
          lastIngested: "2026-07-02T00:00:00.000Z",
          refreshedAt: "2026-07-02T00:00:00.000Z",
          owners: [],
          severity: "low",
        },
      ],
    },
    loading: false,
    error: false,
  }),
}));

vi.mock("../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGaps: vi.fn(),
  },
}));

describe("KnowledgeGapsPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <KnowledgeGapsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("AuthService")).toBeInTheDocument();
    });

    expect(screen.getByRole("group", { name: "Filter gaps by severity" })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
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
      }),
  };
});
