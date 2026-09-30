import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ProjectDetailsDrawer } from "../../../src/features/admin/components/ProjectDetailsDrawer";
import type { AdminUser, ProjectOverview } from "../../../src/features/admin/types";

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    getProjectById: vi.fn().mockResolvedValue({
      id: "p1",
      name: "SprintStart",
      description: "Main application",
      manager: null,
      tags: [],
      industry: "",
      industryConfidence: null,
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
  industry: "",
  industryConfidence: null,
  industryCustom: false,
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

  it("should not have any a11y violations with a staged move and its confirmation", async () => {
    const actor = userEvent.setup();
    const movingUser: AdminUser = {
      id: "u2",
      username: "jsmith",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Smith",
      roles: [],
      permissionGroup: "User",
      projects: [{ id: "p-other", name: "Other Project" }],
      projectIds: ["p-other"],
      enabled: true,
      profileIcon: "",
      hasCompletedOnboarding: false,
    };

    const { baseElement } = render(
      <MemoryRouter>
        <ProjectDetailsDrawer
          project={project}
          availableUsers={[movingUser]}
          isOpen={true}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await screen.findByText("Alice Smith");
    // The search field can be re-created while the details settle, which drops
    // typed text, so type until the value sticks.
    await waitFor(async () => {
      const search = screen.getByLabelText("Search or add people");
      await actor.clear(search);
      await actor.type(search, "jane");
      expect(search).toHaveValue("jane");
    });
    await actor.click(await screen.findByText("Jane Smith"));

    expect(screen.getByText("Will be moved from Other Project")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await actor.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Jane Smith");
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
