import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../../src/pages/DashboardPage";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      firstName: "Test",
      username: "Test",
      email: "test@test.com",
      projectRoles: [],
      projectIds: [],
      hasCompletedOnboarding: false,
    },
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProject: { id: "1", name: "Test Project" },
    canManageSelected: false,
    isLoading: false,
  }),
}));

vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({ celebrate: vi.fn(), flyby: vi.fn(), showRocketPet: false }),
}));

describe("DashboardPage", () => {
  it("renders the dashboard with widgets", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });
});
