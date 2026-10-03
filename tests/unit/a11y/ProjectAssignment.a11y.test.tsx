import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { MultiProjectAssignment } from "../../../src/features/admin/components/MultiProjectAssignment";
import { SingleProjectAssignment } from "../../../src/features/admin/components/SingleProjectAssignment";
import type { AdminUser, ProjectOverview } from "../../../src/features/admin/types";

const overview = (id: string, name: string, managerId?: string): ProjectOverview => ({
  id,
  name,
  description: `${name} description`,
  manager: managerId
    ? { id: managerId, username: "boss", email: "", firstName: "Bea", lastName: "Boss" }
    : null,
  sources: [],
  users: [],
  industry: "Fintech",
  industryConfidence: null,
  industryCustom: false,
});

const projects = [
  overview("p1", "SprintStart", "u1"),
  overview("p2", "Backend"),
  overview("p3", "AI"),
];

const user: AdminUser = {
  id: "u1",
  username: "asmith",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Smith",
  roles: [],
  permissionGroup: "User",
  projects: [{ id: "p2", name: "Backend" }],
  projectIds: ["p2"],
  enabled: true,
  profileIcon: "",
  hasCompletedOnboarding: true,
};

const baseProps = {
  allProjects: projects,
  usersById: new Map<string, AdminUser>(),
  onOpenProjectDetails: vi.fn(),
  onAssignProject: vi.fn().mockResolvedValue(undefined),
  onRemoveProject: vi.fn().mockResolvedValue(undefined),
};

describe("Project assignment accessibility", () => {
  it("has no violations for a regular user's single project", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <SingleProjectAssignment
            {...baseProps}
            user={user}
            assignedProjects={[{ id: "p2", name: "Backend", overview: projects[1] }]}
          />
        </main>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Open Backend project details" }),
    ).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations for a regular user without a project", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <SingleProjectAssignment {...baseProps} user={user} assignedProjects={[]} />
        </main>
      </MemoryRouter>,
    );

    expect(screen.getByText("Not assigned to a project")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations for a project manager, including the open picker", async () => {
    const actor = userEvent.setup();
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <MultiProjectAssignment
            {...baseProps}
            user={{ ...user, permissionGroup: "Project Manager" }}
            isAdmin={false}
            assignedProjects={[{ id: "p2", name: "Backend", overview: projects[1] }]}
          />
        </main>
      </MemoryRouter>,
    );

    await actor.click(screen.getByRole("button", { name: /Add project/i }));

    expect(screen.getByRole("textbox", { name: "Search projects" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
