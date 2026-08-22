import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { BuddyPage } from "../../../src/pages/BuddyPage";

vi.mock("../../../src/services/buddyService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  streamMessage: vi.fn(),
  performAction: vi.fn(),
  // The chips come from the backend now, gated on the tools mounted for this hire — the page
  // holds no list of its own.
  getSuggestions: vi
    .fn()
    .mockResolvedValue([
      { label: "What should I work on?", question: "What should I work on next?" },
    ]),
}));

vi.mock("../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchMyTimeline: vi.fn().mockRejectedValue(new Error("no metrics")),
  },
}));

const projectState = { selectedProjectId: "p1" };

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: projectState.selectedProjectId,
        projects: projectState.selectedProjectId
          ? [createSelectableProject({ id: "p1", name: "Project One" })]
          : [],
        selectedProject: projectState.selectedProjectId
          ? createSelectableProject({ id: "p1", name: "Project One" })
          : null,
      }),
  };
});

describe("BuddyPage Accessibility", () => {
  afterEach(() => {
    // The no-project test below overrides this per-file default; reset it so later tests in
    // this file don't inherit an empty project.
    projectState.selectedProjectId = "p1";
  });

  it("has no violations in the no-project state", async () => {
    projectState.selectedProjectId = "";

    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <BuddyPage />
        </main>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/not on a project yet/)).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations in mentor mode", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <BuddyPage />
        </main>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("What should I work on?")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
