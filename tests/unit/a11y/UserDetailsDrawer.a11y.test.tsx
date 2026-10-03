import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { UserDetailsDrawer } from "../../../src/features/admin/components/UserDetailsDrawer";
import type { AdminUser, ProjectOverview } from "../../../src/features/admin/types";

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="64" height="64" />,
}));

vi.mock("../../../src/services/adminUserService", () => ({
  adminUserService: {
    updateUser: vi.fn().mockResolvedValue({
      id: "u1",
      username: "asmith",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      roles: [],
      permissionGroup: "Admin",
      projects: [],
      enabled: true,
      profileIcon: "",
      hasCompletedOnboarding: true,
    }),
    updateUserEnabled: vi.fn().mockResolvedValue({
      id: "u1",
      username: "asmith",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      roles: [],
      permissionGroup: "Admin",
      projects: [],
      enabled: true,
      profileIcon: "",
      hasCompletedOnboarding: true,
    }),
  },
}));

vi.mock("../../../src/services/teamManagementService", () => ({
  getProjectRoles: vi.fn().mockResolvedValue([{ id: "r1", name: "Developer", description: "" }]),
  assignProjectRoleToUser: vi.fn().mockResolvedValue(undefined),
  unassignProjectRoleFromUser: vi.fn().mockResolvedValue(undefined),
}));

const user: AdminUser = {
  id: "u1",
  username: "asmith",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Smith",
  roles: [{ id: "r1", name: "Developer", description: "", type: "primary" }],
  permissionGroup: "Admin",
  projects: [{ id: "p1", name: "SprintStart" }],
  projectIds: ["p1"],
  enabled: true,
  profileIcon: "",
  hasCompletedOnboarding: true,
};

const overview = (id: string, name: string): ProjectOverview => ({
  id,
  name,
  description: "",
  manager: null,
  sources: [],
  users: [],
  industry: "",
  industryConfidence: null,
  industryCustom: false,
});

const projects: ProjectOverview[] = [overview("p1", "SprintStart"), overview("p2", "Backend")];

describe("UserDetailsDrawer Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <UserDetailsDrawer
          user={user}
          projects={projects}
          isOpen={true}
          onClose={vi.fn()}
          onOpenProjectDetails={vi.fn()}
          onUserUpdated={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Edit User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Alice Smith" })).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("should not have any a11y violations while the move confirmation is open", async () => {
    const actor = userEvent.setup();
    const { baseElement } = render(
      <MemoryRouter>
        <UserDetailsDrawer
          user={{ ...user, permissionGroup: "User" }}
          projects={projects}
          isOpen={true}
          onClose={vi.fn()}
          onOpenProjectDetails={vi.fn()}
          onUserUpdated={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    await actor.click(screen.getByRole("button", { name: /Move to another project/i }));
    await actor.click(screen.getByText("Backend"));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("removed from SprintStart");
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
