import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ProjectDetailsDrawer } from "../../../src/features/admin/components/ProjectDetailsDrawer";
import type { ProjectOverview } from "../../../src/features/admin/types";

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    getProjectById: vi.fn().mockResolvedValue({
      id: "p1",
      name: "SprintStart",
      description: "Main application",
      manager: null,
      tags: [],
      sources: [{ id: "s1", name: "GitHub", type: "GITHUB", status: "CONNECTED" }],
      users: [
        {
          id: "u1",
          username: "asmith",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          roles: ["ADMIN"],
          projectRoles: ["MEMBER"],
          enabled: true,
        },
      ],
    }),
  },
}));

const project: ProjectOverview = {
  id: "p1",
  name: "SprintStart",
  description: "Main application",
  manager: null,
  sources: [],
  users: [],
};

describe("ProjectDetailsDrawer Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <ProjectDetailsDrawer project={project} isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("SprintStart")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
