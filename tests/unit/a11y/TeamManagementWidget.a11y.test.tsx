import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { TeamManagementWidget } from "../../../src/features/team-management/components/TeamManagementWidget";

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="32" height="32" />,
}));

vi.mock("../../../src/services/teamManagementService", () => ({
  getTeamOverview: vi.fn().mockResolvedValue([
    {
      userId: "u1",
      firstname: "Alice",
      lastname: "Smith",
      roles: [{ id: "r1", name: "Developer", description: "" }],
      skills: [],
      progressPercentage: 0.5,
      projects: [{ id: "p1", name: "SprintStart" }],
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: {
        id: "s1",
        title: "Setup environment",
        startedAt: "2026-07-01T00:00:00.000Z",
        skip: null,
      },
      hasFeedback: false,
    },
    {
      userId: "u2",
      firstname: "Bob",
      lastname: "Jones",
      roles: [],
      skills: [],
      progressPercentage: 0.2,
      projects: [{ id: "p1", name: "SprintStart" }],
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: null,
      hasFeedback: true,
    },
  ]),
}));

describe("TeamManagementWidget Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <TeamManagementWidget />
        </main>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
