import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "../../../src/pages/AdminPage";
import type { AdminUser } from "../../../src/services/adminUserService";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue } = await import("../setup/projectContext");
  return { useProjectContext: () => createProjectContextValue() };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "admin1", firstName: "Admin", lastName: "User" } }),
}));

vi.mock("../../../src/services/adminUserService", () => ({
  adminUserService: {
    getUsers: vi.fn().mockResolvedValue([
      {
        id: "1",
        username: "user1",
        email: "user1@example.com",
        firstName: "John",
        lastName: "Doe",
        roles: [],
        permissionGroup: "User",
        projects: [],
        projectIds: [],
        enabled: true,
        profileIcon: "",
        hasCompletedOnboarding: true,
      } as AdminUser,
    ]),
    deleteUser: vi.fn().mockResolvedValue({ id: "1", deleted: true }),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    updateUserRoles: vi.fn(),
    updateUserEnabled: vi.fn(),
    getCurrentUser: vi.fn(),
    getAvailableRolesFromUsers: vi.fn(),
  },
}));

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    getProjects: vi.fn().mockResolvedValue([]),
    getProjectById: vi.fn(),
    getProjectUsers: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    assignUsersToProject: vi.fn(),
    removeUserFromProject: vi.fn(),
    resetProjectMocks: vi.fn(),
  },
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn().mockResolvedValue(["token1"]),
}));

vi.mock("../../../src/features/admin/components/UsersTab", () => ({
  UsersTab: () => <div data-testid="users-tab">Users</div>,
}));

vi.mock("../../../src/features/admin/components/ProjectsTab", () => ({
  ProjectsTab: () => <div data-testid="projects-tab">Projects</div>,
}));

vi.mock("../../../src/features/admin/components/TokensTab", () => ({
  TokensTab: () => <div data-testid="tokens-tab">Tokens</div>,
}));

vi.mock("../../../src/features/admin/components/UserDetailsDrawer", () => ({
  UserDetailsDrawer: () => <div data-testid="user-details-drawer">User Details</div>,
}));

vi.mock("../../../src/features/admin/components/ProjectDetailsDrawer", () => ({
  ProjectDetailsDrawer: () => <div data-testid="project-details-drawer">Project Details</div>,
}));

describe("AdminPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
