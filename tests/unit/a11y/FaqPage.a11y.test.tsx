import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { FaqPage } from "../../../src/features/faq/components/FaqPage";

vi.mock("../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: () => ({
    data: {
      groups: [
        {
          groupId: "g1",
          count: 5,
          question: "How do I reset my password?",
          topDocuments: [{ id: "d1", title: "Password Guide" }],
        },
        {
          groupId: "g2",
          count: 3,
          question: "How do I invite a teammate?",
          topDocuments: [{ id: "d2", title: "Team Guide" }],
        },
      ],
    },
    loading: false,
    revalidating: false,
    error: false,
    refresh: () => {},
  }),
}));

vi.mock("../../../src/services/faqService", () => ({
  insightsService: {
    fetchFAQGroups: vi.fn(),
  },
}));

describe("FaqPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("How do I reset my password?")).toBeInTheDocument();
    });

    expect(screen.getByText("How do I invite a teammate?")).toBeInTheDocument();

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
