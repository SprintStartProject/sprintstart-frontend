import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { TeamManagementPage } from "../../../src/pages/TeamManagementPage";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "project-1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "project-1",
        canManageSelected: true,
      }),
  };
});

vi.mock("../../../src/features/onboarding-metrics/hooks/useAttention", () => ({
  useAttention: () => ({ attention: null, isLoading: false, error: null, reload: vi.fn() }),
}));

describe("TeamManagementPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("combobox", { name: "Filter team members by role" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort team members" })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
